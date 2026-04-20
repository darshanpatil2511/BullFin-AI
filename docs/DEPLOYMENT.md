# Deployment

End-to-end guide for taking BullFin-AI from a fresh clone to a live public URL.

## Overview

| Service | Host | Free tier? | Purpose |
|---|---|---|---|
| **Postgres + Auth + Storage** | Supabase | Yes | database, user auth, PDF/CSV buckets |
| **Web client** | Vercel | Yes | static React/Vite build |
| **API gateway** | Render (or Railway) | Yes | Express/TS container |
| **ML engine** | Render (Docker service) | Yes (with cold starts) | FastAPI + pandas/numpy |
| **Redis cache** | Upstash | Yes | yfinance price caching |
| **Error monitoring** | Sentry | Yes | optional |
| **Product analytics** | PostHog | Yes | optional |

## 1 — Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. In **Project Settings → API**, grab the Project URL and the `anon` + `service_role` keys.
3. In **Authentication → Providers → Email**, disable email confirmation for dev, enable it for production.
4. Install the Supabase CLI locally:

    ```bash
    brew install supabase/tap/supabase
    supabase login
    supabase link --project-ref YOUR-REF
    supabase db push
    ```

   That runs `supabase/migrations/*.sql` — schema, RLS, and Storage buckets (`portfolio-uploads`, `reports`, `avatars`).

## 2 — Upstash Redis (optional but recommended)

1. Sign up at [upstash.com](https://upstash.com) and create a free Redis database.
2. Copy the `UPSTASH_REDIS_REST_URL` or TLS connection string into `REDIS_URL` on the ML engine.

## 3 — Web (Vercel)

1. Push the repo to GitHub.
2. In Vercel, **New Project → Import Git Repository**. Select the repo.
3. **Root directory:** `apps/web`
4. **Framework preset:** Vite
5. **Build command:** `cd ../.. && pnpm --filter @bullfin/web build`
6. **Output directory:** `apps/web/dist`
7. **Install command:** `cd ../.. && pnpm install --frozen-lockfile=false`
8. **Environment variables** (production):
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
    - `VITE_API_URL` — the public URL of your Render API service
    - `VITE_POSTHOG_KEY` (optional)
    - `VITE_SENTRY_DSN` (optional)

## 4 — API gateway (Render)

1. In Render, **New → Web Service → Docker**. Select the repo.
2. **Dockerfile path:** `apps/api/Dockerfile`
3. **Docker build context:** repo root (leave blank / `.`)
4. **Plan:** Starter is fine.
5. **Environment variables:**
    - `NODE_ENV=production`
    - `PORT=4000` (Render will forward $PORT anyway)
    - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
    - `GEMINI_API_KEY`
    - `ML_ENGINE_URL` — the private Render URL of the ML service
    - `CLIENT_ORIGIN` — your Vercel domain (e.g. `https://bullfin.vercel.app`)
    - `SENTRY_DSN` (optional)
6. **Health check path:** `/api/health`

## 5 — ML engine (Render)

1. In Render, **New → Web Service → Docker**. Same repo.
2. **Dockerfile path:** `apps/ml/Dockerfile`
3. **Docker build context:** `apps/ml`
4. **Plan:** Starter works but the ML service benefits from Standard once you have real users (MPT + Monte Carlo are CPU-bound).
5. **Environment variables:**
    - `ENV=production`
    - `REDIS_URL` — your Upstash connection string
    - `DEFAULT_BENCHMARK=SPY`
    - `SENTRY_DSN` (optional)
6. **Health check path:** `/health`
7. After deploy, visit `/docs` on the service URL to see the auto-generated OpenAPI explorer.

## 6 — GitHub Actions secrets

Add these under **Settings → Secrets → Actions** for the `deploy.yml` workflow to fire:

| Secret | Where to find it |
|---|---|
| `SUPABASE_PROJECT_REF` | Project settings → General |
| `SUPABASE_ACCESS_TOKEN` | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_DB_PASSWORD` | Project settings → Database |
| `RENDER_API_DEPLOY_HOOK` | Render service → Settings → Deploy Hook (for `api`) |
| `RENDER_ML_DEPLOY_HOOK` | Same, for `ml` |
| `VERCEL_DEPLOY_HOOK` | Vercel project → Settings → Git → Deploy Hooks |

## 7 — Post-deploy verification checklist

- [ ] `https://<api>/api/health` returns `{ ok: true }`
- [ ] `https://<api>/api/health/deep` returns `{ ok: true, checks: { ml_engine: true, supabase: true } }`
- [ ] `https://<ml>/docs` renders FastAPI Swagger
- [ ] Vercel deploy preview succeeds with a placeholder portfolio
- [ ] Sign up, log in, create a portfolio with 2+ holdings
- [ ] `/api/metrics` returns populated data (not `NOT_FOUND` or `UPSTREAM_ERROR`)
- [ ] AI advisor streams tokens back (SSE works through your proxy)
- [ ] PDF report generation saves to `reports` bucket
- [ ] Sentry receives a deliberate test error
- [ ] PostHog session replay captures a dashboard visit (if enabled)

## 8 — Scaling notes

- **yfinance rate limits.** The in-process TTL cache in the ML engine is fine up to ~a few hundred users. Beyond that, swap to shared Redis (`REDIS_URL`) so all ML instances share the cache.
- **ML cold starts** on Render's free tier can take 30–60s. Upgrade to a paid plan or hit `/health` on a cron to keep it warm.
- **Supabase free tier** caps at 500 MB of Postgres + 1 GB of Storage. The schema fits comfortably under that for hundreds of users.
- **Gemini quotas.** Student accounts get generous per-minute limits. If you hit them, route through multiple keys or upgrade the account.

## 9 — Rolling back

Every Render deploy leaves the previous build cached — use **Deploys → Previous → Redeploy** for an instant rollback. Vercel works the same way via **Deployments → Promote to Production**.

For Supabase schema rollbacks, write a forward migration that undoes the change rather than reverting the SQL file — migrations are append-only.
