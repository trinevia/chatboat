'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  LayoutDashboard,
  Maximize2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { CHART_TYPE_LABELS, type ChartSpec, type ChartType } from '@chatboat/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Menu, MenuItem } from '@/components/ui/menu';
import { downloadCsv, downloadPdf, downloadPng, toTsv } from '@/lib/export';
import { cn } from '@/lib/utils';
import { ChartView, compatibleTypes } from './chart-view';
import { DataTable } from './data-table';
import { PinDialog } from './pin-dialog';

type Tab = 'chart' | 'data' | 'how';
const TAB_LABELS: Record<Tab, string> = { chart: 'Chart', data: 'Data', how: 'How it was calculated' };

function TypeSelect({ spec, value, onChange }: { spec: ChartSpec; value: ChartType; onChange: (t: ChartType) => void }) {
  return (
    <select
      aria-label='View as'
      value={value}
      onChange={e => onChange(e.target.value as ChartType)}
      className='h-8 rounded-lg border border-border bg-surface px-2 text-xs text-text'
    >
      {compatibleTypes(spec).map(t => (
        <option key={t} value={t}>
          {CHART_TYPE_LABELS[t]}
        </option>
      ))}
    </select>
  );
}

function HowCalculated({ spec }: { spec: ChartSpec }) {
  return (
    <div className='space-y-3 text-sm'>
      <p className='text-text'>
        {spec.explanation ??
          (spec.sql
            ? 'No explanation was saved for this answer. The exact query is below.'
            : 'No explanation was saved for this answer.')}
      </p>
      {spec.sql && (
        <details className='group'>
          <summary className='cursor-pointer text-xs font-medium text-muted hover:text-text'>Show SQL query</summary>
          <pre className='mt-2 overflow-auto rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-text'>{spec.sql}</pre>
        </details>
      )}
      <p className='text-xs text-muted'>{spec.rows.length} rows returned.</p>
    </div>
  );
}

export function ChartCard({
  spec,
  chatId,
  onRefresh,
  onRemove,
  refreshing,
  readOnly,
  extraActions,
}: {
  spec: ChartSpec;
  /** Public share view: no "Add to dashboard". */
  readOnly?: boolean;
  /** Extra items at the top of the ⋯ menu. */
  extraActions?: (close: () => void) => React.ReactNode;
  chatId?: string;
  onRefresh?: () => void;
  onRemove?: () => void;
  refreshing?: boolean;
}) {
  const [type, setType] = useState<ChartType>(spec.type);
  const [tab, setTab] = useState<Tab>('chart');
  const [pinOpen, setPinOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const current = { ...spec, type };

  // Image/PDF exports need the chart on screen, so switch to it first if needed.
  const withChart = async (fn: (node: HTMLElement) => Promise<void>, failMsg: string) => {
    if (tab !== 'chart') {
      setTab('chart');
      await new Promise(r => setTimeout(r, 350));
    }
    if (!chartRef.current) return;
    try {
      await fn(chartRef.current);
    } catch {
      toast.error(failMsg);
    }
  };

  const copyData = async () => {
    try {
      await navigator.clipboard.writeText(toTsv(spec));
      toast.success(`Copied ${spec.rows.length} rows. Paste into Excel or Google Sheets.`);
    } catch {
      toast.error('Could not copy to the clipboard.');
    }
  };

  const actions = (
    <Menu
      trigger={(_, toggle) => (
        <Button variant='ghost' size='icon' aria-label='Chart actions' onClick={toggle}>
          <MoreHorizontal className='h-4 w-4' />
        </Button>
      )}
    >
      {close => {
        const run = (fn: () => void) => () => {
          close();
          fn();
        };
        return (
          <>
            {extraActions?.(close)}
            {!onRemove && !readOnly && (
              <MenuItem onClick={run(() => setPinOpen(true))}>
                <LayoutDashboard className='h-4 w-4' /> Add to dashboard
              </MenuItem>
            )}
            <MenuItem onClick={run(() => setFullscreen(true))}>
              <Maximize2 className='h-4 w-4' /> Full screen
            </MenuItem>
            <MenuItem onClick={run(copyData)}>
              <ClipboardCopy className='h-4 w-4' /> Copy data
            </MenuItem>
            <div className='my-1 border-t border-border' />
            <MenuItem onClick={run(() => withChart(n => downloadPng(n, current), 'Could not export the image.'))}>
              <Download className='h-4 w-4' /> Download PNG
            </MenuItem>
            <MenuItem onClick={run(() => withChart(n => downloadPdf(n, current), 'Could not create the PDF.'))}>
              <FileText className='h-4 w-4' /> Download PDF
            </MenuItem>
            <MenuItem onClick={run(() => downloadCsv(spec))}>
              <FileSpreadsheet className='h-4 w-4' /> Download CSV
            </MenuItem>
            {onRemove && (
              <>
                <div className='my-1 border-t border-border' />
                <MenuItem className='text-danger' onClick={run(onRemove)}>
                  <Trash2 className='h-4 w-4' /> Remove from dashboard
                </MenuItem>
              </>
            )}
          </>
        );
      }}
    </Menu>
  );

  return (
    <div className='rounded-xl border border-border bg-surface p-4'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <h3 className='text-sm font-semibold text-text'>{spec.title}</h3>
        <div className='flex items-center gap-1'>
          {tab === 'chart' && <TypeSelect spec={spec} value={type} onChange={setType} />}
          {onRefresh && (
            <Button variant='ghost' size='icon' aria-label='Refresh data' onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          )}
          {actions}
        </div>
      </div>

      <div className='mt-2 flex flex-wrap gap-1 text-xs' role='tablist'>
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            role='tab'
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1',
              tab === t ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:text-text'
            )}
          >
            {t === 'how' && <Info className='h-3 w-3' />}
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div ref={chartRef} className='mt-3 bg-surface'>
        {tab === 'chart' && <ChartView spec={spec} type={type} />}
        {tab === 'data' && <DataTable spec={spec} />}
        {tab === 'how' && <HowCalculated spec={spec} />}
      </div>

      {spec.summary && tab !== 'how' && <p className='mt-3 text-sm text-muted'>{spec.summary}</p>}

      {!readOnly && <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} spec={current} chatId={chatId} />}
      <Dialog
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        title={spec.title}
        className='w-[min(1100px,calc(100vw-32px))]'
      >
        <div className='mb-3 flex justify-end'>
          <TypeSelect spec={spec} value={type} onChange={setType} />
        </div>
        <ChartView spec={spec} type={type} height={Math.min(560, typeof window === 'undefined' ? 480 : window.innerHeight - 220)} />
        {spec.summary && <p className='mt-3 text-sm text-muted'>{spec.summary}</p>}
        <div className='mt-4 flex justify-end'>
          <Button variant='secondary' onClick={() => setFullscreen(false)}>
            Close
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
