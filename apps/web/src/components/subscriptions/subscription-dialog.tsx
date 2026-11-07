'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { SubscriptionInfo, SubscriptionInput } from '@chatboat/shared';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const selectCls = 'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm';

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function timezones(current: string) {
  try {
    const all = Intl.supportedValuesOf('timeZone');
    return all.includes(current) ? all : [current, ...all];
  } catch {
    return [current, 'UTC'];
  }
}

/** Create or edit an email digest for one dashboard. */
export function SubscriptionDialog({
  open,
  onClose,
  dashboardId,
  dashboardName,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  dashboardId: number;
  dashboardName: string;
  existing?: SubscriptionInfo;
}) {
  const qc = useQueryClient();
  const [frequency, setFrequency] = useState<SubscriptionInput['frequency']>('weekly');
  const [time, setTime] = useState('09:00');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timezone, setTimezone] = useState('UTC');
  const zones = useMemo(() => timezones(timezone), [timezone]);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setFrequency(existing.frequency);
      setTime(`${String(existing.hour).padStart(2, '0')}:${String(existing.minute).padStart(2, '0')}`);
      setDayOfWeek(existing.dayOfWeek ?? 1);
      setDayOfMonth(existing.dayOfMonth ?? 1);
      setTimezone(existing.timezone);
    } else {
      setFrequency('weekly');
      setTime('09:00');
      setDayOfWeek(1);
      setDayOfMonth(1);
      setTimezone(browserTimezone());
    }
  }, [open, existing]);

  const save = useMutation({
    mutationFn: () => {
      const [hour, minute] = time.split(':').map(Number);
      const body: SubscriptionInput = {
        dashboardId,
        frequency,
        hour,
        minute,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : null,
        dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
        timezone,
      };
      return existing ? api.updateSubscription(existing.id, body) : api.createSubscription(body);
    },
    onSuccess: s => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success(`Digest scheduled: ${s.schedule}`);
      onClose();
    },
    onError: e => toast.error(e instanceof ApiError ? e.message : 'Could not save the schedule.'),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? 'Edit email digest' : 'Email this dashboard'}
      description={`Get “${dashboardName}” by email with fresh numbers and what changed since last time.`}
    >
      <form
        className='space-y-3'
        onSubmit={e => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='sub-frequency'>How often</Label>
            <select
              id='sub-frequency'
              value={frequency}
              onChange={e => setFrequency(e.target.value as SubscriptionInput['frequency'])}
              className={selectCls}
            >
              <option value='daily'>Daily</option>
              <option value='weekly'>Weekly</option>
              <option value='monthly'>Monthly</option>
            </select>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='sub-time'>Time</Label>
            <Input id='sub-time' type='time' value={time} required onChange={e => setTime(e.target.value)} />
          </div>
        </div>
        {frequency === 'weekly' && (
          <div className='space-y-1.5'>
            <Label htmlFor='sub-dow'>Day</Label>
            <select id='sub-dow' value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))} className={selectCls}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
        {frequency === 'monthly' && (
          <div className='space-y-1.5'>
            <Label htmlFor='sub-dom'>Day of the month</Label>
            <select id='sub-dom' value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))} className={selectCls}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <p className='text-xs text-muted'>Days 1–28 so it runs every month.</p>
          </div>
        )}
        <div className='space-y-1.5'>
          <Label htmlFor='sub-tz'>Timezone</Label>
          <select id='sub-tz' value={timezone} onChange={e => setTimezone(e.target.value)} className={selectCls}>
            {zones.map(z => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <p className='text-xs text-muted'>Sent to your account email. Charts are refreshed from live data each time.</p>
        <div className='flex justify-end gap-2 pt-1'>
          <Button type='button' variant='secondary' onClick={onClose}>
            Cancel
          </Button>
          <Button type='submit' disabled={save.isPending}>
            {save.isPending ? 'Saving…' : existing ? 'Save' : 'Schedule digest'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
