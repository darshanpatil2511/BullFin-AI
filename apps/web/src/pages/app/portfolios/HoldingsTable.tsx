import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Holding } from '@bullfin/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeleteHolding } from '@/hooks/useHoldings';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

interface HoldingsTableProps {
  portfolioId: string;
  holdings: Holding[];
}

export function HoldingsTable({ portfolioId, holdings }: HoldingsTableProps) {
  const del = useDeleteHolding(portfolioId);

  async function handleDelete(id: string, symbol: string) {
    if (!confirm(`Remove ${symbol} from this portfolio?`)) return;
    try {
      await del.mutateAsync(id);
      toast.success(`Removed ${symbol}`);
    } catch (err) {
      toast.error('Could not remove holding', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-[var(--color-bg-muted)]/60 text-[var(--color-fg-subtle)]">
          <tr>
            <Th>Symbol</Th>
            <Th align="right">Shares</Th>
            <Th align="right">Cost basis</Th>
            <Th align="right">Cost value</Th>
            <Th>Purchased</Th>
            <Th>Sector</Th>
            <Th className="w-[1%]" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {holdings.map((h) => (
            <tr key={h.id} className="transition-colors hover:bg-[var(--color-bg-muted)]/40">
              <Td>
                <span className="font-semibold tracking-wide">{h.symbol}</span>
              </Td>
              <Td align="right" numeric>
                {formatNumber(h.shares, 4)}
              </Td>
              <Td align="right" numeric>
                {formatCurrency(h.purchasePrice)}
              </Td>
              <Td align="right" numeric>
                {formatCurrency(h.shares * h.purchasePrice)}
              </Td>
              <Td className="text-[var(--color-fg-muted)]">{formatDate(h.purchaseDate)}</Td>
              <Td>
                {h.sector ? (
                  <Badge variant="outline" className="text-xs">
                    {h.sector}
                  </Badge>
                ) : (
                  <span className="text-[var(--color-fg-subtle)]">—</span>
                )}
              </Td>
              <Td>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(h.id, h.symbol)}
                  aria-label={`Remove ${h.symbol}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align = 'left',
  className,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.08em] ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className ?? ''}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  numeric,
  className,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 align-middle ${align === 'right' ? 'text-right' : 'text-left'} ${
        numeric ? 'tabular-nums' : ''
      } ${className ?? ''}`}
    >
      {children}
    </td>
  );
}
