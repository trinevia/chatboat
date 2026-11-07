'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function AcceptInvite({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.invitation(token),
    retry: false,
  });

  if (isLoading) return <p className='text-sm text-muted'>Checking your invitation…</p>;
  if (loadError || !data)
    return (
      <p className='text-sm text-danger'>
        {loadError instanceof ApiError ? loadError.message : 'This invitation is invalid or has expired.'} Ask your admin
        to send a new one.
      </p>
    );

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
          await api.acceptInvitation(token, { name: String(f.get('name')), password: String(f.get('password')) });
          // Full reload so the app picks up the role set when the invitation was accepted.
          window.location.assign('/');
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Could not accept the invitation.');
          setPending(false);
        }
      }}
    >
      <p className='text-sm text-muted'>
        Join <strong className='text-text'>{data.companyName}</strong> as <strong className='text-text'>{data.email}</strong>.
      </p>
      <div className='space-y-1.5'>
        <Label htmlFor='name'>Your name</Label>
        <Input id='name' name='name' required autoComplete='name' />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='password'>Choose a password</Label>
        <Input id='password' name='password' type='password' required minLength={8} autoComplete='new-password' />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='confirm'>Confirm password</Label>
        <Input id='confirm' name='confirm' type='password' required minLength={8} autoComplete='new-password' />
      </div>
      {error && (
        <p role='alert' className='text-sm text-danger'>
          {error}
        </p>
      )}
      <Button className='w-full justify-center' disabled={pending}>
        {pending ? 'Joining…' : 'Join'}
      </Button>
    </form>
  );
}
