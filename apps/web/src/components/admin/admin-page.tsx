'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, ImageUp, MailPlus, Trash2, X } from 'lucide-react';
import { ACCESS_ROLES, ROLES, type Member } from '@chatboat/shared';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { BrandMark, useBranding } from '@/components/branding';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { DataTab } from './data-tab';

const selectCls = 'h-8 rounded-md border border-border bg-surface px-2 text-xs capitalize';
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function InviteForm() {
  const qc = useQueryClient();
  const [link, setLink] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: api.invite,
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['admin-members'] });
      if (r.emailed) {
        toast.success('Invitation sent');
        setLink(null);
      } else {
        toast.warning("Email couldn't be sent. Share the link below instead.");
        setLink(r.link);
      }
    },
    onError: e => toast.error(errMsg(e, 'Could not send the invitation.')),
  });
  return (
    <div className='rounded-xl border border-border bg-surface p-4'>
      <h3 className='text-sm font-semibold'>Invite someone</h3>
      <form
        className='mt-3 flex flex-wrap items-end gap-2'
        onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          invite.mutate(
            { email: String(f.get('email')), accessRole: String(f.get('access')), role: String(f.get('role')) },
            { onSuccess: () => (e.target as HTMLFormElement).reset() }
          );
        }}
      >
        <div className='min-w-56 flex-1 space-y-1.5'>
          <Label htmlFor='invite-email'>Email</Label>
          <Input id='invite-email' name='email' type='email' required placeholder='colleague@company.com' />
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='invite-role' className='block'>Role</Label>
          <select id='invite-role' name='role' defaultValue='sales' className='h-10 rounded-lg border border-border bg-surface px-3 text-sm capitalize'>
            {ROLES.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='invite-access' className='block'>Access</Label>
          <select id='invite-access' name='access' defaultValue='member' className='h-10 rounded-lg border border-border bg-surface px-3 text-sm capitalize'>
            {ACCESS_ROLES.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <Button disabled={invite.isPending}>
          <MailPlus className='h-4 w-4' /> {invite.isPending ? 'Sending…' : 'Send invite'}
        </Button>
      </form>
      {link && (
        <div className='mt-3 flex gap-2'>
          <Input value={link} readOnly aria-label='Invitation link' onFocus={e => e.target.select()} />
          <Button
            variant='secondary'
            className='shrink-0'
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              toast.success('Link copied');
            }}
          >
            <Copy className='h-4 w-4' /> Copy
          </Button>
        </div>
      )}
      <p className='mt-2 text-xs text-muted'>Admins can invite people, change roles, manage data and branding. Invitations expire after 7 days.</p>
    </div>
  );
}

function MembersTab() {
  const qc = useQueryClient();
  const dialogs = useDialogs();
  const { data: session } = useSession();
  const { data, isLoading } = useQuery({ queryKey: ['admin-members'], queryFn: api.adminMembers });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-members'] });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { accessRole?: string; role?: string } }) => api.updateMember(id, body),
    onSuccess: refresh,
    onError: e => {
      refresh();
      toast.error(errMsg(e, 'Could not update the member.'));
    },
  });
  const remove = useMutation({
    mutationFn: api.removeMember,
    onSuccess: () => {
      refresh();
      toast.success('Member removed');
    },
    onError: e => toast.error(errMsg(e, 'Could not remove the member.')),
  });
  const revoke = useMutation({ mutationFn: api.revokeInvite, onSuccess: refresh });

  const askRemove = async (m: Member) => {
    const ok = await dialogs.confirm({
      title: `Remove ${m.name}?`,
      description: `${m.email} will be signed out and lose access. Their chats, dashboards and digests are deleted.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) remove.mutate(m.id);
  };

  return (
    <div className='space-y-6'>
      {data && !data.emailConfigured && (
        <p className='rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm'>
          Email isn’t configured (SMTP_URL), so invitations show a link to share instead of being emailed.
        </p>
      )}
      <InviteForm />
      {isLoading && <p className='text-sm text-muted'>Loading…</p>}
      {data && (
        <div className='overflow-x-auto rounded-xl border border-border bg-surface'>
          <table className='w-full text-sm'>
            <thead className='bg-surface-2 text-left text-xs text-muted'>
              <tr>
                <th className='px-4 py-2 font-medium'>Person</th>
                <th className='px-4 py-2 font-medium'>Role</th>
                <th className='px-4 py-2 font-medium'>Access</th>
                <th className='px-4 py-2 text-right font-medium'>Questions this month</th>
                <th className='px-4 py-2' />
              </tr>
            </thead>
            <tbody>
              {data.members.map(m => {
                const isMe = m.id === session?.user.id;
                return (
                  <tr key={m.id} className='border-t border-border'>
                    <td className='px-4 py-2'>
                      <div className='font-medium'>
                        {m.name} {isMe && <span className='text-xs font-normal text-muted'>(you)</span>}
                      </div>
                      <div className='text-xs text-muted'>{m.email}</div>
                    </td>
                    <td className='px-4 py-2'>
                      <select
                        aria-label={`Role for ${m.name}`}
                        value={m.role}
                        onChange={e => update.mutate({ id: m.id, body: { role: e.target.value } })}
                        className={selectCls}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className='px-4 py-2'>
                      <select
                        aria-label={`Access for ${m.name}`}
                        value={m.accessRole}
                        onChange={e => update.mutate({ id: m.id, body: { accessRole: e.target.value } })}
                        className={selectCls}
                      >
                        {ACCESS_ROLES.map(r => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className='px-4 py-2 text-right tabular-nums'>{m.questionsThisMonth}</td>
                    <td className='px-4 py-2 text-right'>
                      {!isMe && (
                        <button
                          aria-label={`Remove ${m.name}`}
                          onClick={() => askRemove(m)}
                          className='cursor-pointer rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.pending.map(p => (
                <tr key={p.token} className='border-t border-border text-muted'>
                  <td className='px-4 py-2'>
                    <div>{p.email}</div>
                    <div className='text-xs'>Invited · expires {new Date(p.expiresAt).toLocaleDateString()}</div>
                  </td>
                  <td className='px-4 py-2 text-xs capitalize'>{p.role}</td>
                  <td className='px-4 py-2 text-xs capitalize'>{p.accessRole}</td>
                  <td />
                  <td className='px-4 py-2 text-right'>
                    <button
                      aria-label={`Cancel invitation for ${p.email}`}
                      onClick={() => revoke.mutate(p.token)}
                      className='cursor-pointer rounded p-1.5 hover:bg-surface-2 hover:text-text'
                    >
                      <X className='h-4 w-4' />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Shrink an uploaded image to at most 256px and return it as a PNG data URL. */
async function toLogoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

function CompanyTab() {
  const qc = useQueryClient();
  const { data } = useBranding();
  const [name, setName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => {
    if (data) {
      setName(data.companyName);
      setLogo(data.logo);
    }
  }, [data]);
  const save = useMutation({
    mutationFn: () => api.saveBranding({ companyName: name.trim(), logo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['setup-status'] });
      toast.success('Company details saved');
    },
    onError: e => toast.error(errMsg(e, 'Could not save.')),
  });

  return (
    <form
      className='max-w-md space-y-4'
      onSubmit={e => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className='space-y-1.5'>
        <Label htmlFor='company-name'>Company name</Label>
        <Input id='company-name' value={name} maxLength={80} required onChange={e => setName(e.target.value)} />
        <p className='text-xs text-muted'>Shown in the sidebar, on the sign-in page and in email digests.</p>
      </div>
      <div className='space-y-1.5'>
        <span className='text-sm font-medium'>Logo</span>
        <div className='flex items-center gap-3'>
          <BrandMark logo={logo} size='lg' />
          <label className='inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2'>
            <ImageUp className='h-4 w-4' /> Upload
            <input
              type='file'
              accept='image/png,image/jpeg,image/webp'
              className='sr-only'
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setLogo(await toLogoDataUrl(file));
                } catch {
                  toast.error('Could not read that image.');
                }
              }}
            />
          </label>
          {logo && (
            <Button type='button' variant='ghost' size='sm' onClick={() => setLogo(null)}>
              Remove
            </Button>
          )}
        </div>
        <p className='text-xs text-muted'>PNG, JPEG or WebP. Resized to 256px.</p>
      </div>
      <Button disabled={save.isPending || !name.trim()}>{save.isPending ? 'Saving…' : 'Save'}</Button>
    </form>
  );
}

const TABS = { members: 'Members', data: 'Data sources', company: 'Company' } as const;

export function AdminPage() {
  const { data: session, isPending } = useSession();
  const [tab, setTab] = useState<keyof typeof TABS>('members');
  if (isPending) return <div className='p-8 text-sm text-muted'>Loading…</div>;
  if (session?.user.accessRole !== 'admin') {
    return <div className='p-8 text-sm text-muted'>Only admins can open this page.</div>;
  }
  return (
    <div className='mx-auto max-w-5xl px-4 py-8'>
      <h1 className='text-xl font-semibold'>Admin</h1>
      <p className='mt-1 text-sm text-muted'>Manage who can use Chatboat, which data it answers from, and how it looks for your company.</p>
      <div className='mt-6 flex gap-1 border-b border-border' role='tablist'>
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map(t => (
          <button
            key={t}
            role='tab'
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              '-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm',
              tab === t ? 'border-brand font-medium text-text' : 'border-transparent text-muted hover:text-text'
            )}
          >
            {TABS[t]}
          </button>
        ))}
      </div>
      <div className='mt-6'>
        {tab === 'members' ? <MembersTab /> : tab === 'data' ? <DataTab /> : <CompanyTab />}
      </div>
    </div>
  );
}
