# API reference

All endpoints live under `/api` and require a Supabase access token in the
`Authorization: Bearer <jwt>` header unless marked **public**.

Responses follow a stable envelope:

```jsonc
// success
{ "ok": true, "data": ... }
// failure
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
```

Common error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`,
`CONFLICT`, `RATE_LIMITED`, `UPSTREAM_ERROR`, `INTERNAL_ERROR`.

## Health

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | liveness |
| GET | `/api/health/deep` | public | liveness + Supabase + ML engine checks |

## Account

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/me` | — | `UserProfile` |
| PATCH | `/api/me` | `{ fullName?, avatarUrl? }` | updated `UserProfile` |

## Portfolios

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/portfolios?archived=false` | — | `Portfolio[]` |
| GET | `/api/portfolios/:id` | — | `{ portfolio, holdings }` |
| POST | `/api/portfolios` | `{ name, description?, baseCurrency? }` | created `Portfolio` |
| PATCH | `/api/portfolios/:id` | `{ name?, description?, baseCurrency?, isArchived? }` | updated `Portfolio` |
| DELETE | `/api/portfolios/:id` | — | `{ ok: true }` |

## Holdings

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/portfolios/:portfolioId/holdings` | — | `Holding[]` |
| POST | `/api/portfolios/:portfolioId/holdings` | `HoldingInput` | created `Holding` |
| POST | `/api/portfolios/:portfolioId/holdings/bulk` | `{ holdings: HoldingInput[] }` | created `Holding[]` |
| POST | `/api/portfolios/:portfolioId/holdings/upload` | multipart `file=<CSV>` | parsed `Holding[]` |
| PATCH | `/api/holdings/:id` | partial `HoldingInput` | updated `Holding` |
| DELETE | `/api/holdings/:id` | — | `{ ok: true }` |

## Metrics

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/metrics` | `{ portfolioId, benchmark?, riskFreeRate? }` | `MetricsResponse` |

`MetricsResponse` fields: `portfolio` (CAGR, Sharpe, Sortino, Beta, Alpha, MDD, VaR,
diversification, totals), `holdings[]`, `sectorExposure[]`, `benchmark` (cumulative
series), `riskScore` (0–100), `riskLabel`.

## Analyze (advanced)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/analyze/monte-carlo` | `{ portfolioId, years?, simulations?, annualContribution? }` | `{ percentiles, medianFinalValue, probabilityAboveInitial, years }` |
| POST | `/api/analyze/efficient-frontier` | `{ symbols: string[], points? }` | `{ frontier[], maxSharpe, minVolatility }` |

## Chat

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/chat/sessions` | — | `ChatSession[]` |
| GET | `/api/chat/sessions/:id` | — | `{ session, messages }` |
| PATCH | `/api/chat/sessions/:id` | `{ title }` | updated `ChatSession` |
| DELETE | `/api/chat/sessions/:id` | — | `{ ok: true }` |
| POST | `/api/chat/send` | `{ message, portfolioId?, sessionId? }` | **SSE stream** |

### SSE frame shape

The `/api/chat/send` response is `text/event-stream`. Events you'll see:

```
event: session
data: { "sessionId": "<uuid>" }

event: delta
data: { "text": "partial assistant tokens…" }

event: done
data: { "messageId": "<uuid>" }

event: error
data: { "code": "GEMINI_ERROR", "message": "…" }
```

## Reports

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/reports` | — | `Report[]` |
| POST | `/api/reports` | multipart `file=<PDF>` + `{ portfolioId, title? }` | created `Report` |
| GET | `/api/reports/:id/download` | — | `{ url: <signed URL, 5-min TTL> }` |
| DELETE | `/api/reports/:id` | — | `{ ok: true }` |

## Rate limits

- Global: 600 requests / 15 min / IP
- Expensive (metrics, analyze, chat): 20 requests / 60 s / IP
- Upload: 10 requests / 60 s / IP
