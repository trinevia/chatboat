import {
  ArrowRight,
  BarChart3,
  Cable,
  Cpu,
  Database,
  FileSpreadsheet,
  KeyRound,
  LayoutDashboard,
  LineChart,
  Link2,
  Lock,
  Mail,
  MessageSquareText,
  PieChart,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Table2,
} from 'lucide-react';
import Link from 'next/link';
import { Faq } from '@/components/faq';
import { ProductPreview } from '@/components/product-preview';
import { ButtonLink, cn, SectionHeading } from '@/components/ui';
import { SITE } from '@/lib/site';

const sources = ['PostgreSQL', 'CSV uploads', 'Excel uploads', 'Azure OpenAI', 'AWS Bedrock', 'Anthropic', 'OpenAI', 'Google Gemini', 'Ollama', 'Self-hosted models'];

const steps = [
  { icon: Cable, title: 'Connect your data', body: 'Point it at Postgres or upload CSV and Excel files. It reads the structure and learns your terms.' },
  { icon: MessageSquareText, title: 'Ask in plain English', body: '"Which customers owe us more than 60 days?" No SQL, no ticket for the data team.' },
  { icon: BarChart3, title: 'Get charts back', body: 'A short answer with the right chart, plus a plain-English note on how it was worked out.' },
  { icon: LayoutDashboard, title: 'Dashboards & digests', body: 'Pin answers to dashboards and have fresh numbers emailed every Monday morning.' },
];

const facts = [
  ['Read-only', 'database access, always'],
  ['0 rows', 'of your data copied to us'],
  ['5 s', 'timeout on every query'],
  ['14 days', 'grace if a licence lapses'],
];

function Aurora({ className }: { className?: string }) {
  return (
    <div className={cn('aurora', className)} aria-hidden>
      <span className='top-[-10%] left-[10%] h-[28rem] w-[28rem] bg-[var(--brand)]' />
      <span className='top-[5%] right-[5%] h-[24rem] w-[24rem] bg-[var(--chart-2)] [animation-delay:-6s]' />
      <span className='top-[30%] left-[40%] h-[20rem] w-[20rem] bg-[var(--chart-6)] [animation-delay:-12s]' />
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className='relative -mt-[76px] overflow-hidden pt-[76px]'>
        <Aurora />
        <div className='bg-grid absolute inset-0' aria-hidden />
        <div className='relative mx-auto max-w-6xl px-4 pt-16 text-center sm:px-6 sm:pt-24'>
          <Link
            href='/#security'
            className='glass mx-auto inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs font-medium text-muted transition hover:text-text'
          >
            <span className='rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-brand-fg'>New</span>
            <span className="sm:hidden">Private AI: Azure &amp; Bedrock</span>
            <span className="hidden sm:inline">Private AI with Azure OpenAI &amp; AWS Bedrock</span>
            <ArrowRight className='h-3 w-3' />
          </Link>
          <h1 className='mx-auto mt-7 max-w-4xl text-5xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-7xl'>
            Ask your business data anything. <span className='text-gradient'>Get charts back.</span>
          </h1>
          <p className='mx-auto mt-6 max-w-2xl text-lg text-muted text-pretty sm:text-xl'>
            Plain-English answers about sales, invoices, customers and inventory, turned into dashboards and email digests. Installed
            privately, so your data never leaves your environment.
          </p>
          <div className='mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row'>
            <ButtonLink href={SITE.liveDemoUrl} external size='lg'>
              Try the live demo <ArrowRight className='h-4 w-4' />
            </ButtonLink>
            <ButtonLink href='/demo' variant='secondary' size='lg'>
              Book a demo
            </ButtonLink>
          </div>
          <p className='mt-4 flex items-center justify-center gap-4 text-xs text-muted'>
            <span className='flex items-center gap-1.5'>
              <ShieldCheck className='h-3.5 w-3.5 text-good' /> Read-only access
            </span>
            <span className='flex items-center gap-1.5'>
              <ServerCog className='h-3.5 w-3.5 text-good' /> Runs in your cloud
            </span>
            <span className='hidden items-center gap-1.5 sm:flex'>
              <Sparkles className='h-3.5 w-3.5 text-good' /> No sign-up for the demo
            </span>
          </p>
        </div>
        <div className='relative px-4 pt-16 pb-24 sm:px-6'>
          <ProductPreview />
        </div>
      </section>

      {/* ───────── Works with ───────── */}
      <section className='border-y border-border bg-surface/50 py-8' aria-label='Works with'>
        <p className='text-center text-xs font-medium tracking-wide text-muted uppercase'>Works with your data and your AI provider</p>
        <div className='relative mt-5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]'>
          <div className='marquee flex w-max gap-3'>
            {[...sources, ...sources].map((s, k) => (
              <span key={k} className='rounded-full border border-border bg-surface px-4 py-1.5 text-sm whitespace-nowrap text-muted' aria-hidden={k >= sources.length}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section id='how-it-works' className='reveal scroll-mt-24 py-24 sm:py-32'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <SectionHeading eyebrow='How it works' title='From question to dashboard in minutes' intro='No SQL, no new warehouse, no waiting on the data team.' />
          <ol className='relative mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6'>
            <div className='absolute top-7 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block' aria-hidden />
            {steps.map((s, k) => (
              <li key={s.title} className='relative text-center'>
                <span className='glass relative mx-auto grid h-14 w-14 place-items-center rounded-2xl text-brand shadow-lg shadow-brand/10'>
                  <s.icon className='h-6 w-6' />
                  <span className='absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-[11px] font-semibold text-brand-fg'>{k + 1}</span>
                </span>
                <h3 className='mt-5 font-semibold'>{s.title}</h3>
                <p className='mx-auto mt-2 max-w-60 text-sm text-muted'>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────── Features (bento) ───────── */}
      <section id='features' className='reveal scroll-mt-24 pb-24 sm:pb-32'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <SectionHeading eyebrow='Features' title='Everything your team needs to answer its own questions' />
          <div className='mt-16 grid gap-4 md:grid-cols-6'>
            <Bento className='md:col-span-4' icon={BarChart3} title='The right chart, automatically' body='Lines for trends, bars for comparisons, tables for lists. Switch type in a click and download as PNG, PDF or CSV.'>
              <div className='mt-6 flex items-end gap-3'>
                <div className='flex h-28 flex-1 items-end gap-2 rounded-2xl border border-border bg-bg p-3'>
                  {[35, 52, 44, 68, 59, 80, 92].map((v, k) => (
                    <div key={k} className='flex-1 rounded-t-md' style={{ height: `${v}%`, background: k === 6 ? 'var(--chart-1)' : 'color-mix(in oklab, var(--chart-1) 35%, transparent)' }} />
                  ))}
                </div>
                <div className='flex flex-col gap-2'>
                  {[BarChart3, LineChart, PieChart, Table2].map((I, k) => (
                    <span key={k} className={cn('grid h-8 w-8 place-items-center rounded-lg border border-border', k === 0 ? 'bg-brand-soft text-brand' : 'bg-bg text-muted')}>
                      <I className='h-4 w-4' />
                    </span>
                  ))}
                </div>
              </div>
            </Bento>

            <Bento className='md:col-span-2' icon={Mail} title='Email digests' body='Any dashboard, in inboxes daily, weekly or monthly.'>
              <div className='mt-6 rounded-2xl border border-border bg-bg p-3 text-xs'>
                <p className='font-medium'>Monday sales digest</p>
                <p className='mt-0.5 text-muted'>Revenue $86.2k · ▲ 12% on last week</p>
                <svg viewBox='0 0 100 24' className='mt-2 h-8 w-full' preserveAspectRatio='none' aria-hidden>
                  <polyline points='0,20 15,17 30,18 45,12 60,13 75,7 100,3' fill='none' stroke='var(--chart-4)' strokeWidth='2' vectorEffect='non-scaling-stroke' />
                </svg>
              </div>
            </Bento>

            <Bento className='md:col-span-2' icon={Sparkles} title='Knows your business' body='Teach it your terms once; every answer uses them.'>
              <div className='mt-6 flex flex-wrap gap-2 text-xs'>
                {['Active customer = ordered in 90 days', 'Net revenue', 'Fiscal year starts April'].map((t) => (
                  <span key={t} className='rounded-full border border-border bg-bg px-3 py-1 text-muted'>
                    {t}
                  </span>
                ))}
              </div>
            </Bento>

            <Bento className='md:col-span-2' icon={LayoutDashboard} title='Dashboards that stay fresh' body='Saved answers re-run on live data, without the AI.'>
              <div className='mt-6 grid grid-cols-3 gap-2'>
                {['var(--chart-1)', 'var(--chart-2)', 'var(--chart-4)'].map((c, k) => (
                  <div key={k} className='rounded-xl border border-border bg-bg p-2'>
                    <div className='h-1.5 w-8 rounded-full bg-surface-2' />
                    <div className='mt-2 h-8 rounded-md' style={{ background: `linear-gradient(to top, color-mix(in oklab, ${c} 35%, transparent), transparent)` }} />
                  </div>
                ))}
              </div>
            </Bento>

            <Bento className='md:col-span-2' icon={Link2} title='Share by link' body='Read-only snapshots for people without an account. Revoke any time.'>
              <div className='mt-6 flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-2 text-xs text-muted'>
                <Link2 className='h-3.5 w-3.5 text-brand' />
                <span className='truncate'>data.yourcompany.com/s/x8f2…</span>
              </div>
            </Bento>

            <Bento className='md:col-span-6' icon={Database} title='Works with what you already have' body='Postgres databases and CSV or Excel uploads today, with more sources on the way. No warehouse or data project needed.'>
              <div className='mt-6 flex flex-wrap gap-2'>
                {[
                  [Database, 'PostgreSQL'],
                  [FileSpreadsheet, 'CSV'],
                  [FileSpreadsheet, 'Excel'],
                ].map(([I, t]) => {
                  const Icon = I as typeof Database;
                  return (
                    <span key={t as string} className='flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1.5 text-sm'>
                      <Icon className='h-4 w-4 text-brand' /> {t as string}
                    </span>
                  );
                })}
              </div>
            </Bento>
          </div>
        </div>
      </section>

      {/* ───────── Security ───────── */}
      <section id='security' className='reveal scroll-mt-24 px-3 sm:px-6'>
        <div className='relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-surface px-6 py-16 sm:px-12 sm:py-20'>
          <div className='bg-grid absolute inset-0 opacity-60' aria-hidden />
          <div className='relative grid items-center gap-12 lg:grid-cols-2'>
            <div>
              <p className='inline-flex rounded-full border border-border bg-bg px-3 py-1 text-xs font-medium text-good'>Security</p>
              <h2 className='mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-5xl'>Your data stays in your environment</h2>
              <p className='mt-4 text-lg text-muted text-pretty'>
                {SITE.name} is a private install, not a shared cloud service. You decide where it runs, what it can read and which AI
                model it uses.
              </p>
              <ul className='mt-8 space-y-4'>
                {[
                  [Lock, 'Read-only by design', 'A read-only database user, plus a check on every query: writes and unlisted tables are refused.'],
                  [Cpu, 'Private AI options', 'Your own Azure OpenAI or AWS Bedrock account, or a self-hosted model.'],
                  [KeyRound, 'Works offline', 'Your licence is checked on your server. No call home.'],
                ].map(([I, t, b]) => {
                  const Icon = I as typeof Lock;
                  return (
                    <li key={t as string} className='flex gap-3'>
                      <span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-good/10 text-good'>
                        <Icon className='h-4 w-4' />
                      </span>
                      <div>
                        <p className='font-medium'>{t as string}</p>
                        <p className='text-sm text-muted'>{b as string}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Diagram: everything runs inside the customer's environment */}
            <div className='relative rounded-3xl border-2 border-dashed border-good/40 bg-bg/60 p-6 sm:p-8'>
              <span className='absolute -top-3 left-6 rounded-full bg-good px-3 py-0.5 text-xs font-semibold text-white'>Your environment</span>
              <div className='flex flex-col items-center gap-3'>
                <Node icon={Database} title='Your database' sub='read-only user, allowed tables only' />
                <Arrow label='read-only query' />
                <Node icon={BarChart3} title={SITE.name} sub='on your server or cloud' highlight />
                <Arrow label='question + table descriptions' />
                <Node icon={Cpu} title='AI model' sub='your Azure / Bedrock account or self-hosted' />
              </div>
            </div>
          </div>

          <dl className='relative mt-16 grid grid-cols-2 gap-6 border-t border-border pt-10 lg:grid-cols-4'>
            {facts.map(([v, l]) => (
              <div key={v}>
                <dt className='text-3xl font-semibold tracking-tight text-gradient'>{v}</dt>
                <dd className='mt-1 text-sm text-muted'>{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id='faq' className='reveal scroll-mt-24 py-24 sm:py-32'>
        <div className='mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.7fr]'>
          <div>
            <p className='inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-brand'>FAQ</p>
            <h2 className='mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-5xl'>Questions we often hear</h2>
            <p className='mt-4 text-muted'>Can&apos;t find what you need?</p>
            <ButtonLink href='/demo' variant='secondary' className='mt-4'>
              Talk to us
            </ButtonLink>
          </div>
          <Faq />
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className='px-3 pb-24 sm:px-6'>
        <div className='relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-border px-6 py-20 text-center sm:py-24'>
          <Aurora className='opacity-80' />
          <div className='bg-grid absolute inset-0' aria-hidden />
          <div className='relative'>
            <h2 className='mx-auto max-w-2xl text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-6xl'>See it on your own questions</h2>
            <p className='mx-auto mt-5 max-w-xl text-lg text-muted'>Try the demo on sample data now, or book 30 minutes and we&apos;ll show it on data like yours.</p>
            <div className='mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row'>
              <ButtonLink href={SITE.liveDemoUrl} external size='lg'>
                Try the live demo <ArrowRight className='h-4 w-4' />
              </ButtonLink>
              <ButtonLink href='/pricing' variant='secondary' size='lg'>
                See pricing
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Bento({
  className,
  icon: Icon,
  title,
  body,
  children,
}: {
  className?: string;
  icon: typeof BarChart3;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('card-glow relative overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-7', className)}>
      <span className='grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand'>
        <Icon className='h-5 w-5' />
      </span>
      <h3 className='mt-4 text-lg font-semibold'>{title}</h3>
      <p className='mt-1.5 text-sm text-muted'>{body}</p>
      {children}
    </div>
  );
}

function Node({ icon: Icon, title, sub, highlight }: { icon: typeof BarChart3; title: string; sub: string; highlight?: boolean }) {
  return (
    <div className={cn('flex w-full max-w-xs items-center gap-3 rounded-2xl border bg-surface p-3', highlight ? 'border-brand shadow-lg shadow-brand/15' : 'border-border')}>
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', highlight ? 'bg-brand text-brand-fg' : 'bg-surface-2 text-muted')}>
        <Icon className='h-5 w-5' />
      </span>
      <div className='min-w-0'>
        <p className='text-sm font-medium'>{title}</p>
        <p className='truncate text-xs text-muted'>{sub}</p>
      </div>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className='flex flex-col items-center text-[11px] text-muted' aria-hidden>
      <span className='h-4 w-px bg-border' />
      <span className='rounded-full border border-border bg-surface px-2 py-0.5'>{label}</span>
      <span className='h-4 w-px bg-border' />
    </div>
  );
}
