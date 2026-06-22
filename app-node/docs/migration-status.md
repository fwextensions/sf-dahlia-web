# DAHLIA migration status — app-node (TanStack Start)

**Updated:** 2026-06-21 · **Branch:** `jdunning/poc/tanstack-on-i18n`

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

So far the **listing surface, home page, and all content/get-assistance pages
are native** — at both the unprefixed and `/$lang` paths (es/zh/tl get SSR too).
Account and auth pages still bridge.

> **Localization:** native pages now render at both the unprefixed (English) and
> `/$lang` paths via shared route configs; the root `beforeLoad` builds the i18n
> store from the path, so the same component SSRs in the right language. `<html
> lang>` reflects the request language. Internal links in native pages/chrome use
> `getLocalizedPath` so navigating from a localized page keeps the language.

---

## Route inventory

### Native (SSR, no Rails component)

| Path | Component | Notes |
|------|-----------|-------|
| `/listings/$id` | `pages/listings/ListingDetail.tsx` (+ `ListingDetailSections`, `PricingTable`) | Full parity: gallery, aside, eligibility/AMI tables, features, neighborhood, additional info, FCFS sales flow. Deferred/streamed below-the-fold sections. |
| `/listings/for-sale` | `pages/listings/SaleDirectory.tsx` | Ownership directory; DALP header gated on flag. |
| `/listings/for-rent` | `pages/listings/RentDirectory.tsx` | Rental directory. |
| `/listings/$id/apply/intro` | `pages/apply/ListingApplyForm.tsx` | Form-engine apply entry. |
| `/listings/$id/next-steps` | route + `getListingDetail` | Post-lottery "next steps" (skeleton; WIP). |
| `/listings/$id/next-steps/documents` | route | Document checklist for next steps (stub; WIP). |
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
  hitting the Salesforce proxy) + Redis cache (`lib/cache/redis.ts`).
- **Vendored components** — `@bloom-housing/ui-components` removed; components live
  in `app/javascript/components/uic` as `@uic` on a single Tailwind v4 theme.
- **Dual auth** — `lib/auth/dual-auth.ts` accepts Clerk *or* devise_token_auth
  (validated against the Rails backend). Clerk is flag-off by default → devise.
- **Build/serve** — `serve.mjs` zero-dep Node adapter in front of the built
  `fetch` handler (`npm run build && npm start`). See deployment.md.

---

## What to tackle next (prioritized)

_Done: localized listing routes, native home page, and native content pages
(steps 1–3 of the earlier list)._

1. **Auth pages native** (sign-in, create-account, forgot/reset-password) — needs
   the auth provider story settled (Clerk flag vs. devise). Wire to dual-auth.
2. **Account suite native** (account, settings, applications, my-account,
   my-applications) — client-rendered behind SSR'd chrome is acceptable; uses
   `requireDualAuth` server fns that already exist.
3. **Finish the apply / next-steps native flow** — the `/listings/$id/apply/intro`
   and `/next-steps*` routes exist but are skeletons/stubs; flesh them out.
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
