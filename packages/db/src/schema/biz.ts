import {
  date,
  integer,
  numeric,
  pgSchema,
  serial,
  text,
} from 'drizzle-orm/pg-core';

/** Demo business data the AI is allowed to query (read-only). */
export const biz = pgSchema('biz');

export const regions = biz.table('regions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // West, East, Central, South
  state: text('state').notNull(), // e.g. California
});

export const salesReps = biz.table('sales_reps', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  regionId: integer('region_id').notNull().references(() => regions.id),
});

export const customers = biz.table('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry').notNull(),
  segment: text('segment').notNull(), // SMB | Mid-Market | Enterprise
  regionId: integer('region_id').notNull().references(() => regions.id),
  city: text('city').notNull(),
  createdOn: date('created_on').notNull(),
});

export const products = biz.table('products', {
  id: serial('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
});

export const invoices = biz.table('invoices', {
  id: serial('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  salesRepId: integer('sales_rep_id').notNull().references(() => salesReps.id),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  status: text('status').notNull(), // paid | open | overdue | void
  totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull(),
});

export const invoiceItems = biz.table('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.id),
  productId: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  lineTotal: numeric('line_total', { precision: 14, scale: 2 }).notNull(),
});

export const payments = biz.table('payments', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.id),
  paidOn: date('paid_on').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  method: text('method').notNull(), // card | ach | wire | check
});

export const inventory = biz.table('inventory', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  warehouse: text('warehouse').notNull(),
  quantityOnHand: integer('quantity_on_hand').notNull(),
  reorderLevel: integer('reorder_level').notNull(),
});
