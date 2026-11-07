'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Link2, RefreshCw, Share2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Share button + dialog for a chat or dashboard. Links show a frozen, read-only copy. */
export function ShareButton({ kind, id }: { kind: 'chat' | 'dashboard'; id: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();
  const key = ['share', kind, id];
  const { data: link, isLoading } = useQuery({ queryKey: key, queryFn: () => api.getShare(kind, id), enabled: open });

  const create = useMutation({
    mutationFn: () => api.createShare(kind, id),
    onSuccess: l => qc.setQueryData(key, l),
    onError: () => toast.error('Could not create the link.'),
  });
  const revoke = useMutation({
    mutationFn: (token: string) => api.revokeShare(token),
    onSuccess: () => {
      qc.setQueryData(key, null);
      toast.success('Link turned off. Anyone who has it can no longer open it.');
    },
    onError: () => toast.error('Could not turn off the link.'),
  });

  const url = link ? `${window.location.origin}/s/${link.token}` : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.');
    }
  };
  const what = kind === 'chat' ? 'conversation' : 'dashboard';

  return (
    <>
      <Button variant='secondary' size='sm' onClick={() => setOpen(true)}>
        <Share2 className='h-4 w-4' /> Share
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Share this ${what}`}
        description={`Anyone with the link can view a read-only copy. They can't ask new questions, and the SQL is hidden.`}
      >
        {isLoading ? (
          <p className='text-sm text-muted'>Loading…</p>
        ) : link ? (
          <div className='space-y-3'>
            <div className='flex gap-2'>
              <Input value={url} readOnly aria-label='Share link' onFocus={e => e.target.select()} />
              <Button onClick={copy} aria-label='Copy link' className='shrink-0'>
                {copied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className='text-xs text-muted'>
              Shows the {what} as of {timeAgo(link.updatedAt)}. Later changes aren’t included until you update the link.
            </p>
            <div className='flex flex-wrap justify-between gap-2 pt-1'>
              <Button
                variant='ghost'
                className='text-danger hover:text-danger'
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(link.token)}
              >
                Stop sharing
              </Button>
              <div className='flex gap-2'>
                <Button variant='secondary' disabled={create.isPending} onClick={() => create.mutate()}>
                  <RefreshCw className={create.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Update link
                </Button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className='flex justify-end gap-2'>
            <Button variant='secondary' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              <Link2 className='h-4 w-4' /> {create.isPending ? 'Creating…' : 'Create link'}
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
