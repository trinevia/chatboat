import { describe, expect, it } from 'vitest';
import { score } from '../evals/score';

describe('eval scoring', () => {
  const expected = [
    { region: 'West', total: 1234.56 },
    { region: 'East', total: 99 },
  ];
  it('ignores column names, row order and small rounding', () => {
    expect(score(expected, [{ r: 'East', sales: 99 }, { r: 'West', sales: 1235 }]).pass).toBe(true);
  });
  it('fails on wrong numbers or row counts', () => {
    expect(score(expected, [{ r: 'East', sales: 99 }, { r: 'West', sales: 1500 }]).pass).toBe(false);
    expect(score(expected, [{ r: 'West', sales: 1234.56 }]).pass).toBe(false);
    expect(score(expected, null).pass).toBe(false);
  });
  it('requires exact counts', () => {
    expect(score([{ n: 565 }], [{ count: 564 }]).pass).toBe(false);
  });
});
