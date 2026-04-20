import * as React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  delta?: number; // decimal return, e.g. 0.12 = 12%
  tone?: 'neutral' | 'positive' | 'negative';
  loading?: boolean;
  className?: string;
}

export function KpiCard({ label, value, sublabel, delta, tone, loading, className }: KpiCardProps) {
  const resolvedTone =
    tone ?? (delta === undefined ? 'neutral' : delta >= 0 ? 'positive' : 'negative');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 shadow-card',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">{label}</p>
        {delta !== undefined ? <DeltaPill delta={delta} /> : null}
      </div>
      <p
        className={cn(
          'mt-3 text-2xl font-semibold tabular-nums',
          resolvedTone === 'positive' && 'text-[var(--color-brand-300)]',
          resolvedTone === 'negative' && 'text-[color:#fca5a5]',
        )}
      >
        {loading ? <span className="skeleton inline-block h-7 w-24" /> : value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{sublabel}</p>
      ) : null}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-[var(--color-brand-500)]/10 blur-2xl"
      />
    </motion.div>
  );
}

function DeltaPill({ delta }: { delta: number }) {
  const isUp = delta >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isUp
          ? 'bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]'
          : 'bg-[var(--color-danger)]/15 text-[color:#fca5a5]',
      )}
    >
      <Icon className="size-3" />
      {(delta * 100).toFixed(2)}%
    </span>
  );
}
