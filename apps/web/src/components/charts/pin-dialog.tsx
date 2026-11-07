'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { ChartSpec } from '@chatboat/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';

export function PinDialog({ open, onClose, spec, chatId }: { open: boolean; onClose: () => void; spec: ChartSpec; chatId?: string }) {
  const qc = useQueryClient();
  const { data: dashboards } = useQuery({ queryKey: ['dashboards'], queryFn: api.listDashboards, enabled: open });
  const [choice, setChoice] = useState<string>('new');
  const [name, setName] = useState('');

  useEffect(() => {
    if (dashboards?.length && choice === 'new' && !name) setChoice(String(dashboards[0].id));
  }, [dashboards]); // eslint-disable-line react-hooks/exhaustive-deps

  const pin = useMutation({
    mutationFn: () =>
      api.pinWidget({
        chart: spec,
        chatId,
        ...(choice === 'new' ? { dashboardName: name.trim() || 'My dashboard' } : { dashboardId: Number(choice) }),
      }),
    onSuccess: ({ dashboardId }) => {
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      qc.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
      toast.success('Added to dashboard', {
        action: { label: 'Open', onClick: () => (window.location.href = `/dashboards/${dashboardId}`) },
      });
      onClose();
    },
    onError: () => toast.error('Could not add the chart to the dashboard.'),
  });

  return (
    <Dialog open={open} onClose={onClose} title='Add to dashboard' description={`“${spec.title}”`} initialFocus='#dash-name'>
      <form
        className='space-y-3'
        onSubmit={e => {
          e.preventDefault();
          pin.mutate();
        }}
      >
        <div className='space-y-1.5'>
          <Label htmlFor='dash'>Dashboard</Label>
          <select
            id='dash'
            value={choice}
            onChange={e => setChoice(e.target.value)}
            className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm'
          >
            {dashboards?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            <option value='new'>+ New dashboard</option>
          </select>
        </div>
        {choice === 'new' && (
          <div className='space-y-1.5'>
            <Label htmlFor='dash-name'>Name</Label>
            <Input id='dash-name' value={name} onChange={e => setName(e.target.value)} placeholder='Sales overview' />
          </div>
        )}
        <div className='flex justify-between gap-2 pt-2'>
          <Link href='/dashboards' className='self-center text-sm text-muted hover:text-text'>View dashboards</Link>
          <div className='flex gap-2'>
            <Button type='button' variant='secondary' onClick={onClose}>Cancel</Button>
            <Button type='submit' disabled={pin.isPending}>{pin.isPending ? 'Adding…' : 'Add'}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
