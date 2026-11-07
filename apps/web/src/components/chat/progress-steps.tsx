'use client';

import type { UIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepState = 'done' | 'active' | 'pending';
type ToolPart = { type: string; state: string; output?: unknown };

/** Derive human-readable steps from the parts the answer has streamed so far. */
function deriveSteps(message: UIMessage | undefined) {
  const parts = (message?.role === 'assistant' ? message.parts : []) as ToolPart[];
  const tool = (name: string) => parts.filter(p => p.type === `tool-${name}`);
  const sql = tool('runSql');
  const chart = tool('renderChart');
  const hasText = parts.some(p => p.type === 'text' && (p as unknown as { text: string }).text.trim());

  const sqlDone = sql.some(p => p.state === 'output-available' && (p.output as { ok?: boolean })?.ok);
  const sqlFailures = sql.filter(p => p.state === 'output-available' && !(p.output as { ok?: boolean })?.ok).length;
  const chartDone = chart.some(p => p.state === 'output-available');

  const started = sql.length > 0 || chart.length > 0 || hasText;
  const steps: { label: string; state: StepState }[] = [
    { label: 'Understanding your question', state: started ? 'done' : 'active' },
    {
      label: sqlFailures && !sqlDone ? `Fixing the query (attempt ${sqlFailures + 1})` : 'Querying your data',
      state: sqlDone ? 'done' : sql.length ? 'active' : 'pending',
    },
    { label: 'Building the chart', state: chartDone ? 'done' : chart.length || sqlDone ? 'active' : 'pending' },
    { label: 'Writing the summary', state: hasText && chartDone ? 'active' : 'pending' },
  ];
  // A plain-text reply (e.g. "hello") never queries data: keep the list short.
  if (hasText && !sql.length) return steps.slice(0, 1).map(s => ({ ...s, state: 'done' as StepState }));
  return steps;
}

export function ProgressSteps({ message }: { message: UIMessage | undefined }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const steps = deriveSteps(message);
  return (
    <div className='flex gap-3' role='status' aria-live='polite'>
      <span className='hidden w-7 shrink-0 sm:block' />
      <ol className='space-y-1.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm'>
        {steps.map(s => (
          <li
            key={s.label}
            className={cn('flex items-center gap-2', s.state === 'pending' ? 'text-muted/60' : s.state === 'active' ? 'text-text' : 'text-muted')}
          >
            {s.state === 'done' ? (
              <Check className='h-3.5 w-3.5 text-brand' />
            ) : s.state === 'active' ? (
              <Loader2 className='h-3.5 w-3.5 animate-spin text-brand' />
            ) : (
              <span className='mx-[3px] h-2 w-2 rounded-full border border-current' />
            )}
            {s.label}
          </li>
        ))}
        <li className='pt-1 text-xs text-muted'>{seconds}s</li>
      </ol>
    </div>
  );
}
