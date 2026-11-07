import { toWide, type ChartSpec } from '@chatboat/shared';

/** One headline number per chart: the sum of its plotted values (or the KPI value). */
export function chartTotal(spec: ChartSpec): number | null {
  const { rows, yKeys } = toWide(spec);
  const keys = spec.type === 'kpi' ? spec.yKeys.slice(0, 1) : yKeys;
  let total = 0;
  let seen = false;
  for (const r of spec.type === 'kpi' ? spec.rows : rows) {
    for (const k of keys) {
      const v = r[k];
      if (typeof v === 'number' && Number.isFinite(v)) {
        total += v;
        seen = true;
      }
    }
  }
  return seen ? total : null;
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

/** Plain-English change since the previous digest, or null if there's nothing to compare. */
export function describeChange(previous: number | null | undefined, current: number | null): string | null {
  if (current == null) return null;
  if (previous == null) return `Total: ${compact.format(current)} (first digest, nothing to compare yet).`;
  if (previous === current) return `No change since the last digest (${compact.format(current)}).`;
  if (previous === 0) return `Now ${compact.format(current)}, up from 0 since the last digest.`;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const dir = pct > 0 ? 'Up' : 'Down';
  return `${dir} ${Math.abs(pct).toFixed(1)}% since the last digest (${compact.format(previous)} → ${compact.format(current)}).`;
}
