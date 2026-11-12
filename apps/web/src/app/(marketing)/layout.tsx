import type { Metadata } from 'next';
import { Footer, Header } from '@/components/marketing/site-chrome';
import { SITE } from '@/lib/marketing/site';

export const metadata: Metadata = {
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description:
    'Ask questions about sales, invoices, customers and inventory in plain English and get charts, dashboards and email digests back. Installed privately in your environment.',
};

/** Public pages (landing, pricing, book a demo): site header and footer instead of the app shell. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex min-h-dvh flex-col'>
      <Header />
      <main className='flex-1 pt-[76px]'>{children}</main>
      <Footer />
    </div>
  );
}
