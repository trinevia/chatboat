import { CalendarCheck, MonitorPlay, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { DemoForm } from '@/components/demo-form';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Book a demo',
  description: `See ${SITE.name} on data like yours in a 30-minute call.`,
};

export default async function DemoPage({ searchParams }: PageProps<'/demo'>) {
  const { topic } = await searchParams;
  return (
    <section className='hero-glow'>
      <div className='mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.3fr]'>
        <div>
          <h1 className='text-4xl font-semibold tracking-tight text-balance sm:text-5xl'>Book a demo</h1>
          <p className='mt-4 text-lg text-muted text-pretty'>
            30 minutes with someone who builds {SITE.name}. Bring your questions; we will show answers on data like yours.
          </p>
          <ul className='mt-8 space-y-5'>
            {[
              [CalendarCheck, 'We reply within one working day', 'to find a time that suits you.'],
              [ShieldCheck, 'Security and setup', 'Where it runs, what it can read, and which AI model it uses.'],
              [MonitorPlay, 'Rather explore first?', 'The live demo runs on sample data, no sign-up needed.'],
            ].map(([Icon, t, b]) => {
              const I = Icon as typeof CalendarCheck;
              return (
                <li key={t as string} className='flex gap-3'>
                  <I className='mt-0.5 h-5 w-5 shrink-0 text-brand' />
                  <div>
                    <p className='font-medium'>{t as string}</p>
                    <p className='text-sm text-muted'>{b as string}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <a
            href={SITE.liveDemoUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='mt-6 inline-block text-sm font-medium text-brand hover:underline'
          >
            Open the live demo →
          </a>
        </div>
        <div className='rounded-2xl border border-border bg-surface p-6 sm:p-8'>
          <DemoForm topic={typeof topic === 'string' ? topic.slice(0, 40) : undefined} />
        </div>
      </div>
    </section>
  );
}
