'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useState } from 'react';
import { BarChart3, LayoutDashboard, LogOut, Mail, Menu as MenuIcon, MessageSquarePlus, Settings, Shield, X } from 'lucide-react';
import { Brand } from '@/components/branding';
import { signOut, useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { ChatHistory } from '@/components/chat/chat-history';

function NavLink({ href, icon: Icon, children }: { href: string; icon: typeof BarChart3; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
        active ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-surface-2 hover:text-text'
      )}
    >
      <Icon className='h-4 w-4' />
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();

  const sidebar = (
    <div className='flex h-full flex-col gap-4 p-3'>
      <Link href='/' className='px-2 pt-1 text-base'>
        <Brand />
      </Link>
      {/* URL hooks (usePathname/useParams) must sit inside Suspense with Cache Components. */}
      <Suspense fallback={<div className='h-[190px]' />}>
        <nav className='space-y-0.5'>
          <NavLink href='/' icon={MessageSquarePlus}>New question</NavLink>
          <NavLink href='/dashboards' icon={LayoutDashboard}>Dashboards</NavLink>
          <NavLink href='/subscriptions' icon={Mail}>Subscriptions</NavLink>
          <NavLink href='/settings' icon={Settings}>Settings</NavLink>
          {session?.user.accessRole === 'admin' && (
            <NavLink href='/admin' icon={Shield}>Admin</NavLink>
          )}
        </nav>
      </Suspense>
      <Suspense fallback={<div className='flex-1' />}>
        <ChatHistory onNavigate={() => setMobileOpen(false)} />
      </Suspense>
      <div className='flex items-center justify-between gap-2 border-t border-border pt-3'>
        <div className='min-w-0'>
          <div className='truncate text-sm font-medium'>{session?.user.name ?? ' '}</div>
          <div className='truncate text-xs capitalize text-muted'>{session?.user.role ?? ''}</div>
        </div>
        <button
          aria-label='Sign out'
          className='rounded-md p-2 text-muted hover:bg-surface-2 hover:text-text cursor-pointer'
          onClick={async () => {
            await signOut();
            // Full reload so / serves the landing page now that the session cookie is gone.
            window.location.href = '/';
          }}
        >
          <LogOut className='h-4 w-4' />
        </button>
      </div>
    </div>
  );

  return (
    <div className='flex h-dvh'>
      <aside className='hidden w-64 shrink-0 border-r border-border bg-surface md:block'>{sidebar}</aside>

      {mobileOpen && (
        <div className='fixed inset-0 z-40 md:hidden'>
          <div className='absolute inset-0 bg-black/40' onClick={() => setMobileOpen(false)} />
          <aside className='absolute inset-y-0 left-0 w-72 bg-surface shadow-xl'>
            <button aria-label='Close menu' className='absolute right-2 top-2 p-2 text-muted' onClick={() => setMobileOpen(false)}>
              <X className='h-4 w-4' />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className='flex min-w-0 flex-1 flex-col'>
        <header className='flex h-12 items-center gap-2 border-b border-border bg-surface px-4 md:hidden'>
          <button aria-label='Open menu' onClick={() => setMobileOpen(true)} className='-ml-2 p-2'>
            <MenuIcon className='h-5 w-5' />
          </button>
          <Brand />
        </header>
        <main className='min-h-0 flex-1 overflow-y-auto'>{children}</main>
      </div>
    </div>
  );
}
