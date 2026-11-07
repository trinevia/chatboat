import type { Row } from '@chatboat/shared';

/** Every finite number in a result, ignoring column names and row order. */
export function numbersIn(rows: Row[]): number[] {
  return rows.flatMap(r => Object.values(r)).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

/** Counts (small integers) must match exactly; amounts may differ by rounding. */
const close = (a: number, b: number, tol: number) => {
  if (Number.isInteger(b) && Math.abs(b) < 100_000) return a === b;
  return Math.abs(a - b) <= Math.max(Math.abs(b) * tol, 0.01);
};

/**
 * Pass when every number in the reference answer appears in the model's result
 * (within a relative tolerance, so rounding to whole dollars is fine) and the
 * row count matches. Text columns like names are not compared: a wrong name
 * almost always comes with a wrong number.
 */
export function score(expected: Row[], actual: Row[] | null, opts: { tol?: number; allowExtraRows?: boolean } = {}) {
  const tol = opts.tol ?? 0.005;
  if (!actual) return { pass: false, reason: 'No query result' };
  const rowsOk = opts.allowExtraRows ? actual.length >= expected.length : actual.length === expected.length;
  if (!rowsOk) {
    return { pass: false, reason: `Expected ${expected.length} rows, got ${actual.length}` };
  }
  const pool = numbersIn(actual);
  const missing: number[] = [];
  for (const want of numbersIn(expected)) {
    const i = pool.findIndex(got => close(got, want, tol));
    if (i === -1) missing.push(want);
    else pool.splice(i, 1);
  }
  return missing.length
    ? { pass: false, reason: `Missing values: ${missing.slice(0, 3).map(n => Math.round(n * 100) / 100).join(', ')}${missing.length > 3 ? '…' : ''}` }
    : { pass: true, reason: 'Numbers match' };
}
