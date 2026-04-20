import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Portfolio } from '@bullfin/shared';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  useCreatePortfolio,
  useDeletePortfolio,
  usePortfolios,
  useUpdatePortfolio,
} from '@/hooks/usePortfolios';
import { useSelectedPortfolio } from '@/contexts/SelectedPortfolioContext';
import { formatDate } from '@/lib/utils';

const Schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(2000).optional(),
});
type Values = z.infer<typeof Schema>;

export default function PortfoliosPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Portfolio | null>(null);
  const [deleting, setDeleting] = useState<Portfolio | null>(null);

  const { data, isLoading } = usePortfolios();
  const create = useCreatePortfolio();
  const { selectedId, setSelectedId } = useSelectedPortfolio();

  const form = useForm<Values>({ resolver: zodResolver(Schema) });

  async function onSubmit(values: Values) {
    try {
      const portfolio = await create.mutateAsync(values);
      toast.success(`Created "${portfolio.name}"`);
      setCreateOpen(false);
      form.reset();
    } catch (err) {
      toast.error('Could not create portfolio', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  }

  return (
    <>
      <TopBar
        title="Portfolios"
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>
            New portfolio
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto space-y-6 p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="size-5" />}
            title="No portfolios yet"
            description="Portfolios group your holdings so BullFin-AI can compute coherent metrics and AI insights for each one."
            action={
              <Button leftIcon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>
                Create your first portfolio
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((p) => (
              <PortfolioCard
                key={p.id}
                portfolio={p}
                onEdit={() => setEditing(p)}
                onDelete={() => setDeleting(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a portfolio</DialogTitle>
            <DialogDescription>
              Give it a name — you can add holdings in the next step.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="My retirement portfolio" {...form.register('name')} />
              {form.formState.errors.name ? (
                <p className="text-xs text-[var(--color-danger)]">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Long-horizon, growth-tilted"
                {...form.register('description')}
              />
            </div>
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={create.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <EditPortfolioDialog
        portfolio={editing}
        onClose={() => setEditing(null)}
      />

      {/* Delete */}
      <DeletePortfolioDialog
        portfolio={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(id) => {
          // If the deleted one was the sticky selection, clear it so no stale
          // id gets carried around. Feature pages auto-fall-back to the first
          // remaining portfolio in their own effects.
          if (selectedId === id) setSelectedId(undefined);
        }}
      />
    </>
  );
}

/* ──────────────────────────────────────────────── Card */
function PortfolioCard({
  portfolio,
  onEdit,
  onDelete,
}: {
  portfolio: Portfolio;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Link
      to={`/app/portfolios/${portfolio.id}`}
      className="group relative block rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 shadow-card transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--color-brand-500)]/40"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">{portfolio.name}</h3>
        <span className="text-xs text-[var(--color-fg-subtle)]">{portfolio.baseCurrency}</span>
      </div>
      {portfolio.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-[var(--color-fg-muted)]">
          {portfolio.description}
        </p>
      ) : (
        <p className="mt-1 text-sm text-[var(--color-fg-subtle)]">No description.</p>
      )}
      <div className="mt-6 flex items-center justify-between text-xs text-[var(--color-fg-subtle)]">
        <span>Updated {formatDate(portfolio.updatedAt)}</span>
        <span className="font-medium text-[var(--color-brand-400)] transition-transform group-hover:translate-x-0.5">
          Open →
        </span>
      </div>

      {/* Action rail — absolutely positioned so it never competes with the
          card link. We stop navigation on the buttons themselves. */}
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <CardIconButton
          label="Rename"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="size-3.5" />
        </CardIconButton>
        <CardIconButton
          label="Delete"
          tone="danger"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-3.5" />
        </CardIconButton>
      </div>
    </Link>
  );
}

function CardIconButton({
  children,
  label,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  tone?: 'danger';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        'grid size-7 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/90 text-[var(--color-fg-muted)] backdrop-blur transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)] ' +
        (tone === 'danger' ? 'hover:border-[var(--color-danger)]/60 hover:text-[var(--color-danger)]' : '')
      }
    >
      {children}
    </button>
  );
}

/* ──────────────────────────────────────────────── Edit dialog */
function EditPortfolioDialog({
  portfolio,
  onClose,
}: {
  portfolio: Portfolio | null;
  onClose: () => void;
}) {
  const update = useUpdatePortfolio();
  const form = useForm<Values>({ resolver: zodResolver(Schema) });

  // Reset the form to the currently-editing portfolio's values each time the
  // dialog opens on a different one.
  useEffect(() => {
    if (portfolio) {
      form.reset({
        name: portfolio.name,
        description: portfolio.description ?? '',
      });
    }
  }, [portfolio, form]);

  async function onSubmit(values: Values) {
    if (!portfolio) return;
    try {
      await update.mutateAsync({
        id: portfolio.id,
        body: {
          name: values.name,
          description: values.description ?? null,
        },
      });
      toast.success('Portfolio updated');
      onClose();
    } catch (err) {
      toast.error('Could not update portfolio', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  }

  return (
    <Dialog open={!!portfolio} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename portfolio</DialogTitle>
          <DialogDescription>
            Update the name or description. Holdings stay where they are.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-xs text-[var(--color-danger)]">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Description</Label>
            <Input id="edit-description" {...form.register('description')} />
          </div>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={update.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────────────────────────────── Delete dialog */
function DeletePortfolioDialog({
  portfolio,
  onClose,
  onDeleted,
}: {
  portfolio: Portfolio | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const del = useDeletePortfolio();

  async function confirmDelete() {
    if (!portfolio) return;
    try {
      await del.mutateAsync(portfolio.id);
      toast.success(`Deleted "${portfolio.name}"`);
      onDeleted(portfolio.id);
      onClose();
    } catch (err) {
      toast.error('Could not delete portfolio', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  }

  return (
    <Dialog open={!!portfolio} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this portfolio?</DialogTitle>
          <DialogDescription>
            <strong className="text-[var(--color-fg)]">{portfolio?.name}</strong> and all of its
            holdings and saved reports will be permanently removed. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={confirmDelete}
            loading={del.isPending}
            className="bg-[var(--color-danger)] text-white hover:bg-[color:#e11d48]"
          >
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
