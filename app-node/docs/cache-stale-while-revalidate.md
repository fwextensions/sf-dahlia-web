# Design: stale-while-revalidate for `CacheService`

Status: proposed
Owner: TBD
Related: `src/lib/cache/cache-service.ts`, `src/lib/listings/server-fns.ts`, [listing nav perf work](../../app-node) (commits `2dac9b0d5`, AMI per-chart cache)

## Problem

Listing data is cached in Redis (detail/units/preferences for 1 day, AMI for 1
day and now shared per `(year,type,percent)`). When a cache entry is **warm**,
listing pages load in single-digit milliseconds. The remaining pain is the
**cold/expired** path: when a key's TTL has elapsed, the next request blocks on
the full Salesforce round-trip through Rails — measured at **~4s** for the AMI
charts on a listing detail page, and similar order for the directory/detail
fetches.

Today that cost is paid by a *user*: the first request after expiry waits for
the upstream fetch before the page (or the streamed section) resolves. Because
the TTL is fixed, this recurs every time an entry lapses, not just once.

## Goal

Stop serving the latency of an expired entry to users. When data exists but is
stale, return it **immediately** and refresh it in the **background**, so only
the very first ever fetch of a key (no data at all) blocks.

### Non-goals

- Pre-rendering or HTTP/CDN caching of rendered HTML (separate, larger decision).
- Eliminating the first-ever cold fetch for a brand-new key. (That's the job of
  an optional scheduled warm job — complementary, see "Interaction" below.)
- Changing TTL values or cache keys.

## Background: what exists today

`CacheService` already maintains two copies of every cached value
(`src/lib/cache/cache-service.ts`):

- **Live key** `<key>` — written with `EX <ttl>`, so it disappears at TTL.
- **Stale key** `stale:<key>` — written with **no expiry**, intended as a
  fallback.

`set()` writes both. `cachedGet()` currently:

1. If not `force`, read the **live** key; on hit, return it.
2. Otherwise call `fetchFn()`; on 2xx, `set()` (refreshing both copies); return.
3. On fetch **error**, read the **stale** copy via `getStale()`; return it if
   present, else rethrow.

So the never-expiring `stale:` copy is only consulted when a fetch *fails*. On a
normal TTL expiry the code goes straight to the blocking `fetchFn()`. The SWR
change makes the expiry path use that stale copy too — proactively — instead of
only on error.

## Proposed behavior

New `cachedGet` control flow (additive; the `force` and first-ever paths are
unchanged):

```
cachedGet(endpoint, params, force, fetchFn, ttlOverride?, { swr = true } = {}):
  key = generateCacheKey(endpoint, params)
  ttl = ttlOverride ?? resolveTtl(endpoint, params)

  if not force:
    live = get(key)
    if live != null: return live                      # warm hit — unchanged

    if swr:
      stale = getStale(key)
      if stale != null:
        revalidateInBackground(key, ttl, fetchFn)      # fire-and-forget, deduped
        return stale                                   # instant, possibly stale

  # cold (no data at all) or force: block on the fetch — unchanged
  return fetchAndStore(key, ttl, fetchFn)              # existing try/catch logic
```

Where:

- `fetchAndStore` is the current step 2/3 body (fetch → store on 2xx → return;
  on error fall back to `getStale`, else throw). Extracted so both the
  foreground path and the background revalidation reuse it.
- `revalidateInBackground` calls `fetchAndStore` **without awaiting**, swallows
  errors (a failed background refresh just leaves the existing copies in place),
  and is **deduplicated** per key (see below).

### Stampede / dedup

Without protection, N concurrent requests to a just-expired key would each kick
off a refresh. Guard with an in-process in-flight set:

```ts
private inflight = new Set<string>()

private revalidateInBackground(key, ttl, fetchFn) {
  if (this.inflight.has(key)) return
  this.inflight.add(key)
  void this.fetchAndStore(key, ttl, fetchFn)
    .catch(() => {})                      // background failure is non-fatal
    .finally(() => this.inflight.delete(key))
}
```

In-process dedup is sufficient for the single web dyno today. If the web tier is
ever scaled to multiple dynos, add a short Redis lock (`SET lock:<key> 1 NX PX
30000`) so only one dyno revalidates; the others skip. Note this only affects
*how many* refreshes fire, never correctness — duplicates would just be wasted
upstream calls.

### Why background work is safe here

`revalidateInBackground` resolves *after* the HTTP response is already sent. That
is safe because the web tier is a **long-lived Node server** (`serve.mjs` /
Heroku web dyno) — the process keeps running, so the detached promise completes.

> ⚠️ This pattern would **not** be safe on a serverless/Lambda host, where the
> runtime can freeze or kill the instance once the response is returned. If the
> app is ever moved behind such a host, gate `swr` off there (or move
> revalidation into the BullMQ worker). Document this assumption at the call
> site.

## API change

```ts
async cachedGet<T>(
  endpoint: string,
  params: Record<string, string> | undefined,
  force: boolean,
  fetchFn: FetchFn<T>,
  ttlOverride?: number,
  options?: { swr?: boolean },   // NEW — defaults to { swr: true }
): Promise<T>
```

- Default `swr: true` so all existing callers (listing detail, units,
  preferences, AMI, directory) get SWR with no change.
- Callers that must never serve stale data (none identified today; candidates
  would be anything write-after-read or correctness-critical) can pass
  `{ swr: false }` to keep the strict blocking behavior.
- `force: true` still bypasses both read paths and fetches fresh — unchanged.

No change to `set`, `get`, `getStale`, `generateCacheKey`, `resolveTtl`, or the
cache keys/TTLs.

## Edge cases

| Case | Behavior |
|---|---|
| Warm live hit | Return live. No revalidation. (unchanged) |
| Live miss, stale present | Return stale instantly + background refresh (deduped). |
| Live miss, no stale (first ever) | Block on fetch. (unchanged) |
| `force: true` | Block on fetch, refresh both copies. (unchanged) |
| Background fetch fails | Swallowed; existing live/stale copies remain; next request retries. |
| Foreground fetch fails, stale exists | Return stale (unchanged error fallback). |
| Non-2xx response | Not stored (unchanged); foreground returns the body, background discards. |
| Redis down | `get`/`getStale` return null → behaves as cold → blocking fetch (unchanged graceful degradation). |
| `swr: false` | Skip the stale read entirely → strict TTL semantics. |

### Staleness bound

With SWR, a served value can be **up to one refresh cycle old**: it's whatever
was last successfully stored. In the worst case (a key viewed exactly once, then
not again for a long time, then viewed) the user sees data as old as the gap
since the last view, then the page updates on the *next* load. For listing data
(deadlines are fixed; statuses/lottery results change on the order of
hours/days) this is acceptable. If a specific field needs tighter freshness,
either lower that endpoint's TTL or use `{ swr: false }` for it.

The optional scheduled **warm job** bounds staleness globally: by refreshing the
catalog every N hours it keeps the `stale:` copies SWR serves from drifting.

## Observability

- Log (debug level / counter) on each branch: `live-hit`, `swr-stale`,
  `cold-fetch`, `revalidate-start`, `revalidate-fail`. The ratio of
  `swr-stale : cold-fetch` shows how often SWR is saving a user-facing wait.
- Optionally stamp `set()` values with a `cachedAt` timestamp (or store a
  sibling `meta:<key>`) so logs/headers can report age. Not required for v1.

## Testing

Extend `src/lib/cache/cache-service.test.ts` (in-memory Redis mock already
present):

1. Live hit → returns live, `fetchFn` not called.
2. Live expired + stale present → returns stale synchronously; `fetchFn` is
   called exactly once (await a tick); live key repopulated afterward.
3. Concurrent expired reads → `fetchFn` called once (dedup).
4. No stale (first ever) → blocks on `fetchFn`, stores both copies.
5. Background fetch rejects → the original stale value was still returned; no
   throw surfaces to the caller; inflight cleared (a subsequent call retries).
6. `force: true` → bypasses live+stale, calls `fetchFn`.
7. `{ swr: false }` + expired + stale present → does NOT return stale; blocks on
   `fetchFn`.

Use fake timers or a controllable `fetchFn` deferred so the test can assert the
return resolves *before* the background fetch completes.

## Rollout

- Behind the default-on `swr` option; no caller changes required.
- Low risk: the only new user-visible behavior is "serve last-known-good
  instantly instead of waiting ~4s," and the data is already considered cacheable
  for a day.
- If needed, ship with `swr` defaulting to a config/env flag
  (`CACHE_SWR_ENABLED`) so it can be toggled without a redeploy during bake-in.

## Interaction with a scheduled warm job

> The warm job now has its own design: [`cache-prewarm-plan.md`](./cache-prewarm-plan.md).

SWR and warming are complementary:

- **SWR** removes the user-facing latency of *expiry* (only the first-ever view
  of a never-cached key blocks).
- **A BullMQ warm job** (repeatable, every N hours, over the current listing IDs)
  populates keys *before* anyone views them — covering the first-ever case — and
  keeps the `stale:` copies SWR serves fresh.

Recommended order: ship **SWR first** (highest leverage, smallest change), then
add the warm job if first-ever cold loads still show up in logs.

## Out of scope / future

- Redis-lock dedup for multi-dyno web tier.
- `cachedAt`/age metadata and `Age`-style response headers.
- HTTP/CDN caching of rendered HTML (requires awaiting deferred sections and
  keying by language/flags) — separate proposal.
