import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RiskScoreGaugeProps {
  score: number; // 0-100
  label: string;
  className?: string;
}

/**
 * Plain-English risk gauge. Colors smoothly transition green → amber → red.
 */
export function RiskScoreGauge({ score, label, className }: RiskScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const hue = 140 - (clamped / 100) * 140; // 140 (green) → 0 (red)
  const color = `hsl(${hue} 70% 50%)`;
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative size-32">
        <svg viewBox="0 0 120 120" className="-rotate-90">
          <circle
            cx="60"
            cy="60"
            r="52"
            stroke="var(--color-border)"
            strokeWidth="10"
            fill="none"
          />
          <motion.circle
            cx="60"
            cy="60"
            r="52"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            fill="none"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums" style={{ color }}>
            {clamped}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
            / 100
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">Risk score</p>
        <p className="text-sm font-medium" style={{ color }}>
          {label}
        </p>
      </div>
    </div>
  );
}
