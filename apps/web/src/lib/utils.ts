import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function formatNumber(v: unknown, style: 'compact' | 'full' = 'full') {
  if (typeof v !== 'number') return v == null ? '—' : String(v);
  return style === 'compact' ? compact.format(v) : full.format(v);
}

/** Turn snake_case column names into labels: total_sales -> Total sales */
export function humanize(key: string) {
  const s = key.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
