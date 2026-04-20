import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Bot,
  FileText,
  LineChart,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
  Zap,
} from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AnimatedCounter,
  AnimatedHeadline,
  AnimatedSparkline,
  GradientOrbs,
  LivePulse,
  Magnetic,
  MouseSpotlight,
  Reveal,
  TiltCard,
} from '@/components/landing/animations';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]">
      <BackgroundArt />
      <Nav />
      <Hero />
      <FeatureGrid />
      <LiveShowcase />
      <MetricsStripe />
      <StackSection />
      <CTASection />
      <Footer />
    </div>
  );
}

function BackgroundArt() {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[780px] bg-aurora" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.25]" />
      <GradientOrbs />
    </>
  );
}

function Nav() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6"
    >
      <Link to="/">
        <Logo />
      </Link>
      <nav className="hidden items-center gap-8 text-sm text-[var(--color-fg-muted)] md:flex">
        <a href="#features" className="transition-colors hover:text-[var(--color-fg)]">
          Features
        </a>
        <a href="#how" className="transition-colors hover:text-[var(--color-fg)]">
          How it works
        </a>
        <a href="#stack" className="transition-colors hover:text-[var(--color-fg)]">
          Why it works
        </a>
      </nav>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">Sign in</Link>
        </Button>
        <Magnetic strength={4}>
          <Button asChild size="sm" rightIcon={<ArrowRight className="size-4" />}>
            <Link to="/register">Get started</Link>
          </Button>
        </Magnetic>
      </div>
    </motion.header>
  );
}

function Hero() {
  return (
    <MouseSpotlight
      className="relative z-10"
      color="rgba(16, 185, 129, 0.16)"
      size={420}
    >
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pt-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/70 px-3 py-1 text-xs font-medium text-[var(--color-fg-muted)] backdrop-blur"
          >
            <Sparkles className="size-3 text-[var(--color-brand-400)]" />
            The intelligence layer for modern investors
          </motion.span>

          <AnimatedHeadline
            className="mt-6 text-4xl font-semibold leading-tight tracking-tight md:text-6xl"
            lines={[
              ['Your', 'portfolio,'],
              [{ text: 'finally', gradient: true }, { text: 'understood.', gradient: true }],
            ]}
          />

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.55 }}
            className="mx-auto mt-5 max-w-2xl text-base text-[var(--color-fg-muted)] md:text-lg"
          >
            Every metric Wall Street runs on. Every forecast your future depends on. Every answer
            your portfolio demands. All in one tab, all running on your real holdings.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.7 }}
            className="mt-8 flex flex-wrap justify-center gap-3"
          >
            <Magnetic strength={3}>
              <Button asChild size="lg" rightIcon={<ArrowRight className="size-4" />}>
                <Link to="/register">Start free</Link>
              </Button>
            </Magnetic>
            <Magnetic strength={4}>
              <Button asChild variant="secondary" size="lg">
                <a href="#features">Explore features</a>
              </Button>
            </Magnetic>
          </motion.div>
        </motion.div>
        <HeroPreview />
      </section>
    </MouseSpotlight>
  );
}

function HeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 48, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.85, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto mt-16 max-w-5xl"
    >
      <TiltCard intensity={5} className="[perspective:1200px]">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-elevated">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-2">
            <span className="size-2.5 rounded-full bg-[color:#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[color:#ffbd2e]" />
            <span className="size-2.5 rounded-full bg-[color:#28ca42]" />
            <span className="ml-3 truncate text-[10px] text-[var(--color-fg-subtle)]">
              bullfin.ai/app — Dashboard
            </span>
            <div className="ml-auto">
              <LivePulse />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-4">
            <PreviewKpi label="CAGR" value="+12.4%" tone="up" delay={0.7} />
            <PreviewKpi label="Sharpe" value="1.27" delay={0.8} />
            <PreviewKpi label="Max DD" value="-14.2%" tone="down" delay={0.9} />
            <PreviewKpi label="Beta" value="0.92" delay={1.0} />
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4 md:col-span-3">
              <AnimatedSparkline />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4"
            >
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                Risk profile
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-brand-300)]">
                Balanced
              </p>
              <p className="mt-1 text-xs text-[var(--color-fg-muted)]">54 / 100</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '54%' }}
                  transition={{ delay: 1.4, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-gradient-to-r from-[var(--color-brand-400)] to-[var(--color-accent-500)]"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </TiltCard>
    </motion.div>
  );
}

function PreviewKpi({
  label,
  value,
  tone,
  delay = 0,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down';
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4"
    >
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">{label}</p>
      <p
        className={cn(
          'mt-2 text-lg font-semibold tabular-nums',
          tone === 'up' && 'text-[var(--color-brand-300)]',
          tone === 'down' && 'text-[color:#fca5a5]',
        )}
      >
        {value}
      </p>
    </motion.div>
  );
}

/* ───────────────────────────────────────────── Feature grid */
function FeatureGrid() {
  return (
    <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-brand-400)]">
          What you get
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Everything you need to know about what you own.
        </h2>
        <p className="mt-3 text-sm text-[var(--color-fg-muted)] md:text-base">
          Twelve quant signals. Five year forecasts on every holding. An AI advisor that reads
          your portfolio before you ask. One clean dashboard, zero spreadsheets.
        </p>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.05}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[var(--color-brand-500)]/40">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-400)] transition-transform group-hover:scale-110">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{f.body}</p>
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[var(--color-brand-500)]/15 opacity-0 [filter:blur(32px)] transition-opacity duration-300 group-hover:opacity-100"
              />
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Every metric that matters',
    body: 'Sharpe, Sortino, Beta, Max Drawdown, Value at Risk, diversification, and eight more. Computed live on real market data the moment you open the app.',
  },
  {
    icon: Bot,
    title: 'An AI advisor that already knows your portfolio',
    body: 'Ask how you would fare in a downturn, what your biggest concentration is, or whether to trim a sector. Get a grounded, plain English answer in seconds.',
  },
  {
    icon: Upload,
    title: 'From CSV to dashboard in ten seconds',
    body: 'Drop your brokerage export or type positions by hand. We recognize every common column format and start computing the moment you save.',
  },
  {
    icon: LineChart,
    title: 'See the future of every stock you own',
    body: 'Five thousand simulated futures. Five year forecasts on every holding. A risk versus return frontier for any basket you want to compare.',
  },
  {
    icon: FileText,
    title: 'Investor ready reports, one click away',
    body: 'Export a polished PDF with charts, metrics, and an AI written executive summary. Stored privately, shareable on demand.',
  },
  {
    icon: ShieldCheck,
    title: 'Your portfolio, yours alone',
    body: 'Your holdings are locked to your account at the database layer. Nobody else can read them, and neither can our engineers.',
  },
];

/* ───────────────────────────────────────────── Live showcase */
function LiveShowcase() {
  return (
    <section id="how" className="relative z-10 mx-auto max-w-7xl px-6 py-20">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-brand-400)]">
            In three steps
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">From holdings to insight.</h2>
          <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
            No setup, no onboarding friction. Sign up, import your portfolio, chat with the
            advisor. Every metric is recomputed on demand against real historical prices.
          </p>
          <ol className="mt-8 space-y-4">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 transition-colors hover:border-[var(--color-brand-500)]/40"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--color-brand-500)]/15 text-sm font-semibold text-[var(--color-brand-300)]">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{s.body}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={0.2}>
          <TiltCard intensity={4}>
            <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                  <Bot className="size-4 text-[var(--color-brand-400)]" />
                  BullFin Advisor
                </div>
                <LivePulse />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <Bubble role="user" delay={0.1}>
                  How concentrated is my portfolio, and what is the biggest risk?
                </Bubble>
                <Bubble role="assistant" delay={0.3}>
                  Your top two positions (AAPL, MSFT) account for <strong>48%</strong> of value,
                  which puts your diversification index at <strong>0.62</strong>, mid pack. Your
                  beta to SPY is <strong>1.12</strong>, so a 10% market drop tends to take about
                  11.2% off your portfolio. A Monte Carlo run over 15 years suggests a 72%
                  probability you finish above today&apos;s value.
                </Bubble>
                <Bubble role="user" delay={0.5}>
                  If I trimmed tech exposure by 20%, what changes?
                </Bubble>
                <Bubble role="assistant" delay={0.7}>
                  Volatility drops around 15%, Sharpe lifts to about 1.41, and beta falls toward
                  0.95. That is a meaningful reduction in drawdown risk without sacrificing much
                  expected return, though concentration still sits in mega cap growth.
                </Bubble>
              </div>
            </div>
          </TiltCard>
        </Reveal>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: 'Sign up free',
    body: 'Sign up with your email. No card, no questionnaire, no sales call.',
  },
  {
    title: 'Import your holdings',
    body: 'Upload a CSV or type positions by hand. We recognize every common brokerage format.',
  },
  {
    title: 'See it. Ask it. Understand it.',
    body: 'Your dashboard lights up in seconds. Ask the advisor follow up questions that already know every number you are looking at.',
  },
];

function Bubble({
  role,
  children,
  delay = 0,
}: {
  role: 'user' | 'assistant';
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      className={cn('flex', role === 'user' ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5',
          role === 'user'
            ? 'bg-[var(--color-brand-500)]/15 text-[var(--color-fg)]'
            : 'bg-[var(--color-bg-raised)] text-[var(--color-fg-muted)]',
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}

/* ───────────────────────────────────────────── Metrics stripe */
function MetricsStripe() {
  const stats = [
    { numeric: 12, suffix: '+', label: 'Quant metrics, computed live' },
    { numeric: 5000, label: 'Simulated futures per run' },
    { text: '< 2s', label: 'Average dashboard load' },
    { text: 'Live', label: 'AI answers, streamed word by word' },
  ] as const;
  return (
    <section className="relative z-10 border-y border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 py-12 md:grid-cols-4">
        {stats.map((m, i) => (
          <Reveal key={m.label} delay={i * 0.08}>
            <p className="text-3xl font-semibold text-gradient tabular-nums">
              {'numeric' in m ? (
                <AnimatedCounter value={m.numeric} suffix={m.suffix ?? ''} duration={1.8} />
              ) : (
                m.text
              )}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
              {m.label}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────── Stack / Why */
function StackSection() {
  return (
    <section id="stack" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-brand-400)]">
          Why it works
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          Engineered for the investors who demand more.
        </h2>
        <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
          Real time market data. The same quantitative math a trading desk relies on. Security
          architected at the database layer, not bolted on afterward. Designed to feel as sharp
          on your phone as it does on a Bloomberg terminal.
        </p>
      </Reveal>
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StackCard
          delay={0}
          icon={Zap}
          title="Answers in milliseconds"
          body="Your dashboard paints before you blink. Prices, metrics, and forecasts refresh the moment you change a setting or upload a new holding."
        />
        <StackCard
          delay={0.1}
          icon={Wand2}
          title="Math you can trust"
          body="Every number you see is derived on the fly from live market prices. No cached averages, no stale benchmarks, no black box you have to take on faith."
        />
        <StackCard
          delay={0.2}
          icon={ShieldCheck}
          title="Your portfolio, yours alone"
          body="Every holding is locked to your account at the database layer. Nobody else can read it, share it, or export it. Not even the team that builds the product."
        />
      </div>
    </section>
  );
}

function StackCard({
  icon: Icon,
  title,
  body,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="group h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[var(--color-brand-500)]/40">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/15 text-[var(--color-brand-400)] transition-transform group-hover:scale-110">
          <Icon className="size-5" />
        </div>
        <h3 className="mt-4 text-base font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{body}</p>
      </div>
    </Reveal>
  );
}

/* ───────────────────────────────────────────── CTA */
function CTASection() {
  return (
    <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-10 shadow-elevated md:p-16">
          {/* Soft rotating aurora behind the CTA content */}
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-aurora opacity-70"
            animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            style={{ backgroundSize: '200% 200%' }}
          />
          <div className="relative text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              See your portfolio the way{' '}
              <span className="text-gradient">Wall Street</span> sees theirs.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--color-fg-muted)] md:text-base">
              Every Sharpe, every Sortino, every Beta. A five year forecast on every stock you
              own. An AI advisor that reads your portfolio before you ask. Ready the moment you
              upload your first holding.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Magnetic strength={3}>
                <Button asChild size="lg" rightIcon={<ArrowRight className="size-4" />}>
                  <Link to="/register">Create free account</Link>
                </Button>
              </Magnetic>
              <Magnetic strength={4}>
                <Button asChild variant="secondary" size="lg">
                  <Link to="/login">I already have one</Link>
                </Button>
              </Magnetic>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ───────────────────────────────────────────── Footer */
function Footer() {
  return (
    <footer className="relative z-10 border-t border-[var(--color-border)]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-[var(--color-fg-subtle)] md:flex-row">
        <div className="flex items-center gap-2">
          <Logo showWordmark={false} />
          <span>&copy; {new Date().getFullYear()} BullFin-AI &middot; All Rights Reserved</span>
        </div>
      </div>
    </footer>
  );
}
