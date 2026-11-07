import { pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Our own customers (companies that bought Chatboat). Lives in the `control` schema. */
export const control = pgSchema('control');

export const customers = control.table('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  company: text('company').notNull(),
  email: text('email').notNull(),
  plan: text('plan').notNull(),
  /** month | year */
  billingInterval: text('billing_interval'),
  /** Stripe subscription status: active, trialing, past_due, canceled, unpaid, ... */
  status: text('status').notNull(),
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  installUrl: text('install_url'),
  licence: text('licence'),
  licenceIssuedAt: timestamp('licence_issued_at', { withTimezone: true }),
  licenceExpiresAt: timestamp('licence_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Stripe event ids we've processed, so retried deliveries are ignored. */
export const stripeEvents = control.table('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
