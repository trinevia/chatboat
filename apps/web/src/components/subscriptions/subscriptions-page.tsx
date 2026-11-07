'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Mail, MoreHorizontal, Pause, Pencil, Play, Send, Trash2 } from 'lucide-react';
import type { SubscriptionInfo } from '@chatboat/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDialogs } from '@/components/ui/dialog';
import { Menu, MenuItem } from '@/components/ui/menu';
import { SubscriptionDialog } from './subscription-dialog';

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function SubscriptionsPage() {
  const qc = useQueryClient();
  const dialogs = useDialogs();
  const [editing, setEditing] = useState<SubscriptionInfo | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['subscriptions'], queryFn: () => api.listSubscriptions() });
  const refresh = () => qc.invalidateQueries({ queryKey: ['subscriptions'] });

  const toggle = useMutation({
    mutationFn: (s: SubscriptionInfo) => api.updateSubscription(s.id, { isActive: !s.isActive }),
    onSuccess: s => {
      refresh();
      toast.success(s.isActive ? 'Digest resumed' : 'Digest paused');
    },
  });
  const send = useMutation({
    mutationFn: (s: SubscriptionInfo) => api.sendSubscription(s.id),
    onSuccess: r => {
      refresh();
      toast.success(`Digest sent to ${r.sentTo}`);
    },
    onError: e => {
      refresh();
      toast.error(`Could not send: ${(e as Error).message}`);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteSubscription(id),
    onSuccess: () => {
      refresh();
      toast.success('Digest deleted');
    },
  });

  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <h1 className='text-xl font-semibold'>Subscriptions</h1>
      <p className='mt-1 text-sm text-muted'>
        Dashboards emailed to you on a schedule, with fresh numbers and what changed since the last one. Add one from any
        dashboard with “Email digest”.
      </p>
      {data && !data.emailConfigured && (
        <div className='mt-4 flex gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger'>
          <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
          Email isn’t configured on the server (SMTP_URL), so digests will fail to send.
        </div>
      )}
      {isLoading && <p className='mt-6 text-sm text-muted'>Loading…</p>}
      {data && !data.subscriptions.length && (
        <div className='mt-8 rounded-xl border border-dashed border-border p-10 text-center'>
          <Mail className='mx-auto h-8 w-8 text-muted' />
          <p className='mt-3 text-sm text-muted'>No digests yet. Open a dashboard and choose “Email digest”.</p>
          <Link href='/dashboards' className='mt-4 inline-block text-sm font-medium text-brand'>
            Go to dashboards →
          </Link>
        </div>
      )}
      <ul className='mt-6 space-y-3'>
        {data?.subscriptions.map(s => (
          <li key={s.id} className='flex flex-wrap items-start gap-3 rounded-xl border border-border bg-surface p-4'>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center gap-2'>
                <Link href={`/dashboards/${s.dashboardId}`} className='truncate font-medium hover:text-brand'>
                  {s.dashboardName}
                </Link>
                {!s.isActive && <span className='rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted'>Paused</span>}
              </div>
              <div className='mt-1 text-sm text-muted'>{s.schedule}</div>
              <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted'>
                {s.isActive && <span>Next: {when(s.nextRunAt)}</span>}
                {s.lastRun ? (
                  <span className={cn('inline-flex items-center gap-1', s.lastRun.status === 'failed' && 'text-danger')}>
                    {s.lastRun.status === 'sent' ? (
                      <CheckCircle2 className='h-3.5 w-3.5 text-brand' />
                    ) : (
                      <AlertCircle className='h-3.5 w-3.5' />
                    )}
                    Last {s.lastRun.status === 'sent' ? 'sent' : 'failed'} {when(s.lastRun.at)}
                    {s.lastRun.error && ` – ${s.lastRun.error}`}
                  </span>
                ) : (
                  <span>Not sent yet</span>
                )}
              </div>
            </div>
            <Menu
              trigger={(_, t) => (
                <button aria-label={`Actions for ${s.dashboardName} digest`} onClick={t} className='cursor-pointer rounded p-1.5 text-muted hover:bg-surface-2 hover:text-text'>
                  <MoreHorizontal className='h-4 w-4' />
                </button>
              )}
            >
              {close => (
                <>
                  <MenuItem disabled={send.isPending} onClick={() => { close(); send.mutate(s); }}>
                    <Send className='h-4 w-4' /> Send now
                  </MenuItem>
                  <MenuItem onClick={() => { close(); setEditing(s); }}>
                    <Pencil className='h-4 w-4' /> Edit schedule
                  </MenuItem>
                  <MenuItem onClick={() => { close(); toggle.mutate(s); }}>
                    {s.isActive ? <Pause className='h-4 w-4' /> : <Play className='h-4 w-4' />}
                    {s.isActive ? 'Pause' : 'Resume'}
                  </MenuItem>
                  <div className='my-1 border-t border-border' />
                  <MenuItem
                    className='text-danger'
                    onClick={async () => {
                      close();
                      const ok = await dialogs.confirm({
                        title: 'Delete digest?',
                        description: `You'll stop getting “${s.dashboardName}” by email. The dashboard is kept.`,
                        confirmLabel: 'Delete',
                        danger: true,
                      });
                      if (ok) remove.mutate(s.id);
                    }}
                  >
                    <Trash2 className='h-4 w-4' /> Delete
                  </MenuItem>
                </>
              )}
            </Menu>
          </li>
        ))}
      </ul>
      {editing && (
        <SubscriptionDialog
          open
          onClose={() => setEditing(null)}
          dashboardId={editing.dashboardId}
          dashboardName={editing.dashboardName}
          existing={editing}
        />
      )}
    </div>
  );
}
