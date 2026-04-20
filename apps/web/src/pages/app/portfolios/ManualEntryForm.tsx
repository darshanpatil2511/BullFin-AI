import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBulkAddHoldings } from '@/hooks/useHoldings';

const RowSchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9.\-]{1,12}$/, 'Invalid ticker'),
  shares: z.coerce.number().positive(),
  purchasePrice: z.coerce.number().nonnegative(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  sector: z.string().optional(),
});
const Schema = z.object({ rows: z.array(RowSchema).min(1) });
type Values = z.infer<typeof Schema>;

const EMPTY_ROW: Values['rows'][number] = {
  symbol: '',
  shares: 0,
  purchasePrice: 0,
  purchaseDate: new Date().toISOString().slice(0, 10),
  sector: '',
};

export function ManualEntryForm({ portfolioId, onSaved }: { portfolioId: string; onSaved?: () => void }) {
  const bulk = useBulkAddHoldings(portfolioId);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { rows: [{ ...EMPTY_ROW }] },
    mode: 'onBlur',
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rows' });

  async function onSubmit(values: Values) {
    try {
      const inserted = await bulk.mutateAsync(
        values.rows.map((r) => ({
          symbol: r.symbol,
          shares: Number(r.shares),
          purchasePrice: Number(r.purchasePrice),
          purchaseDate: r.purchaseDate,
          sector: r.sector || null,
        })),
      );
      toast.success(`Added ${inserted.length} holdings`);
      form.reset({ rows: [{ ...EMPTY_ROW }] });
      onSaved?.();
    } catch (err) {
      toast.error('Could not save holdings', {
        description: err instanceof Error ? err.message : 'Please review the rows and retry.',
      });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div className="hidden grid-cols-[1.1fr_0.7fr_0.9fr_1fr_1.2fr_auto] gap-2 px-2 text-xs font-medium text-[var(--color-fg-subtle)] md:grid">
        <span>Symbol</span>
        <span>Shares</span>
        <span>Cost basis</span>
        <span>Purchase date</span>
        <span>Sector (optional)</span>
        <span className="sr-only">Remove</span>
      </div>
      <div className="space-y-2">
        {fields.map((f, i) => {
          const errs = form.formState.errors.rows?.[i];
          return (
            <div
              key={f.id}
              className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-muted)]/30 p-2 md:grid-cols-[1.1fr_0.7fr_0.9fr_1fr_1.2fr_auto]"
            >
              <Input placeholder="AAPL" {...form.register(`rows.${i}.symbol`)} aria-invalid={!!errs?.symbol} />
              <Input
                type="number"
                step="0.000001"
                placeholder="0"
                {...form.register(`rows.${i}.shares`)}
                aria-invalid={!!errs?.shares}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...form.register(`rows.${i}.purchasePrice`)}
                aria-invalid={!!errs?.purchasePrice}
              />
              <Input type="date" {...form.register(`rows.${i}.purchaseDate`)} aria-invalid={!!errs?.purchaseDate} />
              <Input placeholder="Technology" {...form.register(`rows.${i}.sector`)} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={fields.length === 1}
                onClick={() => remove(i)}
                aria-label="Remove row"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          leftIcon={<Plus className="size-4" />}
          onClick={() => append({ ...EMPTY_ROW })}
        >
          Add row
        </Button>
        <Button type="submit" loading={bulk.isPending}>
          Save {fields.length} {fields.length === 1 ? 'holding' : 'holdings'}
        </Button>
      </div>
    </form>
  );
}
