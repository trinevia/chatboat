'use client';

import { useChat } from '@ai-sdk/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { AlertCircle, BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { AskBox } from './ask-box';
import { MessageView } from './message-view';

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
  return <Conversation key={chatId} chatId={chatId} title={data.chat.title} initialMessages={data.messages} />;
}

function Conversation({ chatId, title, initialMessages }: { chatId: string; title: string; initialMessages: UIMessage[] }) {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bottomRef = useRef<HTMLDivElement>(null);

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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id;
  const ask = (text: string) => sendMessage({ text });

  return (
    <div className='flex h-full flex-col'>
      <div className='border-b border-border bg-surface px-4 py-3'>
        <h1 className='mx-auto max-w-3xl truncate text-sm font-semibold'>{title}</h1>
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <div className='mx-auto max-w-3xl space-y-6 px-4 py-6'>
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
          {status === 'submitted' && (
            <div className='flex items-center gap-3' aria-live='polite'>
              <span className='grid h-7 w-7 place-items-center rounded-lg bg-brand text-brand-fg'>
                <BarChart3 className='h-4 w-4' />
              </span>
              <span className='flex gap-1' aria-label='Thinking'>
                {[0, 1, 2].map(i => (
                  <span key={i} className='typing-dot h-1.5 w-1.5 rounded-full bg-muted' style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            </div>
          )}
          {error && (
            <div className='flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger'>
              <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
              <div>
                {error.message || 'Something went wrong.'}{' '}
                <button className='underline cursor-pointer' onClick={() => regenerate()}>Try again</button>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className='border-t border-border bg-bg px-4 py-3'>
        <div className='mx-auto max-w-3xl'>
          <AskBox onSubmit={ask} busy={busy} onStop={stop} placeholder='Ask a follow-up question…' />
        </div>
      </div>
    </div>
  );
}
