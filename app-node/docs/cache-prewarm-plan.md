# Plan: pre-warming the Redis cache

Status: **implemented** (flag-gated, off by default) · originally proposed
Owner: TBD
Related: `src/lib/cache/cache-service.ts`, `src/lib/listings/server-fns.ts`,
`src/lib/jobs/*` (`processors/cache-warm.ts`, `queues.ts`, `workers.ts`),
`src/worker.ts`, [`cache-stale-while-revalidate.md`](./cache-stale-while-revalidate.md),
[`rails-retirement-plan.md`](./rails-retirement-plan.md) (Phase 3 §5: "move cron/rake
listing cache warmers to BullMQ repeatable jobs")

> **Implementation note.** Shipped as described below. The one refinement made
> during implementation: rather than the warm processor calling the TanStack
> `createServerFn` wrappers (which assume the SSR/start runtime and are fragile
> to call from the standalone worker), the four listing reads were extracted into
> plain, deps-injectable core functions (`fetchListings`, `fetchListingDetail`,
> `fetchListingUnits`, `fetchListingPreferences`) that the server fns now
> delegate to — mirroring how `resolveAmiChartsCached` was already factored. The
> warm processor calls those directly with a shared `ServerDeps`, so key/TTL
> parity is guaranteed and there's no server-fn-runtime dependency in the worker.
> Gated by `CACHE_WARM_ENABLED` (default off); cadence/concurrency via
> `CACHE_WARM_INTERVAL_MS` (default 6h) and `CACHE_WARM_CONCURRENCY` (default 4).

## Problem

Listing data is cached in Redis and, when **warm**, listing pages render in
single-digit milliseconds. The pain is the **cold** path: the first request for a
key with no cached data blocks on the full Salesforce round-trip through the Rails
proxy — measured at **~4s** for the AMI charts on a detail page, and a similar
order for the directory and per-listing detail/units/preferences fetches.

Two things create cold keys today:

1. **First-ever fetch of a key.** No user has viewed it since the key was created
   (a new listing) or since Redis was flushed (a restart of the shared Redis
   add-on, a `FLUSHALL`, an eviction).
2. **TTL expiry.** Live keys carry a TTL (`withoutParams` 86400s / 1 day;
   `withParams` 600s / 10 min; `amiData` 86400s). When the live key lapses, the
   next request pays the ~4s fetch again.

The cost of both is paid by a **user** — whoever happens to make the first request
after the key goes cold waits out the upstream fetch before the page (or the
streamed section) resolves.

## Goal

Populate the cache **before a user asks for it**, so the first real request for
any page in the listing catalog finds warm keys. A scheduled job walks the current
catalog on a cadence shorter than the TTLs and refreshes every key the listing
surface reads.

### Non-goals

- Implementing stale-while-revalidate. That's a separate, complementary change
  (see [`cache-stale-while-revalidate.md`](./cache-stale-while-revalidate.md) and
  "Interaction with SWR" below). Warming and SWR solve different halves of the
  cold-path problem; either can ship first.
- HTTP/CDN caching of rendered HTML.
- Changing cache keys or TTL values.
- Warming auth'd/account data or anything user-specific — only the shared,
  cacheable listing catalog.

## What "warm" means here — the keys to populate

The listing surface reads through `src/lib/listings/server-fns.ts`, each of which
calls `CacheService.cachedGet` (or, for AMI, the per-chart `resolveAmiChartsCached`).
Every one writes a **live key** (`<key>`, `EX <ttl>`) and a never-expiring **stale
key** (`stale:<key>`). The warm job must hit the same server fns so it writes the
exact keys those reads look up (identical `generateCacheKey` output).

Per directory type and per listing, the keys are:

| Data | Server fn | Cache key shape | TTL |
|---|---|---|---|
| Directory list | `getListings({ type })` | `api/v1/listings?type=<type>` | 1 day |
| Listing detail | `getListingDetail({ id })` | `api/v1/listings/<id>` | 1 day |
| Units | `getListingUnits({ id })` | `api/v1/listings/<id>/units` | 1 day |
| Preferences | `getListingPreferences({ id })` | `api/v1/listings/<id>/preferences` | 1 day |
| AMI charts | `getListingAmiCharts({ charts })` → per chart | `api/v1/listings/ami?chartType=<t>&percent=<p>&year=<y>` | 1 day |

Notes:

- **AMI charts are shared across listings** (keyed by `(year, type, percent)`, not
  by listing). Warming units first, then deriving the chart metadata from them via
  `getAmiChartMetaDataFromUnits`, naturally dedupes: the first listing that needs
  the 2024/MOHCD/50% chart warms it for the whole catalog. Feeding the deduped set
  of chart metadata through `getListingAmiCharts` reuses the existing
  batch-the-misses logic in `resolveAmiChartsCached`.
- **Lottery buckets/ranking** are intentionally left out of the default warm set:
  buckets are large and only matter post-lottery, and ranking is per-lottery-number
  (unbounded key space). Add them later behind a per-listing "lottery published"
  check if their cold load shows up in logs.
- **Detail is warmed inline (no `defer`).** The route loader (`loadListingDetail`)
  peeks the cache to decide inline-vs-stream; warming just makes those peeks hit.

## Where it runs — reuse the BullMQ worker

The infrastructure the retirement plan calls for already exists: a `worker` dyno
(`src/worker.ts`) running BullMQ against the shared Redis, with queue/connection
plumbing in `src/lib/jobs/`. Today it only runs the file-attachment worker. Add a
second queue + worker for warming.

Why the worker dyno and not `serve.mjs`:

- `serve.mjs` already fires a **one-shot** boot warmup (a single request to
  `/listings/for-rent`) to warm `getServerDeps` — process init, not catalog data.
  It is not a scheduler and shouldn't grow into one; a crash-looping or scaled web
  dyno would fire redundant warms.
- BullMQ **repeatable jobs** give a single cron-like schedule across the whole app
  regardless of web dyno count, plus retries/backoff, DLQ, and observability we
  already wired for file attachments.

### Components to add

```
src/lib/jobs/
  queues.ts        + cacheWarmQueue (Queue "cacheWarm") + enqueue/repeatable setup
  types.ts         + CacheWarmJob type (e.g. { scope: "all" | "directory", type? })
  workers.ts       + createCacheWarmWorker(processor)
  processors/
    cache-warm.ts  NEW — the warm logic (below)
src/worker.ts      register the cache-warm worker alongside file-attachment
```

The processor imports the **same server fns** the routes use, so warming and
serving can never drift in key shape or TTL:

```
processCacheWarm(job):
  # 1. Warm both directories (also the entry point to the id list).
  const [rentals, ownership] = await Promise.all([
    getListings({ data: { type: "rental",    force: true } }),
    getListings({ data: { type: "ownership", force: true } }),
  ])

  # 2. For every listing id, warm detail + units + preferences, then AMI.
  #    Bounded concurrency (p-limit style, e.g. 4–6) to avoid hammering Rails.
  for each id in [...rentals, ...ownership] (concurrency-capped):
    const [_, units] = await Promise.all([
      getListingDetail({ data: { id, force: true } }),
      getListingUnits({ data: { id } }),        # warmed via cachedGet
      getListingPreferences({ data: { id } }),
    ])
    const charts = getAmiChartMetaDataFromUnits(units)
    if (charts.length) await getListingAmiCharts({ data: { charts } })

  # AMI charts dedupe globally through the per-chart shared keys, so most
  # listings after the first few pay nothing for their charts.
```

- Use `force: true` on the **directory + detail** reads so the job refreshes even
  currently-warm keys (that's the point — keep them from ever expiring). Units /
  preferences / AMI go through `cachedGet` with `force: false`; because the job
  runs more often than the TTL, they stay warm, and the AMI misses batch as usual.
  (If refreshing units/preferences on every pass is desired, add a `force`
  parameter to those server fns — they don't accept one today.)
- **Concurrency cap** is the key safety knob: a catalog of N listings is up to
  ~3N proxy calls. Cap parallelism (start at 4) so the warm pass doesn't compete
  with live traffic for Rails/Salesforce throughput or trip proxy rate limits.

### Scheduling

Register a **repeatable job** once at worker startup:

```ts
await cacheWarmQueue.add(
  "warm-all",
  { scope: "all" },
  {
    repeat: { every: 6 * 60 * 60 * 1000 }, // every 6h — comfortably < the 1-day TTL
    jobId: "cache-warm-all",               // stable id ⇒ idempotent, no dupes on redeploy
    removeOnComplete: true,
    removeOnFail: 20,
  }
)
```

- **Cadence < TTL.** Listing/units/preferences/AMI are 1-day TTL, so a 6h (or 12h)
  repeat keeps live keys from ever lapsing while a user is waiting. The `withParams`
  600s endpoints (eligibility filters) are *not* in the warm set — their key space
  is unbounded and they're not on the initial-page path.
- **Stable scheduler id** (`upsertJobScheduler`) so redeploys/restarts don't
  stack duplicate repeatables.
- **Boot coverage is automatic:** `upsertJobScheduler` with `every` produces its
  first job immediately on creation, so a fresh deploy or Redis flush is covered
  right away. (An earlier explicit one-shot boot `add` was removed — it ran a
  second, redundant pass back-to-back at startup.)

## Interaction with SWR

Warming and stale-while-revalidate are complementary and address different cold
cases:

| | First-ever key (no data) | TTL expiry (stale data exists) |
|---|---|---|
| **Warm job** | ✅ populates before any user asks | ✅ refreshes before expiry |
| **SWR** | ❌ still blocks (nothing to serve) | ✅ serves stale instantly, refreshes in bg |

- **Warm job alone** removes both cold cases *for keys in the catalog*, as long as
  the cadence stays under the TTL. Its gap: a brand-new listing (or a Redis flush)
  in the window between warm passes is still cold for the first viewer.
- **SWR alone** removes the user-facing latency of *expiry* but the very first view
  of a never-cached key still blocks.
- **Together** they cover everything: the warm job keeps the `stale:` copies fresh
  (bounding SWR staleness) and covers first-ever keys on its cadence; SWR covers
  the window between warm passes for any key that already has a stale copy.

Recommended order matches the SWR doc: ship **SWR first** (smallest change, highest
per-change leverage), then add this warm job to close the first-ever-key gap if
cold loads still appear in logs.

## Observability

- Per pass, log a summary: listings walked, warmed, failed, total duration. Emit
  as a single structured line so a slow/failing pass is greppable.
- Log **progress** roughly every 10% of the catalog (`[cache-warm] progress
  N/total (pct%)`) so a long pass (the observed cold pass took ~150s for 143
  listings) shows movement without a line per listing.
- Count per-key outcomes (`warmed`, `already-warm`, `fetch-failed`) to size how
  much work each pass actually does — informs tuning the cadence and concurrency.
- The existing DLQ handling applies: a warm job that exhausts retries lands in the
  dead-letter queue rather than silently vanishing.

## Failure handling

- A warm pass is **best-effort**: individual listing failures are logged and
  skipped, not fatal to the whole pass (one bad listing shouldn't block warming the
  rest). Wrap each listing's block in try/catch and continue.
- If Rails/Salesforce is down, `cachedGet` already falls back to the `stale:` copy
  on fetch error and the proxy client times out at 30s; the pass logs failures and
  the next repeat retries. Never let a warm failure surface to users.
- Cap total pass runtime (or rely on the concurrency cap + per-call 30s timeout) so
  a pathological pass can't run into the next scheduled one; BullMQ's stable
  `jobId` on the repeatable prevents overlap of the scheduled trigger itself.

## Testing

- Unit-test `processCacheWarm` with fake server fns / a fake `CacheService`
  (the AMI cache logic is already factored for this — see `resolveAmiChartsCached`
  and its tests): assert it walks both directories, dedupes AMI chart metadata
  across listings, respects the concurrency cap, and continues past a single
  listing's failure.
- Assert the keys written match what the route loaders peek (`generateCacheKey`
  parity) — the whole point is that warmed keys are the keys reads look up.
- Integration-style: run the processor against a Redis mock + a stubbed proxy
  client, then assert the detail-route peeks (`peekListingUnits`,
  `peekListingPreferences`, `peekListingAmiCharts`) all hit afterward.

## Rollout

- Additive: a new queue + worker + repeatable job. No change to read paths, keys,
  or TTLs, so it's safe to ship dark and observe the logs before relying on it.
- Gate behind an env flag (e.g. `CACHE_WARM_ENABLED`, and `CACHE_WARM_INTERVAL_MS`
  / `CACHE_WARM_CONCURRENCY` for tuning) so cadence and concurrency can be adjusted
  — or the job disabled — without a code change during bake-in.
- Start conservative (12h cadence, concurrency 4), watch the pass-duration and
  proxy-load logs, then tighten the cadence if first-ever cold loads persist.

## Out of scope / future

- Warming lottery buckets/ranking for listings with published results.
- Event-driven warming (warm a single new/updated listing on a Salesforce webhook
  or admin publish, instead of only on the fixed cadence).
- A Redis lock around the pass if the worker is ever scaled to multiple dynos
  (today one worker dyno + a stable repeatable `jobId` is sufficient).
- Coordinating warm timing with the shared Rails app's own cache warmers to avoid
  double-driving Salesforce.
