import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

interface InfoHintProps {
  /** Tooltip body — short sentence describing the field. */
  children: React.ReactNode;
  /** Accessible label for screen readers when the tooltip is closed. */
  ariaLabel?: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Small circled-info button — hover or keyboard-focus to see an explanation.
 * Use it next to a Label when the field needs an explainer that would clutter
 * the form if rendered inline.
 */
export function InfoHint({
  children,
  ariaLabel = 'More information',
  className,
  side = 'top',
}: InfoHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'inline-flex size-4 items-center justify-center rounded-full text-[var(--color-fg-subtle)] transition-colors',
            'hover:text-[var(--color-brand-400)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]/60',
            className,
          )}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
