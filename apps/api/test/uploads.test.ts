import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { inferType, parseSpreadsheet, toIdentifier } from '../src/data/spreadsheet';

describe('spreadsheet uploads', () => {
  it('makes safe, readable identifiers', () => {
    expect(toIdentifier('Revenue (USD)')).toBe('revenue_usd');
    expect(toIdentifier('2025 Sales')).toBe('col_2025_sales');
    expect(toIdentifier('Café Größe')).toBe('cafe_grosse');
    expect(toIdentifier('***')).toBe('col');
  });

  it('infers column types', () => {
    expect(inferType([1, '2', '3.5', '1,200.50', null])).toBe('numeric');
    expect(inferType(['2025-01-02', '', '2025-12-31'])).toBe('date');
    expect(inferType(['2025-01-02 10:30', '2025-01-03'])).toBe('timestamp');
    expect(inferType(['true', 'FALSE', true])).toBe('boolean');
    expect(inferType(['Pune', 42])).toBe('text');
  });

  it('keeps CSV dates exactly as written (no timezone shift)', () => {
    const csv = Buffer.from('Store,Sale Date,Amount\nPune,2025-03-13,"1,286.68"\n');
    const [t] = parseSpreadsheet(csv, 'sales.csv');
    expect(t.table).toBe('sales');
    expect(t.names).toEqual(['store', 'sale_date', 'amount']);
    expect(t.types).toEqual(['text', 'date', 'numeric']);
    expect(t.rows[0]['Sale Date']).toBe('2025-03-13');
  });

  it('reads Excel dates by their calendar day', () => {
    const ws = XLSX.utils.aoa_to_sheet([['Day', 'Units'], [new Date(2025, 2, 13), 4]], { cellDates: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const [t] = parseSpreadsheet(buf, 'units.xlsx');
    expect(t.types).toEqual(['date', 'numeric']);
    const d = t.rows[0].Day as Date;
    expect(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`).toBe('2025-3-13');
  });
});
