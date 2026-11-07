import { ChevronDown } from 'lucide-react';

export const FAQS: { q: string; a: string }[] = [
  {
    q: 'Where does our data live?',
    a: 'In your environment. Chatboat is installed on your own server or cloud account (or one we host just for you). Your database is never copied to us.',
  },
  {
    q: 'Can the AI change or delete our data?',
    a: 'No. Chatboat connects with a read-only database user, and every query is checked before it runs: anything other than a read is refused, and only the tables you allow can be queried.',
  },
  {
    q: 'What does the AI provider see?',
    a: 'The question, a description of the tables you allow, and the rows needed to write the answer. If that is too much for your policies, use a private model: Azure OpenAI or AWS Bedrock in your own account, or a self-hosted model.',
  },
  {
    q: 'Which data sources can we connect?',
    a: 'Postgres databases and CSV or Excel uploads today, with more databases on the way. Each plan includes a number of data sources; Enterprise is unlimited.',
  },
  {
    q: 'Does it work without internet access?',
    a: 'Yes. Your licence key is checked on your server with no call home. Installs that can reach us renew their key automatically; others paste the new key in the admin area.',
  },
  {
    q: 'What happens if we cancel?',
    a: 'You keep full access until the end of the paid period, then get a 14-day grace period. After that Chatboat becomes read-only. Your data is never deleted.',
  },
  {
    q: 'Can you host it for us?',
    a: 'Yes. Tick "Host it for us" at checkout for a one-time setup fee, and we run a private install for your company only.',
  },
];

export function Faq() {
  return (
    <div className='mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-surface'>
      {FAQS.map((f) => (
        <details key={f.q} className='group px-5 py-4'>
          <summary className='flex items-center justify-between gap-4 font-medium'>
            {f.q}
            <ChevronDown className='faq-chevron h-4 w-4 shrink-0 text-muted transition' />
          </summary>
          <p className='mt-3 text-muted text-pretty'>{f.a}</p>
        </details>
      ))}
    </div>
  );
}
