import { describe, expect, it } from 'vitest';
import { guardSql, limitSql, UnsafeSqlError } from '../src/ai/sql-guard';
import { BIZ_SCHEMA_DOC, BIZ_TABLES } from '@chatboat/db/biz-schema-doc';

describe('guardSql', () => {
  it('allows a single SELECT over biz tables', () => {
    const sql = `SELECT r.state, SUM(i.total_amount) AS total
      FROM biz.invoices i JOIN biz.customers c ON c.id = i.customer_id
      JOIN biz.regions r ON r.id = c.region_id GROUP BY r.state;`;
    expect(guardSql(sql)).not.toMatch(/;$/);
  });

  it('allows CTEs', () => {
    expect(() =>
      guardSql(`WITH m AS (SELECT date_trunc('month', issue_date) AS month, total_amount FROM biz.invoices)
                SELECT month, SUM(total_amount) FROM m GROUP BY month`)
    ).not.toThrow();
  });

  it.each([
    ['DELETE FROM biz.invoices'],
    ['UPDATE biz.invoices SET status = \'paid\''],
    ['DROP TABLE biz.invoices'],
    ['INSERT INTO biz.regions (name, state) VALUES (\'x\', \'y\')'],
    ['SELECT 1; DELETE FROM biz.invoices'],
    ['SELECT * FROM app.user'],
    ['SELECT * FROM pg_catalog.pg_roles'],
    ['SELECT * FROM invoices'],
    [''],
  ])('rejects %s', sql => {
    expect(() => guardSql(sql)).toThrow(UnsafeSqlError);
  });

  it('wraps queries with a row limit', () => {
    expect(limitSql('SELECT 1')).toMatch(/LIMIT 1000$/);
  });
});

describe('schema doc', () => {
  it('mentions every biz table so the model knows about it', () => {
    for (const t of BIZ_TABLES) expect(BIZ_SCHEMA_DOC).toContain(`biz.${t}(`);
  });
});

describe('guardSql with a company allow-list', () => {
  const opts = { allowedTables: new Set(['public.orders', 'sales.customers']), defaultSchema: 'public' };

  it('allows listed tables, qualified or not (unqualified means the default schema)', () => {
    expect(() => guardSql('SELECT count(*) FROM orders', opts)).not.toThrow();
    expect(() => guardSql('SELECT * FROM public.orders o JOIN sales.customers c ON c.id = o.customer_id', opts)).not.toThrow();
  });

  it('rejects tables that are not on the list', () => {
    expect(() => guardSql('SELECT * FROM public.salaries', opts)).toThrow(UnsafeSqlError);
    expect(() => guardSql('SELECT * FROM customers', opts)).toThrow(UnsafeSqlError); // public.customers, not sales.customers
    expect(() => guardSql('SELECT * FROM pg_catalog.pg_user', opts)).toThrow(UnsafeSqlError);
  });

  it('still allows CTEs and still rejects writes', () => {
    expect(() => guardSql('WITH x AS (SELECT * FROM orders) SELECT * FROM x', opts)).not.toThrow();
    expect(() => guardSql('DELETE FROM orders', opts)).toThrow(UnsafeSqlError);
  });

  it('allows any table in an allowed schema for uploads', () => {
    const uploads = { allowedSchemas: ['uploads'], defaultSchema: 'uploads' };
    expect(() => guardSql('SELECT * FROM sales_2025', uploads)).not.toThrow();
    expect(() => guardSql('SELECT * FROM biz.invoices', uploads)).toThrow(UnsafeSqlError);
  });
});
