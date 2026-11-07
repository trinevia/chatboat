'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toWide, type ChartSpec, type ChartType } from '@chatboat/shared';
import { formatNumber, humanize } from '@/lib/utils';
import { DataTable } from './data-table';

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
const axis = { stroke: 'var(--text-muted)', fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: 12,
  },
  formatter: (v: unknown, name: unknown) => [formatNumber(v), humanize(String(name))] as [string, string],
};

/** Renders a ChartSpec as the requested chart type (used for "view as" too). */
export function ChartView({ spec, type = spec.type, height = 300 }: { spec: ChartSpec; type?: ChartType; height?: number }) {
  if (type === 'table' || !spec.rows.length) return <DataTable spec={spec} />;

  const { rows, yKeys } = toWide(spec);

  if (type === 'kpi') {
    const key = spec.yKeys[0];
    const value = spec.rows.length === 1 ? spec.rows[0][key] : spec.rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    return (
      <div className='py-6'>
        <div className='text-4xl font-semibold tracking-tight text-text'>{formatNumber(value)}</div>
        <div className='mt-1 text-sm text-muted'>{humanize(key)}</div>
      </div>
    );
  }

  if (type === 'pie') {
    const y = yKeys[0];
    return (
      <ResponsiveContainer width='100%' height={height}>
        <PieChart>
          <Pie data={rows} dataKey={y} nameKey={spec.xKey} innerRadius='55%' outerRadius='85%' paddingAngle={2} stroke='var(--surface)'>
            {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const legend = yKeys.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => humanize(String(v))} /> : null;
  const yAxis = <YAxis {...axis} width={56} tickFormatter={v => String(formatNumber(v, 'compact'))} />;
  const xAxis = <XAxis dataKey={spec.xKey} {...axis} minTickGap={16} />;
  const grid = <CartesianGrid vertical={false} stroke='var(--border)' />;

  if (type === 'line' || type === 'multi_line') {
    return (
      <ResponsiveContainer width='100%' height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {grid}
          {xAxis}
          {yAxis}
          <Tooltip {...tooltipStyle} />
          {legend}
          {yKeys.map((k, i) => (
            <Line key={k} type='monotone' dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // bar | stacked | grouped
  const stacked = type === 'stacked';
  return (
    <ResponsiveContainer width='100%' height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {grid}
        {xAxis}
        {yAxis}
        <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
        {legend}
        {yKeys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId={stacked ? 'a' : undefined}
            fill={COLORS[i % COLORS.length]}
            radius={stacked && i < yKeys.length - 1 ? 0 : [4, 4, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Which "view as" options make sense for this data. */
export function compatibleTypes(spec: ChartSpec): ChartType[] {
  const multi = spec.yKeys.length > 1 || !!spec.seriesKey;
  const base: ChartType[] = ['table', 'bar', 'line'];
  if (multi) base.push('stacked', 'grouped', 'multi_line');
  else base.push('pie');
  if (spec.rows.length === 1) base.push('kpi');
  return base;
}
