import { Logo } from '@/components/layout/Logo';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Two-column split layout for sign-in / sign-up — form on the left,
 * aurora-gradient marketing panel on the right. Collapses to one column
 * below md.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col justify-between p-8 md:p-12">
        <Link to="/" className="inline-flex">
          <Logo />
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-sm"
        >
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 text-sm text-[var(--color-fg-muted)]">{footer}</div> : null}
        </motion.div>

        <p className="text-xs text-[var(--color-fg-subtle)]">
          &copy; {new Date().getFullYear()} BullFin-AI &middot; All Rights Reserved
        </p>
      </div>

      {/* Right — marketing panel */}
      <div className="relative hidden overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-bg-elevated)] md:block">
        <div className="absolute inset-0 bg-aurora opacity-80" />
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
            <span className="inline-flex size-2 rounded-full bg-[var(--color-brand-500)] animate-pulse" />
            Live market-aware analysis
          </div>
          <div>
            <p className="text-3xl font-semibold leading-tight tracking-tight">
              <span className="text-gradient">Institutional-grade</span> portfolio analytics,
              <br />
              one upload away.
            </p>
            <p className="mt-4 max-w-md text-sm text-[var(--color-fg-muted)]">
              Unlock twelve quant metrics, Monte-Carlo retirement projections, and a
              five-year forecast for every stock you own with live Yahoo Finance
              data and a Gemini-backed advisor that reads your portfolio before you
              ask.
            </p>
          </div>
          <Stat />
        </div>
      </div>
    </div>
  );
}

function Stat() {
  return (
    <div className="grid grid-cols-3 gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/70 p-4 backdrop-blur">
      <div>
        <p className="text-xs text-[var(--color-fg-subtle)]">Metrics</p>
        <p className="mt-1 text-lg font-semibold">12+</p>
      </div>
      <div>
        <p className="text-xs text-[var(--color-fg-subtle)]">Forecast</p>
        <p className="mt-1 text-lg font-semibold">5 years</p>
      </div>
      <div>
        <p className="text-xs text-[var(--color-fg-subtle)]">AI engine</p>
        <p className="mt-1 text-lg font-semibold text-gradient">BullFin-AI</p>
      </div>
    </div>
  );
}
