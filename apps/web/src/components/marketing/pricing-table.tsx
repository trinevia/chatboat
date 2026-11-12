'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { PLAN_CARDS, SETUP_FEE, usd } from '@/lib/marketing/plans';
import { buttonClass, cn } from './ui';

type Interval = 'month' | 'year';

export function PricingTable() {
  const [interval, setInterval] = useState<Interval>('month');

  return (
    <div>
      <div className='flex justify-center'>
        <div role='radiogroup' aria-label='Billing period' className='inline-flex rounded-xl border border-border bg-surface p-1 text-sm'>
          {(['month', 'year'] as const).map((i) => (
            <button
              key={i}
              type='button'
              role='radio'
              aria-checked={interval === i}
              onClick={() => setInterval(i)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition cursor-pointer',
                interval === i ? 'bg-brand text-brand-fg' : 'text-muted hover:text-text',
              )}
            >
              {i === 'month' ? 'Monthly' : 'Yearly'}
              {i === 'year' && (
                <span className={cn('rounded-full px-2 py-0.5 text-[11px]', interval === i ? 'bg-brand-fg/20' : 'bg-good/15 text-good')}>
                  2 months free
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className='mt-10 grid gap-6 lg:grid-cols-3'>
        {PLAN_CARDS.map((p) => {
          const price = interval === 'month' ? p.monthly : p.yearly;
          return (
            <div
              key={p.id}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-surface p-6 sm:p-8',
                p.featured ? 'border-brand shadow-xl shadow-brand/10' : 'border-border',
              )}
            >
              {p.featured && (
                <span className='absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-fg'>Most popular</span>
              )}
              <h3 className='text-lg font-semibold'>{p.name}</h3>
              <p className='mt-1 text-sm text-muted'>{p.forWho}</p>
              <p className='mt-6 flex items-baseline gap-1'>
                <span className='text-4xl font-semibold tracking-tight tabular-nums'>{usd(price)}</span>
                <span className='text-sm text-muted'>/ {interval}</span>
              </p>
              <p className='mt-1 h-5 text-xs text-muted'>
                {interval === 'year' ? `${usd(Math.round(p.yearly / 12))} a month, billed yearly` : 'Billed monthly, cancel anytime'}
              </p>

              <ul className='mt-6 flex-1 space-y-3 text-sm'>
                {p.highlights.map((h) => (
                  <li key={h} className='flex gap-2'>
                    <Check className='mt-0.5 h-4 w-4 shrink-0 text-good' />
                    {h}
                  </li>
                ))}
              </ul>

              <form action='/billing/checkout' method='post' className='mt-8 space-y-3'>
                <input type='hidden' name='plan' value={p.id} />
                <input type='hidden' name='interval' value={interval} />
                <label className='flex items-start gap-2 text-sm text-muted'>
                  <input type='checkbox' name='hosted' className='mt-0.5 h-4 w-4 accent-[var(--brand)]' />
                  <span>
                    Host it for us <span className='text-xs'>(+{usd(SETUP_FEE)} one-time setup)</span>
                  </span>
                </label>
                <button className={buttonClass(p.featured ? 'primary' : 'secondary', 'md', 'w-full')}>Subscribe to {p.name}</button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
