'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { Brand, useBranding } from '@/components/branding';

/** Signed-in people go to the app; on a brand-new install everyone goes to the setup wizard. */
function AuthRedirects() {
  const { data: session } = useSession();
  const { data: status } = useBranding();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (session) router.replace('/');
    else if (status?.needsSetup && pathname !== '/setup') router.replace('/setup');
  }, [session, status?.needsSetup, pathname, router]);
  return null;
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className='flex min-h-dvh items-center justify-center px-4 py-12'>
      {/* URL hooks must sit inside Suspense with Cache Components. */}
      <Suspense>
        <AuthRedirects />
      </Suspense>
      <div className='w-full max-w-sm'>
        <div className='mb-6'>
          <Brand size='lg' />
        </div>
        <h1 className='text-xl font-semibold'>{title}</h1>
        {subtitle && <p className='mt-1 text-sm text-muted'>{subtitle}</p>}
        <div className='mt-6'>{children}</div>
      </div>
    </div>
  );
}
