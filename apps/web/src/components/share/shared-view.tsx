'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BarChart3, Lock } from 'lucide-react';
import type { PublicChart } from '@chatboat/shared';
import { api } from '@/lib/api';
import { ChartCard } from '@/components/charts/chart-card';

function Header() {
  return (
    <header className='border-b border-border bg-surface'>
      <div className='mx-auto flex h-14 max-w-5xl items-center justify-between px-4'>
        <Link href='/' className='flex items-center gap-2 font-semibold'>
          <span className='grid h-7 w-7 place-items-center rounded-lg bg-brand text-brand-fg'>
            <BarChart3 className='h-4 w-4' />
          </span>
          Chatboat
        </Link>
        <span className='inline-flex items-center gap-1 text-xs text-muted'>
          <Lock className='h-3.5 w-3.5' /> Read-only shared view
        </span>
      </div>
    </header>
  );
}

/** Shared charts have no SQL; ChartCard works with the rest of the spec. */
const chart = (c: PublicChart, key: number) => <ChartCard key={key} spec={c} readOnly />;

export function SharedView({ token }: { token: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-share', token],
    queryFn: () => api.publicShare(token),
    retry: false,
  });

  return (
    <div className='min-h-dvh bg-bg'>
      <Header />
      <main className='mx-auto max-w-5xl px-4 py-8'>
        {isLoading && <p className='text-sm text-muted'>Loading…</p>}
        {(error || (!isLoading && !data)) && (
          <div className='mx-auto max-w-md py-16 text-center'>
            <h1 className='text-lg font-semibold'>This link isn’t available</h1>
            <p className='mt-2 text-sm text-muted'>It may have been turned off by the person who shared it.</p>
          </div>
        )}
        {data && (
          <>
            <h1 className='text-xl font-semibold'>{data.snapshot.title}</h1>
            <p className='mt-1 text-sm text-muted'>
              Shared by {data.sharedBy} · Snapshot from {new Date(data.updatedAt).toLocaleString()}
            </p>
            {data.snapshot.kind === 'dashboard' ? (
              <div className='mt-6 grid gap-4 lg:grid-cols-2'>{data.snapshot.charts.map(chart)}</div>
            ) : (
              <div className='mx-auto mt-6 max-w-3xl space-y-6'>
                {data.snapshot.messages.map((m, i) =>
                  m.role === 'user' ? (
                    <div key={i} className='flex justify-end'>
                      <div className='max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-brand-fg'>
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className='space-y-3'>
                      {m.charts.map(chart)}
                      {m.text && <p className='whitespace-pre-wrap text-sm leading-relaxed'>{m.text.replace(/\*\*/g, '')}</p>}
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
