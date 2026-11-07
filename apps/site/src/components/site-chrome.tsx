import Link from 'next/link';
import { SITE } from '@/lib/site';
import { ThemeToggle } from './theme-toggle';
import { Brand, ButtonLink } from './ui';

export function Header() {
  return (
    <header className='sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur'>
      <div className='mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6'>
        <Link href='/' aria-label={`${SITE.name} home`}>
          <Brand />
        </Link>
        <nav className='hidden items-center gap-1 text-sm md:flex'>
          {[
            ['/#how-it-works', 'How it works'],
            ['/#features', 'Features'],
            ['/#security', 'Security'],
            ['/pricing', 'Pricing'],
            ['/#faq', 'FAQ'],
          ].map(([href, label]) => (
            <Link key={href} href={href!} className='rounded-lg px-3 py-2 text-muted transition hover:text-text'>
              {label}
            </Link>
          ))}
        </nav>
        <div className='ml-auto flex items-center gap-2'>
          <ThemeToggle />
          <span className='hidden sm:block'>
            <ButtonLink href={SITE.liveDemoUrl} external variant='ghost'>
              Try the live demo
            </ButtonLink>
          </span>
          <ButtonLink href='/demo'>Book a demo</ButtonLink>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const year = 2026;
  return (
    <footer className='border-t border-border'>
      <div className='mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]'>
        <div>
          <Brand />
          <p className='mt-3 max-w-xs text-sm text-muted'>
            Ask questions about your business in plain English and get charts back. Installed privately, in your own
            environment.
          </p>
        </div>
        <FooterCol
          title='Product'
          links={[
            ['/#how-it-works', 'How it works'],
            ['/#features', 'Features'],
            ['/pricing', 'Pricing'],
            [SITE.liveDemoUrl, 'Live demo'],
          ]}
        />
        <FooterCol
          title='Company'
          links={[
            ['/#security', 'Security'],
            ['/demo', 'Book a demo'],
            ['/#faq', 'FAQ'],
          ]}
        />
        <div>
          <h3 className='text-sm font-semibold'>Customers</h3>
          <form action='/api/portal' method='post' className='mt-3'>
            <button className='text-sm text-muted transition hover:text-text cursor-pointer'>Manage subscription</button>
          </form>
        </div>
      </div>
      <div className='border-t border-border'>
        <p className='mx-auto max-w-6xl px-4 py-6 text-xs text-muted sm:px-6'>
          © {year} {SITE.name} · {SITE.domain}
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className='text-sm font-semibold'>{title}</h3>
      <ul className='mt-3 space-y-2 text-sm'>
        {links.map(([href, label]) => (
          <li key={label}>
            {href.startsWith('http') ? (
              <a href={href} className='text-muted transition hover:text-text' target='_blank' rel='noopener noreferrer'>
                {label}
              </a>
            ) : (
              <Link href={href} className='text-muted transition hover:text-text'>
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
