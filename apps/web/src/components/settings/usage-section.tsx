'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const nf = new Intl.NumberFormat('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className='rounded-lg border border-border p-3'>
      <div className='text-xs text-muted'>{label}</div>
      <div className='mt-1 text-lg font-semibold tabular-nums'>{value}</div>
      {hint && <div className='text-xs text-muted'>{hint}</div>}
    </div>
  );
}

/** Last 14 days as small bars, so spikes are easy to spot. */
function DailyBars({ days }: { days: { day: string; questions: number }[] }) {
  const byDay = new Map(days.map(d => [d.day, d.questions]));
  const list = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, n: byDay.get(key) ?? 0 };
  });
  const max = Math.max(1, ...list.map(d => d.n));
  return (
    <div>
      <div className='flex h-16 items-end gap-1' role='img' aria-label='Questions per day, last 14 days'>
        {list.map(d => (
          <div
            key={d.key}
            title={`${d.key}: ${d.n} ${d.n === 1 ? 'question' : 'questions'}`}
            className='flex-1 rounded-t bg-brand'
            style={{ height: `${Math.max(d.n ? 8 : 2, (d.n / max) * 100)}%`, opacity: d.n ? 1 : 0.25 }}
          />
        ))}
      </div>
      <div className='mt-1 flex justify-between text-[10px] text-muted'>
        <span>14 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export function UsageSection() {
  const { data } = useQuery({ queryKey: ['usage'], queryFn: api.usage });
  if (!data) return <p className='text-sm text-muted'>Loading…</p>;
  const pct = Math.min(100, (data.today.used / data.today.limit) * 100);
  const m = data.month;
  return (
    <div className='space-y-4'>
      <div>
        <div className='flex justify-between text-sm'>
          <span>Questions today</span>
          <span className='tabular-nums text-muted'>
            {data.today.used} / {data.today.limit}
          </span>
        </div>
        <div className='mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2'>
          <div className={pct >= 90 ? 'h-full bg-danger' : 'h-full bg-brand'} style={{ width: `${pct}%` }} />
        </div>
        <p className='mt-1 text-xs text-muted'>The daily limit resets at midnight UTC.</p>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <Stat label='Questions this month' value={nf.format(m.questions)} hint={m.failed ? `${m.failed} failed` : undefined} />
        <Stat label='Average answer time' value={m.avgSeconds != null ? `${m.avgSeconds}s` : '—'} />
        <Stat
          label='Tokens this month'
          value={compact.format(m.inputTokens + m.outputTokens)}
          hint={`${compact.format(m.inputTokens)} in · ${compact.format(m.outputTokens)} out`}
        />
        <Stat
          label='Estimated AI cost'
          value={m.estimatedCost != null ? `$${m.estimatedCost.toFixed(2)}` : '—'}
          hint={m.estimatedCost == null ? 'Set prices in the server config' : 'This month'}
        />
      </div>
      <DailyBars days={data.days} />
    </div>
  );
}
