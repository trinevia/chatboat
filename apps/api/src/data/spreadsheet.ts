import * as XLSX from 'xlsx';

/** Parsing CSV/Excel into typed tables. Pure: no database access, so it's easy to test. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 200_000;
const MAX_COLUMNS = 100;

export type ColumnType = 'numeric' | 'date' | 'timestamp' | 'boolean' | 'text';

/** "Sales Report (Q4).xlsx" -> "sales_report_q4" — a safe Postgres identifier. */
export function toIdentifier(raw: string, fallback = 'col') {
  let id = raw
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  if (!id) id = fallback;
  if (/^[0-9]/.test(id)) id = `${fallback}_${id}`;
  return id;
}

function uniqueNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map(n => {
    const count = seen.get(n) ?? 0;
    seen.set(n, count + 1);
    return count ? `${n}_${count + 1}` : n;
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Spreadsheet dates arrive as JS Dates at local midnight. Read them by their
 * local calendar parts so "2025-03-13" never becomes "2025-03-12 18:30" in UTC.
 */
const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localDateTime = (d: Date) => `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const hasTime = (d: Date) => !!(d.getHours() || d.getMinutes() || d.getSeconds());
const ISO_TS = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;
const NUMBER = /^-?[\d,]*\.?\d+(e[+-]?\d+)?$/i;

/** Guess one column's type from its non-empty values. */
export function inferType(values: unknown[]): ColumnType {
  const present = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (!present.length) return 'text';
  if (present.every(v => typeof v === 'boolean' || /^(true|false)$/i.test(String(v)))) return 'boolean';
  if (present.every(v => typeof v === 'number' || (typeof v === 'string' && NUMBER.test(v.trim())))) return 'numeric';
  if (present.every(v => v instanceof Date || (typeof v === 'string' && ISO_DATE.test(v.trim())))) {
    return present.some(v => v instanceof Date && hasTime(v)) ? 'timestamp' : 'date';
  }
  if (present.every(v => v instanceof Date || (typeof v === 'string' && (ISO_DATE.test(v.trim()) || ISO_TS.test(v.trim()))))) {
    return 'timestamp';
  }
  return 'text';
}

export function convert(v: unknown, type: ColumnType): unknown {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  switch (type) {
    case 'numeric':
      return typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
    case 'boolean':
      return typeof v === 'boolean' ? v : /^true$/i.test(String(v));
    case 'date':
      return v instanceof Date ? localDate(v) : String(v).trim();
    case 'timestamp':
      return v instanceof Date ? localDateTime(v) : String(v).trim();
    default:
      return v instanceof Date ? localDate(v) : String(v);
  }
}

/** Parse a CSV/Excel file into one table per non-empty sheet. Throws a friendly Error. */
export function parseSpreadsheet(buffer: Buffer, fileName: string) {
  let wb: XLSX.WorkBook;
  try {
    // CSV: keep every value as written (types are inferred below). Excel: real dates.
    const isCsv = /\.(csv|tsv|txt)$/i.test(fileName);
    wb = XLSX.read(buffer, isCsv ? { type: 'buffer', raw: true, dense: true } : { type: 'buffer', cellDates: true, dense: true });
  } catch {
    throw new Error('Could not read that file. Upload a .csv, .xlsx or .xls file.');
  }
  const base = toIdentifier(fileName.replace(/\.[^.]+$/, ''), 'upload');
  const sheets = wb.SheetNames.map(name => ({
    name,
    rows: XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: null, raw: true }),
  })).filter(s => s.rows.length);
  if (!sheets.length) throw new Error('The file has no rows.');

  return sheets.map(s => {
    if (s.rows.length > MAX_ROWS) throw new Error(`"${s.name}" has more than ${MAX_ROWS.toLocaleString()} rows.`);
    const headers = Object.keys(s.rows[0]).concat(...s.rows.slice(1, 50).map(r => Object.keys(r)));
    const original = [...new Set(headers)];
    if (original.length > MAX_COLUMNS) throw new Error(`"${s.name}" has more than ${MAX_COLUMNS} columns.`);
    const names = uniqueNames(original.map(h => toIdentifier(h)));
    const sample = s.rows.slice(0, 5000);
    const types = original.map(h => inferType(sample.map(r => r[h])));
    const table = sheets.length === 1 ? base : toIdentifier(`${base}_${s.name}`, 'upload');
    return { table, original, names, types, rows: s.rows };
  });
}

