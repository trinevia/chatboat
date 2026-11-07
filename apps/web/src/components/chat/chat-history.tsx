'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Bookmark,
  ChevronRight,
  Folder,
  FolderInput,
  FolderMinus,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import type { ChatListItem, Collection } from '@chatboat/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, useDialogs } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { Menu, MenuItem } from '@/components/ui/menu';

const DRAG_TYPE = 'application/x-chatboat-chat';
const OPEN_KEY = 'chatboat:open-collections';

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

/** Which collections are expanded; a per-browser convenience, so failures are ignored. */
function useOpenCollections() {
  const [open, setOpen] = useState<number[]>([]);
  useEffect(() => {
    try {
      setOpen(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]'));
    } catch {}
  }, []);
  const toggle = (id: number, force?: boolean) =>
    setOpen(prev => {
      const isOpen = prev.includes(id);
      const next = (force ?? !isOpen) ? (isOpen ? prev : [...prev, id]) : prev.filter(x => x !== id);
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  return { open, toggle };
}

/** Drop target that highlights while a chat is dragged over it. */
function useDropTarget(onDropChat: (chatId: string) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        setOver(false);
        const id = e.dataTransfer.getData(DRAG_TYPE);
        if (id) {
          e.preventDefault();
          onDropChat(id);
        }
      },
    },
  };
}

function MoveDialog({
  chat,
  collections,
  onClose,
  onMove,
}: {
  chat: ChatListItem | null;
  collections: Collection[];
  onClose: () => void;
  onMove: (chatId: string, target: { id: number } | { newName: string }) => void;
}) {
  const [choice, setChoice] = useState('new');
  const [name, setName] = useState('');
  useEffect(() => {
    if (!chat) return;
    const firstOther = collections.find(c => c.id !== chat.groupId);
    setChoice(firstOther ? String(firstOther.id) : 'new');
    setName('');
  }, [chat, collections]);

  return (
    <Dialog open={!!chat} onClose={onClose} title='Move to collection' description={chat ? `“${chat.title}”` : undefined}>
      <form
        className='space-y-3'
        onSubmit={e => {
          e.preventDefault();
          if (!chat) return;
          if (choice === 'new') {
            if (name.trim()) onMove(chat.id, { newName: name.trim() });
          } else onMove(chat.id, { id: Number(choice) });
        }}
      >
        <div className='space-y-1.5'>
          <Label htmlFor='move-to'>Collection</Label>
          <select
            id='move-to'
            value={choice}
            onChange={e => setChoice(e.target.value)}
            className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm'
          >
            {collections
              .filter(c => c.id !== chat?.groupId)
              .map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            <option value='new'>+ New collection</option>
          </select>
        </div>
        {choice === 'new' && (
          <div className='space-y-1.5'>
            <Label htmlFor='move-new'>Name</Label>
            <Input id='move-new' value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder='Q4 review' />
          </div>
        )}
        <div className='flex justify-end gap-2 pt-1'>
          <Button type='button' variant='secondary' onClick={onClose}>
            Cancel
          </Button>
          <Button type='submit' disabled={choice === 'new' && !name.trim()}>
            Move
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ChatHistory({ onNavigate }: { onNavigate?: () => void }) {
  const [q, setQ] = useState('');
  const search = useDeferredValue(q.trim());
  const { data: chats, isLoading } = useQuery({
    queryKey: ['chats', search],
    queryFn: () => api.listChats(search || undefined),
  });
  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: api.listCollections });
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const dialogs = useDialogs();
  const { open, toggle } = useOpenCollections();
  const [moving, setMoving] = useState<ChatListItem | null>(null);

  const refresh = (chatId?: string) => {
    qc.invalidateQueries({ queryKey: ['chats'] });
    qc.invalidateQueries({ queryKey: ['collections'] });
    if (chatId) qc.invalidateQueries({ queryKey: ['chat', chatId] });
  };

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { title?: string; isSaved?: boolean; groupId?: number | null } }) =>
      api.updateChat(id, patch),
    onSuccess: (_, { id }) => refresh(id),
    onError: () => toast.error('Could not update the chat.'),
  });
  const remove = useMutation({
    mutationFn: api.deleteChat,
    onSuccess: (_, id) => {
      refresh();
      if (params.id === id) router.push('/');
      toast.success('Chat deleted');
    },
    onError: () => toast.error('Could not delete the chat.'),
  });
  const collectionOp = useMutation({
    mutationFn: (op: { kind: 'rename'; id: number; name: string } | { kind: 'delete'; id: number }) =>
      op.kind === 'rename' ? api.renameCollection(op.id, op.name) : api.deleteCollection(op.id),
    onSuccess: () => refresh(),
    onError: () => toast.error('Could not update the collection.'),
  });

  const moveTo = async (chatId: string, groupId: number | null) => {
    await update.mutateAsync({ id: chatId, patch: { groupId } });
    if (groupId) toggle(groupId, true);
  };
  const newCollection = async (name?: string) => {
    const n = name ?? (await dialogs.prompt({ title: 'New collection', label: 'Name', confirmLabel: 'Create', maxLength: 60 }));
    if (!n) return null;
    try {
      const created = await api.createCollection(n);
      refresh();
      toggle(created.id, true);
      return created;
    } catch {
      toast.error('Could not create the collection.');
      return null;
    }
  };

  const recentDrop = useDropTarget(id => {
    const chat = chats?.find(c => c.id === id);
    if (chat?.groupId) moveTo(id, null);
  });

  const row = (c: ChatListItem, indent = false) => (
    <div
      key={c.id}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData(DRAG_TYPE, c.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        'group flex items-center rounded-lg pr-1',
        indent && 'ml-3',
        params.id === c.id ? 'bg-surface-2' : 'hover:bg-surface-2'
      )}
    >
      <Link href={`/c/${c.id}`} onClick={onNavigate} className='min-w-0 flex-1 truncate px-2 py-1.5 text-sm' title={c.title}>
        {c.title}
      </Link>
      <Menu
        trigger={(isOpen, t) => (
          <button
            aria-label={`Actions for ${c.title}`}
            onClick={t}
            className={cn(
              'cursor-pointer rounded p-1 text-muted hover:text-text',
              isOpen ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100'
            )}
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
            <MenuItem onClick={() => { close(); setMoving(c); }}>
              <FolderInput className='h-4 w-4' /> Move to collection
            </MenuItem>
            {c.groupId && (
              <MenuItem onClick={() => { close(); moveTo(c.id, null); }}>
                <FolderMinus className='h-4 w-4' /> Remove from collection
              </MenuItem>
            )}
            <div className='my-1 border-t border-border' />
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
  );

  const ungrouped = chats?.filter(c => !c.groupId) ?? [];

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-2'>
      <div className='flex gap-1'>
        <div className='relative flex-1'>
          <Search className='pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted' />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder='Search chats'
            aria-label='Search chats'
            className='h-9 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-2 text-sm outline-none focus:border-brand'
          />
        </div>
        <button
          aria-label='New collection'
          title='New collection'
          onClick={() => newCollection()}
          className='grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text'
        >
          <FolderPlus className='h-4 w-4' />
        </button>
      </div>

      <div className='-mx-1 min-h-0 flex-1 overflow-y-auto px-1'>
        {isLoading && <p className='px-2 py-1 text-xs text-muted'>Loading…</p>}

        {/* Search shows a flat list across collections. */}
        {search && chats && (
          <>
            {!chats.length && <p className='px-2 py-1 text-xs text-muted'>No matching chats.</p>}
            {chats.map(c => row(c))}
          </>
        )}

        {!search && collections.length > 0 && (
          <div className='mb-3'>
            <div className='px-2 pb-1 text-xs font-medium text-muted'>Collections</div>
            {collections.map(col => (
              <CollectionGroup
                key={col.id}
                collection={col}
                isOpen={open.includes(col.id)}
                onToggle={() => toggle(col.id)}
                onDropChat={id => moveTo(id, col.id)}
                onRename={async () => {
                  const name = await dialogs.prompt({ title: 'Rename collection', label: 'Name', defaultValue: col.name, maxLength: 60 });
                  if (name && name !== col.name) collectionOp.mutate({ kind: 'rename', id: col.id, name });
                }}
                onDelete={async () => {
                  const ok = await dialogs.confirm({
                    title: 'Delete collection?',
                    description: `"${col.name}" will be deleted. Its ${col.chatCount} ${col.chatCount === 1 ? 'chat goes' : 'chats go'} back to your recent list.`,
                    confirmLabel: 'Delete',
                    danger: true,
                  });
                  if (ok) collectionOp.mutate({ kind: 'delete', id: col.id });
                }}
              >
                {chats?.filter(c => c.groupId === col.id).map(c => row(c, true))}
              </CollectionGroup>
            ))}
          </div>
        )}

        {!search && chats && (
          <div {...recentDrop.props} className={cn('min-h-8 rounded-lg', recentDrop.over && 'bg-brand-soft')}>
            {!chats.length && <p className='px-2 py-1 text-xs text-muted'>Your questions will appear here.</p>}
            {groupByDate(ungrouped).map(([label, items]) => (
              <div key={label} className='mb-3'>
                <div className='px-2 pb-1 text-xs font-medium text-muted'>{label}</div>
                {items.map(c => row(c))}
              </div>
            ))}
          </div>
        )}
      </div>

      <MoveDialog
        chat={moving}
        collections={collections}
        onClose={() => setMoving(null)}
        onMove={async (chatId, target) => {
          setMoving(null);
          const id = 'id' in target ? target.id : (await newCollection(target.newName))?.id;
          if (id) moveTo(chatId, id);
        }}
      />
    </div>
  );
}

function CollectionGroup({
  collection,
  isOpen,
  onToggle,
  onDropChat,
  onRename,
  onDelete,
  children,
}: {
  collection: Collection;
  isOpen: boolean;
  onToggle: () => void;
  onDropChat: (chatId: string) => void;
  onRename: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const drop = useDropTarget(onDropChat);
  return (
    <div {...drop.props} className={cn('rounded-lg', drop.over && 'bg-brand-soft ring-1 ring-brand')}>
      <div className='group flex items-center rounded-lg pr-1 hover:bg-surface-2'>
        <button
          onClick={onToggle}
          aria-expanded={isOpen}
          className='flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 px-2 py-1.5 text-left text-sm'
        >
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted transition-transform', isOpen && 'rotate-90')} />
          <Folder className='h-4 w-4 shrink-0 text-muted' />
          <span className='truncate'>{collection.name}</span>
          <span className='ml-auto pl-1 text-xs text-muted'>{collection.chatCount}</span>
        </button>
        <Menu
          trigger={(menuOpen, t) => (
            <button
              aria-label={`Actions for collection ${collection.name}`}
              onClick={t}
              className={cn(
                'cursor-pointer rounded p-1 text-muted hover:text-text',
                menuOpen ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100'
              )}
            >
              <MoreHorizontal className='h-4 w-4' />
            </button>
          )}
        >
          {close => (
            <>
              <MenuItem onClick={() => { close(); onRename(); }}>
                <Pencil className='h-4 w-4' /> Rename
              </MenuItem>
              <MenuItem className='text-danger' onClick={() => { close(); onDelete(); }}>
                <Trash2 className='h-4 w-4' /> Delete collection
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
      {isOpen && (
        <div className='pb-1'>
          {collection.chatCount === 0 ? (
            <p className='ml-8 py-1 text-xs text-muted'>Drag chats here or use “Move to collection”.</p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}
