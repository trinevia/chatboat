'use client';

import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { Code2, Download, FileSpreadsheet, LayoutDashboard, MoreHorizontal, RefreshCw, Trash2 } from 'lucide-react';
import { CHART_TYPE_LABELS, type ChartSpec, type ChartType } from '@chatboat/shared';
import { Button } from '@/components/ui/button';
import { Menu, MenuItem } from '@/components/ui/menu';
import { ChartView, compatibleTypes } from './chart-view';
import { DataTable } from './data-table';
import { PinDialog } from './pin-dialog';
import { cn } from '@/lib/utils';

function toCsv(spec: ChartSpec) {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [spec.columns.join(','), ...spec.rows.map(r => spec.columns.map(c => esc(r[c])).join(','))].join('\n');
}

function download(name: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

const fileName = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart';

export function ChartCard({
  spec,
  chatId,
  onRefresh,
  onRemove,
  refreshing,
}: {
  spec: ChartSpec;
  chatId?: string;
  onRefresh?: () => void;
  onRemove?: () => void;
  refreshing?: boolean;
}) {
  const [type, setType] = useState<ChartType>(spec.type);
  const [tab, setTab] = useState<'chart' | 'data' | 'sql'>('chart');
  const [pinOpen, setPinOpen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const exportPng = async () => {
    if (!chartRef.current) return;
    try {
      const url = await toPng(chartRef.current, {
        backgroundColor: getComputedStyle(document.body).getPropertyValue('--surface') || '#fff',
        pixelRatio: 2,
      });
      download(`${fileName(spec.title)}.png`, url);
    } catch {
      toast.error('Could not export the chart image.');
    }
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(spec)], { type: 'text/csv' }));
    download(`${fileName(spec.title)}.csv`, url);
    URL.revokeObjectURL(url);
  };

  return (
    <div className='rounded-xl border border-border bg-surface p-4'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <h3 className='text-sm font-semibold text-text'>{spec.title}</h3>
        <div className='flex items-center gap-1'>
          {tab === 'chart' && (
            <select
              aria-label='View as'
              value={type}
              onChange={e => setType(e.target.value as ChartType)}
              className='h-8 rounded-lg border border-border bg-surface px-2 text-xs text-text'
            >
              {compatibleTypes(spec).map(t => (
                <option key={t} value={t}>{CHART_TYPE_LABELS[t]}</option>
              ))}
            </select>
          )}
          {onRefresh && (
            <Button variant='ghost' size='icon' aria-label='Refresh data' onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          )}
          <Menu
            trigger={(_, toggle) => (
              <Button variant='ghost' size='icon' aria-label='Chart actions' onClick={toggle}>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            )}
          >
            {close => (
              <>
                {!onRemove && (
                  <MenuItem onClick={() => { setPinOpen(true); close(); }}>
                    <LayoutDashboard className='h-4 w-4' /> Add to dashboard
                  </MenuItem>
                )}
                <MenuItem onClick={() => { exportPng(); close(); }}>
                  <Download className='h-4 w-4' /> Download PNG
                </MenuItem>
                <MenuItem onClick={() => { exportCsv(); close(); }}>
                  <FileSpreadsheet className='h-4 w-4' /> Download CSV
                </MenuItem>
                {onRemove && (
                  <MenuItem className='text-danger' onClick={() => { onRemove(); close(); }}>
                    <Trash2 className='h-4 w-4' /> Remove from dashboard
                  </MenuItem>
                )}
              </>
            )}
          </Menu>
        </div>
      </div>

      <div className='mt-2 flex gap-1 text-xs' role='tablist'>
        {(['chart', 'data', ...(spec.sql ? ['sql'] : [])] as const).map(t => (
          <button
            key={t}
            role='tab'
            aria-selected={tab === t}
            onClick={() => setTab(t as typeof tab)}
            className={cn(
              'rounded-md px-2 py-1 capitalize cursor-pointer',
              tab === t ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:text-text'
            )}
          >
            {t === 'sql' ? <span className='inline-flex items-center gap-1'><Code2 className='h-3 w-3' />SQL</span> : t}
          </button>
        ))}
      </div>

      <div ref={chartRef} className='mt-3 bg-surface'>
        {tab === 'chart' && <ChartView spec={spec} type={type} />}
        {tab === 'data' && <DataTable spec={spec} />}
        {tab === 'sql' && (
          <pre className='overflow-auto rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-text'>{spec.sql}</pre>
        )}
      </div>

      {spec.summary && <p className='mt-3 text-sm text-muted'>{spec.summary}</p>}

      <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} spec={{ ...spec, type }} chatId={chatId} />
    </div>
  );
}
