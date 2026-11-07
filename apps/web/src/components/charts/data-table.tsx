import type { ChartSpec } from '@chatboat/shared';
import { formatNumber, humanize } from '@/lib/utils';

export function DataTable({ spec, maxHeight = 320 }: { spec: ChartSpec; maxHeight?: number }) {
  if (!spec.rows.length) return <p className='py-6 text-sm text-muted'>The query returned no rows.</p>;
  return (
    <div className='overflow-auto rounded-lg border border-border' style={{ maxHeight }}>
      <table className='w-full text-sm'>
        <thead className='sticky top-0 bg-surface-2'>
          <tr>
            {spec.columns.map(c => (
              <th key={c} className='whitespace-nowrap px-3 py-2 text-left font-medium text-muted'>
                {humanize(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((r, i) => (
            <tr key={i} className='border-t border-border'>
              {spec.columns.map(c => (
                <td key={c} className={`whitespace-nowrap px-3 py-1.5 ${typeof r[c] === 'number' ? 'text-right tabular-nums' : ''}`}>
                  {formatNumber(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
