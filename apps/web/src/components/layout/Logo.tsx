import { cn } from '@/lib/utils';

/**
 * BullFin-AI wordmark — ascending bar chart glyph + gradient wordmark.
 * The glyph reads instantly as a bullish market: three rising bars with
 * a trend arrow climbing over the top. Inline SVG so it inherits color.
 */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        aria-hidden
        className="relative grid size-8 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-[var(--color-brand-400)] to-[var(--color-brand-700)] shadow-[0_6px_20px_-8px_rgba(16,185,129,0.55)]"
      >
        {/* Subtle inner highlight for depth */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-b from-white/15 to-transparent"
        />
        <svg
          viewBox="0 0 24 24"
          className="relative size-5 text-[var(--color-brand-950)]"
        >
          {/* Ascending bars */}
          <rect x="3" y="14" width="4" height="7" rx="1" fill="currentColor" />
          <rect x="10" y="9" width="4" height="12" rx="1" fill="currentColor" />
          <rect x="17" y="4" width="4" height="17" rx="1" fill="currentColor" />
          {/* Upward trend arrow */}
          <path
            d="M3 10 L10 6 L14 8 L20 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
          <path
            d="M16 3 L20 3 L20 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
        </svg>
      </span>
      {showWordmark ? (
        <span className="text-base font-semibold tracking-tight">
          BullFin<span className="text-gradient">.AI</span>
        </span>
      ) : null}
    </div>
  );
}
