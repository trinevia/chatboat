import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { SITE } from '@/lib/site';

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Same mark as the product (apps/web/src/components/branding.tsx). */
export function Brand() {
  return (
    <span className='flex items-center gap-2 font-semibold'>
      <span className='grid h-7 w-7 place-items-center rounded-lg bg-brand text-brand-fg'>
        <BarChart3 className='h-4 w-4' />
      </span>
      {SITE.name}
    </span>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-fg shadow-[0_8px_24px_-8px_var(--brand)] hover:opacity-90',
  secondary: 'glass text-text hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-text',
};
const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer disabled:opacity-50 disabled:pointer-events-none';
const sizes = { md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };

export function buttonClass(variant: Variant = 'primary', size: keyof typeof sizes = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  external,
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof sizes;
  className?: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} className={buttonClass(variant, size, className)} target='_blank' rel='noopener noreferrer'>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className='mx-auto max-w-2xl text-center'>
      <p className='inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-brand'>{eyebrow}</p>
      <h2 className='mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-5xl'>{title}</h2>
      {intro && <p className='mt-4 text-lg text-muted text-pretty'>{intro}</p>}
    </div>
  );
}
