import * as React from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Bell,
  Camera,
  Download,
  ExternalLink,
  Key,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { usePreferences } from '@/hooks/usePreferences';
import { cn, initialsOf } from '@/lib/utils';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
}

const ProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Required').max(120),
});
type ProfileValues = z.infer<typeof ProfileSchema>;

export default function SettingsPage() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<Profile>('/me'),
  });

  const form = useForm<ProfileValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: { fullName: '' },
  });

  useEffect(() => {
    if (profile.data?.full_name) form.reset({ fullName: profile.data.full_name });
  }, [profile.data, form]);

  async function onSubmit(values: ProfileValues) {
    try {
      await apiFetch<Profile>('/me', { method: 'PATCH', body: { fullName: values.fullName } });
      toast.success('Profile updated');
      void qc.invalidateQueries({ queryKey: ['me'] });
    } catch (err) {
      toast.error('Could not update profile', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleSignOut(scope: 'local' | 'global' = 'local') {
    try {
      if (scope === 'global') {
        await supabase.auth.signOut({ scope: 'global' });
      } else {
        await signOut();
      }
      toast.success(scope === 'global' ? 'Signed out everywhere' : 'Signed out');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error('Could not sign out', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handlePasswordReset() {
    if (!user?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast.success('Password reset email sent', {
        description: `Check ${user.email} for the reset link.`,
      });
    } catch (err) {
      toast.error('Could not send reset email', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleExport() {
    const t = toast.loading('Building your export…');
    try {
      const [portfolios, reports, sessions] = await Promise.all([
        apiFetch<unknown>('/portfolios'),
        apiFetch<unknown>('/reports'),
        apiFetch<unknown>('/chat/sessions'),
      ]);
      const payload = {
        exportedAt: new Date().toISOString(),
        user: {
          id: user?.id,
          email: user?.email,
          profile: profile.data,
        },
        portfolios,
        reports,
        chatSessions: sessions,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bullfin-ai-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export ready', { id: t, description: 'Your browser is downloading it.' });
    } catch (err) {
      toast.error('Export failed', {
        id: t,
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <>
      <TopBar title="Settings" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
          <AppearanceCard />
          <ProfileCard
            userId={user?.id ?? ''}
            email={user?.email ?? ''}
            roleLabel={profile.data?.role ?? 'investor'}
            fullName={profile.data?.full_name ?? ''}
            avatarUrl={profile.data?.avatar_url ?? null}
            onAvatarChange={() => void qc.invalidateQueries({ queryKey: ['me'] })}
            form={form}
            onSubmit={onSubmit}
          />
          <PreferencesCard />
          <SecurityCard onReset={handlePasswordReset} />
          <DataCard onExport={handleExport} />
          <SessionsCard onSignOut={handleSignOut} />
          <DangerZoneCard email={user?.email ?? ''} />
          <AboutCard />
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Appearance
 * ────────────────────────────────────────────────────────────────────── */
function AppearanceCard() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const options: Array<{ value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'system', label: 'System', icon: Monitor },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Currently rendering in <strong>{resolvedTheme}</strong> mode.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-1">
          {options.map((o) => {
            const active = theme === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setTheme(o.value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg px-3 py-4 text-sm transition-colors',
                  active
                    ? 'bg-[var(--color-bg-elevated)] text-[var(--color-fg)] shadow-card'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
                )}
              >
                <o.icon className="size-5" />
                <span className="font-medium">{o.label}</span>
                {o.value === 'system' ? (
                  <span className="text-[10px] text-[var(--color-fg-subtle)]">Auto</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Profile
 * ────────────────────────────────────────────────────────────────────── */
interface ProfileCardProps {
  userId: string;
  email: string;
  roleLabel: string;
  fullName: string;
  avatarUrl: string | null;
  onAvatarChange: () => void;
  form: ReturnType<typeof useForm<ProfileValues>>;
  onSubmit: (v: ProfileValues) => void | Promise<void>;
}

function ProfileCard({
  userId,
  email,
  roleLabel,
  fullName,
  avatarUrl,
  onAvatarChange,
  form,
  onSubmit,
}: ProfileCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Shown in the top bar, in AI advisor conversations, and on generated reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <AvatarPicker
          userId={userId}
          avatarUrl={avatarUrl}
          name={fullName || email}
          onChanged={onAvatarChange}
        />
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Input id="email" value={email} disabled />
              <Badge variant="outline" className="shrink-0 capitalize">
                {roleLabel}
              </Badge>
            </div>
            <p className="text-xs text-[var(--color-fg-subtle)]">
              Email address is managed by your login — can&apos;t be changed here.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" {...form.register('fullName')} />
            {form.formState.errors.fullName ? (
              <p className="text-xs text-[var(--color-danger)]">
                {form.formState.errors.fullName.message}
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            leftIcon={<Save className="size-4" />}
            loading={form.formState.isSubmitting}
          >
            Save changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Avatar picker — drops into the `avatars` public bucket at
 * `{userId}/avatar-{timestamp}.{ext}`. We bust the cache with the timestamp
 * suffix so the browser can't keep serving the old image.
 * ────────────────────────────────────────────────────────────────────── */
function AvatarPicker({
  userId,
  avatarUrl,
  name,
  onChanged,
}: {
  userId: string;
  avatarUrl: string | null;
  name: string;
  onChanged: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!userId) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Use a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image is larger than 2 MB.');
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
      // Unique filename per upload so Supabase's CDN doesn't cache the old
      // bytes. Path must start with `{userId}/` — that's how the RLS policy
      // on the `avatars` bucket decides ownership.
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      if (!pub.publicUrl) throw new Error('Could not resolve avatar URL.');

      await apiFetch('/me', { method: 'PATCH', body: { avatarUrl: pub.publicUrl } });
      toast.success('Avatar updated');
      onChanged();
    } catch (err) {
      toast.error('Could not upload avatar', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await apiFetch('/me', { method: 'PATCH', body: { avatarUrl: null } });
      toast.success('Avatar removed');
      onChanged();
    } catch (err) {
      toast.error('Could not remove avatar', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="grid size-16 place-items-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg-muted)] text-lg font-semibold text-[var(--color-fg-muted)]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <span>{initialsOf(name)}</span>
          )}
        </div>
        {busy ? (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-black/50">
            <Loader2 className="size-5 animate-spin text-white" />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={<Camera className="size-4" />}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {avatarUrl ? 'Change photo' : 'Upload photo'}
        </Button>
        {avatarUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={busy}
          >
            Remove
          </Button>
        ) : null}
        <span className="w-full text-[11px] text-[var(--color-fg-subtle)] sm:w-auto">
          PNG, JPEG, or WebP · up to 2 MB.
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Preferences
 * ────────────────────────────────────────────────────────────────────── */
const BENCHMARKS: Array<{ value: string; label: string; blurb: string }> = [
  { value: 'SPY', label: 'SPY — S&P 500', blurb: 'Broad large-cap US equities' },
  { value: 'QQQ', label: 'QQQ — Nasdaq 100', blurb: 'Tech-heavy growth benchmark' },
  { value: 'VTI', label: 'VTI — Total US market', blurb: 'All-cap US equities' },
  { value: 'VT', label: 'VT — Total world', blurb: 'Global equities (US + ex-US)' },
  { value: 'AGG', label: 'AGG — US aggregate bonds', blurb: 'Fixed income reference' },
];

function PreferencesCard() {
  const { preferences, updatePreferences } = usePreferences();
  const picked = BENCHMARKS.find((b) => b.value === preferences.defaultBenchmark);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          These settings affect how metrics are displayed across the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Default benchmark</Label>
          <Select
            value={preferences.defaultBenchmark}
            onValueChange={(v) => updatePreferences({ defaultBenchmark: v })}
          >
            <SelectTrigger className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BENCHMARKS.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {picked ? (
            <p className="text-xs text-[var(--color-fg-subtle)]">{picked.blurb}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)]/40 p-3">
          <div>
            <p className="text-sm font-medium">Compact numbers</p>
            <p className="text-xs text-[var(--color-fg-subtle)]">
              Show abbreviated values like $1.2k instead of $1,234.56 on cards.
            </p>
          </div>
          <Toggle
            checked={preferences.compactNumbers}
            onChange={(v) => updatePreferences({ compactNumbers: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Security
 * ────────────────────────────────────────────────────────────────────── */
function SecurityCard({ onReset }: { onReset: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-4 text-[var(--color-brand-400)]" />
          Security
        </CardTitle>
        <CardDescription>Account hardening options.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingRow
          title="Password"
          description="We'll email you a secure link to choose a new one."
          action={
            <Button
              variant="secondary"
              leftIcon={<Key className="size-4" />}
              onClick={onReset}
            >
              Reset password
            </Button>
          }
        />
        <SettingRow
          title="Two-factor authentication"
          description="Add an extra security step when signing in."
          action={
            <Button variant="ghost" disabled>
              Coming soon
            </Button>
          }
        />
        <SettingRow
          title="Login notifications"
          description="Email me when a new device signs into my account."
          action={
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-[var(--color-fg-subtle)]" />
              <Toggle disabled checked={false} onChange={() => undefined} />
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Data
 * ────────────────────────────────────────────────────────────────────── */
function DataCard({ onExport }: { onExport: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data</CardTitle>
        <CardDescription>
          Export a machine-readable copy of everything BullFin-AI has stored for your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRow
          title="Export my data"
          description="Downloads a single JSON with your profile, portfolios, holdings, reports, and chat sessions."
          action={
            <Button variant="secondary" leftIcon={<Download className="size-4" />} onClick={onExport}>
              Export JSON
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Sessions
 * ────────────────────────────────────────────────────────────────────── */
function SessionsCard({ onSignOut }: { onSignOut: (scope: 'local' | 'global') => void }) {
  const [busy, setBusy] = useState<'local' | 'global' | null>(null);
  const handle = async (scope: 'local' | 'global'): Promise<void> => {
    setBusy(scope);
    try {
      await onSignOut(scope);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>Sign out of BullFin-AI on this device or everywhere.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          leftIcon={<LogOut className="size-4" />}
          loading={busy === 'local'}
          onClick={() => void handle('local')}
        >
          Sign out this device
        </Button>
        <Button
          variant="outline"
          leftIcon={<ShieldCheck className="size-4" />}
          loading={busy === 'global'}
          onClick={() => void handle('global')}
        >
          Sign out everywhere
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Danger zone
 * ────────────────────────────────────────────────────────────────────── */
function DangerZoneCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  // We require the user to type their email verbatim (case-insensitive) —
  // matches the GitHub "delete repository" pattern. Keeps an accidental
  // click from nuking everything.
  const confirmed = confirmText.trim().toLowerCase() === email.toLowerCase() && email.length > 0;

  async function handleDelete() {
    if (!confirmed || deleting) return;
    setDeleting(true);
    try {
      await apiFetch('/me', { method: 'DELETE' });
      // Supabase auth user is gone — clear local session state and anything
      // we keep in localStorage that belonged to the old account.
      try {
        localStorage.removeItem('bullfin:selected-portfolio');
      } catch {
        /* noop */
      }
      await signOut().catch(() => undefined);
      toast.success('Account deleted', {
        description: 'Everything has been removed. Goodbye.',
      });
      navigate('/', { replace: true });
    } catch (err) {
      setDeleting(false);
      toast.error('Could not delete account', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  }

  function closeAndReset() {
    if (deleting) return;
    setOpen(false);
    // Leave a beat so the close animation isn't visibly resetting the field.
    setTimeout(() => setConfirmText(''), 200);
  }

  return (
    <>
      <Card className="border-[var(--color-danger)]/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[var(--color-danger)]">
            <AlertTriangle className="size-4" />
            Danger zone
          </CardTitle>
          <CardDescription>Irreversible operations. Think twice.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingRow
            title="Delete account"
            description="Permanently erase your account, portfolios, holdings, reports, and chat history."
            action={
              <Button
                variant="danger"
                leftIcon={<Trash2 className="size-4" />}
                onClick={() => setOpen(true)}
              >
                Delete account
              </Button>
            }
          />
          <p className="text-xs text-[var(--color-fg-subtle)]">
            Deletion runs immediately: PDF reports are removed from storage, every holding and
            chat session is wiped from the database, and your auth record is erased.
          </p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => (!v ? closeAndReset() : setOpen(true))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--color-danger)]">
              <AlertTriangle className="size-4" />
              Delete account permanently?
            </DialogTitle>
            <DialogDescription>
              This will immediately remove <strong>everything</strong> under your account —
              portfolios, holdings, generated PDFs, chat sessions, and the auth record itself.
              It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/[0.04] p-4">
            <p className="text-sm text-[var(--color-fg)]">
              To confirm, type your email address:
            </p>
            <p className="font-mono text-xs text-[var(--color-fg-muted)]">{email}</p>
            <Input
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={email}
              aria-label="Type your email to confirm"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={closeAndReset} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              leftIcon={<Trash2 className="size-4" />}
              disabled={!confirmed}
              loading={deleting}
              onClick={handleDelete}
            >
              Delete my account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * About
 * ────────────────────────────────────────────────────────────────────── */
function AboutCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-[var(--color-brand-400)]" />
          About BullFin-AI
        </CardTitle>
        <CardDescription>Build info and resources.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label="Version" value="0.1.0 · development" />
        <Row label="Environment" value={import.meta.env.MODE} />
        <Row
          label="Help & FAQ"
          value={
            <Link
              to="/app/help"
              className="inline-flex items-center gap-1 text-[var(--color-brand-400)] hover:underline"
            >
              Open help
              <ExternalLink className="size-3" />
            </Link>
          }
        />
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Small bits
 * ────────────────────────────────────────────────────────────────────── */

function SettingRow({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)]/40 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-xs text-[var(--color-fg-subtle)]">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 last:border-b-0 last:pb-0">
      <span className="text-[var(--color-fg-muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]/60',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-[var(--color-brand-500)]' : 'bg-[var(--color-border-strong)]',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}
