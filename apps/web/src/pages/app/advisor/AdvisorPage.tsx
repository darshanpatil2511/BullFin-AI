import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ArrowUp,
  History,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatDate } from '@/lib/utils';
import { apiStream } from '@/lib/api';
import { usePortfolios } from '@/hooks/usePortfolios';
import { useSelectedPortfolio } from '@/contexts/SelectedPortfolioContext';
import {
  chatKeys,
  useChatSession,
  useChatSessions,
  useDeleteSession,
} from '@/hooks/useChat';

interface LiveMessage {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

export default function AdvisorPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedPortfolio = searchParams.get('portfolio') ?? undefined;
  const preselectedQuestion = searchParams.get('question') ?? '';

  const sessionId = searchParams.get('session') ?? undefined;
  const { selectedId, setSelectedId } = useSelectedPortfolio();
  // URL param (deep-link) wins over the globally-remembered selection.
  const portfolioId = preselectedPortfolio ?? selectedId;
  const setPortfolioId = (id: string | undefined) => setSelectedId(id);
  const [draft, setDraft] = useState(preselectedQuestion);
  const [streaming, setStreaming] = useState(false);
  const [live, setLive] = useState<LiveMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const portfolios = usePortfolios();
  const sessions = useChatSessions();
  const activeSession = useChatSession(sessionId);
  const del = useDeleteSession();
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeSession.data, live]);

  // Auto-grow the textarea as the user types — maxes out at 200px then scrolls.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  // Auto-attach the caller's most recently updated portfolio so the advisor
  // always has context. The user can still switch via the top-bar dropdown.
  // If the stored selection no longer exists (e.g. it was just deleted) we
  // quietly fall back to the first one.
  useEffect(() => {
    if (!portfolios.data || portfolios.data.length === 0) return;
    const stillExists = portfolioId && portfolios.data.some((p) => p.id === portfolioId);
    if (!stillExists) setSelectedId(portfolios.data[0]!.id);
  }, [portfolios.data, portfolioId, setSelectedId]);

  // If a `question` was pre-filled via URL (deep-link from the Help page),
  // strip it from the URL after we've consumed it so refresh doesn't re-set
  // the draft on every reload.
  useEffect(() => {
    if (!preselectedQuestion) return;
    const next = new URLSearchParams(searchParams);
    next.delete('question');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link persistence — if the user arrived via `/advisor?portfolio=X`,
  // lift that value into the shared context so jumping to Forecast/Analyze
  // next shows the same portfolio.
  useEffect(() => {
    if (preselectedPortfolio && preselectedPortfolio !== selectedId) {
      setSelectedId(preselectedPortfolio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedPortfolio]);

  const attachedPortfolio = useMemo(
    () => portfolios.data?.find((p) => p.id === portfolioId),
    [portfolios.data, portfolioId],
  );
  const portfolioCount = portfolios.data?.length ?? 0;

  const combinedMessages = useMemo<LiveMessage[]>(() => {
    const saved = (activeSession.data?.messages ?? []).filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    ) as LiveMessage[];
    return [...saved, ...live];
  }, [activeSession.data, live]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft('');
    setStreaming(true);
    setLive([
      { role: 'user', content: text },
      { role: 'assistant', content: '', pending: true },
    ]);

    let newSessionId = sessionId;
    try {
      for await (const evt of apiStream('/chat/send', {
        sessionId,
        portfolioId,
        message: text,
      })) {
        if (evt.event === 'session') {
          newSessionId = (evt.data as { sessionId: string }).sessionId;
        } else if (evt.event === 'delta') {
          const chunk = (evt.data as { text: string }).text;
          setLive((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { ...last, content: last.content + chunk, pending: false };
            }
            return next;
          });
        } else if (evt.event === 'done') {
          break;
        } else if (evt.event === 'error') {
          const { message } = evt.data as { message?: string };
          toast.error('Advisor error', { description: message ?? 'Please try again.' });
          break;
        }
      }
    } catch (err) {
      toast.error('Stream interrupted', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setStreaming(false);
      setLive([]);
      void qc.invalidateQueries({ queryKey: chatKeys.sessions });
      if (newSessionId) {
        void qc.invalidateQueries({ queryKey: chatKeys.session(newSessionId) });
        if (newSessionId !== sessionId) {
          searchParams.set('session', newSessionId);
          setSearchParams(searchParams, { replace: true });
        }
      }
    }
  }

  function newSession() {
    searchParams.delete('session');
    setSearchParams(searchParams, { replace: true });
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this conversation?')) return;
    await del.mutateAsync(id);
    if (id === sessionId) newSession();
    toast.success('Conversation deleted');
  }

  // Renders the list of past conversations. Used by both the desktop aside
  // and the mobile drawer. `afterSelect` closes the drawer on mobile.
  const renderSessions = (afterSelect?: () => void) => {
    if (sessions.isLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      );
    }
    if (!sessions.data || sessions.data.length === 0) {
      return (
        <p className="px-3 py-6 text-xs text-[var(--color-fg-subtle)]">
          Your conversations show up here.
        </p>
      );
    }
    return sessions.data.map((s) => {
      const selectSession = () => {
        searchParams.set('session', s.id);
        setSearchParams(searchParams, { replace: true });
        afterSelect?.();
      };
      return (
        <div
          key={s.id}
          role="button"
          tabIndex={0}
          onClick={selectSession}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              selectSession();
            }
          }}
          className={cn(
            'group flex w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]/60',
            sessionId === s.id
              ? 'bg-[var(--color-brand-500)]/10 text-[var(--color-fg)]'
              : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]',
          )}
        >
          <MessageSquare className="mt-0.5 size-4 shrink-0 opacity-60" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{s.title}</p>
            <p className="truncate text-xs text-[var(--color-fg-subtle)]">
              {formatDate(s.updated_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete(s.id);
            }}
            className="rounded p-1 text-[var(--color-fg-subtle)] opacity-60 hover:bg-[var(--color-bg)] hover:opacity-100 md:invisible md:group-hover:visible md:opacity-100"
            aria-label="Delete conversation"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      );
    });
  };

  return (
    <>
      <TopBar
        title="AI Advisor"
        actions={
          <>
            <Select
              value={portfolioId ?? '__none__'}
              onValueChange={(v) => setPortfolioId(v === '__none__' ? undefined : v)}
            >
              <SelectTrigger className="h-9 w-40 text-sm sm:w-56">
                <SelectValue placeholder="Attach portfolio…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No portfolio context</SelectItem>
                {portfolios.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Past conversations"
              onClick={() => setMobileSessionsOpen(true)}
              className="lg:hidden"
            >
              <History className="size-4" />
            </Button>
            <Button
              onClick={newSession}
              variant="secondary"
              leftIcon={<Plus className="size-4" />}
            >
              <span className="hidden sm:inline">New chat</span>
              <span className="sm:hidden">New</span>
            </Button>
          </>
        }
      />

      {/* Chat region — fills remaining viewport and scrolls internally. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[16rem_1fr]">
        {/* Sessions sidebar */}
        <aside className="hidden min-h-0 flex-col border-r border-[var(--color-border)] lg:flex">
          <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
              Conversations
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">{renderSessions()}</div>
        </aside>

        {/* Mobile drawer with past conversations — slides in from the left. */}
        <DialogPrimitive.Root open={mobileSessionsOpen} onOpenChange={setMobileSessionsOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay
              className={cn(
                'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
              )}
            />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className={cn(
                'fixed left-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-elevated',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
                'duration-200 focus:outline-none lg:hidden',
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                <DialogPrimitive.Title className="text-xs uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
                  Conversations
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  className="inline-flex size-8 items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </DialogPrimitive.Close>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {renderSessions(() => setMobileSessionsOpen(false))}
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        {/* Main chat column */}
        <div className="flex min-h-0 flex-col">
          {/* Scrollable message history */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
            {!sessionId && combinedMessages.length === 0 ? (
              <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-10">
                {attachedPortfolio ? (
                  <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-brand-500)]/25 bg-[var(--color-brand-500)]/8 px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-[var(--color-brand-400)]" />
                      <span>
                        Using{' '}
                        <span className="font-semibold text-[var(--color-brand-300)]">
                          {attachedPortfolio.name}
                        </span>{' '}
                        as context for this conversation.
                      </span>
                    </div>
                    {portfolioCount > 1 ? (
                      <span className="text-xs text-[var(--color-fg-subtle)]">
                        Change via the dropdown above
                      </span>
                    ) : null}
                  </div>
                ) : portfolioCount === 0 ? (
                  <div className="mb-6 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-muted)]/40 px-4 py-3 text-sm text-[var(--color-fg-muted)]">
                    You don&apos;t have any portfolios yet — create one in{' '}
                    <strong className="text-[var(--color-fg)]">Portfolios</strong> to unlock
                    tailored answers.
                  </div>
                ) : null}

                <EmptyState
                  icon={<Sparkles className="size-5" />}
                  title={
                    attachedPortfolio
                      ? `Ask me anything about ${attachedPortfolio.name}`
                      : 'Meet your BullFin-AI advisor'
                  }
                  description={
                    attachedPortfolio
                      ? 'I already have your live metrics, sector exposure, and risk score loaded. Pick a prompt or ask anything in plain English.'
                      : 'Attach a portfolio above so I can see your live metrics, then ask me anything.'
                  }
                  action={
                    <div className="grid w-full grid-cols-1 gap-2 text-left sm:grid-cols-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => setDraft(s)}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 text-sm transition-colors hover:border-[var(--color-brand-500)]/40 hover:bg-[var(--color-bg-muted)]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  }
                />
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-10">
                {activeSession.isLoading ? (
                  <Skeleton className="h-24 w-full rounded-xl" />
                ) : (
                  combinedMessages.map((m, i) => (
                    <Bubble key={i} role={m.role} content={m.content} pending={m.pending} />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Input composer — pinned at the bottom of the column */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 md:px-10"
          >
            <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 focus-within:border-[var(--color-brand-500)]/50">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                placeholder={
                  attachedPortfolio
                    ? `Ask about ${attachedPortfolio.name}… (Enter to send, Shift+Enter for newline)`
                    : 'Attach a portfolio for tailored answers, or ask a general question'
                }
                disabled={streaming}
                autoFocus
                className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!draft.trim() || streaming}
                aria-label="Send"
              >
                {streaming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

const SUGGESTIONS = [
  'How diversified is my portfolio? Where am I most concentrated?',
  "What's my biggest risk right now, and how would I explain it in plain English?",
  'How does my portfolio compare to the S&P 500 over the last year?',
  'If the market drops 20%, what does my max-drawdown history suggest?',
];

function Bubble({
  role,
  content,
  pending,
}: {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}) {
  const isUser = role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser ? (
        <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--color-brand-400)] to-[var(--color-brand-700)] text-xs font-semibold text-[var(--color-brand-950)]">
          AI
        </span>
      ) : null}
      <div
        className={cn(
          'max-w-[min(80ch,75%)] overflow-hidden break-words rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-[var(--color-brand-500)]/15 text-[var(--color-fg)]'
            : 'bg-[var(--color-bg-elevated)] text-[var(--color-fg)]',
        )}
      >
        {content ? (
          <MarkdownLite text={content} />
        ) : pending ? (
          <span className="inline-flex gap-1 py-1">
            <Dot />
            <Dot delay={0.15} />
            <Dot delay={0.3} />
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <motion.span
      className="inline-block size-1.5 rounded-full bg-[var(--color-fg-muted)]"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, delay }}
    />
  );
}

/* ============================================================
 * MarkdownLite — tiny renderer for the subset of markdown Gemini
 * actually uses in chat answers: **bold**, *italic*, `code`, `*` bullets,
 * and blank-line paragraph breaks. Avoids pulling in a full markdown
 * dependency for a few hundred tokens of output.
 * ============================================================ */

interface InlineToken {
  kind: 'text' | 'bold' | 'italic' | 'code';
  value: string;
}

function tokenizeInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let remaining = line;
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/;
  while (remaining.length) {
    const match = pattern.exec(remaining);
    if (!match) {
      tokens.push({ kind: 'text', value: remaining });
      break;
    }
    const before = remaining.slice(0, match.index);
    if (before) tokens.push({ kind: 'text', value: before });
    const matched = match[0];
    if (matched.startsWith('**')) {
      tokens.push({ kind: 'bold', value: matched.slice(2, -2) });
    } else if (matched.startsWith('`')) {
      tokens.push({ kind: 'code', value: matched.slice(1, -1) });
    } else {
      tokens.push({ kind: 'italic', value: matched.slice(1, -1) });
    }
    remaining = remaining.slice(match.index + matched.length);
  }
  return tokens;
}

function renderInline(line: string): React.ReactNode {
  return tokenizeInline(line).map((tok, i) => {
    switch (tok.kind) {
      case 'bold':
        return (
          <strong key={i} className="font-semibold text-[var(--color-fg)]">
            {tok.value}
          </strong>
        );
      case 'italic':
        return (
          <em key={i} className="italic">
            {tok.value}
          </em>
        );
      case 'code':
        return (
          <code
            key={i}
            className="rounded bg-[var(--color-bg-muted)] px-1.5 py-0.5 font-mono text-[0.85em]"
          >
            {tok.value}
          </code>
        );
      default:
        return <span key={i}>{tok.value}</span>;
    }
  });
}

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: Array<
    { kind: 'p'; lines: string[] } | { kind: 'ul'; items: string[] }
  > = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bulletMatch = /^\s*[*\-•]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === 'ul') last.items.push(bulletMatch[1] ?? '');
      else blocks.push({ kind: 'ul', items: [bulletMatch[1] ?? ''] });
    } else if (line.trim() === '') {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === 'p' && last.lines.length > 0) {
        blocks.push({ kind: 'p', lines: [] });
      }
    } else {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === 'p' && last.lines.length > 0) {
        last.lines.push(line);
      } else {
        blocks.push({ kind: 'p', lines: [line] });
      }
    }
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.kind === 'ul') {
          return (
            <ul
              key={i}
              className="list-disc space-y-1 pl-5 marker:text-[var(--color-fg-subtle)]"
            >
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.lines.length === 0) return null;
        return (
          <p key={i}>
            {block.lines.map((l, j) => (
              <span key={j}>
                {renderInline(l)}
                {j < block.lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
