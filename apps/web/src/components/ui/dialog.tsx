'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input, Label } from './input';

/** Modal built on the native <dialog>: focus trap, Escape and backdrop come for free. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  initialFocus,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** CSS selector of the element to focus when opened (defaults to the first control). */
  initialFocus?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (initialFocus) d.querySelector<HTMLElement>(initialFocus)?.focus();
    }
    if (!open && d.open) d.close();
  }, [open, initialFocus]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={e => e.target === ref.current && onClose()}
      aria-labelledby='dialog-title'
      className={cn(
        'm-auto w-[min(420px,calc(100vw-32px))] rounded-xl border border-border bg-surface p-5 text-text shadow-xl backdrop:bg-black/50',
        className
      )}
    >
      {open && (
        <>
          <h2 id='dialog-title' className='text-base font-semibold'>
            {title}
          </h2>
          {description && <div className='mt-1 text-sm text-muted'>{description}</div>}
          <div className='mt-4'>{children}</div>
        </>
      )}
    </dialog>
  );
}

type ConfirmOptions = { title: string; description?: React.ReactNode; confirmLabel?: string; danger?: boolean };
type PromptOptions = { title: string; label: string; defaultValue?: string; confirmLabel?: string; maxLength?: number };
type Pending =
  | ({ kind: 'confirm'; resolve: (v: boolean) => void } & ConfirmOptions)
  | ({ kind: 'prompt'; resolve: (v: string | null) => void } & PromptOptions);

const DialogContext = createContext<{
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
} | null>(null);

/** Promise-based confirm/prompt, used instead of window.confirm / window.prompt. */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState('');

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ kind: 'confirm', resolve, ...o })),
    []
  );
  const prompt = useCallback((o: PromptOptions) => {
    setValue(o.defaultValue ?? '');
    return new Promise<string | null>(resolve => setPending({ kind: 'prompt', resolve, ...o }));
  }, []);

  const close = (result: boolean | string | null) => {
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(result === true);
    else pending.resolve(typeof result === 'string' ? result : null);
    setPending(null);
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      <Dialog
        open={!!pending}
        onClose={() => close(pending?.kind === 'confirm' ? false : null)}
        title={pending?.title ?? ''}
        description={pending?.kind === 'confirm' ? pending.description : undefined}
        initialFocus={pending?.kind === 'prompt' ? '#dialog-prompt' : '[data-autofocus]'}
      >
        {pending?.kind === 'confirm' && (
          <div className='flex justify-end gap-2'>
            <Button variant='secondary' onClick={() => close(false)}>
              Cancel
            </Button>
            <Button data-autofocus variant={pending.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {pending.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        )}
        {pending?.kind === 'prompt' && (
          <form
            className='space-y-4'
            onSubmit={e => {
              e.preventDefault();
              const v = value.trim();
              if (v) close(v);
            }}
          >
            <div className='space-y-1.5'>
              <Label htmlFor='dialog-prompt'>{pending.label}</Label>
              <Input
                id='dialog-prompt'
                value={value}
                maxLength={pending.maxLength ?? 120}
                onChange={e => setValue(e.target.value)}
                onFocus={e => e.target.select()}
              />
            </div>
            <div className='flex justify-end gap-2'>
              <Button type='button' variant='secondary' onClick={() => close(null)}>
                Cancel
              </Button>
              <Button type='submit' disabled={!value.trim()}>
                {pending.confirmLabel ?? 'Save'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </DialogContext.Provider>
  );
}

export function useDialogs() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be used inside <DialogProvider>');
  return ctx;
}
