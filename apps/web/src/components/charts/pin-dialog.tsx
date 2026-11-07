'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { ChartSpec } from '@chatboat/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function PinDialog({ open, onClose, spec, chatId }: { open: boolean; onClose: () => void; spec: ChartSpec; chatId?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const qc = useQueryClient();
  const { data: dashboards } = useQuery({ queryKey: ['dashboards'], queryFn: api.listDashboards, enabled: open });
  const [choice, setChoice] = useState<string>('new');
  const [name, setName] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal focuses the first control; put the cursor where the user types.
      d.querySelector<HTMLInputElement>('#dash-name')?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
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
    <dialog
      ref={ref}
      onClose={onClose}
      className='m-auto w-[min(420px,calc(100vw-32px))] rounded-xl border border-border bg-surface p-5 text-text backdrop:bg-black/40'
    >
      <h2 className='text-base font-semibold'>Add to dashboard</h2>
      <p className='mt-1 text-sm text-muted'>“{spec.title}”</p>
      <form
        className='mt-4 space-y-3'
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
    </dialog>
  );
}
