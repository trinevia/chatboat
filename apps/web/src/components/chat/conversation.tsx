'use client';

import { useChat } from '@ai-sdk/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BarChart3, MessagesSquare, Pin } from 'lucide-react';
import type { ChartSpec } from '@chatboat/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ChartCard } from '@/components/charts/chart-card';
import { ShareButton } from '@/components/share/share-dialog';
import { AskBox } from './ask-box';
import { MessageView } from './message-view';
import { ProgressSteps } from './progress-steps';

export function ConversationLoader({ chatId }: { chatId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => api.getChat(chatId),
    // useChat owns the messages once loaded; don't refetch underneath it.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  if (isLoading) return <div className='p-8 text-sm text-muted'>Loading conversation…</div>;
  if (error || !data)
    return <div className='p-8 text-sm text-danger'>This chat could not be loaded. It may have been deleted.</div>;
  return (
    <Conversation
      key={chatId}
      chatId={chatId}
      title={data.chat.title}
      context={data.chat.context}
      initialMessages={data.messages}
    />
  );
}

/** Every chart answered in this conversation, oldest first. */
function chartsIn(messages: UIMessage[]): { key: string; chart: ChartSpec }[] {
  return messages.flatMap(m =>
    m.parts.flatMap((p, i) => {
      const part = p as { type: string; state?: string; output?: { ok?: boolean; chart?: ChartSpec } };
      return part.type === 'tool-renderChart' && part.state === 'output-available' && part.output?.ok && part.output.chart
        ? [{ key: `${m.id}-${i}`, chart: part.output.chart }]
        : [];
    })
  );
}

const CONTEXT_SUGGESTIONS = [
  'What stands out in this chart?',
  'Break this down by region',
  'Compare with the same period last year',
];

function Conversation({
  chatId,
  title,
  context,
  initialMessages,
}: {
  chatId: string;
  title: string;
  context: ChartSpec | null;
  initialMessages: UIMessage[];
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'conversation' | 'charts'>('conversation');

  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: chatId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // The server keeps the history; only send the newest message.
      prepareSendMessagesRequest: ({ messages, id }) => ({ body: { id, message: messages[messages.length - 1] } }),
    }),
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ['chats'] });
      qc.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });

  const busy = status === 'submitted' || status === 'streaming';
  const charts = useMemo(() => chartsIn(messages), [messages]);

  // First question arrives from the home page as ?q=. A timeout (cleared on unmount)
  // instead of a ref keeps this correct under React Strict Mode's double effect run.
  const pendingQuestion = searchParams.get('q');
  useEffect(() => {
    if (!pendingQuestion || messages.length > 0) return;
    const t = setTimeout(() => {
      sendMessage({ text: pendingQuestion });
      router.replace(`/c/${chatId}`);
    }, 0);
    return () => clearTimeout(t);
  }, [pendingQuestion, messages.length, sendMessage, router, chatId]);

  useEffect(() => {
    if (view === 'conversation') bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status, view]);

  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id;
  const ask = (text: string) => {
    setView('conversation');
    sendMessage({ text });
  };

  const tab = (value: typeof view, label: string, Icon: typeof BarChart3, count?: number) => (
    <button
      role='tab'
      aria-selected={view === value}
      onClick={() => setView(value)}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs',
        view === value ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:text-text'
      )}
    >
      <Icon className='h-3.5 w-3.5' />
      {label}
      {count !== undefined && <span className='tabular-nums'>({count})</span>}
    </button>
  );

  return (
    <div className='flex h-full flex-col'>
      <div className='border-b border-border bg-surface px-4 py-2'>
        <div className='mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2'>
          <h1 className='min-w-0 flex-1 truncate text-sm font-semibold'>{title}</h1>
          <div className='flex gap-1' role='tablist'>
            {tab('conversation', 'Conversation', MessagesSquare)}
            {tab('charts', 'Charts', BarChart3, charts.length)}
          </div>
          <ShareButton kind='chat' id={chatId} />
        </div>
      </div>

      {view === 'charts' ? (
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <div className='mx-auto max-w-5xl px-4 py-6'>
            {charts.length ? (
              <div className='grid gap-4 lg:grid-cols-2'>
                {charts.map(c => (
                  <ChartCard key={c.key} spec={c.chart} chatId={chatId} />
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted'>No charts in this conversation yet.</p>
            )}
          </div>
        </div>
      ) : (
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <div className='mx-auto max-w-3xl space-y-6 px-4 py-6'>
            {context && (
              <div className='space-y-3 rounded-xl border border-dashed border-border p-3'>
                <div className='flex items-center gap-1.5 text-xs font-medium text-muted'>
                  <Pin className='h-3.5 w-3.5' /> Asking about this chart
                </div>
                <ChartCard spec={context} chatId={chatId} />
                {messages.length === 0 && (
                  <div className='flex flex-wrap gap-2'>
                    {CONTEXT_SUGGESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => ask(q)}
                        className='cursor-pointer rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:border-brand hover:text-brand'
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map(m => (
              <MessageView
                key={m.id}
                message={m}
                chatId={chatId}
                isLast={m.id === lastAssistantId}
                busy={busy}
                onFollowUp={ask}
              />
            ))}
            {busy && <ProgressSteps message={messages[messages.length - 1]} />}
            {error && (
              <div className='flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger'>
                <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
                <div>
                  {error.message || 'Something went wrong.'}{' '}
                  <button className='cursor-pointer underline' onClick={() => regenerate()}>
                    Try again
                  </button>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <div className='border-t border-border bg-bg px-4 py-3'>
        <div className='mx-auto max-w-3xl'>
          <AskBox
            onSubmit={ask}
            busy={busy}
            onStop={stop}
            placeholder={context && messages.length === 0 ? 'Ask about this chart…' : 'Ask a follow-up question…'}
          />
        </div>
      </div>
    </div>
  );
}
