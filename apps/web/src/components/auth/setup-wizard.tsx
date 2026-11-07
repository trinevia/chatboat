'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Database } from 'lucide-react';
import { ROLES } from '@chatboat/shared';
import { api, ApiError } from '@/lib/api';
import { useBranding } from '@/components/branding';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

/** First-run setup: company name and the first admin account. Only reachable on an empty install. */
export function SetupWizard() {
  const { data: status } = useBranding();
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status && !status.needsSetup && step === 1) {
    return (
      <div className='space-y-3 text-sm'>
        <p className='text-muted'>This Chatboat is already set up. Sign in, or ask your admin for an invitation.</p>
        <Button className='w-full justify-center' onClick={() => router.push('/login')}>
          Go to sign in
        </Button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className='space-y-4'>
        <div className='flex items-center gap-2 text-sm text-good'>
          <Check className='h-4 w-4' /> Your account is ready.
        </div>
        <div className='rounded-xl border border-border p-4'>
          <div className='flex items-center gap-2 font-medium'>
            <Database className='h-4 w-4 text-muted' /> Your data
          </div>
          <p className='mt-1 text-sm text-muted'>
            Chatboat starts with <strong>sample sales data</strong> so you can try it right away. Connect your own
            database or upload spreadsheets from <strong>Admin → Data sources</strong> when you're ready.
          </p>
        </div>
        <Button
          className='w-full justify-center'
          // Full reload: the session was created before the account became admin.
          onClick={() => window.location.assign('/')}
        >
          Start asking questions
        </Button>
      </div>
    );
  }

  return (
    <form
      className='space-y-4'
      onSubmit={async e => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (f.get('password') !== f.get('confirm')) return setError('The passwords do not match.');
        setPending(true);
        setError(null);
        try {
          await api.setup({
            companyName: String(f.get('company')),
            name: String(f.get('name')),
            email: String(f.get('email')),
            password: String(f.get('password')),
            role: String(f.get('role')),
          });
          await qc.invalidateQueries({ queryKey: ['setup-status'] });
          setStep(2);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Setup failed. Please try again.');
        } finally {
          setPending(false);
        }
      }}
    >
      <div className='space-y-1.5'>
        <Label htmlFor='company'>Company name</Label>
        <Input id='company' name='company' required maxLength={80} placeholder='Acme Ltd' />
      </div>
      <div className='border-t border-border pt-4 text-xs font-medium text-muted'>Your admin account</div>
      <div className='space-y-1.5'>
        <Label htmlFor='name'>Your name</Label>
        <Input id='name' name='name' required autoComplete='name' />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='email'>Work email</Label>
        <Input id='email' name='email' type='email' required autoComplete='email' />
      </div>
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-1.5'>
          <Label htmlFor='password'>Password</Label>
          <Input id='password' name='password' type='password' required minLength={8} autoComplete='new-password' />
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='confirm'>Confirm</Label>
          <Input id='confirm' name='confirm' type='password' required minLength={8} autoComplete='new-password' />
        </div>
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='role'>Your role</Label>
        <select id='role' name='role' defaultValue='executive' className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm capitalize'>
          {ROLES.map(r => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role='alert' className='text-sm text-danger'>
          {error}
        </p>
      )}
      <Button className='w-full justify-center' disabled={pending}>
        {pending ? 'Setting up…' : 'Create admin account'}
      </Button>
    </form>
  );
}
