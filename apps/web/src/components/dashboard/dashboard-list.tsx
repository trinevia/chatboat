'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { LayoutDashboard, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useDialogs } from '@/components/ui/dialog';
import { Menu, MenuItem } from '@/components/ui/menu';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export function DashboardList() {
  const qc = useQueryClient();
  const dialogs = useDialogs();
  const { data, isLoading } = useQuery({ queryKey: ['dashboards'], queryFn: api.listDashboards });
  const remove = useMutation({
    mutationFn: api.deleteDashboard,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Dashboard deleted');
    },
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.renameDashboard(id, name),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      qc.invalidateQueries({ queryKey: ['dashboard', id] });
    },
    onError: () => toast.error('Could not rename the dashboard.'),
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
            <div className='absolute right-2 top-2'>
              <Menu
                trigger={(open, toggle) => (
                  <button
                    aria-label={`Actions for ${d.name}`}
                    onClick={toggle}
                    className={`cursor-pointer rounded p-1.5 text-muted hover:text-text focus:opacity-100 ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    <MoreHorizontal className='h-4 w-4' />
                  </button>
                )}
              >
                {close => (
                  <>
                    <MenuItem
                      onClick={async () => {
                        close();
                        const name = await dialogs.prompt({ title: 'Rename dashboard', label: 'Name', defaultValue: d.name, maxLength: 80 });
                        if (name && name !== d.name) rename.mutate({ id: d.id, name });
                      }}
                    >
                      <Pencil className='h-4 w-4' /> Rename
                    </MenuItem>
                    <MenuItem
                      className='text-danger'
                      onClick={async () => {
                        close();
                        const ok = await dialogs.confirm({
                          title: 'Delete dashboard?',
                          description: `"${d.name}" and its ${d.widgetCount} ${d.widgetCount === 1 ? 'chart' : 'charts'} will be deleted. Your chats are kept.`,
                          confirmLabel: 'Delete',
                          danger: true,
                        });
                        if (ok) remove.mutate(d.id);
                      }}
                    >
                      <Trash2 className='h-4 w-4' /> Delete
                    </MenuItem>
                  </>
                )}
              </Menu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
