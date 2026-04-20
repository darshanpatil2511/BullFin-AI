import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OAuthButtons, OrDivider } from '@/components/auth/OAuthButtons';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from './AuthLayout';

const RegisterSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Full name is required').max(120),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(8),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

type RegisterValues = z.infer<typeof RegisterSchema>;

export default function RegisterPage() {
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(RegisterSchema) });

  async function onSubmit(values: RegisterValues) {
    setSubmitting(true);
    const email = values.email.toLowerCase();
    const { error } = await signUp(email, values.password, values.fullName);
    if (error) {
      setSubmitting(false);
      toast.error('Could not create account', { description: error });
      return;
    }
    // Supabase local dev has email confirmation off by default, so we can
    // sign in immediately. In prod, the user will need to confirm via email.
    const { error: signInErr } = await signIn(email, values.password);
    setSubmitting(false);
    if (signInErr) {
      toast.info('Account created', {
        description: 'Please sign in to continue.',
      });
      navigate('/login');
      return;
    }
    toast.success(`Welcome, ${values.fullName.split(' ')[0]}`);
    navigate('/app', { replace: true });
  }

  return (
    <AuthLayout
      title="Create your BullFin-AI account"
      subtitle="Free for individual investors. No card required."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-[var(--color-brand-400)] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <OAuthButtons />
      <OrDivider label="OR SIGN UP WITH EMAIL" />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          id="fullName"
          label="Full name"
          icon={<UserIcon className="size-4" />}
          placeholder="Darshan Patil"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
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
          placeholder="At least 8 characters"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Field
          id="confirm"
          type="password"
          label="Confirm password"
          icon={<Lock className="size-4" />}
          placeholder="Retype your password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Create account
        </Button>
        <p className="text-xs text-[var(--color-fg-subtle)]">
          By creating an account you agree to the BullFin-AI Terms of Service and
          Privacy Policy.
        </p>
      </form>
    </AuthLayout>
  );
}

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
