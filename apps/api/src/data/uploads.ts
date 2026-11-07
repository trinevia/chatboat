import { sql as owner } from '@chatboat/db';
import { convert, toIdentifier, type ColumnType, type parseSpreadsheet } from './spreadsheet';

export { MAX_UPLOAD_BYTES, parseSpreadsheet } from './spreadsheet';

/** Spreadsheets become tables in the `uploads` schema, readable by the AI's read-only role. */
export interface UploadedTable {
  table: string;
  rows: number;
  columns: { name: string; type: ColumnType }[];
}

/** Replace uploads.<table> with the parsed rows. */
export async function storeTable(t: ReturnType<typeof parseSpreadsheet>[number]): Promise<UploadedTable> {
  const qualified = `uploads.${t.table}`;
  await owner.begin(async tx => {
    await tx`DROP TABLE IF EXISTS ${tx(qualified)}`;
    const cols = t.names.map((n, i) => `"${n}" ${t.types[i]}`).join(', ');
    await tx.unsafe(`CREATE TABLE uploads."${t.table}" (${cols})`);
    const records = t.rows.map(r => Object.fromEntries(t.original.map((h, i) => [t.names[i], convert(r[h], t.types[i])])));
    for (let i = 0; i < records.length; i += 1000) {
      await tx`INSERT INTO ${tx(qualified)} ${tx(records.slice(i, i + 1000) as Record<string, string>[], t.names)}`;
    }
  });
  await owner.unsafe(`ANALYZE uploads."${t.table}"`);
  return { table: t.table, rows: t.rows.length, columns: t.names.map((name, i) => ({ name, type: t.types[i] })) };
}

export async function dropUploadedTable(table: string) {
  await owner`DROP TABLE IF EXISTS ${owner(`uploads.${toIdentifier(table, 'upload')}`)}`;
}
