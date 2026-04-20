import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OAuthButtons, OrDivider } from '@/components/auth/OAuthButtons';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from './AuthLayout';

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type LoginValues = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(LoginSchema) });

  const from = (location.state as { from?: string } | null)?.from ?? '/app';

  async function onSubmit(values: LoginValues) {
    setSubmitting(true);
    const { error } = await signIn(values.email.toLowerCase(), values.password);
    setSubmitting(false);
    if (error) {
      toast.error('Could not sign in', { description: error });
      return;
    }
    toast.success('Welcome back');
    navigate(from, { replace: true });
  }

  return (
    <AuthLayout
      title="Sign in to BullFin-AI"
      subtitle="Welcome back. Pick up where you left off."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-[var(--color-brand-400)] hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <OAuthButtons />
      <OrDivider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          id="email"
          type="email"
          label="Email"
          icon={<Mail className="size-4" />}
          placeholder="you@northeastern.edu"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Field
          id="password"
          type="password"
          label="Password"
          icon={<Lock className="size-4" />}
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

/* ----- small local field helper ----- */
import * as React from 'react';
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  error?: string;
}
const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ id, label, icon, error, className, ...props }, ref) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]">
            {icon}
          </span>
        ) : null}
        <Input ref={ref} id={id} className={icon ? 'pl-9' : undefined} {...props} />
      </div>
      {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
    </div>
  ),
);
Field.displayName = 'Field';
