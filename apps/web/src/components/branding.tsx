'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Company name, logo and whether first-run setup is still needed. Public endpoint. */
export function useBranding() {
  return useQuery({ queryKey: ['setup-status'], queryFn: api.setupStatus, staleTime: 5 * 60_000 });
}

export function BrandMark({ logo, size = 'md' }: { logo?: string | null; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-8 w-8' : 'h-7 w-7';
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt='' className={cn(box, 'rounded-lg object-contain')} />;
  }
  return (
    <span className={cn(box, 'grid place-items-center rounded-lg bg-brand text-brand-fg')}>
      <BarChart3 className='h-4 w-4' />
    </span>
  );
}

export function Brand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { data } = useBranding();
  return (
    <span className='flex min-w-0 items-center gap-2 font-semibold'>
      <BrandMark logo={data?.logo} size={size} />
      <span className='truncate'>{data?.companyName ?? 'Chatboat'}</span>
    </span>
  );
}
