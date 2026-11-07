'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Info, RefreshCw, TrendingUp } from 'lucide-react';
import type { InsightInfo } from '@chatboat/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const TONE = {
  good: { icon: TrendingUp, cls: 'text-good bg-good/10' },
  bad: { icon: AlertTriangle, cls: 'text-warn bg-warn/10' },
  neutral: { icon: Info, cls: 'text-brand bg-brand-soft' },
} as const;

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

/** "What's worth a look": precomputed observations; clicking one asks its question. */
export function InsightCards({ onAsk, disabled }: { onAsk: (question: string) => void; disabled?: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['insights'], queryFn: api.insights, staleTime: 5 * 60_000 });
  const refresh = useMutation({
    mutationFn: api.refreshInsights,
    onSuccess: d => qc.setQueryData(['insights'], d),
  });
  if (!data?.length) return null;

  return (
    <section className='mt-8'>
      <div className='mb-2 flex items-center justify-between'>
        <h2 className='text-xs font-medium text-muted'>Worth a look</h2>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className='inline-flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-text'
          title='Recalculate from the latest data'
        >
          <RefreshCw className={cn('h-3 w-3', refresh.isPending && 'animate-spin')} />
          Updated {ago(data[0].computedAt)}
        </button>
      </div>
      <div className='grid gap-3 sm:grid-cols-2'>
        {data.map((i: InsightInfo) => {
          const { icon: Icon, cls } = TONE[i.tone];
          return (
            <button
              key={i.key}
              disabled={disabled}
              onClick={() => onAsk(i.question)}
              className='group flex cursor-pointer gap-3 rounded-xl border border-border bg-surface p-3 text-left hover:border-brand disabled:opacity-60'
            >
              <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', cls)}>
                <Icon className='h-4 w-4' />
              </span>
              <span className='min-w-0'>
                <span className='block text-sm font-medium group-hover:text-brand'>{i.title}</span>
                <span className='mt-0.5 block text-xs leading-relaxed text-muted'>{i.body}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
