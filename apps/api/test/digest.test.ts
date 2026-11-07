import { describe, expect, it } from 'vitest';
import type { ChartSpec } from '@chatboat/shared';
import { renderChartPng } from '../src/digest/chart-image';
import { cronFor, describeSchedule, isValidTimezone, nextRunAt } from '../src/digest/schedule';
import { chartTotal, describeChange } from '../src/digest/totals';

const base = { hour: 9, minute: 0, dayOfWeek: null, dayOfMonth: null, timezone: 'UTC' };

describe('schedule', () => {
  it('builds cron expressions', () => {
    expect(cronFor({ ...base, frequency: 'daily' })).toBe('0 9 * * *');
    expect(cronFor({ ...base, frequency: 'weekly', dayOfWeek: 1 })).toBe('0 9 * * 1');
    expect(cronFor({ ...base, frequency: 'monthly', dayOfMonth: 15 })).toBe('0 9 15 * *');
  });

  it('respects the timezone (Monday 09:00 in Kolkata is 03:30 UTC)', () => {
    const from = new Date('2026-11-07T10:00:00Z'); // a Saturday
    const next = nextRunAt({ ...base, frequency: 'weekly', dayOfWeek: 1, timezone: 'Asia/Kolkata' }, from);
    expect(next.toISOString()).toBe('2026-11-09T03:30:00.000Z');
  });

  it('handles daylight saving time (New York 09:00 is 13:00 UTC in summer, 14:00 in winter)', () => {
    const tz = 'America/New_York';
    expect(nextRunAt({ ...base, frequency: 'daily', timezone: tz }, new Date('2026-07-01T00:00:00Z')).toISOString()).toBe(
      '2026-07-01T13:00:00.000Z'
    );
    expect(nextRunAt({ ...base, frequency: 'daily', timezone: tz }, new Date('2026-12-01T00:00:00Z')).toISOString()).toBe(
      '2026-12-01T14:00:00.000Z'
    );
  });

  it('describes schedules and validates timezones', () => {
    expect(describeSchedule({ ...base, frequency: 'weekly', dayOfWeek: 1 })).toBe('Every Monday at 09:00 (UTC)');
    expect(isValidTimezone('Asia/Kolkata')).toBe(true);
    expect(isValidTimezone('Mars/Base')).toBe(false);
  });
});

const spec = (over: Partial<ChartSpec>): ChartSpec => ({
  type: 'bar',
  title: 'T',
  xKey: 'month',
  yKeys: ['total'],
  columns: ['month', 'total'],
  rows: [
    { month: '2026-01', total: 100 },
    { month: '2026-02', total: 50 },
  ],
  ...over,
});

describe('totals', () => {
  it('sums plotted values, including long-format series', () => {
    expect(chartTotal(spec({}))).toBe(150);
    expect(
      chartTotal(
        spec({
          seriesKey: 'region',
          columns: ['month', 'region', 'total'],
          rows: [
            { month: 'a', region: 'West', total: 1 },
            { month: 'a', region: 'East', total: 2 },
          ],
        })
      )
    ).toBe(3);
  });

  it('describes the change since the last digest', () => {
    expect(describeChange(undefined, 150)).toMatch(/first digest/);
    expect(describeChange(100, 150)).toMatch(/^Up 50\.0%/);
    expect(describeChange(200, 150)).toMatch(/^Down 25\.0%/);
    expect(describeChange(150, 150)).toMatch(/No change/);
    expect(describeChange(100, null)).toBeNull();
  });
});

describe('chart images', () => {
  it.each(['bar', 'line', 'pie', 'stacked'] as const)('renders a %s chart to PNG', type => {
    const png = renderChartPng(spec({ type }));
    expect(png?.subarray(1, 4).toString()).toBe('PNG');
  });

  it('returns null for tables (they are sent as HTML tables)', () => {
    expect(renderChartPng(spec({ type: 'table' }))).toBeNull();
  });
});
