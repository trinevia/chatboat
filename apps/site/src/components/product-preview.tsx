import { BarChart3, MessageSquarePlus, Sparkles } from 'lucide-react';

const bars = [
  { m: 'May', v: 42 },
  { m: 'Jun', v: 51 },
  { m: 'Jul', v: 48 },
  { m: 'Aug', v: 63 },
  { m: 'Sep', v: 71 },
  { m: 'Oct', v: 86 },
];

/** A static picture of the product: a question, an answer and a chart, drawn with the app's tokens. */
export function ProductPreview() {
  const max = 100;
  return (
    <div className='relative mx-auto w-full max-w-4xl'>
      <div className='overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-brand/10'>
        <div className='flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5'>
          <span className='h-2.5 w-2.5 rounded-full bg-danger/60' />
          <span className='h-2.5 w-2.5 rounded-full bg-warn/60' />
          <span className='h-2.5 w-2.5 rounded-full bg-good/60' />
          <span className='ml-3 truncate text-xs text-muted'>data.yourcompany.com</span>
        </div>
        <div className='grid md:grid-cols-[180px_1fr]'>
          <aside className='hidden border-r border-border p-3 text-sm md:block'>
            <div className='flex items-center gap-2 rounded-lg bg-brand-soft px-2 py-1.5 font-medium text-brand'>
              <MessageSquarePlus className='h-4 w-4' /> New question
            </div>
            <p className='mt-4 px-2 text-xs font-medium text-muted'>Recent</p>
            {['Revenue by month', 'Overdue invoices', 'Top 10 customers', 'Stock below reorder'].map((t) => (
              <p key={t} className='truncate px-2 py-1.5 text-muted'>
                {t}
              </p>
            ))}
          </aside>
          <div className='space-y-4 p-4 sm:p-6'>
            <div className='ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-brand-fg'>
              How did revenue trend over the last six months?
            </div>
            <div className='space-y-3'>
              <p className='flex items-start gap-2 text-sm'>
                <Sparkles className='mt-0.5 h-4 w-4 shrink-0 text-brand' />
                <span>
                  Revenue grew every month except July, reaching <strong>$86k in October</strong>, up 105% on May.
                </span>
              </p>
              <figure className='rounded-xl border border-border bg-bg p-4'>
                <figcaption className='mb-3 flex items-center gap-2 text-xs font-medium text-muted'>
                  <BarChart3 className='h-3.5 w-3.5' /> Revenue by month ($k)
                </figcaption>
                <div className='flex h-36 items-end gap-3 sm:gap-5' role='img' aria-label='Bar chart of revenue rising from 42k in May to 86k in October'>
                  {bars.map((b, i) => (
                    <div key={b.m} className='flex h-full flex-1 flex-col items-center justify-end gap-1.5'>
                      <span className='text-[10px] text-muted tabular-nums'>{b.v}</span>
                      <div
                        className='w-full max-w-10 rounded-t-md'
                        style={{
                          height: `${(b.v / max) * 100}%`,
                          background: i === bars.length - 1 ? 'var(--chart-1)' : 'color-mix(in oklab, var(--chart-1) 45%, transparent)',
                        }}
                      />
                      <span className='text-[10px] text-muted'>{b.m}</span>
                    </div>
                  ))}
                </div>
              </figure>
              <p className='text-xs text-muted'>Ran 1 read-only query on sales · 0.8s</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
