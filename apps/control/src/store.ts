import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import type { ControlDB } from './db';
import { customers, stripeEvents, type Customer, type NewCustomer } from './schema';

export type CustomerPatch = Partial<Omit<Customer, 'id' | 'createdAt'>>;

/** Persistence used by the app. Postgres in production, in memory for tests. */
export interface Store {
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  findByStripeCustomer(stripeCustomerId: string): Promise<Customer | null>;
  findByStripeSubscription(stripeSubscriptionId: string): Promise<Customer | null>;
  /** Inserts, or updates the row with the same Stripe customer id. */
  upsertByStripeCustomer(data: Omit<NewCustomer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer>;
  updateCustomer(id: string, patch: CustomerPatch): Promise<Customer>;
  hasProcessedEvent(id: string): Promise<boolean>;
  markEventProcessed(id: string, type: string): Promise<void>;
}

export class PgStore implements Store {
  constructor(private db: ControlDB) {}

  listCustomers() {
    return this.db.select().from(customers).orderBy(desc(customers.createdAt));
  }
  async getCustomer(id: string) {
    // Ids are uuids; anything else can't match and would make Postgres throw.
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [row] = await this.db.select().from(customers).where(eq(customers.id, id));
    return row ?? null;
  }
  async findByStripeCustomer(stripeCustomerId: string) {
    const [row] = await this.db.select().from(customers).where(eq(customers.stripeCustomerId, stripeCustomerId));
    return row ?? null;
  }
  async findByStripeSubscription(stripeSubscriptionId: string) {
    const [row] = await this.db.select().from(customers).where(eq(customers.stripeSubscriptionId, stripeSubscriptionId));
    return row ?? null;
  }
  async upsertByStripeCustomer(data: Omit<NewCustomer, 'id' | 'createdAt' | 'updatedAt'>) {
    const [row] = await this.db
      .insert(customers)
      .values(data)
      .onConflictDoUpdate({ target: customers.stripeCustomerId, set: { ...data, updatedAt: new Date() } })
      .returning();
    return row!;
  }
  async updateCustomer(id: string, patch: CustomerPatch) {
    const [row] = await this.db
      .update(customers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    if (!row) throw new Error(`Customer ${id} not found`);
    return row;
  }
  async hasProcessedEvent(id: string) {
    const [row] = await this.db.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.id, id));
    return !!row;
  }
  async markEventProcessed(id: string, type: string) {
    await this.db.insert(stripeEvents).values({ id, type }).onConflictDoNothing();
  }
}

export class MemoryStore implements Store {
  customers = new Map<string, Customer>();
  events = new Set<string>();

  async listCustomers() {
    return [...this.customers.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async getCustomer(id: string) {
    return this.customers.get(id) ?? null;
  }
  async findByStripeCustomer(id: string) {
    return [...this.customers.values()].find((c) => c.stripeCustomerId === id) ?? null;
  }
  async findByStripeSubscription(id: string) {
    return [...this.customers.values()].find((c) => c.stripeSubscriptionId === id) ?? null;
  }
  async upsertByStripeCustomer(data: Omit<NewCustomer, 'id' | 'createdAt' | 'updatedAt'>) {
    const existing = await this.findByStripeCustomer(data.stripeCustomerId);
    const now = new Date();
    const row: Customer = {
      id: existing?.id ?? randomUUID(),
      createdAt: existing?.createdAt ?? now,
      billingInterval: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      installUrl: null,
      licence: null,
      licenceIssuedAt: null,
      licenceExpiresAt: null,
      ...existing,
      ...stripUndefined(data),
      updatedAt: now,
    } as Customer;
    this.customers.set(row.id, row);
    return row;
  }
  async updateCustomer(id: string, patch: CustomerPatch) {
    const existing = this.customers.get(id);
    if (!existing) throw new Error(`Customer ${id} not found`);
    const row = { ...existing, ...stripUndefined(patch), updatedAt: new Date() };
    this.customers.set(id, row);
    return row;
  }
  async hasProcessedEvent(id: string) {
    return this.events.has(id);
  }
  async markEventProcessed(id: string) {
    this.events.add(id);
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
