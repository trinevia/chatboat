'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { History, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { AskBox } from './ask-box';

export function Home() {
  const router = useRouter();
  const { data: suggestions } = useQuery({ queryKey: ['suggestions'], queryFn: api.suggestions });
  const start = useMutation({
    mutationFn: (question: string) => api.createChat({ title: question }),
    onSuccess: ({ id }, question) => router.push(`/c/${id}?q=${encodeURIComponent(question)}`),
    onError: () => toast.error('Could not start a new chat.'),
  });

  return (
    <div className='mx-auto flex min-h-full max-w-3xl flex-col justify-center px-4 py-12'>
      <div className='mb-8 text-center'>
        <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>Ask anything about your data</h1>
        <p className='mt-2 text-sm text-muted'>
          Sales, invoices, customers and inventory. Ask in plain English and get a chart back.
        </p>
      </div>
      <AskBox
        size='lg'
        autoFocus
        busy={start.isPending}
        onSubmit={q => start.mutate(q)}
        placeholder='Show me the sales data for California'
      />
      {suggestions && (
        <div className='mt-8 grid gap-6 sm:grid-cols-2'>
          <section>
            <h2 className='mb-2 flex items-center gap-1.5 text-xs font-medium text-muted'>
              <Sparkles className='h-3.5 w-3.5' /> Suggested for {suggestions.role}
            </h2>
            <ul className='space-y-1.5'>
              {suggestions.roleBased.map(q => (
                <li key={q}>
                  <button
                    onClick={() => start.mutate(q)}
                    disabled={start.isPending}
                    className='w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm hover:border-brand hover:text-brand cursor-pointer'
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {suggestions.recent.length > 0 && (
            <section>
              <h2 className='mb-2 flex items-center gap-1.5 text-xs font-medium text-muted'>
                <History className='h-3.5 w-3.5' /> Recent questions
              </h2>
              <ul className='space-y-1.5'>
                {suggestions.recent.map(q => (
                  <li key={q}>
                    <button
                      onClick={() => start.mutate(q)}
                      disabled={start.isPending}
                      className='w-full truncate rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-text cursor-pointer'
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
