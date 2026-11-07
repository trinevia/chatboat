import { AlertCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { Faq } from '@/components/faq';
import { PricingTable } from '@/components/pricing-table';
import { ButtonLink, SectionHeading } from '@/components/ui';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Starter, Business and Enterprise plans, monthly or yearly. Every plan is a private install in your environment.',
};

function CheckoutError({ error }: { error?: string | string[] }) {
  if (typeof error !== 'string' || !error) return null;
  return (
    <div role='alert' className='mx-auto mb-8 flex max-w-2xl items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm'>
      <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-danger' />
      <span>{error.slice(0, 200)}</span>
    </div>
  );
}

export default async function PricingPage({ searchParams }: PageProps<'/pricing'>) {
  const { error } = await searchParams;
  return (
    <>
      <section className='hero-glow'>
        <div className='mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-20'>
          <div className='mx-auto max-w-2xl text-center'>
            <h1 className='text-4xl font-semibold tracking-tight text-balance sm:text-5xl'>Simple pricing per install</h1>
            <p className='mt-4 text-lg text-muted text-pretty'>
              Every plan is a private {SITE.name} install for your company, in your environment. Pay monthly or yearly, and
              change or cancel any time.
            </p>
          </div>
          <div id='plans' className='mt-12 scroll-mt-24'>
            <CheckoutError error={error} />
            <PricingTable />
          </div>
          <p className='mt-8 text-center text-sm text-muted'>
            Prices in USD, excluding tax. Not sure which plan fits?{' '}
            <a href={SITE.liveDemoUrl} className='font-medium text-brand hover:underline' target='_blank' rel='noopener noreferrer'>
              Try the live demo
            </a>{' '}
            or{' '}
            <a href='/demo' className='font-medium text-brand hover:underline'>
              book a demo
            </a>
            .
          </p>
        </div>
      </section>

      <section className='border-t border-border py-20'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <SectionHeading eyebrow='After you subscribe' title='Up and running the same day' />
          <ol className='mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3'>
            {[
              ['Get your licence key', 'We email it after payment. It carries your plan and works offline.'],
              ['Install or let us host', 'One command on your server, or tick "Host it for us" and we set it up.'],
              ['Connect and ask', 'Connect your database, invite your team and ask the first question.'],
            ].map(([t, b], i) => (
              <li key={t} className='rounded-2xl border border-border bg-surface p-6'>
                <span className='text-xs font-semibold text-brand'>{i + 1}</span>
                <h3 className='mt-2 font-semibold'>{t}</h3>
                <p className='mt-2 text-sm text-muted'>{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className='border-t border-border bg-surface py-20'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <SectionHeading eyebrow='FAQ' title='Pricing questions' />
          <div className='mt-12'>
            <Faq />
          </div>
          <div className='mt-10 text-center'>
            <ButtonLink href='/demo' variant='secondary'>
              Ask us something else
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
