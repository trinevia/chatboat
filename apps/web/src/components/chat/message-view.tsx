'use client';

import type { UIMessage } from 'ai';
import { useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, ThumbsDown, ThumbsUp } from 'lucide-react';
import { FEEDBACK_REASONS, type ChartSpec, type FeedbackReason } from '@chatboat/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ChartCard } from '@/components/charts/chart-card';

/** Models sometimes use **bold** despite the prompt; render it instead of showing asterisks. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
        chunk.startsWith('**') && chunk.endsWith('**') ? <strong key={i}>{chunk.slice(2, -2)}</strong> : chunk
      )}
    </>
  );
}

type ToolPart = {
  type: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error' | string;
  output?: unknown;
  errorText?: string;
};

function Followups({ questions, onPick, disabled }: { questions: string[]; onPick: (q: string) => void; disabled?: boolean }) {
  return (
    <div className='flex flex-wrap gap-2'>
      {questions.map(q => (
        <button
          key={q}
          disabled={disabled}
          onClick={() => onPick(q)}
          className='rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text hover:border-brand hover:text-brand disabled:opacity-50 cursor-pointer'
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function Feedback({ messageId }: { messageId: string }) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [askWhy, setAskWhy] = useState(false);
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (r: 'up' | 'down', extra?: { reasons: FeedbackReason[]; comment: string }) => {
    setSending(true);
    try {
      await api.feedback({ messageId, rating: r, reasons: extra?.reasons, comment: extra?.comment.trim() || undefined });
      setRating(r);
      setAskWhy(false);
      toast.success('Thanks for the feedback!');
    } catch {
      toast.error('Could not save feedback.');
    } finally {
      setSending(false);
    }
  };
  const toggle = (r: FeedbackReason) => setReasons(rs => (rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r]));

  return (
    <div className='flex items-center gap-1 text-xs text-muted'>
      <span className='mr-1'>Was this helpful?</span>
      <button
        aria-label='Helpful'
        aria-pressed={rating === 'up'}
        onClick={() => send('up')}
        className={cn('cursor-pointer rounded p-1 hover:text-text', rating === 'up' && 'text-brand')}
      >
        <ThumbsUp className='h-3.5 w-3.5' />
      </button>
      <button
        aria-label='Not helpful'
        aria-pressed={rating === 'down'}
        onClick={() => setAskWhy(true)}
        className={cn('cursor-pointer rounded p-1 hover:text-text', rating === 'down' && 'text-brand')}
      >
        <ThumbsDown className='h-3.5 w-3.5' />
      </button>
      <Dialog
        open={askWhy}
        onClose={() => setAskWhy(false)}
        title='What went wrong?'
        description='Pick anything that applies. This helps us improve answers.'
      >
        <form
          className='space-y-4'
          onSubmit={e => {
            e.preventDefault();
            send('down', { reasons, comment });
          }}
        >
          <div className='flex flex-wrap gap-2'>
            {(Object.entries(FEEDBACK_REASONS) as [FeedbackReason, string][]).map(([key, label]) => (
              <button
                key={key}
                type='button'
                aria-pressed={reasons.includes(key)}
                onClick={() => toggle(key)}
                className={cn(
                  'cursor-pointer rounded-full border px-3 py-1.5 text-xs',
                  reasons.includes(key) ? 'border-brand bg-brand-soft text-brand' : 'border-border text-text hover:border-brand'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='feedback-comment'>Anything else? (optional)</Label>
            <textarea
              id='feedback-comment'
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder='e.g. It should only count paid invoices'
              className='w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm text-text outline-none placeholder:text-muted focus:border-brand'
            />
          </div>
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='secondary' onClick={() => setAskWhy(false)}>
              Cancel
            </Button>
            <Button type='submit' disabled={sending || (!reasons.length && !comment.trim())}>
              Send feedback
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

export function MessageView({
  message,
  chatId,
  isLast,
  busy,
  onFollowUp,
}: {
  message: UIMessage;
  chatId: string;
  isLast: boolean;
  busy: boolean;
  onFollowUp: (q: string) => void;
}) {
  if (message.role === 'user') {
    const text = message.parts.map(p => (p.type === 'text' ? p.text : '')).join('');
    return (
      <div className='flex justify-end'>
        <div className='max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-brand-fg'>{text}</div>
      </div>
    );
  }

  let followups: string[] = [];
  const blocks: React.ReactNode[] = [];
  message.parts.forEach((part, i) => {
    if (part.type === 'text') {
      if (part.text.trim()) blocks.push(<p key={i} className='whitespace-pre-wrap text-sm leading-relaxed'><RichText text={part.text} /></p>);
      return;
    }
    if (!part.type.startsWith('tool-')) return;
    const p = part as ToolPart;
    const name = p.type.slice(5);
    const done = p.state === 'output-available';

    if (name === 'runSql' || name === 'runMongo') return; // progress is shown by ProgressSteps
    if (name === 'renderChart') {
      const out = p.output as { ok: true; chart: ChartSpec } | { ok: false } | undefined;
      if (!done) {
        blocks.push(
          <div key={i} className='h-64 animate-pulse rounded-xl border border-border bg-surface' aria-label='Building chart' />
        );
      } else if (out?.ok) {
        blocks.push(<ChartCard key={i} spec={out.chart} chatId={chatId} />);
      }
      return;
    }
    if (name === 'suggestFollowups' && done) {
      followups = (p.output as { questions: string[] }).questions ?? [];
    }
  });

  if (!blocks.length && !followups.length) return null;

  return (
    <div className='flex gap-3'>
      <span className='mt-0.5 hidden h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand text-brand-fg sm:grid'>
        <BarChart3 className='h-4 w-4' />
      </span>
      <div className='min-w-0 flex-1 space-y-3'>
        {blocks}
        {isLast && !busy && followups.length > 0 && <Followups questions={followups} onPick={onFollowUp} disabled={busy} />}
        {isLast && !busy && <Feedback messageId={message.id} />}
      </div>
    </div>
  );
}
