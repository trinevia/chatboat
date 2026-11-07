'use client';

import { CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';
import { requestDemo, type DemoFormState } from '@/app/demo/actions';
import { buttonClass, cn } from './ui';

const initial: DemoFormState = { ok: false, message: '' };
const input =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-2 focus:outline-brand';

export function DemoForm({ topic }: { topic?: string }) {
  const [state, action, pending] = useActionState(requestDemo, initial);

  if (state.ok) {
    return (
      <div role='status' className='rounded-2xl border border-good/40 bg-good/10 p-6'>
        <CheckCircle2 className='h-6 w-6 text-good' />
        <p className='mt-3 font-medium'>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className='space-y-4' noValidate>
      <input type='hidden' name='topic' value={topic ?? ''} />
      {/* Honeypot for bots; hidden from people and screen readers. */}
      <input type='text' name='website' tabIndex={-1} autoComplete='off' className='hidden' aria-hidden='true' />
      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='Your name' name='name' error={state.errors?.name}>
          <input id='name' name='name' autoComplete='name' required className={input} />
        </Field>
        <Field label='Work email' name='email' error={state.errors?.email}>
          <input id='email' name='email' type='email' autoComplete='email' required className={input} />
        </Field>
        <Field label='Company' name='company' error={state.errors?.company}>
          <input id='company' name='company' autoComplete='organization' required className={input} />
        </Field>
        <Field label='Team size' name='teamSize'>
          <select id='teamSize' name='teamSize' className={input} defaultValue=''>
            <option value=''>Choose…</option>
            <option>1–5</option>
            <option>6–25</option>
            <option>26–100</option>
            <option>100+</option>
          </select>
        </Field>
      </div>
      <Field label='Where does your data live?' name='dataSources' hint='e.g. Postgres, MySQL, spreadsheets'>
        <input id='dataSources' name='dataSources' className={input} />
      </Field>
      <Field label='What would you like to know from your data?' name='message'>
        <textarea id='message' name='message' rows={4} className={input} placeholder='Which customers are late paying? How is revenue trending by region?' />
      </Field>
      {state.message && (
        <p role='alert' className='text-sm text-danger'>
          {state.message}
        </p>
      )}
      <button className={buttonClass('primary', 'lg', 'w-full sm:w-auto')} disabled={pending}>
        {pending ? 'Sending…' : 'Book my demo'}
      </button>
    </form>
  );
}

function Field({ label, name, hint, error, children }: { label: string; name: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className={cn(error && '[&_input]:border-danger')}>
      <label htmlFor={name} className='mb-1.5 block text-sm font-medium'>
        {label}
        {hint && <span className='ml-1 font-normal text-muted'>({hint})</span>}
      </label>
      {children}
      {error && <p className='mt-1 text-xs text-danger'>{error}</p>}
    </div>
  );
}
