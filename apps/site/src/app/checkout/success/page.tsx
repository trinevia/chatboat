import { CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';
import { buttonClass } from '@/components/ui';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Thank you', robots: { index: false } };

function ManageBilling({ session_id }: { session_id?: string | string[] }) {
  if (typeof session_id !== 'string' || !session_id.startsWith('cs_')) return null;
  return (
    <form action='/api/portal' method='post'>
      <input type='hidden' name='session_id' value={session_id} />
      <button className={buttonClass('secondary')}>Manage billing</button>
    </form>
  );
}

export default async function CheckoutSuccess({ searchParams }: PageProps<'/checkout/success'>) {
  const { session_id } = await searchParams;
  return (
    <section className='hero-glow'>
      <div className='mx-auto max-w-xl px-4 py-24 text-center sm:px-6'>
        <CheckCircle2 className='mx-auto h-12 w-12 text-good' />
        <h1 className='mt-6 text-3xl font-semibold tracking-tight'>Welcome to {SITE.name}</h1>
        <p className='mt-4 text-lg text-muted text-pretty'>
          Your subscription is active. We will email your licence key and install instructions shortly. If you chose
          hosting, we will be in touch to set up your private install.
        </p>
        <div className='mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row'>
          <a href='/' className={buttonClass('primary')}>
            Back to home
          </a>
          <ManageBilling session_id={session_id} />
        </div>
      </div>
    </section>
  );
}
