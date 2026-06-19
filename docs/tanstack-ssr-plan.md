# TanStack Start SSR plan (app-node)

Status: planning + first spike. Branch: `jdunning/poc/tanstack-on-i18n`.

## Where we are

Every page-content route in app-node is currently `ssr: false`. They render via
the `RailsPage` bridge (`app-node/src/components/RailsPage.tsx`), which mounts the
*original* react-on-rails components from `app/javascript` **client-side only**:
it renders `null` during SSR, then on the client loads translations + the page
module dynamically and mounts. This was a deliberate parity shim, not an SSR
dead-end.

Three things needed for real SSR already exist:

1. **Native, SSR-ready page components** — `src/pages/listings/{RentDirectory,
   SaleDirectory,ListingDetail}.tsx` (+ `GenericDirectory`, `ListingsGroup`,
   `EmptyListingsView`). They take data via props (e.g. `RentDirectory({ listings })`)
   and render synchronously. Built but **not yet wired to routes** — the listings
   routes still bridge to Rails.
2. **Server data fetchers** — `src/lib/listings/server-fns.ts` exposes
   `createServerFn` handlers (`getListings`, `getListingDetail`, units,
   preferences, lottery, AMI…) that hit Salesforce through a proxy + Redis cache.
   Server-only by construction.
3. **SSR-safe rendering primitives** — the vendored `@uic` components guard all
   `window`/`document` access (`typeof window !== "undefined"`, `documentAvailable`,
   effects only). The i18next façade (`app/javascript/components/uic/translator.ts`)
   was explicitly designed for SSR: `createTranslationInstance` is "one per
   request," read through a module-scoped active-instance ref.

The reference wiring already in the tree: `src/routes/listings.$id.next-steps.tsx`
(loader → `getListingDetail` → `Route.useLoaderData()`) and
`src/routes/listings.$id.apply.intro.tsx` (native component, no bridge).

## Why everything is `ssr: false` today

The `RailsPage` bridge mounts react-on-rails components that (a) touch `window`
at module-eval time and (b) load translations on the client. SSR of *those*
components is not the goal — the goal is to SSR the **native rewrites** and let
the Rails-bridged routes stay client-only until each gets a native version.

## Strategy: SSR the native pages (Track A)

Per page that has a native rewrite, convert its route from a `RailsPage` bridge to:

```ts
export const Route = createFileRoute("/listings/for-rent")({
  // 1. translations available for the SSR render pass (and client nav)
  beforeLoad: ({ location }) => ensureTranslations(getCurrentLanguage(location.pathname)),
  // 2. data fetched on the server, streamed to the client
  loader: async () => ({ listings: (await getListings({ data: { type: "rental" } })).listings }),
  // 3. native component renders synchronously from loader data
  component: RentDirectoryRoute,
  // ssr defaults to true — no `ssr: false`
})
```

Do NOT SSR the Rails-bridged routes; leave them `ssr: false` until rewritten.

## The cross-cutting prerequisites (do these first)

### 1. Server-side translations without a global-singleton race

The façade `t()` reads a **module-level `activeInstance`** ref
(`setActiveTranslationInstance`). Per `docs/phase8-i18n-design.md` §3.4 this is
fine for a **single render pass**, which covers the current SSR path. For
*concurrent* per-request SSR in one Node process, two requests would clobber each
other's active language. The deferred fix (design §8 item 4) is to back the ref
with `AsyncLocalStorage` (or pass the instance explicitly). Sequence:

- **Now (spike):** create + set the instance per request via a small
  `ensureTranslations(lang)` helper (server: load bundle, create instance, set
  ref). Acceptable for dev / single-render.
- **Before production SSR with concurrency:** replace the module ref with an
  `AsyncLocalStorage`-scoped instance so `t()` resolves the current request's
  language. One change in `translator.ts`; call sites untouched.

### 2. Hydration parity for translations

Loaders/`beforeLoad` run on the server during SSR; their results are dehydrated
and **not re-run on initial client hydration**. So the client's first render
needs the same translations the server used, or React throws a hydration
mismatch. Standard i18next-SSR fix: serialize the active language's resource
bundle into the SSR payload and init the client instance synchronously from it
before `hydrateRoot` (the "initial store" pattern). Until that's in place, expect
hydration warnings on SSR'd pages (server HTML is correct; client re-renders).

### 3. `getCurrentLanguage` must not read `window` on the server

`getCurrentLanguage(path?)` defaults to `window.location.pathname`. Always pass
the route `location.pathname` on the server.

## Rollout order

1. **Prereq 1 (spike-level):** `ensureTranslations(lang)` helper, module ref.
2. **First slice — `/listings/for-rent` → `RentDirectory`** (this doc's spike):
   loader + native component + `ssr: true`. Verify server-rendered HTML contains
   the translated directory markup.
3. **Prereq 2:** serialize + client-init translations to kill hydration
   mismatch; re-verify for-rent hydrates cleanly.
4. **Roll out** to `for-sale` (`SaleDirectory`) and `/listings/$id`
   (`ListingDetail`) using `getListings`/`getListingDetail`; then the `$lang/*`
   variants.
5. **Prereq 1 (production):** `AsyncLocalStorage`-scope the translation instance
   before enabling SSR under real concurrency.
6. Remaining pages get native rewrites + SSR as they're migrated off `RailsPage`.

## Known blockers / notes

- **No local backend:** `getListings` needs the Rails/Salesforce proxy on :3000.
  Without it the loader throws; the spike loader tolerates this and renders the
  empty state so the SSR path is still demonstrable. Real data SSR needs Rails
  (or a staging API via `RAILS_API_BASE_URL`) running.
- The dev-server SSR stream watchdog guard and `:3001` zombie-port caveats still
  apply (see app-node dev notes).
