'use client';

import { BarChart3, Database, LayoutDashboard, LineChart, Mail, MessageSquarePlus, Sparkles, Table2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from './ui';

type Scene =
  | { kind: 'bars'; q: string; a: React.ReactNode; title: string; data: { l: string; v: number }[] }
  | { kind: 'line'; q: string; a: React.ReactNode; title: string; a1: number[]; a2: number[] }
  | { kind: 'table'; q: string; a: React.ReactNode; title: string; rows: [string, string, string][] };

const SCENES: Scene[] = [
  {
    kind: 'bars',
    q: 'How did revenue trend over the last six months?',
    a: (
      <>
        Revenue grew every month except July, reaching <strong>$86k in October</strong>, up 105% on May.
      </>
    ),
    title: 'Revenue by month ($k)',
    data: [
      { l: 'May', v: 42 },
      { l: 'Jun', v: 51 },
      { l: 'Jul', v: 48 },
      { l: 'Aug', v: 63 },
      { l: 'Sep', v: 71 },
      { l: 'Oct', v: 86 },
    ],
  },
  {
    kind: 'table',
    q: 'Which customers owe us more than 60 days?',
    a: (
      <>
        <strong>4 customers</strong> owe <strong>$41.2k</strong> past 60 days. Northwind Traders owes the most.
      </>
    ),
    title: 'Overdue over 60 days',
    rows: [
      ['Northwind Traders', '$18,400', '94 days'],
      ['Blue Harbor Foods', '$11,250', '71 days'],
      ['Kestrel Supply Co', '$7,900', '66 days'],
      ['Alder & Finch', '$3,650', '62 days'],
    ],
  },
  {
    kind: 'line',
    q: 'Compare weekly orders this quarter with last quarter',
    a: (
      <>
        Orders are running <strong>18% ahead</strong> of last quarter, with the gap widening since week 6.
      </>
    ),
    title: 'Weekly orders',
    a1: [30, 34, 33, 38, 41, 47, 52, 55, 61],
    a2: [28, 31, 30, 33, 34, 36, 39, 41, 43],
  },
];

const icons = { bars: BarChart3, line: LineChart, table: Table2 };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** The product, drawn with the app's tokens: questions type themselves and charts animate in. */
export function ProductPreview() {
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(SCENES[0]!.q.length);
  const [phase, setPhase] = useState<'typing' | 'thinking' | 'answer'>('answer');
  const scene = SCENES[i]!;

  // typing → thinking → answer → next scene
  useEffect(() => {
    if (reduced) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === 'typing') {
      t = typed < scene.q.length ? setTimeout(() => setTyped(typed + 1), 28) : setTimeout(() => setPhase('thinking'), 250);
    } else if (phase === 'thinking') {
      t = setTimeout(() => setPhase('answer'), 900);
    } else {
      t = setTimeout(() => {
        setI((i + 1) % SCENES.length);
        setTyped(0);
        setPhase('typing');
      }, 5200);
    }
    return () => clearTimeout(t);
  }, [phase, typed, i, scene.q.length, reduced]);

  const show = reduced || phase === 'answer';

  return (
    <div className='relative mx-auto w-full max-w-5xl'>
      {/* glow under the window */}
      <div className='absolute -inset-x-10 -bottom-10 top-10 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_35%,transparent),transparent)] blur-2xl' />
      <div className='glass overflow-hidden rounded-3xl p-1.5 shadow-2xl shadow-black/10'>
        <div className='overflow-hidden rounded-[1.25rem] border border-border bg-surface'>
          <div className='flex items-center gap-2 border-b border-border px-4 py-2.5'>
            <span className='h-2.5 w-2.5 rounded-full bg-[#ff5f57]' />
            <span className='h-2.5 w-2.5 rounded-full bg-[#febc2e]' />
            <span className='h-2.5 w-2.5 rounded-full bg-[#28c840]' />
            <span className='mx-auto rounded-full bg-surface-2 px-3 py-0.5 text-[11px] text-muted'>data.yourcompany.com</span>
          </div>
          <div className='grid md:grid-cols-[200px_1fr]'>
            <aside className='hidden border-r border-border p-3 text-sm md:block'>
              <div className='flex items-center gap-2 rounded-xl bg-brand-soft px-2.5 py-2 font-medium text-brand'>
                <MessageSquarePlus className='h-4 w-4' /> New question
              </div>
              <div className='mt-2 space-y-0.5 text-muted'>
                <p className='flex items-center gap-2 px-2.5 py-1.5'>
                  <LayoutDashboard className='h-4 w-4' /> Dashboards
                </p>
                <p className='flex items-center gap-2 px-2.5 py-1.5'>
                  <Mail className='h-4 w-4' /> Digests
                </p>
              </div>
              <p className='mt-4 px-2.5 text-[11px] font-medium tracking-wide text-muted uppercase'>Recent</p>
              {SCENES.map((s, k) => (
                <p key={s.q} className={cn('truncate rounded-lg px-2.5 py-1.5 text-[13px] transition', k === i ? 'bg-surface-2 text-text' : 'text-muted')}>
                  {s.title}
                </p>
              ))}
            </aside>

            <div className='flex min-h-[380px] flex-col gap-4 p-4 sm:p-6'>
              <div className='ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-brand-fg'>
                <span className={cn(!reduced && phase === 'typing' && 'caret')}>{reduced ? scene.q : scene.q.slice(0, typed)}</span>
              </div>

              {!show && (
                <div className='space-y-3' aria-hidden>
                  <div className='flex items-center gap-2 text-sm text-muted'>
                    <Database className={cn('h-4 w-4 text-brand', phase === 'thinking' && 'animate-pulse')} />
                    {phase === 'thinking' ? 'Writing a read-only query…' : 'Listening…'}
                  </div>
                  <div className='h-3 w-3/4 animate-pulse rounded-full bg-surface-2' />
                  <div className='h-48 animate-pulse rounded-2xl border border-border bg-bg' />
                </div>
              )}

              {show && (
                <div key={i} className='space-y-3 fade-up'>
                  <p className='flex items-start gap-2 text-sm'>
                    <Sparkles className='mt-0.5 h-4 w-4 shrink-0 text-brand' />
                    <span>{scene.a}</span>
                  </p>
                  <figure className='rounded-2xl border border-border bg-bg p-4'>
                    <figcaption className='mb-3 flex items-center justify-between text-xs font-medium text-muted'>
                      <span className='flex items-center gap-2'>
                        {(() => {
                          const I = icons[scene.kind];
                          return <I className='h-3.5 w-3.5' />;
                        })()}
                        {scene.title}
                      </span>
                      <span className='flex gap-1'>
                        {(['bars', 'line', 'table'] as const).map((k) => {
                          const I = icons[k];
                          return (
                            <span key={k} className={cn('grid h-6 w-6 place-items-center rounded-md', k === scene.kind ? 'bg-brand-soft text-brand' : 'text-muted')}>
                              <I className='h-3.5 w-3.5' />
                            </span>
                          );
                        })}
                      </span>
                    </figcaption>
                    <SceneChart scene={scene} />
                  </figure>
                  <p className='text-xs text-muted'>Ran 1 read-only query · 0.8s</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneChart({ scene }: { scene: Scene }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (scene.kind === 'bars') {
    return (
      <div className='flex h-40 items-end gap-3 sm:gap-5' role='img' aria-label={`Bar chart: ${scene.title}`}>
        {scene.data.map((b, k) => (
          <div key={b.l} className='flex h-full flex-1 flex-col items-center justify-end gap-1.5'>
            <span className='text-[10px] text-muted tabular-nums'>{b.v}</span>
            <div
              className='w-full max-w-11 rounded-t-lg transition-[height] duration-700 ease-out'
              style={{
                height: grown ? `${b.v}%` : '0%',
                transitionDelay: `${k * 70}ms`,
                background:
                  k === scene.data.length - 1
                    ? 'linear-gradient(to top, var(--chart-1), var(--chart-6))'
                    : 'color-mix(in oklab, var(--chart-1) 40%, transparent)',
              }}
            />
            <span className='text-[10px] text-muted'>{b.l}</span>
          </div>
        ))}
      </div>
    );
  }

  if (scene.kind === 'line') {
    const w = 400;
    const h = 150;
    const max = 70;
    const pts = (arr: number[]) => arr.map((v, k) => `${(k / (arr.length - 1)) * w},${h - (v / max) * h}`).join(' ');
    return (
      <div role='img' aria-label={`Line chart: ${scene.title}`}>
        <svg viewBox={`0 0 ${w} ${h}`} className='h-40 w-full overflow-visible' preserveAspectRatio='none'>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1='0' x2={w} y1={h * g} y2={h * g} stroke='var(--border)' strokeDasharray='3 4' vectorEffect='non-scaling-stroke' />
          ))}
          <polyline points={pts(scene.a2)} fill='none' stroke='var(--chart-2)' strokeWidth='2' pathLength={1} className='draw' vectorEffect='non-scaling-stroke' />
          <polyline points={pts(scene.a1)} fill='none' stroke='var(--chart-1)' strokeWidth='2.5' pathLength={1} className='draw' vectorEffect='non-scaling-stroke' />
        </svg>
        <div className='mt-2 flex gap-4 text-[11px] text-muted'>
          <span className='flex items-center gap-1.5'>
            <span className='h-2 w-2 rounded-full bg-[var(--chart-1)]' /> This quarter
          </span>
          <span className='flex items-center gap-1.5'>
            <span className='h-2 w-2 rounded-full bg-[var(--chart-2)]' /> Last quarter
          </span>
        </div>
      </div>
    );
  }

  return (
    <table className='w-full text-left text-[13px]'>
      <thead className='text-[11px] text-muted'>
        <tr>
          <th className='pb-2 font-medium'>Customer</th>
          <th className='pb-2 text-right font-medium'>Owed</th>
          <th className='pb-2 text-right font-medium'>Overdue</th>
        </tr>
      </thead>
      <tbody>
        {scene.rows.map((r, k) => (
          <tr key={r[0]} className='border-t border-border fade-up' style={{ animationDelay: `${k * 90}ms` }}>
            <td className='py-2'>{r[0]}</td>
            <td className='py-2 text-right tabular-nums'>{r[1]}</td>
            <td className='py-2 text-right'>
              <span className='rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn'>{r[2]}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
