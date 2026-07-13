# Deployment Guide: DAHLIA Node/TS Server

## Architecture Overview

The DAHLIA application uses a two-app Heroku deployment topology:

```
Public DNS (housing.sfgov.org) → dahlia-web (Node/TS - Primary App)
                                       ↓ internal HTTP (API key auth)
                                  dahlia-salesforce-proxy (Rails - Internal App)
                                       ↓ Apex REST
                                  Salesforce
```

### App Roles

| App | Heroku Name | Role | Custom Domain |
|-----|-------------|------|---------------|
| Node/TS (TanStack Start) | `dahlia-web` | Primary — receives all public DNS traffic, handles routing, SSR, auth, caching | Yes (`housing.sfgov.org`) |
| Rails (Salesforce Proxy) | `dahlia-salesforce-proxy` | Internal — stateless Salesforce API proxy, accessed only by its Heroku app URL | No |

### Key Points

- The **Node app** owns the custom domain and handles all routing, page rendering, authentication, and caching.
- The **Rails app** has no custom domain. It is accessed only by the Node app via its Heroku app URL (e.g., `https://dahlia-salesforce-proxy-abcdef123.herokuapp.com`).
- Both apps share the same **Redis** and **PostgreSQL** Heroku add-ons via cross-app add-on attachment.
- During migration, both apps coexist. Traffic gradually shifts as pages are migrated from Rails to Node.

---

## Shared Add-ons (Cross-App Attachment)

Both apps share Redis and PostgreSQL via Heroku's cross-app add-on attachment feature.

### Setup Commands

```bash
# Redis: attached to Node app as primary, shared with Rails app
heroku addons:attach dahlia-web::REDIS --app dahlia-salesforce-proxy

# PostgreSQL: attached to Node app as primary, shared with Rails app
heroku addons:attach dahlia-web::DATABASE --app dahlia-salesforce-proxy
```

This ensures:
- Both apps read/write the same Redis instance (shared cache, shared BullMQ queues)
- Both apps access the same PostgreSQL database (user mappings, uploaded files)

---

## Node App (`dahlia-web`)

### Processes

See `app-node/Procfile`.

| Process | Command | Purpose |
|---------|---------|---------|
| `web` | `node serve.mjs` | Zero-dep Node adapter that serves the built client assets and fronts the TanStack Start SSR `fetch` handler; handles all HTTP requests |
| `worker` | `node --env-file-if-exists=.env --import tsx/esm src/worker.ts` | BullMQ worker for async jobs (file attachments, emails, cache warm) |

> **Why `serve.mjs` and not `.output/server/index.mjs`?** The build uses the
> plain `tanstackStart()` Vite plugin (no Nitro deployment target), so it emits a
> Web-standard `fetch` handler at `dist/server/server.js` plus static client
> assets in `dist/client` — **not** a runnable `.output/` Node server. `serve.mjs`
> (~150 lines, zero deps) serves `dist/client/**` statically and falls through to
> that `fetch` handler for SSR, server functions, and the Rails API proxy. It also
> fires a boot-time warmup request so the first real user request doesn't pay the
> Redis-connect + dynamic-import init cost. See the "Decision 2" record in
> [`rails-retirement-plan.md`](./rails-retirement-plan.md).
>
> The **worker** is not part of the `vite build` output, so it runs from source
> via `tsx` (a runtime dependency), not from a compiled `.mjs`. The
> `--env-file-if-exists=.env` flag loads `app-node/.env` for local dev (Vite loads
> it for the web server, but `tsx` does not); on Heroku there's no `.env` and the
> flag is a no-op, so dyno config vars are used. (Requires Node >= 20.12.)

### Build

The Node app uses the `heroku/nodejs` buildpack. On deploy:

1. Heroku detects `package.json` and runs `npm install`
2. The `heroku-postbuild` script runs `vite build` (compiling the TanStack Start
   app to `dist/`) followed by `prisma generate`
3. The `postdeploy` script runs `npm run db:migrate` (Prisma migrations)

### Custom Domain

```bash
heroku domains:add housing.sfgov.org --app dahlia-web
```

DNS should point to the Heroku DNS target returned by this command.

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Must be `production` | `production` |
| `PORT` | Set automatically by Heroku | (auto) |
| `RAILS_API_BASE_URL` | Full URL of the Rails internal app | `https://dahlia-salesforce-proxy-abcdef123.herokuapp.com` |
| `INTERNAL_API_KEY` | Shared secret for Node→Rails auth | (generate a secure random string) |
| `CLERK_SECRET_KEY` | Clerk server-side secret | `sk_live_...` |
| `CLERK_PUBLISHABLE_KEY` | Clerk client-side key | `pk_live_...` |
| `DATABASE_URL` | Auto-set by Heroku PostgreSQL add-on | (auto) |
| `REDIS_URL` | Auto-set by Heroku Redis add-on | (auto) |
| `CACHE_WARM_ENABLED` | Enable the scheduled Redis cache pre-warm on the `worker` dyno | `false` (default) / `true` |
| `CACHE_WARM_INTERVAL_MS` | Pre-warm cadence (must stay below the 1-day listing TTLs) | `21600000` (6h, default) |
| `CACHE_WARM_CONCURRENCY` | Max listings warmed in parallel per pass | `4` (default) |

> The cache pre-warm runs on the `worker` dyno (BullMQ repeatable job). It's off
> by default; set `CACHE_WARM_ENABLED=true` to enable. See
> [`cache-prewarm-plan.md`](./cache-prewarm-plan.md).

---

## Rails App (`dahlia-salesforce-proxy`)

### Role

The Rails app is a stateless Salesforce API proxy. It:
- Authenticates to Salesforce via OAuth
- Translates requests to Apex REST format
- Normalizes responses (strips `__c`/`__r` suffixes)
- Processes file attachments via Sidekiq (until migrated to BullMQ)

### Access Control

- No custom domain — only accessible via its Heroku app URL
- Rejects any request without a valid `X-Internal-Api-Key` header (returns 401)
- Only the Node app should call it

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `INTERNAL_API_KEY` | Must match the Node app's key | (same as Node app) |
| `DATABASE_URL` | Shared via cross-app attachment | (auto from attachment) |
| `REDIS_URL` | Shared via cross-app attachment | (auto from attachment) |
| `SALESFORCE_*` | Salesforce OAuth credentials | (existing values) |

---

## Deploying a New Migration Phase

When a new migration phase is ready:

1. Deploy the updated Node app — it begins serving newly migrated paths immediately
2. No restart or redeployment of the Rails app is required
3. The Node app's route configuration determines which paths it serves vs. proxies to Rails

This supports the requirement that new migration phases deploy without Rails downtime.

---

## Scaling

```bash
# Scale Node web dynos
heroku ps:scale web=2:standard-2x --app dahlia-web

# Scale BullMQ workers
heroku ps:scale worker=1:standard-1x --app dahlia-web
```

---

## Troubleshooting

### Redis Connection Issues
Both apps share Redis. If one app has Redis issues, check:
```bash
heroku addons:info REDIS --app dahlia-web
```

### Database Migrations
Only run migrations from the Node app (it owns the Prisma schema):
```bash
heroku run npm run db:migrate --app dahlia-web
```

### Verifying Cross-App Attachment
```bash
heroku addons --app dahlia-salesforce-proxy
# Should show REDIS and DATABASE as attached from dahlia-web
```
