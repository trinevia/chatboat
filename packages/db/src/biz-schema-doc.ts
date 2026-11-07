/**
 * Plain-text description of the `biz` schema that goes into the AI system prompt.
 * Keep in sync with schema/biz.ts (a test checks every table is mentioned).
 */
export const BIZ_SCHEMA_DOC = `
PostgreSQL schema "biz" (always qualify tables as biz.<table>):

biz.regions(id, name, state)                -- name: West|East|Central|South; state: US state name e.g. 'California'
biz.sales_reps(id, name, email, region_id -> regions.id)
biz.customers(id, name, industry, segment, region_id -> regions.id, city, created_on date)
                                            -- segment: SMB|Mid-Market|Enterprise
biz.products(id, sku, name, category, unit_price numeric, unit_cost numeric)
biz.invoices(id, invoice_number, customer_id -> customers.id, sales_rep_id -> sales_reps.id,
             issue_date date, due_date date, status, total_amount numeric)
                                            -- status: paid|open|overdue|void. "Sales"/"revenue" = SUM(total_amount) of non-void invoices.
biz.invoice_items(id, invoice_id -> invoices.id, product_id -> products.id, quantity, unit_price, line_total)
biz.payments(id, invoice_id -> invoices.id, paid_on date, amount, method)   -- method: card|ach|wire|check
biz.inventory(id, product_id -> products.id, warehouse, quantity_on_hand, reorder_level)
`.trim();

export const BIZ_TABLES = [
  'regions',
  'sales_reps',
  'customers',
  'products',
  'invoices',
  'invoice_items',
  'payments',
  'inventory',
] as const;
