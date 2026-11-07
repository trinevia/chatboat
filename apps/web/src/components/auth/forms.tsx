'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ROLES } from '@chatboat/shared';
import { authClient, signIn, signUp } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

function Field({ id, label, ...props }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className='space-y-1.5'>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} required {...props} />
    </div>
  );
}

function ErrorText({ children }: { children?: string | null }) {
  return children ? (
    <p role='alert' className='text-sm text-danger'>
      {children}
    </p>
  ) : null;
}

/** Only allow relative redirects after login. */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className='space-y-4'
      onSubmit={async e => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setPending(true);
        setError(null);
        const { error } = await signIn.email({ email: String(f.get('email')), password: String(f.get('password')) });
        setPending(false);
        if (error) return setError(error.message ?? 'Invalid email or password.');
        router.push(safeNext(params.get('next')));
        router.refresh();
      }}
    >
      <Field id='email' label='Email' type='email' autoComplete='email' />
      <Field id='password' label='Password' type='password' autoComplete='current-password' />
      <ErrorText>{error}</ErrorText>
      <Button className='w-full justify-center' disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
      <div className='flex justify-between text-sm'>
        <Link href='/forgot-password' className='text-muted hover:text-text'>
          Forgot password?
        </Link>
        <span className='text-muted'>No account? Ask your admin for an invite.</span>
      </div>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className='space-y-4'
      onSubmit={async e => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setPending(true);
        setError(null);
        const { error } = await signUp.email({
          name: String(f.get('name')),
          email: String(f.get('email')),
          password: String(f.get('password')),
          role: String(f.get('role')),
        });
        setPending(false);
        if (error) return setError(error.message ?? 'Could not create the account.');
        router.push('/');
        router.refresh();
      }}
    >
      <Field id='name' label='Name' autoComplete='name' />
      <Field id='email' label='Work email' type='email' autoComplete='email' />
      <Field id='password' label='Password' type='password' autoComplete='new-password' minLength={8} />
      <div className='space-y-1.5'>
        <Label htmlFor='role'>Your role</Label>
        <select id='role' name='role' className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm capitalize'>
          {ROLES.map(r => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <p className='text-xs text-muted'>Used to suggest questions that fit your work.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      <Button className='w-full justify-center' disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
      <p className='text-center text-sm text-muted'>
        Already have an account?{' '}
        <Link href='/login' className='font-medium text-brand'>
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  if (sent)
    return (
      <p className='text-sm text-muted'>
        If an account exists for that email, a reset link is on its way. In local development the link is printed in the
        API server log.
      </p>
    );
  return (
    <form
      className='space-y-4'
      onSubmit={async e => {
        e.preventDefault();
        setPending(true);
        await authClient.requestPasswordReset({
          email: String(new FormData(e.currentTarget).get('email')),
          redirectTo: '/reset-password',
        });
        setPending(false);
        setSent(true);
      }}
    >
      <Field id='email' label='Email' type='email' autoComplete='email' />
      <Button className='w-full justify-center' disabled={pending}>
        Send reset link
      </Button>
      <p className='text-center text-sm'>
        <Link href='/login' className='text-muted hover:text-text'>
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');
  const [error, setError] = useState<string | null>(null);
  if (!token) return <p className='text-sm text-danger'>This reset link is invalid or has expired.</p>;
  return (
    <form
      className='space-y-4'
      onSubmit={async e => {
        e.preventDefault();
        const { error } = await authClient.resetPassword({
          token,
          newPassword: String(new FormData(e.currentTarget).get('password')),
        });
        if (error) return setError(error.message ?? 'Could not reset the password.');
        router.push('/login');
      }}
    >
      <Field id='password' label='New password' type='password' autoComplete='new-password' minLength={8} />
      <ErrorText>{error}</ErrorText>
      <Button className='w-full justify-center'>Set new password</Button>
    </form>
  );
}
