'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { LayoutDashboard, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export function DashboardList() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['dashboards'], queryFn: api.listDashboards });
  const remove = useMutation({
    mutationFn: api.deleteDashboard,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Dashboard deleted');
    },
  });

  return (
    <div className='mx-auto max-w-5xl px-4 py-8'>
      <h1 className='text-xl font-semibold'>Dashboards</h1>
      <p className='mt-1 text-sm text-muted'>
        Pin charts from any answer with “Add to dashboard”. Widgets refresh from live data.
      </p>
      {isLoading && <p className='mt-6 text-sm text-muted'>Loading…</p>}
      {data && !data.length && (
        <div className='mt-8 rounded-xl border border-dashed border-border p-10 text-center'>
          <LayoutDashboard className='mx-auto h-8 w-8 text-muted' />
          <p className='mt-3 text-sm text-muted'>No dashboards yet. Ask a question and add its chart to a dashboard.</p>
          <Link href='/' className='mt-4 inline-block text-sm font-medium text-brand'>
            Ask a question →
          </Link>
        </div>
      )}
      <div className='mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {data?.map(d => (
          <div key={d.id} className='group relative rounded-xl border border-border bg-surface p-4 hover:border-brand'>
            <Link href={`/dashboards/${d.id}`} className='block'>
              <div className='font-medium'>{d.name}</div>
              <div className='mt-1 text-xs text-muted'>
                {d.widgetCount} {d.widgetCount === 1 ? 'chart' : 'charts'}
              </div>
            </Link>
            <button
              aria-label={`Delete ${d.name}`}
              onClick={() =>
                window.confirm(`Delete dashboard "${d.name}"? This cannot be undone.`) && remove.mutate(d.id)
              }
              className='absolute right-2 top-2 cursor-pointer rounded p-1.5 text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100'
            >
              <Trash2 className='h-4 w-4' />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
