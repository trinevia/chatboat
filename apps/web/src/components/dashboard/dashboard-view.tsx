'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, MessageSquare, MessageSquarePlus, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SubscriptionDialog } from '@/components/subscriptions/subscription-dialog';
import type { ChartSpec } from '@chatboat/shared';
import { MenuItem } from '@/components/ui/menu';
import { ShareButton } from '@/components/share/share-dialog';
import { useDialogs } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api, type DashboardDetail } from '@/lib/api';
import { ChartCard } from '@/components/charts/chart-card';

export function DashboardView({ id }: { id: number }) {
  const qc = useQueryClient();
  const dialogs = useDialogs();
  const router = useRouter();
  const key = ['dashboard', id];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.getDashboard(id) });
  const { data: subs } = useQuery({ queryKey: ['subscriptions', id], queryFn: () => api.listSubscriptions(id) });
  const subscription = subs?.subscriptions[0];
  const [digestOpen, setDigestOpen] = useState(false);

  const refresh = useMutation({
    mutationFn: api.refreshWidget,
    onSuccess: w =>
      qc.setQueryData<DashboardDetail>(key, d => d && { ...d, widgets: d.widgets.map(x => (x.id === w.id ? w : x)) }),
    onError: () => toast.error('Could not refresh this chart.'),
  });
  const remove = useMutation({
    mutationFn: api.deleteWidget,
    onSuccess: (_, wid) => {
      qc.setQueryData<DashboardDetail>(key, d => d && { ...d, widgets: d.widgets.filter(x => x.id !== wid) });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
    },
  });

  const rename = useMutation({
    mutationFn: (name: string) => api.renameDashboard(id, name),
    onSuccess: (_, name) => {
      qc.setQueryData<DashboardDetail>(key, d => d && { ...d, name });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
    },
    onError: () => toast.error('Could not rename the dashboard.'),
  });

  // "Ask about this chart": a new chat that starts with this chart as context.
  const askAbout = useMutation({
    mutationFn: (chart: ChartSpec) => api.createChat({ contextChart: chart }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ['chats'] });
      router.push(`/c/${id}`);
    },
    onError: () => toast.error('Could not start a chat about this chart.'),
  });

  if (isLoading) return <div className='p-8 text-sm text-muted'>Loading dashboard…</div>;
  if (error || !data) return <div className='p-8 text-sm text-danger'>Dashboard not found.</div>;

  return (
    <div className='mx-auto max-w-6xl px-4 py-8'>
      <Link href='/dashboards' className='inline-flex items-center gap-1 text-sm text-muted hover:text-text'>
        <ArrowLeft className='h-4 w-4' /> Dashboards
      </Link>
      <div className='mt-2 flex flex-wrap items-center gap-1'>
        <h1 className='text-xl font-semibold'>{data.name}</h1>
        <button
          aria-label='Rename dashboard'
          className='cursor-pointer rounded p-1.5 text-muted hover:bg-surface-2 hover:text-text'
          onClick={async () => {
            const name = await dialogs.prompt({ title: 'Rename dashboard', label: 'Name', defaultValue: data.name, maxLength: 80 });
            if (name && name !== data.name) rename.mutate(name);
          }}
        >
          <Pencil className='h-4 w-4' />
        </button>
        <div className='ml-auto flex items-center gap-2'>
          <Button variant='secondary' size='sm' onClick={() => setDigestOpen(true)}>
            <Mail className='h-4 w-4' /> {subscription ? 'Edit digest' : 'Email digest'}
          </Button>
          <ShareButton kind='dashboard' id={String(data.id)} />
        </div>
      </div>
      {subscription && (
        <p className='mt-1 text-xs text-muted'>
          Emailed {subscription.isActive ? subscription.schedule.charAt(0).toLowerCase() + subscription.schedule.slice(1) : '(paused)'} ·{' '}
          <Link href='/subscriptions' className='hover:text-brand'>
            Manage
          </Link>
        </p>
      )}
      <SubscriptionDialog
        open={digestOpen}
        onClose={() => setDigestOpen(false)}
        dashboardId={data.id}
        dashboardName={data.name}
        existing={subscription}
      />
      {!data.widgets.length && <p className='mt-6 text-sm text-muted'>This dashboard is empty.</p>}
      <div className='mt-6 grid gap-4 lg:grid-cols-2'>
        {data.widgets.map(w => (
          <div key={w.id} className='space-y-1'>
            <ChartCard
              spec={w.chart}
              onRefresh={w.sql ? () => refresh.mutate(w.id) : undefined}
              refreshing={refresh.isPending && refresh.variables === w.id}
              extraActions={close => (
                <MenuItem
                  onClick={() => {
                    close();
                    askAbout.mutate(w.chart);
                  }}
                >
                  <MessageSquarePlus className='h-4 w-4' /> Ask about this chart
                </MenuItem>
              )}
              onRemove={async () => {
                const ok = await dialogs.confirm({
                  title: 'Remove chart?',
                  description: `"${w.chart.title}" will be removed from this dashboard.`,
                  confirmLabel: 'Remove',
                  danger: true,
                });
                if (ok) remove.mutate(w.id);
              }}
            />
            <div className='flex flex-wrap gap-x-4 px-1'>
              <button
                onClick={() => askAbout.mutate(w.chart)}
                disabled={askAbout.isPending}
                className='inline-flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-brand'
              >
                <MessageSquarePlus className='h-3 w-3' /> Ask about this chart
              </button>
              {w.chatId && (
                <Link href={`/c/${w.chatId}`} className='inline-flex items-center gap-1 text-xs text-muted hover:text-brand'>
                  <MessageSquare className='h-3 w-3' /> Open the original conversation
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
