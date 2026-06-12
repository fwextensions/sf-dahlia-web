# Plan: Retiring Rails — Moving DAHLIA Fully to TanStack Start

**Status:** draft · June 2026
**Branch context:** `jdunning/poc/tanstack-migration`

## Where we are today

The POC proved visual parity: app-node serves every public page by mounting the
*original* react-on-rails components from `app/javascript` via the
`RailsPage` bridge (`src/components/RailsPage.tsx`). But the architecture is
deliberately transitional:

- Pages are **client-rendered only** (`ssr: false`); the server sends an empty
  shell, then the browser fetches translations, page code, and listing data.
- The frontend code still lives in the Rails tree (`app/javascript`) and
  resolves dependencies from the **repo-root node_modules**, held together by
  shims in `vite.config.ts` / `postcss.config.js`:
  - `define` injection of `process.env.*` vars
  - sass `additionalData` `@use` of Bloom's `tailwind-variables.scss`
  - a load-hook that strips Tailwind v3 directives from `base.scss` and
    replaces the CJS `tailwind.config.js` with an ESM shim
  - `resolve.dedupe` to prevent duplicate React/Bloom copies
  - subpath aliases around `@bloom-housing/ui-components`'s exports map
- Rails still serves: the production site itself, all `/api/v1` endpoints
  (app-node proxies to it), auth (devise-token-auth), and asset hosting.
- `@bloom-housing/ui-components` comes from `github:fwextensions/ui-components`
  (Tailwind v4 fork) compiled from source, while the Rails webpack build uses
  npm 12.x with Tailwind 2.

The end state: **one Node service**, SSR/SSG-first, one component library, one
Tailwind build, no Ruby.

---

## Phase 1 — Make app-node own the frontend code

*Goal: `app/javascript` moves into the Start build; every shim deleted; the
Rails webpack build is abandoned (Rails keeps serving only `/api/v1`).*

1. **Relocate the source.** Move `app/javascript/**` → `app-node/src/frontend/**`
   (pages, modules, layouts, api, authentication, hooks, util, components).
   Update the `RailsPage` loaders and `tailwind.config.ts` content paths.
   Delete `packs/react_application.tsx` and `deferReactOnRailsAutoRender.ts`
   (react-on-rails entry points — nothing else imports them).
   Move `app/assets/images` + `app/assets/json/translations` into
   `app-node/public/` or `src/assets/` so `import.meta.glob` no longer reaches
   outside the project root.

2. **Single dependency tree.** Add the frontend's real deps to
   `app-node/package.json` (axios, dayjs, react-helmet-async, markdown-to-jsx,
   @unleash/proxy-client-react, @clerk/clerk-react, @fortawesome/*, etc. —
   currently resolved by accident from the repo root). Then delete:
   `resolve.dedupe`, `server.fs.allow` for the repo root, and the
   repo-root-`.env` parsing (env vars move to `app-node/.env` and a typed
   `src/config/clientEnv.ts` export instead of `process.env.*` defines —
   change ~15 call sites in the frontend code).

3. **Remove the style shims.**
   - `base.scss` becomes an app-node file; delete its `@tailwind` v3
     directives outright (the load-hook strip becomes unnecessary).
   - Replace the runtime `tailwind.config.js` import in Bloom's
     `ResponsiveWrappers` usage with a static breakpoints module (or fix it in
     the fork) and delete `bloomTailwindShimPlugin` + the ESM shim file.
   - Keep the postcss `@config`/`@reference` injection for now — it dies in
     Phase 4 when vendored components stop using `@apply` against a JS config.

4. **Cleanups that fall out.** Delete the now-unused stub pages in
   `src/pages/` (HomePage.tsx, listings/*, etc.), the duplicated i18n loader
   in `src/i18n` (or keep it — it becomes the SSR translation source in
   Phase 2), and the `migrating-to-react.md`-era Rails view/controller pairs.

**Exit criteria:** `npm run dev` and `vite build` work with zero references to
files outside `app-node/`; `npm run typecheck` is clean (add the missing
`@types/*`); Rails' webpack build can be deleted from CI.

Estimated size: the frontend is ~230 TS/TSX files; the move is mostly
mechanical (one big `git mv` + import-path codemod), with the env-var and
asset-path call sites being the only semantic edits.

## Phase 2 — SSR/SSG the content

*Goal: stop shipping an empty shell that re-fetches its own strings. A
content-heavy site should render on the server.*

1. **Translations server-side.** The blocker for SSR today is that Bloom's
   `t()` is a module-global Polyglot instance loaded in a `useEffect`. Fix:
   call `addTranslation()` during SSR per request (the existing
   `src/i18n` loader already resolves locale from the URL). Because the
   translator is module-global, concurrent SSR of different locales is racy —
   either (a) wrap rendering in AsyncLocalStorage with a per-request
   translator (fork change to Bloom's `translator.ts`), or (b) accept the
   simpler interim: load the right bundle in the route loader and pass it
   through `loadTranslations` before render, serializing renders per locale.
   (a) is the correct end state and is easy once components are vendored
   (Phase 4).

2. **Window-dependent code.** The pages assume `window` (language detection,
   `getLanguageItems`, Unleash/axe/GTM in `withAppSetup`). Replace
   `withAppSetup` with a Start-native provider stack in `__root.tsx`:
   - locale from router params instead of `window.location`
   - Unleash: evaluate flags server-side (`@unleash/proxy-client` has a node
     client) and hydrate; axe/GTM stay client-only (`useEffect`)
   - `IdleTimeout`, `UserProvider` remain client components — that's fine,
     SSR renders their children's signed-out state.

3. **Flip routes to SSR incrementally.** Per route: replace the `RailsPage`
   bridge with a direct import, add a loader that fetches data server-side
   (the `src/lib/listings/server-fns.ts` plumbing with Redis caching already
   exists from the earlier POC phase — reuse it), remove `ssr: false`.
   Suggested order, easiest first:
   1. Static content pages (disclaimer, privacy, get-assistance, document
      checklist, housing counselors — pure translations + static JSON)
   2. Home page
   3. Directories (for-rent / for-sale — loader calls `getListings`)
   4. Listing detail (largest; many subcomponents touch `window` — audit
      `ListingDetails*` modules and gate browser-only bits in effects)
   5. Auth'd pages last (my-account, applications) — these can legitimately
      stay client-rendered behind SSR'd chrome.

4. **SSG / caching.** True SSG is awkward while listings change in
   Salesforce; instead use SSR + HTTP caching, which the codebase already has
   hooks for (`middleware/cache-headers.ts`, Redis cache service):
   - static pages: `Cache-Control: s-maxage=86400` (CDN-cacheable per locale)
   - directories/detail: `s-maxage=300, stale-while-revalidate` keyed on the
     existing Redis listing cache TTL
   - `head()` on each route replaces react-helmet (`MetaTags.tsx`) so titles/
     OG tags are in the initial HTML — this also fixes social previews, which
     a SPA can't do.

**Exit criteria:** view-source on every public page shows real localized
content; Lighthouse LCP/CLS measured against the Rails baseline; no
client-side fetch of translation JSON on first paint.

## Phase 3 — Move the API off Rails, remove Ruby

*Goal: shrink the `/api/v1` proxy list to zero.*

The infrastructure anticipates this: `middleware/api-proxy.ts` has
`migratedPaths` so endpoints can be cut over one at a time, and
`src/lib/salesforce/client.ts`, `jobs/` (BullMQ), `cache/`, `address/easypost`
already exist.

1. **Inventory.** Enumerate Rails controllers under `/api/v1` (listings,
   units, preferences, lottery buckets/ranking, AMI charts, applications
   CRUD + file uploads, account/short-form, address validation, GIS lookups).
   For each: trace to its Salesforce REST call or Postgres table.
2. **Read-only listing endpoints first** (listings, units, preferences, AMI,
   lottery) — they're thin Salesforce passthroughs with caching; the Node
   Salesforce client + Redis cache replicate `force/` service objects.
   Add contract tests that diff Node vs Rails JSON for the same requests
   before flipping each path in `migratedPaths`.
3. **Auth.** The hard one. Current: devise-token-auth in Rails Postgres;
   POC already contains `lib/auth/dual-auth.ts` and a Clerk integration plus
   `scripts/migrate-users.ts`. Decide: finish the Clerk migration (preferred —
   deletes password handling entirely) or reimplement token auth in Node.
   Run dual-auth during the overlap window.
4. **Application submission + uploads** (writes to Salesforce, S3 file
   attachments, confirmation emails). The BullMQ workers (`jobs/processors/`)
   were built for exactly this; port the Rails jobs' field mappings, then
   cut over with a feature flag and reconcile submissions for a week.
5. **Decommission.** When `proxiedPathPrefixes` is empty: move cron/rake
   tasks (listing cache warmers, lottery result syncs) to BullMQ repeatable
   jobs, point DNS at the Node app, archive the Rails app, drop the Ruby
   buildpack. Keep the Rails Postgres only if anything besides devise still
   reads it (audit `db/schema.rb` — most state is in Salesforce).

**Exit criteria:** Rails dyno count zero; on-call runbook references only the
Node service.

## Phase 4 — Vendor and unify the component library

*Goal: one set of components, one Tailwind (v4) theme, one build — no
`@bloom-housing/ui-components` dependency and none of its compat machinery.*

Rationale: DAHLIA uses a fraction of Bloom (~30 of 100+ components), the
upstream is effectively frozen for SF's purposes (the fork already diverges),
and the library is the sole reason for the postcss `@config` injection, the
sass variable bridge, and the CJS interop `optimizeDeps` list.

1. **Usage census.** Grep the frontend for `from "@bloom-housing/ui-components"`
   imports — expect: SiteHeader/SiteFooter, Hero, ActionBlock, Icon, Button/
   LinkButton, Form fields (Field, Select, PhoneField…), ListingDetails,
   SiteAlert, LoadingOverlay, Modal/Drawer, StackedTable, translator helpers.
   Everything unimported never gets copied.
2. **Vendor.** Copy those components (+ their scss) from the fork into
   `app-node/src/components/ui/`, keeping git history via the fork repo as
   reference. Drop the package dependency; the `exports`-map aliases,
   `optimizeDeps` include list, and dedupe rules all delete.
3. **Restyle onto the shared theme.**
   - Replace `$tailwind-*` sass vars and `var(--bloom-*)` tokens with a single
     `@theme` block (Tailwind v4 CSS-first config) that merges Bloom's design
     tokens with DAHLIA's overrides (the `fontSize` 3xl/4xl tweaks,
     `alt-serif`, etc.). `tailwind.config.ts` + the postcss `@config`
     injection plugin then delete; `postcss.config.js` becomes one line.
   - Migrate component scss `@apply` usage to either plain CSS with theme
     vars or utility classes in JSX — mechanical, per component, and a good
     forcing function to delete dead styles (Bulma variables in `base.scss`,
     ag-grid theme, print styles nobody exercises).
   - Replace `react-media`-based `ResponsiveWrappers` with a `matchMedia`
     hook, removing the last runtime use of a tailwind config.
4. **Swap the translator.** While vendoring, replace Bloom's global Polyglot
   `t()` with the per-request i18n built in Phase 2 (same key format, so
   translation JSON files are untouched).
5. **Dependency diet.** Vendoring strands several heavy transitive deps
   (ag-grid, @dnd-kit, react-beautiful-dnd via StandardTable, dropzone if the
   short form doesn't use it) — verify and drop. This also clears the React 19
   peer-dep tension the fork introduced.

`ui-seeds` is a separate question: it's small, CSS-vars based, and causes no
build friction — vendoring it is optional and can trail.

**Exit criteria:** `package.json` has no `@bloom-housing/*`; `vite.config.ts`
contains no bloom-specific plugin/alias/dedupe/optimizeDeps entries; one
`@theme` definition styles the whole app.

---

## Sequencing and risk notes

- **Order matters: 1 → 2 → (3 ∥ 4).** Phase 3 (API) and Phase 4 (components)
  are independent and can proceed in parallel once the code lives in app-node.
  Doing Phase 4 before Phase 2 is also viable and makes the SSR translator
  work easier — consider interleaving (vendor SiteHeader/Footer + translator
  early, vendor ListingDetails when its route flips to SSR).
- **Each phase ships.** Nothing here requires a big-bang cutover; the proxy
  `migratedPaths` list, per-route SSR flips, and per-component vendoring are
  all incremental and individually revertible.
- **Testing baseline first.** Before Phase 1, capture: screenshot suite of
  all routes × 4 locales (the agent-browser sweep from the POC can be
  scripted), the existing Jest suite for `app/javascript` (must keep passing
  after the move — port `jest.config.js` paths or convert to vitest), and a
  recorded set of `/api/v1` request/response pairs for Phase 3 contract tests.
- **Known sharp edges encountered in the POC** (will bite again during SSR
  work): Bloom's translator is module-global; JSON translation imports need
  `.default` unwrapping under Vite; several Bloom/DAHLIA components touch
  `window` at render time, not in effects; `@dnd-kit/react` must not be
  prebundled; TanStack's SSR stream watchdog can kill dev on hung streams
  (guard already in vite.config.ts).
- **Out of scope here:** the application short form rebuild (`pages/form/`,
  the Angular-era `formEngine/`), which is its own project; Heroku topology
  changes; Salesforce-side work.
