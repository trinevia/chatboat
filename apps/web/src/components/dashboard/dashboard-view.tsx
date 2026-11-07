'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { api, type DashboardDetail } from '@/lib/api';
import { ChartCard } from '@/components/charts/chart-card';

export function DashboardView({ id }: { id: number }) {
  const qc = useQueryClient();
  const key = ['dashboard', id];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.getDashboard(id) });

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

  if (isLoading) return <div className='p-8 text-sm text-muted'>Loading dashboard…</div>;
  if (error || !data) return <div className='p-8 text-sm text-danger'>Dashboard not found.</div>;

  return (
    <div className='mx-auto max-w-6xl px-4 py-8'>
      <Link href='/dashboards' className='inline-flex items-center gap-1 text-sm text-muted hover:text-text'>
        <ArrowLeft className='h-4 w-4' /> Dashboards
      </Link>
      <h1 className='mt-2 text-xl font-semibold'>{data.name}</h1>
      {!data.widgets.length && <p className='mt-6 text-sm text-muted'>This dashboard is empty.</p>}
      <div className='mt-6 grid gap-4 lg:grid-cols-2'>
        {data.widgets.map(w => (
          <div key={w.id} className='space-y-1'>
            <ChartCard
              spec={w.chart}
              onRefresh={w.sql ? () => refresh.mutate(w.id) : undefined}
              refreshing={refresh.isPending && refresh.variables === w.id}
              onRemove={() => remove.mutate(w.id)}
            />
            {w.chatId && (
              <Link href={`/c/${w.chatId}`} className='inline-flex items-center gap-1 px-1 text-xs text-muted hover:text-brand'>
                <MessageSquare className='h-3 w-3' /> Open the conversation
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
