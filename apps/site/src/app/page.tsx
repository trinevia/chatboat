import {
  ArrowRight,
  BarChart3,
  Cable,
  Cpu,
  Database,
  KeyRound,
  LayoutDashboard,
  Lock,
  Mail,
  MessageSquareText,
  ServerCog,
  ShieldCheck,
  Table2,
  Users,
} from 'lucide-react';
import { Faq } from '@/components/faq';
import { ProductPreview } from '@/components/product-preview';
import { ButtonLink, SectionHeading } from '@/components/ui';
import { SITE } from '@/lib/site';

const steps = [
  { icon: Cable, title: 'Connect your data', body: 'Point Chatboat at your Postgres database or upload CSV files. It reads the structure and learns your business terms.' },
  { icon: MessageSquareText, title: 'Ask in plain English', body: '"Which customers owe us more than 60 days?" No SQL, no waiting for the data team.' },
  { icon: BarChart3, title: 'Get charts and tables', body: 'Answers come back as a short summary with the right chart, and the query behind it if you want to check.' },
  { icon: LayoutDashboard, title: 'Dashboards and digests', body: 'Pin answers to a dashboard, and have the numbers emailed to your team every Monday morning.' },
];

const features = [
  { icon: BarChart3, title: 'The right chart, automatically', body: 'Lines for trends, bars for comparisons, tables for lists. Download any chart as PNG, PDF or CSV.' },
  { icon: LayoutDashboard, title: 'Dashboards that stay fresh', body: 'Saved answers re-run on your live data, so a dashboard is never out of date.' },
  { icon: Mail, title: 'Email digests', body: 'Schedule any dashboard to land in inboxes daily, weekly or monthly, charts included.' },
  { icon: Table2, title: 'Knows your business', body: 'Teach it your terms ("active customer", "net revenue") once and every answer uses them.' },
  { icon: Users, title: 'Built for teams', body: 'Invite colleagues, share answers by link, and keep admin controls in one place.' },
  { icon: Database, title: 'Works with what you have', body: 'Postgres and CSV or Excel uploads today, more sources coming. No warehouse or data project required.' },
];

const security = [
  { icon: ServerCog, title: 'Your data stays in your environment', body: 'Installed on your server or cloud. Your database is never copied to us.' },
  { icon: Lock, title: 'Read-only access', body: 'A read-only database user, plus a check on every query: writes and unlisted tables are refused.' },
  { icon: Cpu, title: 'Private AI options', body: 'Use your own Azure OpenAI or AWS Bedrock account, or a self-hosted model, so nothing leaves your network.' },
  { icon: KeyRound, title: 'Works offline', body: 'Your licence is checked on your own server. No call home needed to keep running.' },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className='hero-glow'>
        <div className='mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24'>
          <p className='mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted'>
            <ShieldCheck className='h-3.5 w-3.5 text-good' /> Private install · read-only · your cloud
          </p>
          <h1 className='mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl'>
            Ask your business data anything.
            <span className='text-brand'> Get charts back.</span>
          </h1>
          <p className='mx-auto mt-6 max-w-2xl text-lg text-muted text-pretty'>
            {SITE.name} answers questions about sales, invoices, customers and inventory in plain English, then turns the
            answers into dashboards and email digests. It runs in your environment, so your data stays yours.
          </p>
          <div className='mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row'>
            <ButtonLink href={SITE.liveDemoUrl} external size='lg'>
              Try the live demo <ArrowRight className='h-4 w-4' />
            </ButtonLink>
            <ButtonLink href='/demo' variant='secondary' size='lg'>
              Book a demo
            </ButtonLink>
          </div>
          <p className='mt-3 text-xs text-muted'>The live demo runs on sample data. No sign-up needed.</p>
        </div>
        <div className='px-4 pb-20 sm:px-6'>
          <ProductPreview />
        </div>
      </section>

      {/* How it works */}
      <section id='how-it-works' className='scroll-mt-20 border-t border-border py-20'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <SectionHeading eyebrow='How it works' title='From question to dashboard in minutes' intro='No SQL, no data team ticket, no new warehouse.' />
          <ol className='mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            {steps.map((s, i) => (
              <li key={s.title} className='relative rounded-2xl border border-border bg-surface p-6'>
                <div className='flex items-center gap-3'>
                  <span className='grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand'>
                    <s.icon className='h-4 w-4' />
                  </span>
                  <span className='text-xs font-semibold text-muted'>Step {i + 1}</span>
                </div>
                <h3 className='mt-4 font-semibold'>{s.title}</h3>
                <p className='mt-2 text-sm text-muted'>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section id='features' className='scroll-mt-20 border-t border-border bg-surface py-20'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <SectionHeading eyebrow='Features' title='Everything your team needs to answer its own questions' />
          <div className='mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3'>
            {features.map((f) => (
              <div key={f.title}>
                <f.icon className='h-5 w-5 text-brand' />
                <h3 className='mt-3 font-semibold'>{f.title}</h3>
                <p className='mt-2 text-sm text-muted'>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id='security' className='scroll-mt-20 border-t border-border py-20'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <div className='grid items-start gap-12 lg:grid-cols-[1fr_1.4fr]'>
            <div>
              <p className='text-sm font-semibold text-brand'>Security</p>
              <h2 className='mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>Your data stays in your environment</h2>
              <p className='mt-4 text-lg text-muted text-pretty'>
                {SITE.name} is a private install, not a shared cloud service. You decide where it runs, what it can read and
                which AI model it uses.
              </p>
              <ButtonLink href='/demo?topic=security' variant='secondary' className='mt-6'>
                Talk to us about security
              </ButtonLink>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              {security.map((s) => (
                <div key={s.title} className='rounded-2xl border border-border bg-surface p-6'>
                  <s.icon className='h-5 w-5 text-good' />
                  <h3 className='mt-3 font-semibold'>{s.title}</h3>
                  <p className='mt-2 text-sm text-muted'>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id='faq' className='scroll-mt-20 border-t border-border bg-surface py-20'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <SectionHeading eyebrow='FAQ' title='Questions we often hear' />
          <div className='mt-12'>
            <Faq />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className='border-t border-border py-20'>
        <div className='mx-auto max-w-4xl px-4 text-center sm:px-6'>
          <h2 className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>See it on your own questions</h2>
          <p className='mx-auto mt-4 max-w-xl text-lg text-muted'>
            Try the demo on sample data now, or book 30 minutes and we will show it on data like yours.
          </p>
          <div className='mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row'>
            <ButtonLink href='/pricing' size='lg'>
              See pricing
            </ButtonLink>
            <ButtonLink href='/demo' variant='secondary' size='lg'>
              Book a demo
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
