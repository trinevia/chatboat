import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Footer, Header } from '@/components/site-chrome';
import { SITE } from '@/lib/site';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || `https://${SITE.domain}`),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description:
    'Ask questions about sales, invoices, customers and inventory in plain English and get charts, dashboards and email digests back. Installed privately in your environment.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint to avoid a flash (same key as the app). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className='flex min-h-dvh flex-col font-sans antialiased'>
        <Header />
        <main className='flex-1'>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
