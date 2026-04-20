# BullFin-AI

> Your portfolio, finally understood.

BullFin-AI turns a CSV of holdings into a live analytics dashboard: every metric a quant desk runs on, a five-year forecast on every position, and an AI advisor that reads your portfolio before you ask it a question. Built as a full-stack production application — authentication, per-user data isolation, real market data, AI-generated reports, responsive on every device.


---

## Table of contents

- [What's inside](#whats-inside)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Supabase setup](#supabase-setup)
- [Development workflow](#development-workflow)
- [Further reading](#further-reading)
- [License](#license)

---

## What's inside

### Dashboard & portfolios
- CSV upload **or** manual entry of positions (symbol, shares, cost basis, purchase date)
- Multiple portfolios per account — rename and delete inline from the grid
- Selection sticks across Dashboard / Analyze / Forecast / Reports / Advisor, and survives reloads
- Annualized CAGR, volatility, Sharpe, Sortino, Jensen's alpha, Beta vs. the chosen benchmark
- Max drawdown, 1-day 95% Value-at-Risk, HHI-based diversification index
- Sector exposure breakdown, live benchmark overlay
- Plain-English **risk score** (0–100) labeled Conservative → Speculative

### AI advisor
- Context-aware chat — your holdings and computed metrics are loaded into the conversation
- Streaming responses, full session history per account
- Handles "what-if" scenarios ("what happens if I cut tech exposure by 20%?")
- Quantifies tradeoffs and flags risks; stops short of buy/sell recommendations

### Forecast
- Geometric Brownian Motion fit on up to 15 years of real prices, 1,000 simulated futures per stock
- Per-holding card with median forecast line + 10th–90th percentile cone
- Configurable horizon (1 week → 5 years) and training window
- Latest headlines per ticker, fetched live

### Analyze
- 5,000-path Monte Carlo simulation with optional annual contribution
- Efficient Frontier (Modern Portfolio Theory) — max-Sharpe and min-volatility portfolios highlighted
- Adjustable lookback window so you can see how recent vs. long-term data shifts the curve

### Reports
- One-click PDF with KPIs, performance chart, holdings table, sector exposure, risk score, and an AI-written executive summary
- Stored in a private per-user bucket, accessible only through short-lived signed URLs

### Account & settings
- Email/password and Google OAuth sign-in
- Dark / light / system theme
- Configurable default benchmark (SPY, QQQ, VTI, VT, AGG) and compact number formatting
- Avatar upload, display-name edit, password reset
- Full data export (portfolios, holdings, reports metadata, chat sessions) as JSON
- Self-serve account deletion — wipes auth, database, and storage immediately

### Engineering foundations
- Per-user data isolation enforced at the database layer — even an API bug cannot leak another user's portfolios
- Typed end-to-end (TypeScript for web + API, Pydantic for the quant engine)
- Every request body validated with Zod / Pydantic
- `prefers-reduced-motion` and touch-device detection on the landing animations
- Mobile-first layout, responsive from phone to 4K

---

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌────────────────────┐
│  apps/web       │◀────▶│   apps/api       │◀────▶│   apps/ml          │
│  React + Vite   │ HTTP │   Express + TS   │ HTTP │   FastAPI (Python) │
│  TypeScript     │      │   (gateway)      │      │   pandas/numpy     │
└────────┬────────┘      └────────┬─────────┘      └─────────┬──────────┘
         │                        │                          │
         │   Supabase JS          │                          │
         ▼                        ▼                          ▼
    ┌───────────────────────────────────┐            ┌──────────────┐
    │        Supabase                   │            │   Upstash    │
    │  Auth · Postgres · Storage · RLS  │            │    Redis     │
    └───────────────────────────────────┘            └──────────────┘
                                 ▲
                                 │
                        ┌────────┴────────┐
                        │  Google Gemini  │
                        │   (advisor)     │
                        └─────────────────┘
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Web | React 19, Vite 5, TypeScript, Tailwind v4, shadcn/ui, Recharts, Framer Motion | Modern, recruiter-recognizable, premium UX out of the box |
| API | Node 20, Express 4, TypeScript, Zod, Pino | Thin gateway — auth validation, orchestration, Gemini proxy |
| ML | Python 3.11, FastAPI, pandas, NumPy, SciPy, scikit-learn, yfinance, PyPortfolioOpt | Real quant — auto OpenAPI docs, Pydantic validation |
| Auth + DB | Supabase (Postgres + Auth + Storage + RLS) | Drops the entire DIY JWT/bcrypt surface area; RLS = per-row security guarantees |
| LLM | Google Gemini (`gemini-2.5-flash`) | Free tier is generous for a student account |
| Cache | Redis (Upstash) | yfinance is slow; price data doesn't change intraday |
| Deploy | Vercel (web), Render/Railway (api + ml), Supabase, Upstash | All have free tiers suitable for a resume project |

---

## Repository layout

```
bullfin-ai/
├── apps/
│   ├── web/          # React + Vite + TS client
│   ├── api/          # Express + TS API gateway
│   └── ml/           # FastAPI Python quant engine
├── packages/
│   └── shared/       # Shared TypeScript types (portfolio, metrics, chat)
├── supabase/
│   ├── config.toml   # Supabase CLI config
│   └── migrations/   # SQL schema + RLS policies
├── data-samples/     # Example Portfolio.csv
├── docs/             # Architecture, API reference, deployment
├── .github/workflows # CI/CD (Phase 5)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .env.example
```

---

## Local setup

### Prerequisites

- **Node.js 20+** (use `nvm use` — the repo ships `.nvmrc`)
- **pnpm 9+** — `npm install -g pnpm`
- **Python 3.11+** — `brew install python@3.11` (macOS)
- **Supabase CLI** — `brew install supabase/tap/supabase`
- A **Supabase project** (free tier): https://supabase.com/dashboard
- A **Google Gemini API key** (free for students): https://aistudio.google.com/app/apikey
- *(optional for prod)* An **Upstash Redis** DB: https://upstash.com

### First-time install

```bash
# 1. Install root + all workspace deps
pnpm install

# 2. Set up the ML engine Python env
cd apps/ml
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cd ../..

# 3. Copy env templates
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
cp apps/ml/.env.example apps/ml/.env
# …then edit each with real keys (see below).
```

---

## Environment variables

| File | Who reads it | Highlights |
|---|---|---|
| `.env` (root) | Documentation / CI | Full reference of every variable |
| `apps/web/.env.local` | Vite / browser | `VITE_*` only; no service-role keys |
| `apps/api/.env` | Express server | `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ML_ENGINE_URL` |
| `apps/ml/.env` | FastAPI service | `REDIS_URL`, `DEFAULT_BENCHMARK`, `RISK_FREE_RATE` |

> **Never** commit a `.env` file. `.gitignore` already blocks them.

---

## Supabase setup

1. **Create a project** at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Copy the API keys** from `Project Settings → API`:
   - `Project URL` → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon` public key → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY` (API server only!)
3. **Link and push migrations:**

    ```bash
    supabase link --project-ref YOUR-PROJECT-REF
    supabase db push
    ```

    This applies `supabase/migrations/*.sql`, creating:
    - `public.user_profiles` (auto-populated on signup via auth trigger)
    - `public.portfolios`, `public.holdings`
    - `public.chat_sessions`, `public.chat_messages`
    - `public.reports`
    - Storage buckets: `portfolio-uploads`, `reports`, `avatars`
    - Row-Level Security on everything

4. **Enable email auth** (on by default) in `Authentication → Providers`. For dev, keep "Confirm email" off so signups are instant.

5. **Enable Google OAuth** (powers the "Continue with Google" button on the sign-in and sign-up pages):

   1. **Google Cloud Console** — open [console.cloud.google.com](https://console.cloud.google.com/) and create (or pick) a project.
   2. **OAuth consent screen** → set User type to External → fill in the app name (`BullFin-AI`), support email, and developer email. No scopes beyond the defaults are required.
   3. **Credentials → Create credentials → OAuth client ID** → choose *Web application*. Add these to **Authorized redirect URIs**:
       - Local dev: `http://localhost:54321/auth/v1/callback` (the Supabase local dev callback)
       - Your hosted Supabase project: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   4. Copy the generated **Client ID** and **Client secret**.
   5. **Supabase dashboard → Authentication → Providers → Google** → toggle it on, paste the Client ID and Client secret, save.
   6. **Authentication → URL Configuration** → set the Site URL to your deployed web origin (for example `http://localhost:5173` in dev, your Vercel domain in prod) and add the same origin to Additional Redirect URLs.

   The web app's [`OAuthButtons`](apps/web/src/components/auth/OAuthButtons.tsx) component already calls `supabase.auth.signInWithOAuth({ provider: 'google' })` — no extra env vars on the client side.

---

## Development workflow

Run everything from the repo root with pnpm:

```bash
# Run web + api together (two concurrent processes)
pnpm dev

# Or run individually
pnpm dev:web    # http://localhost:5173
pnpm dev:api    # http://localhost:4000
pnpm dev:ml     # http://localhost:5000  (FastAPI — start this separately)
```

Other scripts:

```bash
pnpm typecheck    # tsc across the whole workspace
pnpm lint         # ESLint everywhere
pnpm test         # Vitest / pytest per package
pnpm build        # production build for web + api
pnpm format       # Prettier on everything non-Python
```

The ML engine has its own Python toolchain:

```bash
cd apps/ml
source .venv/bin/activate
uvicorn app.main:app --reload --port 5000
ruff check .
pytest
```

---

## Further reading

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — service boundaries, metric formulas, auth model
- [`docs/API.md`](docs/API.md) — every HTTP endpoint and SSE stream
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Vercel + Render + Supabase walk-through

---

## License

MIT — see [LICENSE](LICENSE).
