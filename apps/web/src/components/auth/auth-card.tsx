'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { useSession } from '@/lib/auth-client';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session) router.replace('/');
  }, [session, router]);
  return (
    <div className='flex min-h-dvh items-center justify-center px-4 py-12'>
      <div className='w-full max-w-sm'>
        <div className='mb-6 flex items-center gap-2 font-semibold'>
          <span className='grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-fg'>
            <BarChart3 className='h-4 w-4' />
          </span>
          Chatboat
        </div>
        <h1 className='text-xl font-semibold'>{title}</h1>
        {subtitle && <p className='mt-1 text-sm text-muted'>{subtitle}</p>}
        <div className='mt-6'>{children}</div>
      </div>
    </div>
  );
}
