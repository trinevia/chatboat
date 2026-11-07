'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Monitor, Moon, Sun } from 'lucide-react';
import { ROLES } from '@chatboat/shared';
import { authClient, useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className='grid gap-4 border-b border-border py-6 md:grid-cols-[220px_1fr]'>
      <div>
        <h2 className='text-sm font-semibold'>{title}</h2>
        <p className='mt-1 text-sm text-muted'>{description}</p>
      </div>
      <div className='max-w-md'>{children}</div>
    </section>
  );
}

function ProfileForm() {
  const { data: session, refetch } = useSession();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [role, setRole] = useState('sales');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (session) {
      setName(session.user.name);
      setRole(session.user.role ?? 'sales');
    }
  }, [session]);
  if (!session) return <p className='text-sm text-muted'>Loading…</p>;

  const dirty = name.trim() !== session.user.name || role !== (session.user.role ?? 'sales');
  return (
    <form
      className='space-y-4'
      onSubmit={async e => {
        e.preventDefault();
        setSaving(true);
        const { error } = await authClient.updateUser({ name: name.trim(), role });
        setSaving(false);
        if (error) return toast.error(error.message ?? 'Could not save your profile.');
        await refetch();
        // Suggested questions depend on the role.
        qc.invalidateQueries({ queryKey: ['suggestions'] });
        toast.success('Profile saved');
      }}
    >
      <div className='space-y-1.5'>
        <Label htmlFor='name'>Name</Label>
        <Input id='name' value={name} onChange={e => setName(e.target.value)} required maxLength={80} />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='email'>Email</Label>
        <Input id='email' value={session.user.email} disabled />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='role'>Role</Label>
        <select
          id='role'
          value={role}
          onChange={e => setRole(e.target.value)}
          className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm capitalize'
        >
          {ROLES.map(r => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <p className='text-xs text-muted'>Changes the questions suggested on the home page.</p>
      </div>
      <Button disabled={!dirty || saving || !name.trim()}>{saving ? 'Saving…' : 'Save changes'}</Button>
    </form>
  );
}

function PasswordForm() {
  const [pending, setPending] = useState(false);
  return (
    <form
      className='space-y-4'
      onSubmit={async e => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const next = String(f.get('new'));
        if (next !== String(f.get('confirm'))) return toast.error('The new passwords do not match.');
        setPending(true);
        const { error } = await authClient.changePassword({
          currentPassword: String(f.get('current')),
          newPassword: next,
          revokeOtherSessions: true,
        });
        setPending(false);
        if (error) return toast.error(error.message ?? 'Could not change your password.');
        form.reset();
        toast.success('Password changed. Other devices were signed out.');
      }}
    >
      <div className='space-y-1.5'>
        <Label htmlFor='current'>Current password</Label>
        <Input id='current' name='current' type='password' autoComplete='current-password' required />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='new'>New password</Label>
        <Input id='new' name='new' type='password' autoComplete='new-password' minLength={8} required />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='confirm'>Confirm new password</Label>
        <Input id='confirm' name='confirm' type='password' autoComplete='new-password' minLength={8} required />
      </div>
      <Button disabled={pending}>{pending ? 'Updating…' : 'Change password'}</Button>
    </form>
  );
}

type Theme = 'system' | 'light' | 'dark';

function applyTheme(t: Theme) {
  try {
    if (t === 'system') {
      localStorage.removeItem('theme');
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem('theme', t);
      document.documentElement.dataset.theme = t;
    }
  } catch {
    // Storage can be blocked (private mode); the theme still applies for this visit.
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }
}

function ThemePicker() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setTheme(t === 'light' || t === 'dark' ? t : 'system');
  }, []);
  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ];
  return (
    <div role='radiogroup' aria-label='Theme' className='grid grid-cols-3 gap-2'>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role='radio'
          aria-checked={theme === value}
          onClick={() => {
            setTheme(value);
            applyTheme(value);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm',
            theme === value ? 'border-brand bg-brand-soft text-brand' : 'border-border hover:border-brand'
          )}
        >
          <Icon className='h-4 w-4' />
          {label}
        </button>
      ))}
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <h1 className='text-xl font-semibold'>Settings</h1>
      <Section title='Profile' description='Your name and role.'>
        <ProfileForm />
      </Section>
      <Section title='Appearance' description='Use your system setting or pick one.'>
        <ThemePicker />
      </Section>
      <Section title='Password' description='Changing it signs you out on other devices.'>
        <PasswordForm />
      </Section>
    </div>
  );
}
