# Architecture

This document explains how the three services in BullFin-AI fit together and why we made each major decision.

## Service boundaries

| Service | Purpose | Owns |
|---|---|---|
| **apps/web** | React SPA. Talks to Supabase for auth/DB and to `apps/api` for compute. | UI, charts, PDF generation (client-side), Gemini streaming UI |
| **apps/api** | Express gateway. Thin orchestration layer. | Auth validation (verifies Supabase JWT), Gemini API proxy (keeps keys server-side), CSV → holdings normalization, calling `apps/ml`, persisting reports |
| **apps/ml** | FastAPI quant engine. Pure compute. | Downloading prices, Sharpe/Beta/Sortino/VaR/MDD/HHI, MPT optimization, Monte Carlo, backtesting |

### Why split api and ml?
- Python is the correct language for quant (pandas, NumPy, SciPy ecosystem)
- Node is a good fit for HTTP orchestration, streaming (Gemini), and Supabase SDK ergonomics
- Independent scaling: ML workloads are CPU-bound and can run on beefier dynos; the gateway is I/O-bound
- Clear boundary between "trusted business logic" (api) and "stateless calculator" (ml)

## Data flow — metrics request

1. Browser POSTs `/api/metrics` with a Supabase JWT.
2. Express middleware verifies the JWT via `supabase.auth.getUser(jwt)`.
3. The gateway loads the caller's holdings from Supabase (RLS scopes the query to their rows automatically).
4. It calls `POST /metrics` on the FastAPI service with just the holdings payload.
5. FastAPI downloads prices (Redis-cached), crunches metrics, returns `MetricsResponse`.
6. Gateway caches the response briefly, returns JSON to the client.
7. Web renders charts with Recharts and the risk score card with Framer Motion.

## Auth model

- Supabase Auth is the single source of truth. No custom JWT signing in `apps/api`.
- `auth.users` (Supabase-managed) → `public.user_profiles` (app-managed, mirrored via trigger).
- Every user-owned table has an owner-only RLS policy — even if the API layer is compromised, a rogue query can't cross tenancy boundaries.
- The API service uses the **service-role key** only for operations that legitimately need to bypass RLS (e.g. admin scripts). Request-handling endpoints pass the caller's JWT to Supabase, so RLS still applies.

## AI advisor (Gemini)

- The web client never holds the Gemini API key. All Gemini calls go through `apps/api`.
- Before calling Gemini, the gateway fetches the user's active portfolio, summarizes it, and injects it as a system message.
- Responses stream back over SSE; the web client renders tokens as they arrive.
- Each message is persisted to `public.chat_messages` tied to a `chat_session`.

## Metrics we compute (Phase 3)

| Metric | Formula / library | Notes |
|---|---|---|
| CAGR | `((final / initial) ^ (1 / years)) - 1`, weighted by actual purchase dates | Fixes the bug in the old Flask engine where all buys were treated as lump-sum |
| Volatility | `std(daily_returns) * sqrt(252)` | Annualized |
| Sharpe | `(mean_return - risk_free_rate) / volatility` | `risk_free_rate` pulled from `^TNX` (10Y Treasury) or env override |
| Sortino | `(mean_return - risk_free_rate) / downside_deviation` | Penalizes only negative returns |
| Beta / Jensen's α | OLS regression of portfolio excess returns on benchmark excess returns | Benchmark defaults to SPY |
| Max Drawdown | Running-max of cumulative returns, then `(current / peak) - 1` | Reported as a negative decimal |
| VaR (1-day, 95%) | Historical 5th percentile of daily returns | Loss estimate |
| Diversification (HHI) | `1 - sum(weights^2)` | 0 = fully concentrated, 1 = perfectly diversified |
| Efficient Frontier | PyPortfolioOpt `EfficientFrontier` | Plotted on risk-return scatter |
| Monte Carlo | Normal-distribution simulation, 10k paths | Used for retirement/drawdown questions |

## Environment topology

### Dev
- Everything on localhost
- Supabase remote project (free tier)
- No Redis required — ml-engine falls back to in-process caching

### Production (Phase 5)
- Web → Vercel (static + edge functions for SSR if needed later)
- API → Render or Railway (docker)
- ML → Render (docker, beefier plan)
- DB/Auth/Storage → Supabase
- Redis → Upstash
- Monitoring → Sentry (errors) + PostHog (product analytics)

## Security checklist (Phase 5 will verify)

- [ ] Supabase service-role key never ships to browser (enforced via `VITE_` prefix convention)
- [ ] RLS policies on every table; `select * ` with the anon key returns only caller's rows
- [ ] Express uses Helmet + per-IP rate limiting on auth endpoints
- [ ] Zod validates every request body; Pydantic validates every ML request
- [ ] CORS whitelist is explicit, not `*`
- [ ] File uploads are size-capped and MIME-type-checked
- [ ] No secrets in git history (`.env` is in `.gitignore`; old JWT_SECRET was rotated)
- [ ] Gemini API key kept server-side only

## Future extensions

- Real-time price ticks via Supabase Realtime or a WebSocket bridge to the ML service
- Goal-based planning (retire with $X by age Y)
- Multi-currency support beyond USD
- OAuth providers (Google, GitHub) via Supabase
- Advisor role: lets a user share a read-only portfolio snapshot with another user
