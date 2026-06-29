# DAHLIA migration status — app-node (TanStack Start)

**Updated:** 2026-06-29 · **Branch:** `jdunning/poc/tanstack-on-i18n`

This is the living **status snapshot**: which pages render natively in app-node
vs. fall back to the Rails `app/javascript` bridge, what infrastructure is in
place, and what to tackle next. For the *strategy/roadmap* (how Rails is retired
phase by phase) see [`rails-retirement-plan.md`](./rails-retirement-plan.md);
for the SSR mechanism see [`../../docs/tanstack-ssr-plan.md`](../../docs/tanstack-ssr-plan.md).

---

## TL;DR

app-node serves every page, but in two modes:

- **Native** — a TanStack Start route with a server loader that renders a
  purpose-built React component server-side (SSR). No Rails component involved.
- **Bridge** — `RailsPage` (`src/components/RailsPage.tsx`) client-mounts the
  original react-on-rails component from `app/javascript` (`ssr: false`). A
  parity shim, being retired one route at a time.

So far the **listing surface, home page, all content/get-assistance pages, and
the post-lottery next-steps (invite-to) flow are native** — at both the
unprefixed and `/$lang` paths (es/zh/tl get SSR too). Account and auth pages
still bridge.

> **Localization:** native pages now render at both the unprefixed (English) and
> `/$lang` paths via shared route configs; the root `beforeLoad` builds the i18n
> store from the path, so the same component SSRs in the right language. `<html
> lang>` reflects the request language. Internal links in native pages/chrome use
> `getLocalizedPath` so navigating from a localized page keeps the language.
> **Dates localize under SSR too:** `getCurrentLanguage` (in
> `app/javascript/util/languageUtil`) resolves the request language server-side
> from the per-request active i18next instance (`@uic` `locale()`) when there's no
> `window`, so `localizedFormat` renders the right locale during SSR and matches
> the client (no hydration mismatch).

---

## Route inventory

### Native (SSR, no Rails component)

| Path | Component | Notes |
|------|-----------|-------|
| `/listings/$id` | `pages/listings/ListingDetail.tsx` (+ `ListingDetailSections`, `PricingTable`) | Full parity: gallery, aside, eligibility/AMI tables, features, neighborhood, additional info, FCFS sales flow. Deferred/streamed below-the-fold sections. |
| `/listings/for-sale` | `pages/listings/SaleDirectory.tsx` | Ownership directory; DALP header gated on flag. Cards render the "Available Units" stacked table (units / AMI / HOA dues / sales price) + priority-units subheader, and the sticky section nav bar (`DirectorySectionNav`: Enter a lottery / Buy now / Upcoming / Lottery results) with scroll-spy + click-to-expand. |
| `/listings/for-rent` | `pages/listings/RentDirectory.tsx` | Rental directory. Cards render the "Available Units" stacked table (units / income range / rent) + priority-units subheader, and the section nav bar (`DirectorySectionNav`) with scroll-spy + click-to-expand. |
| `/listings/$id/apply/intro` | `pages/apply/ListingApplyForm.tsx` | Form-engine apply entry. |
| `/listings/$id/next-steps` | `pages/inviteTo/NextSteps.tsx` | Invite-to (I2A/I2I) next-steps flow: next-steps, withdrawn, contact-me-later, deadline-passed. Flag-gated (`partners.inviteToApply`, `all.i2i`); reuses the Rails `*Content` exports. |
| `/listings/$id/next-steps/documents` | `pages/inviteTo/NextStepsDocuments.tsx` | I2A/I2I document checklist (flag-gated). |
| `/` (home) | `pages/HomePage.tsx` | Hero + mailing-list signup; localized directory links. |
| `/disclaimer` | `pages/assistance/Disclaimer.tsx` | Static content. |
| `/privacy` | `pages/assistance/Privacy.tsx` | Static content. |
| `/get-assistance` | `pages/assistance/GetAssistance.tsx` | Action blocks + contact sidebar. |
| `/additional-resources` | `pages/assistance/AdditionalResources.tsx` | InfoCard grid from static JSON. |
| `/document-checklist` | `pages/assistance/DocumentChecklist.tsx` | Preference doc accordions. |
| `/housing-counselors` | `pages/assistance/HousingCounselors.tsx` | Counselor list + client-side filter. |

All of the above also exist at `/$lang/...` rendering the same component. Native
routes opt into the SSR-safe site chrome with `staticData: { nativeShell: true }`
(see `components/AppShell.tsx`); bridged routes self-wrap via Rails `Layout.tsx`.

### Bridge (`RailsPage`, `ssr: false`)

- **Auth:** `/sign-in`, `/create-account`, `/forgot-password`, `/reset-password`
- **Account:** `/account`, `/account/applications`, `/account/settings`,
  `/my-account`, `/my-applications`
- **Apply (legacy entry):** `/listings/$id/how-to-apply`
- The `/$lang/...` variants of the above.

---

## Infrastructure in place (enables native rewrites)

- **SSR translations** — per-request i18next instance; the server serializes a
  merged translation store into the HTML, the client hydrates synchronously (no
  re-fetch, no mismatch). `lib/i18n/store.ts`, wired in `__root.tsx` + `client.tsx`.
- **Server-side feature flags** — Unleash evaluated server-side and serialized to
  the client (same pattern as i18n). `lib/flags/{unleash,store}.ts`. Native pages
  gate on the same flags Rails does (realtor section, neighborhood, form engine,
  DALP, account layout); Clerk auth is flag-gated too. See
  [`../../`](../..) memory `app-node-server-side-unleash`.
- **Native app shell** — SSR-safe header/footer (`components/AppShell.tsx`) using
  Bloom `@uic` SiteHeader/SiteFooter directly (renders signed-out chrome on SSR;
  account chrome is client-only).
- **Server data layer** — `lib/listings/server-fns.ts` (`createServerFn` handlers
  hitting the Salesforce proxy) + Redis cache (`lib/cache/redis.ts`). Listing data
  is the **raw Salesforce shape** — native components read the raw SF field keys
  (`Name`, `Building_Street_Address`, `Application_Due_Date`, `Tenure`, …), not a
  camelCase remap, matching the Rails FE convention so Rails helpers/components can
  be reused directly. `SerializableListing` reflects those keys; the server fns
  pass the proxy response through unchanged.
  - **Deterministic cache peek (listing detail)** — `loadListingDetail`
    (`lib/listings/route-config.ts`) decides hit-vs-miss per section with a
    cache-only **peek** (`peek{ListingUnits,ListingPreferences,ListingAmiCharts}`,
    a Redis `GET` that never triggers the Salesforce fetch). Cache hit → data
    returned **inline** so the section SSRs with no Suspense boundary (no spinner,
    no flash); cache miss → `defer()` so the shell streams immediately and the
    section fills in behind a spinner. Replaced an earlier 150ms wall-clock race.
    **Gotcha:** never `await` a `defer()` result — `await` recursively unwraps the
    thenable and blocks the loader until it settles, silently killing streaming;
    deferred promises must be assigned straight to the returned property.
  - **Server cold-start warmup** — `serve.mjs` fires one lightweight internal
    request at boot to warm `getServerDeps()` (Redis connect + dynamic imports)
    before real traffic, so the first user request pays no init latency. Must live
    in `serve.mjs`: TanStack Start's entry transform strips all top-level boot code
    from `src/server.ts` in the build. `getServerDeps()` is memoized (one shared
    init promise) and clears its memo on rejection so a transient init failure
    can retry instead of poisoning the process.
- **Directory card reuse** — the native directory pages reuse the Rails
  `getListingCards` (`modules/listings/DirectoryHelpers`) for the cards (image,
  tags, status bars, stacked unit table, priority subheader), fed a per-directory
  `getFor{Rent,Sale}SummaryTable` built from `unitSummaries`. The section nav bar
  reuses the Rails presentational `DirectoryPageNavigationBar` but implements
  scroll-spy locally (see Known gaps).
- **Vendored components** — `@bloom-housing/ui-components` removed; components live
  in `app/javascript/components/uic` as `@uic` on a single Tailwind v4 theme.
- **Dual auth** — `lib/auth/dual-auth.ts` accepts Clerk *or* devise_token_auth
  (validated against the Rails backend). Clerk is flag-off by default → devise.
- **Build/serve** — `serve.mjs` zero-dep Node adapter in front of the built
  `fetch` handler (`npm run build && npm start`). See deployment.md.

---

## What to tackle next (prioritized)

_Done: localized listing routes, native home page, native content pages (steps
1–3 of the earlier list), and the native next-steps (invite-to) flow._

1. **Auth pages native** (sign-in, create-account, forgot/reset-password) — needs
   the auth provider story settled (Clerk flag vs. devise). Wire to dual-auth.
2. **Account suite native** (account, settings, applications, my-account,
   my-applications) — client-rendered behind SSR'd chrome is acceptable; uses
   `requireDualAuth` server fns that already exist.
3. **Finish the apply native flow** — the `/listings/$id/apply/intro` route exists
   but is a skeleton; flesh it out. (The old Angular apply form at
   `/apply-welcome/intro` is intentionally NOT being migrated.)
4. **Retire `RailsPage`** once no route imports it, then delete the bridge and the
   `app/javascript` page entry points (per retirement-plan Phase 2/3).

See `rails-retirement-plan.md` for the API-decoupling (Phase 3) and any remaining
component work (Phase 4) that runs in parallel.

---

## Known gaps / caveats

- **Neighborhood map** needs `GOOGLE_PLACES_KEY` in app-node `.env` (absent → the
  section is skipped even with its flag on).
- **Machine translation** (`GoogleCloudTranslate`) is not wired natively — native
  pages render English source copy (fine for English; matters once localized
  native routes land).
- **Realtor "For the Buyer's Agent"** needs both the flag on *and* listing data
  (`Allows_Realtor_Commission` + commission amount/info); the local Salesforce
  data has it off, so it won't show locally even though dahlia-full does.
- **Dev vs. built differ** for CSS — diagnose layout on the BUILT site
  (`npm start`); the bridge injects CSS at runtime in dev.
- **document-checklist** dropped the URL-hash auto-expand (Rails read
  `window.location` at render); the section `id` anchors remain so browser scroll
  to a linked section still works.
- **SSR'ing a repo-root dep** (e.g. `react-hook-form`) can hit a dual-React
  invalid-hook crash unless it's in `ssr.noExternal` (vite.config) so Vite
  dedupes React through its graph.
- **Next-steps JWT `t` token** is decoded **without signature verification**
  (app-node has no JWT secret/lib); it only reads the embedded params to render.
  Rails verifies. Acceptable because app-node takes no security-sensitive action
  from the token. If a verified token becomes required, add the secret + a verify
  step in `lib/inviteTo/route-config.ts`.
- **Directory section nav scroll-spy is reimplemented, not reused.** The Rails
  `MenuIntersectionObserver`/`NavigationBarUtils` keep observer state in
  module-level singletons and a `ResizeObserver` that permanently closes over the
  first-mounted page's `setActiveItem`, so the highlight breaks after client
  navigation between directories (the second page's observers update the first,
  unmounted page's state). `DirectorySectionNav` instead does a local
  scroll-position calc (with bottom-of-page detection) owned by the effect and
  cleaned up on unmount. Don't wire the Rails observer into SPA pages.
- **Next-steps response recording** moved from Rails' load-time controller hook to
  a client effect in `pages/inviteTo/NextSteps.tsx` (POST to
  `/api/v1/next-steps/record-response`). The Rails language-change (referrer)
  guard is not replicated; the no-action/deadline-passed/test guards are.

---

## Open issue: responsive-wrapper SSR hydration mismatch (#418/#422)

**Status:** root-caused, fix not yet applied (awaiting approach decision).

**Symptom.** On a full SSR load of the listing detail (refresh / direct URL, not
client nav from the directory), the console logs React **#418** (server HTML
didn't match client) cascading into **#422** (a Suspense boundary client-rendered
because it updated mid-hydration). React then throws away the server markup for
that subtree and re-renders it on the client — this is the **visible "flash"**
where the sidebar/eligibility/features re-render a beat after load (same root
cause as the FOUC/late-sidebar report). Client navigation from the directory
doesn't show it because that path is a pure client render (no hydration).

**Root cause.** `app/javascript/components/uic/ResponsiveWrappers.tsx` —
`Desktop`/`Mobile` gate their children on `useMediaQuery`, whose `useState`
**initializer reads `window.matchMedia` on the client** (`defaultMatches` on the
server). So the server renders the Mobile branch (`Desktop` → `null`) while a
desktop client's first render picks the Desktop branch (e.g. the `<ul>` in
`ResponsiveContentList`). Server and client-initial DOM differ → hydration
mismatch. Used in **20+ places** (listing sections, the aside/sidebar, lottery,
assistance, invite flows), so the fix is central — one change to
`ResponsiveWrappers` fixes every consumer. (Confirmed on the **test branch** too,
so it predates the streaming/peek work; restoring streaming just made it more
visible. Reproduce with the dev server, which prints the de-minified
"Expected server HTML to contain a matching `<ul>` in `<div>`".)

**Fix options.**

1. **Minimal SSR-safe (`useMediaQuery`).** Initialize state to `defaultMatches`
   only (drop the `window.matchMedia` read from `useState`), then set the real
   value in `useEffect` after mount. Server and client-initial render agree →
   **eliminates #418/#422**. Tiny, central, low-risk. **Tradeoff:** the desktop
   variant still appears just after hydration, so the mobile→desktop flash
   remains — but error-free (and no worse than today, where the mismatch already
   forces a client re-render).

2. **CSS-based responsive (also removes the flash).** Render *both* variants
   server-side and toggle with Tailwind `md:` classes (no JS viewport guess).
   No mismatch **and** no flash — the sidebar renders correctly on first paint.
   **Cost:** a real rewrite of the responsive primitives, renders children twice
   (double DOM; possible double effects in the interactive accordions), touches
   all consumers.

3. **Server-accurate viewport (best result, most work).** Determine the viewport
   server-side via a client-hint header or a JS-set cookie, so SSR renders the
   correct branch outright. Removes mismatch and flash with no double DOM, but
   adds a viewport-detection mechanism and a first-visit cold case.

**Recommendation:** ship option 1 to clear the errors immediately, then evaluate
option 2 as a separate UX/flash follow-up. Independent: the `favicon.ico` → 500
(no `favicon.ico` in `dist/client`; the catch-all route 500s on it) — add the
file or short-circuit `/favicon.ico` in `serve.mjs`.
