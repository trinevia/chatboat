'use client';

import { ArrowUp, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Question input: Enter sends, Shift+Enter adds a new line. */
export function AskBox({
  onSubmit,
  busy,
  onStop,
  placeholder = 'Ask a question about your data…',
  autoFocus,
  size = 'md',
}: {
  onSubmit: (text: string) => void;
  busy?: boolean;
  onStop?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  size?: 'md' | 'lg';
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    onSubmit(text);
    setValue('');
  };
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
      className='flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15'
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        autoFocus={autoFocus}
        aria-label='Your question'
        placeholder={placeholder}
        onChange={e => {
          setValue(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        className={cn(
          'max-h-40 min-w-0 flex-1 resize-none bg-transparent px-2 text-text outline-none placeholder:text-muted',
          size === 'lg' ? 'py-2.5 text-base' : 'py-2 text-sm'
        )}
      />
      {busy && onStop ? (
        <button type='button' onClick={onStop} aria-label='Stop' className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-text cursor-pointer'>
          <Square className='h-3.5 w-3.5 fill-current' />
        </button>
      ) : (
        <button
          type='submit'
          aria-label='Ask'
          disabled={!value.trim() || busy}
          className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-fg transition disabled:opacity-40 cursor-pointer disabled:cursor-default'
        >
          <ArrowUp className='h-4 w-4' />
        </button>
      )}
    </form>
  );
}
