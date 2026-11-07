'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { Bookmark, MoreHorizontal, Pencil, Search, Trash2 } from 'lucide-react';
import type { ChatListItem } from '@chatboat/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Menu, MenuItem } from '@/components/ui/menu';
import { useDialogs } from '@/components/ui/dialog';

function groupByDate(chats: ChatListItem[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups: Record<string, ChatListItem[]> = { Saved: [], Today: [], 'Previous 7 days': [], Older: [] };
  for (const c of chats) {
    const t = new Date(c.updatedAt).getTime();
    if (c.isSaved) groups.Saved.push(c);
    else if (t >= startOfToday) groups.Today.push(c);
    else if (t >= startOfToday - 7 * 864e5) groups['Previous 7 days'].push(c);
    else groups.Older.push(c);
  }
  return Object.entries(groups).filter(([, v]) => v.length);
}

export function ChatHistory({ onNavigate }: { onNavigate?: () => void }) {
  const [q, setQ] = useState('');
  const search = useDeferredValue(q.trim());
  const { data: chats, isLoading } = useQuery({ queryKey: ['chats', search], queryFn: () => api.listChats(search || undefined) });
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const dialogs = useDialogs();

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { title?: string; isSaved?: boolean } }) => api.updateChat(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['chats'] });
      qc.invalidateQueries({ queryKey: ['chat', id] });
    },
    onError: () => toast.error('Could not update the chat.'),
  });
  const remove = useMutation({
    mutationFn: api.deleteChat,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['chats'] });
      if (params.id === id) router.push('/');
      toast.success('Chat deleted');
    },
    onError: () => toast.error('Could not delete the chat.'),
  });

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-2'>
      <div className='relative'>
        <Search className='pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted' />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder='Search chats'
          aria-label='Search chats'
          className='h-9 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-2 text-sm outline-none focus:border-brand'
        />
      </div>
      <div className='-mx-1 min-h-0 flex-1 overflow-y-auto px-1'>
        {isLoading && <p className='px-2 py-1 text-xs text-muted'>Loading…</p>}
        {chats && !chats.length && <p className='px-2 py-1 text-xs text-muted'>{search ? 'No matching chats.' : 'Your questions will appear here.'}</p>}
        {chats &&
          groupByDate(chats).map(([label, items]) => (
            <div key={label} className='mb-3'>
              <div className='px-2 pb-1 text-xs font-medium text-muted'>{label}</div>
              {items.map(c => (
                <div
                  key={c.id}
                  className={cn(
                    'group flex items-center rounded-lg pr-1',
                    params.id === c.id ? 'bg-surface-2' : 'hover:bg-surface-2'
                  )}
                >
                  <Link href={`/c/${c.id}`} onClick={onNavigate} className='min-w-0 flex-1 truncate px-2 py-1.5 text-sm' title={c.title}>
                    {c.title}
                  </Link>
                  <Menu
                    trigger={(open, toggle) => (
                      <button
                        aria-label={`Actions for ${c.title}`}
                        onClick={toggle}
                        className={cn('rounded p-1 text-muted hover:text-text cursor-pointer', open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100')}
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
                            const title = await dialogs.prompt({ title: 'Rename chat', label: 'Chat name', defaultValue: c.title });
                            if (title && title !== c.title) update.mutate({ id: c.id, patch: { title } });
                          }}
                        >
                          <Pencil className='h-4 w-4' /> Rename
                        </MenuItem>
                        <MenuItem onClick={() => { close(); update.mutate({ id: c.id, patch: { isSaved: !c.isSaved } }); }}>
                          <Bookmark className='h-4 w-4' /> {c.isSaved ? 'Unsave' : 'Save'}
                        </MenuItem>
                        <MenuItem
                          className='text-danger'
                          onClick={async () => {
                            close();
                            const ok = await dialogs.confirm({
                              title: 'Delete chat?',
                              description: `"${c.title}" and its answers will be deleted. This cannot be undone.`,
                              confirmLabel: 'Delete',
                              danger: true,
                            });
                            if (ok) remove.mutate(c.id);
                          }}
                        >
                          <Trash2 className='h-4 w-4' /> Delete
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
