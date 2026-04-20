import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type CategoryKey =
  | 'getting-started'
  | 'dashboard'
  | 'portfolios'
  | 'advisor'
  | 'analyze'
  | 'forecast'
  | 'reports'
  | 'settings'
  | 'account';

interface Category {
  key: CategoryKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface FaqItem {
  category: CategoryKey;
  question: string;
  answer: string;
  tags?: string[];
}

const CATEGORIES: Category[] = [
  { key: 'getting-started', label: 'Getting started', icon: Sparkles },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'portfolios', label: 'Portfolios', icon: Briefcase },
  { key: 'advisor', label: 'AI Advisor', icon: MessageSquare },
  { key: 'analyze', label: 'Analyze', icon: BarChart3 },
  { key: 'forecast', label: 'Forecast', icon: TrendingUp },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'settings', label: 'Settings & preferences', icon: SettingsIcon },
  { key: 'account', label: 'Account & security', icon: ShieldCheck },
];

const FAQS: FaqItem[] = [
  // Getting started
  {
    category: 'getting-started',
    question: 'What is BullFin-AI?',
    answer:
      'BullFin-AI turns the stocks you already own into a live analytics dashboard. Drop in a brokerage CSV or type positions by hand and you get every metric a quant desk runs on (Sharpe, Sortino, Beta, VaR, max drawdown, sector and risk scoring), a five-year forecast on every holding, and an AI advisor that reads your portfolio before you ask it a question.',
    tags: ['intro', 'overview', 'what is'],
  },
  {
    category: 'getting-started',
    question: 'How do I create my first portfolio?',
    answer:
      'Click Portfolios in the sidebar, then "New portfolio". Give it a name (e.g. "Retirement", "Brokerage"), open it, and either drag-drop a CSV export from your broker or type holdings in the Add tab. The Dashboard, Forecast, Analyze, and Advisor pages light up the moment you save.',
    tags: ['create', 'setup', 'new'],
  },
  {
    category: 'getting-started',
    question: 'How do I sign in with Google?',
    answer:
      'On the Sign in or Create account page, click the Continue with Google button. You will land back on the dashboard the first time. Google is currently the only third-party provider wired up; additional providers are gated on their respective developer programs.',
    tags: ['google', 'oauth', 'sign in', 'login'],
  },
  {
    category: 'getting-started',
    question: 'What CSV columns does BullFin-AI accept?',
    answer:
      'Common brokerage column names are auto-matched. The canonical form is symbol, shares, purchasePrice, purchaseDate (YYYY-MM-DD). We also accept ticker (→ symbol); quantity / qty / units (→ shares); price / avgCost / cost / buyprice (→ purchasePrice); date / purchaseDate / buydate. Column order does not matter and a sector column is optional.',
    tags: ['csv', 'import', 'upload', 'columns', 'format'],
  },
  {
    category: 'getting-started',
    question: 'Is any of this a buy or sell recommendation?',
    answer:
      'No. Every number you see — metrics, forecast cones, frontier charts, AI answers — is derived from live market data applied to your holdings. The product explains what your portfolio looks like and how it might evolve; it does not tell you to buy or sell any specific security.',
    tags: ['advice', 'recommend', 'disclaimer'],
  },

  // Dashboard
  {
    category: 'dashboard',
    question: 'What do the KPI cards on the dashboard mean?',
    answer:
      'Total value = current market value of every position. Total return = percentage change from cost basis to today. CAGR = annualized growth rate since your earliest purchase. Sharpe = risk-adjusted return (higher is better; above 1 is strong). Max drawdown = the biggest peak-to-trough loss the portfolio has seen. Hover any chart for the full tooltip.',
    tags: ['kpi', 'metrics', 'cards', 'numbers'],
  },
  {
    category: 'dashboard',
    question: 'How is the risk score (0–100) calculated?',
    answer:
      'Five signals are blended: annualized volatility (35%), max drawdown magnitude (25%), Beta vs. the benchmark (20%), concentration via Herfindahl-Hirschman Index (15%), and number of holdings (5%). Below 25 reads as Conservative, 25–44 Moderate, 45–64 Balanced, 65–84 Aggressive, 85+ Speculative.',
    tags: ['risk score', 'score', 'label'],
  },
  {
    category: 'dashboard',
    question: 'Why is the first load of a portfolio slow?',
    answer:
      'The first time you request metrics we pull historical prices for every ticker in your portfolio from live market data. For 10–15 positions the first run is typically 10–20 seconds. Subsequent loads are cached for 15 minutes and are near-instant. Requests fan out in parallel, so adding more holdings barely extends the wait.',
    tags: ['slow', 'loading', 'performance'],
  },
  {
    category: 'dashboard',
    question: 'Does the portfolio I pick here stay picked on other pages?',
    answer:
      'Yes. The portfolio selector on the Dashboard, Analyze, Forecast, Reports, and Advisor pages is shared — picking one on any page carries through to every other page and survives full browser refreshes. If you delete the portfolio you were on, we quietly fall back to the next one.',
    tags: ['persist', 'sticky', 'selection', 'remember'],
  },

  // Portfolios
  {
    category: 'portfolios',
    question: 'Can I have multiple portfolios?',
    answer:
      'As many as you want. Create one per account (brokerage, IRA, crypto, play money) and switch between them in the top-bar dropdown on any feature page. Whatever you picked last is remembered the next time you open the app.',
    tags: ['multiple', 'many', 'accounts'],
  },
  {
    category: 'portfolios',
    question: 'How do I rename or delete a portfolio?',
    answer:
      'On the Portfolios grid, hover any card — a pencil and trash icon appear in the top-right. Pencil opens a rename dialog; trash opens a red-button confirm dialog. Deleting a portfolio permanently removes all of its holdings and any PDF reports generated from it.',
    tags: ['rename', 'edit', 'delete', 'remove'],
  },
  {
    category: 'portfolios',
    question: 'How do I delete a single holding?',
    answer:
      'Open the portfolio, go to the Holdings tab, and click the trash icon on the row you want to remove. The metrics and charts recompute within a second.',
    tags: ['holding', 'remove', 'row'],
  },
  {
    category: 'portfolios',
    question: 'What is the 500-row limit on CSV upload?',
    answer:
      'We cap CSV uploads at 500 rows and 5 MB per file — more than enough for any retail portfolio. If you have something truly large, split it across multiple portfolios (for example by account), or add positions through the Add tab.',
    tags: ['limit', 'size', 'rows'],
  },

  // AI Advisor
  {
    category: 'advisor',
    question: 'What does the advisor know about my portfolio?',
    answer:
      'When a portfolio is attached (the chip at the top of the Advisor page) the advisor sees the portfolio name, every holding with weight and sector, and the live metrics: CAGR, Sharpe, Sortino, Beta, Max Drawdown, VaR, diversification index, and risk score. It does not see your name, email, or any other portfolio.',
    tags: ['context', 'privacy', 'data'],
  },
  {
    category: 'advisor',
    question: 'Can I ask about hypothetical scenarios?',
    answer:
      'Yes. "What if I sold half of my tech exposure?", "How would this portfolio fare in a 2008-style drawdown?", "If I added $10k to XYZ, what would my concentration look like?" all work well. The advisor reasons from your current metrics. For formal multi-thousand-path simulations, head to the Analyze page.',
    tags: ['what if', 'scenarios', 'hypothetical'],
  },
  {
    category: 'advisor',
    question: 'Why does the advisor stop short of telling me what to buy or sell?',
    answer:
      'The advisor is built to inform, not prescribe. It walks through the pros and cons, quantifies the tradeoff ("cutting tech by 20% drops volatility about 15%"), and flags the risks — but leaves the call to you.',
    tags: ['buy', 'sell', 'recommend'],
  },
  {
    category: 'advisor',
    question: 'Where do my past conversations go?',
    answer:
      'Every message is saved under your account. The Conversations list on the left of the Advisor page shows every past chat — click one to reopen it. Delete a session with the trash icon next to its title.',
    tags: ['history', 'saved', 'persistence'],
  },

  // Analyze
  {
    category: 'analyze',
    question: 'What is the Monte Carlo simulation doing?',
    answer:
      'We sample 5,000 future price paths for your portfolio, drawing each day\'s return from the historical return distribution of the holdings. The cone on the chart shows the 10th percentile (pessimistic), 50th (median), and 90th (optimistic) outcomes across the horizon you pick. Set an annual contribution to model ongoing saving.',
    tags: ['monte carlo', 'simulation', 'projection'],
  },
  {
    category: 'analyze',
    question: 'What does the Efficient Frontier show?',
    answer:
      'For any basket of candidate tickers, the frontier plots the best possible expected return at every level of volatility. The gold star marks the maximum-Sharpe portfolio (best risk-adjusted return). The mint triangle marks the minimum-volatility portfolio. Change the lookback to see how recent versus long-term data shifts the curve.',
    tags: ['frontier', 'mpt', 'optimization'],
  },
  {
    category: 'analyze',
    question: 'Why does changing the lookback period shift the frontier so much?',
    answer:
      'Shorter lookbacks (1–2 years) overweight recent conditions and react more to the current regime. Longer lookbacks (5–10 years) span multiple cycles and produce steadier estimates. Neither is "right": a 1-year frontier might over-credit a recent tech rally, while a 10-year one might underweight a structural change. Run both and compare.',
    tags: ['lookback', 'tenure', 'period'],
  },

  // Forecast
  {
    category: 'forecast',
    question: 'What is the Forecast page showing?',
    answer:
      'Every stock in your portfolio gets its own card. Each card shows the recent price history, a dashed median forecast line extending out to the horizon you picked, and a shaded 10th–90th percentile cone around it. Stats include annualized volatility, Sharpe, projected median price at the horizon, and the probability that the stock finishes above today\'s price.',
    tags: ['forecast', 'projection', 'prediction'],
  },
  {
    category: 'forecast',
    question: 'How is each stock\'s forecast generated?',
    answer:
      'We pull up to 15 years of real price history, fit a Geometric Brownian Motion model to the log-return distribution, and simulate 1,000 forward price paths per stock. The cone summarizes those simulations — it is not a single prediction, it is the shape of the possibility space.',
    tags: ['gbm', 'simulation', 'model'],
  },
  {
    category: 'forecast',
    question: 'What is the difference between horizon and training window?',
    answer:
      'Horizon is how far forward to project (1 week up to 5 years). Training window is how much historical data to fit the model on (1 up to 15 years). Longer training gives calmer forecasts; shorter training gives more reactive ones that reflect recent regime changes.',
    tags: ['horizon', 'lookback', 'training'],
  },
  {
    category: 'forecast',
    question: 'Where do the news headlines come from?',
    answer:
      'Each forecast card pulls the latest 3 headlines from a live news feed for that ticker. Click any headline to open the article in a new tab. Headlines are fresh every time you run a new forecast — they are not cached.',
    tags: ['news', 'headlines', 'articles'],
  },

  // Reports
  {
    category: 'reports',
    question: 'How do I generate a PDF report?',
    answer:
      'On the Reports page, pick a portfolio from the dropdown and click Generate PDF. The advisor writes an executive summary, the performance chart is rasterized, and a five-page PDF is assembled (cover + KPIs, performance chart, holdings table, sector + risk, AI summary). The file lands in your private library within a few seconds.',
    tags: ['pdf', 'generate', 'export'],
  },
  {
    category: 'reports',
    question: 'Who can see my reports?',
    answer:
      'Only you. Every report lives in a private bucket under your user folder. The "Open" button creates a signed URL with a 5-minute expiry — the only way to reach the file externally. No other user, and no external actor, can list or read your reports.',
    tags: ['privacy', 'share', 'secure'],
  },
  {
    category: 'reports',
    question: 'Can I customize which sections appear in the PDF?',
    answer:
      'Yes. The Reports page has a "Report sections" card with checkboxes for Performance chart, Holdings table, Sector + risk, and AI executive summary. The cover + KPI grid is always included. Unticking the AI summary also skips the backend round-trip that writes it, so the generation is faster and cheaper.',
    tags: ['template', 'customize', 'layout', 'sections'],
  },

  // Settings & preferences
  {
    category: 'settings',
    question: 'How do I switch between dark and light mode?',
    answer:
      'Open Settings → Appearance and pick Dark, Light, or System. System follows your OS preference and swaps live when your OS flips between day and night. The choice persists across sessions.',
    tags: ['theme', 'dark', 'light', 'system'],
  },
  {
    category: 'settings',
    question: 'What does the "Default benchmark" preference do?',
    answer:
      'Settings → Preferences lets you choose the benchmark your portfolio is compared against in Dashboard charts and Beta calculations. Options include SPY, QQQ, VTI, VT, and AGG. Change it any time — metrics recompute against the new benchmark the next time they refresh.',
    tags: ['benchmark', 'spy', 'qqq', 'vti'],
  },
  {
    category: 'settings',
    question: 'What does "Compact numbers" change?',
    answer:
      'When on, large values show as $1.2k / $12.5M instead of $1,234.56 / $12,543,210. Good on narrow screens or if you prefer quick glances. KPI tooltips always show the exact number regardless of this setting.',
    tags: ['compact', 'numbers', 'format'],
  },
  {
    category: 'settings',
    question: 'How do I export my data?',
    answer:
      'Settings → Data → Export JSON downloads a single file containing your profile, every portfolio with its holdings, saved reports metadata, and your chat sessions. Good for backups or for moving off the product entirely.',
    tags: ['export', 'backup', 'download'],
  },
  {
    category: 'settings',
    question: 'What is the difference between "Sign out this device" and "Sign out everywhere"?',
    answer:
      'Sign out this device ends the session on the browser you are using right now — other devices stay signed in. Sign out everywhere revokes every active session on every device. Use the second one if your account was ever used on a machine you no longer control.',
    tags: ['sign out', 'logout', 'session'],
  },

  // Account & security
  {
    category: 'account',
    question: 'Is my data private?',
    answer:
      'Yes. Every table in the database has per-user access controls enforced at the storage layer — even a bug in the API layer cannot leak another user\'s portfolios. Reports and uploads live in private buckets, accessible only through short-lived signed URLs.',
    tags: ['privacy', 'security', 'data'],
  },
  {
    category: 'account',
    question: 'How do I change my display name?',
    answer:
      'Settings → Profile → Full name, then Save changes. The updated name appears in the top-bar avatar, on generated PDF reports, and in AI advisor conversations.',
    tags: ['name', 'profile', 'display'],
  },
  {
    category: 'account',
    question: 'How do I reset my password?',
    answer:
      'Settings → Security → Reset password sends you a secure email with a one-time link. Click it, pick a new password, and you are back in. The link expires after a short window for safety.',
    tags: ['password', 'reset', 'forgot'],
  },
  {
    category: 'account',
    question: 'How do I delete my account?',
    answer:
      'Settings → Danger zone → Delete account opens a confirmation dialog that asks you to re-type your email address. Confirming runs the deletion immediately: every portfolio, holding, chat session, and PDF report is removed, your auth record is erased, and you are signed out. There is no recovery.',
    tags: ['delete account', 'erase', 'permanent'],
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter((f) =>
      [f.question, f.answer, ...(f.tags ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  const byCategory = useMemo(() => {
    const map = new Map<CategoryKey, FaqItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [filtered]);

  function askAdvisor(): void {
    const q = query.trim();
    const url = q
      ? `/app/advisor?question=${encodeURIComponent(q)}`
      : '/app/advisor';
    navigate(url);
  }

  return (
    <>
      <TopBar title="Help & FAQ" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl space-y-8 p-6">
          {/* Hero — search */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-400)]">
              <HelpCircle className="size-5" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              How can we help?
            </h1>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
              Search the FAQ below. If you don&apos;t find what you need, ask the AI advisor —
              it has full context on your portfolio.
            </p>
            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
              <Input
                placeholder="Search e.g. 'sharpe ratio', 'forecast', 'delete account', 'dark mode'…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-12 pl-10 text-base"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <a
                  key={cat.key}
                  href={`#${cat.key}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs text-[var(--color-fg-muted)] hover:border-[var(--color-brand-500)]/40 hover:text-[var(--color-fg)]"
                >
                  <cat.icon className="size-3.5" />
                  {cat.label}
                </a>
              ))}
            </div>
          </motion.div>

          {/* FAQ by category */}
          {CATEGORIES.map((cat) => {
            const items = byCategory.get(cat.key) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={cat.key} id={cat.key} className="scroll-mt-8 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-brand-500)]/10 text-[var(--color-brand-400)]">
                    <cat.icon className="size-4" />
                  </span>
                  <h2 className="text-lg font-semibold tracking-tight">{cat.label}</h2>
                  <Badge variant="default" className="ml-auto">
                    {items.length} {items.length === 1 ? 'article' : 'articles'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <FaqRow key={`${cat.key}-${i}`} item={item} />
                  ))}
                </div>
              </section>
            );
          })}

          {/* Empty search state */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-muted)]/40 p-8 text-center">
              <p className="text-sm text-[var(--color-fg-muted)]">
                No FAQ matched <span className="font-mono">&quot;{query}&quot;</span>. Try the
                AI advisor below — it might know.
              </p>
            </div>
          ) : null}

          {/* Fallback CTA — AI advisor */}
          <Card className="relative overflow-hidden border-[var(--color-brand-500)]/30">
            <div className="absolute inset-0 bg-aurora opacity-70" aria-hidden />
            <CardHeader className="relative">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
                <Sparkles className="size-3 text-[var(--color-brand-400)]" />
                BullFin-AI Advisor
              </div>
              <CardTitle className="mt-3">Still stuck? Ask the AI advisor.</CardTitle>
              <CardDescription>
                The advisor has your live metrics, sector exposure, and risk score loaded. It
                can answer freeform questions no FAQ article covers.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative flex flex-wrap items-center gap-3">
              <Button onClick={askAdvisor} rightIcon={<ArrowRight className="size-4" />}>
                {query.trim() ? 'Ask the advisor this question' : 'Open the AI advisor'}
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/settings">
                  <SettingsIcon className="size-4" />
                  Go to Settings
                </Link>
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
}

function FaqRow({ item }: { item: FaqItem }) {
  return (
    <details
      className={cn(
        'group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3',
        'open:bg-[var(--color-bg-raised)] open:shadow-card',
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="text-sm font-medium">{item.question}</span>
        <LineChart className="size-4 shrink-0 rotate-0 text-[var(--color-fg-subtle)] transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-3 border-t border-[var(--color-border)] pt-3 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        {item.answer}
      </div>
    </details>
  );
}
