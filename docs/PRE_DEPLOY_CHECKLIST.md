# Pre-deploy checklist

> Work through this top-to-bottom the day you go live. Every box covers a real landmine we deferred during local development. Check them off as you go.

---

## 🔐 1. Secrets hygiene — do this BEFORE the first `git push`

The local `.env.example` currently contains real live values for
`SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY`. Those files are tracked by
git. If they hit the remote, bots find them in minutes.

- [ ] **Replace real values in [.env.example](../.env.example) with placeholders** (e.g. `your-service-role-key-SERVER-ONLY`, `your-gemini-api-key`). Real values go in `.env` / `.env.local` only — those are gitignored.
- [ ] **Rotate `SUPABASE_SERVICE_ROLE_KEY`** — Supabase dashboard → *Project Settings → API → Reset service_role JWT*. Paste the new one into `apps/api/.env`.
- [ ] **Rotate `GEMINI_API_KEY`** — AI Studio → trash-icon next to the old key → *Create API key* → paste new value into `apps/api/.env`.
- [ ] **Rotate `SUPABASE_ANON_KEY`** too if you've shared it in any screenshot or chat.
- [ ] **Confirm no keys in git history yet:** `git log -p | grep -E "AIzaSy|sb_secret|eyJhbGci"` returns nothing. If it returns anything, use `git filter-repo` or BFG to purge before the first push.
- [ ] Verify `.gitignore` still excludes `.env`, `.env.local`, `.env.*` (while keeping `.env.example`).
- [ ] Confirm `apps/web/.env.local` contains **only** `VITE_*` variables — never `SUPABASE_SERVICE_ROLE_KEY`, never `GEMINI_API_KEY`.

---

## ☁️ 2. Supabase — switch from dev-mode to prod-mode

- [ ] **Turn ON email confirmation** — *Authentication → Sign In / Providers → Email → enable "Confirm email"*. Users will now need to click a link before login; prevents spam signups.
- [ ] **Set the production Site URL** — *Authentication → URL Configuration → Site URL* = your Vercel domain (e.g. `https://bullfin-ai.vercel.app`).
- [ ] **Add Additional Redirect URLs** for the same domain(s), including any `/auth/callback` path.
- [ ] **Double-check RLS is ON** for all 6 tables — *Database → Tables*. Every row should show a shield icon.
- [ ] **Set a strong DB password** if you used a throwaway one during dev. *Project Settings → Database → Reset database password*.
- [ ] (Optional) **Enable Row Level Security 2FA** for your own admin account in Supabase *Account Settings*.

---

## 🌐 3. Infrastructure accounts to set up

- [ ] **Upstash Redis** (free tier) — [upstash.com](https://upstash.com) → create Redis DB → copy `REDIS_URL` → paste into ML engine env vars.
- [ ] **Vercel** account linked to GitHub — will host `apps/web`.
- [ ] **Render** account linked to GitHub — will host `apps/api` and `apps/ml` as two separate Docker services.
- [ ] (Optional) **Sentry** free account + project for each service → copy `SENTRY_DSN` values.
- [ ] (Optional) **PostHog** Cloud free account → copy `POSTHOG_KEY`.

---

## 📦 4. Production environment variables per service

### apps/web (Vercel → Project Settings → Environment Variables)

- [ ] `VITE_SUPABASE_URL` = your Supabase URL
- [ ] `VITE_SUPABASE_ANON_KEY` = rotated anon key
- [ ] `VITE_API_URL` = your Render API URL (e.g. `https://bullfin-api.onrender.com`)
- [ ] `VITE_POSTHOG_KEY` (if using)
- [ ] `VITE_SENTRY_DSN` (if using)

### apps/api (Render → Service → Environment)

- [ ] `NODE_ENV=production`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (rotated)
- [ ] `GEMINI_API_KEY` (rotated)
- [ ] `GEMINI_MODEL=gemini-2.5-flash` (or whichever you want in prod)
- [ ] `ML_ENGINE_URL` = internal/private URL of the ML Render service
- [ ] `CLIENT_ORIGIN` = your Vercel production domain (exact string, no trailing slash)
- [ ] `SENTRY_DSN` (if using)

### apps/ml (Render → Service → Environment)

- [ ] `ENV=production`
- [ ] `REDIS_URL` = Upstash connection string
- [ ] `DEFAULT_BENCHMARK=SPY`
- [ ] `SENTRY_DSN` (if using)

---

## 🔄 5. GitHub Actions secrets (for `deploy.yml` to fire on push)

Add under repo → *Settings → Secrets and variables → Actions*:

- [ ] `SUPABASE_PROJECT_REF`
- [ ] `SUPABASE_ACCESS_TOKEN` — [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
- [ ] `SUPABASE_DB_PASSWORD`
- [ ] `RENDER_API_DEPLOY_HOOK` — Render service → *Settings → Deploy Hook*
- [ ] `RENDER_ML_DEPLOY_HOOK`
- [ ] `VERCEL_DEPLOY_HOOK` — Vercel project → *Settings → Git → Deploy Hooks*

---

## ✅ 6. Post-deploy verification

After the first deploy, run through these:

- [ ] `GET https://<api>/api/health` → `{ "ok": true }`
- [ ] `GET https://<api>/api/health/deep` → both `ml_engine` and `supabase` report `true`
- [ ] `GET https://<ml>/docs` → FastAPI Swagger UI loads
- [ ] Sign up through the live site; confirmation email arrives; login works after clicking link
- [ ] Create a portfolio, upload `data-samples/Sample_Portfolio.csv`, confirm all 6 tables in Supabase get rows
- [ ] Dashboard KPIs populate (yfinance cold-start may take 10–20s on Render free tier the first time)
- [ ] AI Advisor streams tokens back correctly — SSE isn't blocked by any proxy
- [ ] PDF export generates and downloads from Supabase Storage
- [ ] Open **Authentication → Users** in Supabase — confirm the new user is there, with email-verified = true
- [ ] Try hitting `/api/portfolios` with **someone else's JWT** (manually) — should return 401 or empty. Proves RLS holds.

---

## 🎨 7. Polish for the recruiter-facing README

- [ ] Replace placeholder domains in [README.md](../README.md) with your live URLs
- [ ] Replace the `https://bullfin.ai/` placeholders in [apps/web/index.html](../apps/web/index.html) (the `og:url`, `og:image`, `twitter:image`, and `canonical` tags) with your actual deployed domain
- [ ] Rasterize [apps/web/public/og-image.svg](../apps/web/public/og-image.svg) to a 1200×630 **PNG** named `og-image.png` and commit it next to the SVG (Twitter/X still rejects SVG OG images). Quick one-liner with `rsvg-convert`:
  ```bash
  rsvg-convert -w 1200 -h 630 apps/web/public/og-image.svg -o apps/web/public/og-image.png
  ```
  Then flip `og-image.svg` → `og-image.png` in [index.html](../apps/web/index.html).
- [ ] Validate the OG card with <https://www.opengraph.xyz/> or <https://cards-dev.twitter.com/validator>
- [ ] Add a **Live demo** link at the top of the README, plus a separate **"Try it free"** button
- [ ] Add 3–4 screenshots of the dashboard, advisor, and landing page to `docs/images/` and embed in README
- [ ] Record a 60-second Loom/screen-recording demo and link it
- [ ] Pin the repo on your GitHub profile
- [ ] Add the project to your resume with the live URL

---

## 💰 8. Cost sanity checks

- [ ] Supabase on free tier (500 MB DB, 1 GB storage — plenty)
- [ ] Render free tier for api + ml (note: cold starts ~30–60s)
- [ ] Vercel Hobby (unlimited for personal projects)
- [ ] Upstash free tier (10k commands/day — way more than needed)
- [ ] Gemini free tier (15 req/min, 1,500/day)
- [ ] **Do NOT upgrade any of these to paid** unless you see real traffic — they're all generous for a portfolio project

---

## 🌍 9. Custom domain (optional — nice-to-have for resume)

- [ ] Buy a domain (`bullfin.app`, `bullfin.ai`, `trybullfin.com` — use Namecheap/Cloudflare)
- [ ] Point the root + `www` records at Vercel (Vercel gives you the DNS records)
- [ ] Update Supabase Auth Site URL and redirect URLs to the new domain
- [ ] Update `CLIENT_ORIGIN` on the API service
- [ ] Update `VITE_API_URL` on web if you also move the API to a subdomain

---

## 🚨 Known gotchas

- **Render free-tier cold starts** — the ML engine sleeps after 15 min of inactivity. First request after a cold start takes 30–60s. Acceptable for a demo; if it bites during a recruiter demo, either pre-warm it (hit `/health` right before) or upgrade the plan.
- **yfinance intermittent failures** — Yahoo sometimes rate-limits. Our engine returns `UPSTREAM_ERROR` in that case; retrying usually works. Consider adding a paid fallback like Alpha Vantage later.
- **Supabase auth emails** — free tier uses Supabase's own SMTP which has lower deliverability. For a real launch, plug in SendGrid/Resend under *Authentication → SMTP Settings*.
- **Gemini streaming through CDNs** — some edge caches buffer SSE. Vercel and Render both pass SSE through cleanly, but if you ever go behind Cloudflare, disable buffering for the `/api/chat/send` route.

---

**When every box is checked, you're live.** 🎉
