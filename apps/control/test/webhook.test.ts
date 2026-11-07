import { generateLicenceKeyPair, loadPrivateKey, signLicence, verifyLicence } from '@chatboat/licence';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { MemoryStore, PgStore, type Store } from '../src/store';

/**
 * Drives the real Hono app with Stripe events signed the way Stripe signs them, but with the
 * Stripe API mocked (no network). Runs against an in-memory store, and also against Postgres
 * when CONTROL_TEST_DATABASE_URL is set.
 */
const WEBHOOK_SECRET = 'whsec_test_secret';
const keys = generateLicenceKeyPair();
const NOW = new Date('2026-11-07T12:00:00Z');
const PERIOD_END = Math.floor(new Date('2026-12-07T12:00:00Z').getTime() / 1000);
const DAY = 86_400_000;

function subscription(over: { id: string; customer: string; plan: string; interval?: 'month' | 'year'; status?: string; periodEnd?: number; endedAt?: number | null }) {
  return {
    id: over.id,
    object: 'subscription',
    customer: over.customer,
    status: over.status ?? 'active',
    ended_at: over.endedAt ?? null,
    items: {
      object: 'list',
      data: [
        {
          id: `si_${over.id}`,
          current_period_end: over.periodEnd ?? PERIOD_END,
          price: {
            id: `price_${over.plan}`,
            lookup_key: `chatboat_${over.plan}_${over.interval ?? 'month'}`,
            metadata: {},
            recurring: { interval: over.interval ?? 'month' },
          },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

function event(type: string, object: unknown, id = `evt_${randomUUID()}`) {
  return { id, object: 'event', type, data: { object }, created: Math.floor(NOW.getTime() / 1000) };
}

const stores: [string, () => Promise<{ store: Store; cleanup: () => Promise<void> }>][] = [
  ['memory', async () => ({ store: new MemoryStore(), cleanup: async () => {} })],
];
const pgUrl = process.env.CONTROL_TEST_DATABASE_URL;
if (pgUrl) {
  stores.push([
    'postgres',
    async () => {
      const { connect } = await import('../src/db');
      const { runMigrations } = await import('../src/migrate');
      const { sql, db } = connect(pgUrl);
      await runMigrations(db);
      return {
        store: new PgStore(db),
        cleanup: async () => {
          await sql`delete from control.customers where stripe_customer_id like 'cus_test_%'`;
          await sql`delete from control.stripe_events where id like 'evt_%'`;
          await sql.end();
        },
      };
    },
  ]);
}

describe.each(stores)('control app (%s store)', (_name, makeStore) => {
  let store: Store;
  let cleanup: () => Promise<void> = async () => {};
  let stripe: Stripe;
  let subs: Map<string, Stripe.Subscription>;
  let app: ReturnType<typeof createApp>;
  let cus: string;

  beforeEach(async () => {
    await cleanup();
    ({ store, cleanup } = await makeStore());
    stripe = new Stripe('sk_test_dummy');
    subs = new Map();
    stripe.subscriptions.retrieve = vi.fn(async (id: string) => {
      const s = subs.get(id);
      if (!s) throw new Error(`no such subscription ${id}`);
      return s;
    }) as never;
    stripe.billingPortal.sessions.create = vi.fn(async () => ({ url: 'https://billing.stripe.com/p/session/test' })) as never;
    app = createApp({
      store,
      stripe,
      webhookSecret: WEBHOOK_SECRET,
      licensing: { privateKey: loadPrivateKey(keys.privateKeyPem), bufferDays: 7, now: () => NOW },
      adminPassword: 'hunter2',
      publicUrl: 'http://localhost:4100',
    });
    cus = `cus_test_${randomUUID().slice(0, 8)}`;
  });
  afterAll(() => cleanup());

  async function post(evt: object, secret = WEBHOOK_SECRET) {
    const payload = JSON.stringify(evt);
    const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });
    return app.request('/stripe/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': header, 'content-type': 'application/json' } });
  }

  async function checkout(plan = 'starter') {
    const subId = `sub_${cus}`;
    subs.set(subId, subscription({ id: subId, customer: cus, plan }));
    const res = await post(
      event('checkout.session.completed', {
        id: `cs_${cus}`,
        object: 'checkout.session',
        mode: 'subscription',
        customer: cus,
        subscription: subId,
        customer_details: { email: 'ops@acme.test', name: 'Jo Smith', business_name: null },
        custom_fields: [{ key: 'company', text: { value: 'Acme Ltd' } }],
      }),
    );
    return { res, subId };
  }

  it('rejects unsigned and wrongly signed webhooks', async () => {
    const unsigned = await app.request('/stripe/webhook', { method: 'POST', body: '{}' });
    expect(unsigned.status).toBe(400);
    const bad = await post(event('checkout.session.completed', {}), 'whsec_wrong');
    expect(bad.status).toBe(400);
    expect(await store.listCustomers()).toHaveLength(0);
  });

  it('checkout.session.completed creates the customer and issues a licence', async () => {
    const { res, subId } = await checkout('starter');
    expect(res.status).toBe(200);
    const c = await store.findByStripeCustomer(cus);
    expect(c).toMatchObject({
      company: 'Acme Ltd',
      email: 'ops@acme.test',
      plan: 'starter',
      billingInterval: 'month',
      status: 'active',
      stripeSubscriptionId: subId,
    });
    const v = verifyLicence(c!.licence!, keys.publicKeyPem, { now: NOW });
    expect(v.status).toBe('valid');
    if (v.status !== 'valid') return;
    expect(v.licence).toMatchObject({ customerId: c!.id, company: 'Acme Ltd', plan: 'starter' });
    expect(v.licence.limits).toEqual({ maxUsers: 5, maxDataSources: 1, questionsPerMonth: 1000 });
    // period end + 7-day buffer
    expect(v.expiresAt.getTime()).toBe(PERIOD_END * 1000 + 7 * DAY);
  });

  it('ignores a replayed event', async () => {
    const evt = event('customer.subscription.updated', subscription({ id: `sub_${cus}`, customer: cus, plan: 'business' }));
    await checkout();
    const first = await (await post(evt)).json();
    const second = await (await post(evt)).json();
    expect(first).toEqual({ received: true });
    expect(second).toEqual({ received: true, duplicate: true });
  });

  it('customer.subscription.updated changes the plan and re-issues the licence', async () => {
    const { subId } = await checkout('starter');
    const before = (await store.findByStripeCustomer(cus))!;
    const newEnd = PERIOD_END + 365 * 86400;
    const res = await post(event('customer.subscription.updated', subscription({ id: subId, customer: cus, plan: 'business', interval: 'year', periodEnd: newEnd })));
    expect(res.status).toBe(200);
    const after = (await store.findByStripeCustomer(cus))!;
    expect(after).toMatchObject({ plan: 'business', billingInterval: 'year' });
    expect(after.licence).not.toBe(before.licence);
    const v = verifyLicence(after.licence!, keys.publicKeyPem, { now: NOW });
    expect(v.status === 'valid' && v.licence.limits.maxUsers).toBe(25);
    expect(v.status === 'valid' && v.licence.features).toContain('digests');
  });

  it('does not re-issue when nothing in the licence changed', async () => {
    const { subId } = await checkout('starter');
    const before = (await store.findByStripeCustomer(cus))!;
    await post(event('customer.subscription.updated', subscription({ id: subId, customer: cus, plan: 'starter' })));
    expect((await store.findByStripeCustomer(cus))!.licence).toBe(before.licence);
  });

  it('customer.subscription.deleted marks it canceled and expires the licence when it ended', async () => {
    const { subId } = await checkout('business');
    const endedAt = Math.floor(NOW.getTime() / 1000);
    await post(event('customer.subscription.deleted', subscription({ id: subId, customer: cus, plan: 'business', status: 'canceled', endedAt })));
    const c = (await store.findByStripeCustomer(cus))!;
    expect(c.status).toBe('canceled');
    const later = new Date(NOW.getTime() + 3 * DAY);
    const v = verifyLicence(c.licence!, keys.publicKeyPem, { now: later });
    expect(v.status).toBe('expired');
    expect(v.status === 'expired' && v.graceDaysLeft).toBe(11);
  });

  it('ignores subscription events for unknown customers', async () => {
    const res = await post(event('customer.subscription.updated', subscription({ id: 'sub_nope', customer: 'cus_test_unknown', plan: 'starter' })));
    expect(res.status).toBe(200);
    expect(await store.listCustomers()).toHaveLength(0);
  });

  it('returns 500 (so Stripe retries) when processing fails, and does not mark the event done', async () => {
    const evt = event('checkout.session.completed', { id: 'cs_x', mode: 'subscription', customer: cus, subscription: 'sub_missing', custom_fields: [] });
    const res = await post(evt);
    expect(res.status).toBe(500);
    expect(await store.hasProcessedEvent(evt.id)).toBe(false);
  });

  describe('GET /licence/:customerId/refresh', () => {
    it('returns the latest licence to an install holding an older one', async () => {
      const { subId } = await checkout('starter');
      const old = (await store.findByStripeCustomer(cus))!;
      await post(event('customer.subscription.updated', subscription({ id: subId, customer: cus, plan: 'business' })));
      const res = await app.request(`/licence/${old.id}/refresh`, { headers: { authorization: `Bearer ${old.licence}` } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ status: 'valid', plan: 'business', subscriptionStatus: 'active', changed: true });
      expect(body.licence).not.toBe(old.licence);
    });

    it('refuses requests without a licence, with a forged one, or for another customer', async () => {
      await checkout();
      const c = (await store.findByStripeCustomer(cus))!;
      expect((await app.request(`/licence/${c.id}/refresh`)).status).toBe(401);

      const forged = signLicence({ customerId: c.id, company: 'x', plan: 'enterprise', expiresAt: NOW }, generateLicenceKeyPair().privateKeyPem);
      expect((await app.request(`/licence/${c.id}/refresh`, { headers: { authorization: `Bearer ${forged}` } })).status).toBe(401);

      const otherId = randomUUID();
      expect((await app.request(`/licence/${otherId}/refresh`, { headers: { authorization: `Bearer ${c.licence}` } })).status).toBe(401);
    });
  });

  describe('admin', () => {
    const auth = { authorization: `Basic ${Buffer.from('admin:hunter2').toString('base64')}` };

    it('requires the admin password', async () => {
      expect((await app.request('/admin')).status).toBe(401);
      const wrong = { authorization: `Basic ${Buffer.from('admin:nope').toString('base64')}` };
      expect((await app.request('/admin', { headers: wrong })).status).toBe(401);
    });

    it('lists customers with a copy-licence button', async () => {
      await checkout();
      const c = (await store.findByStripeCustomer(cus))!;
      const res = await app.request('/admin', { headers: auth });
      expect(res.status).toBe(200);
      const page = await res.text();
      expect(page).toContain('Acme Ltd');
      expect(page).toContain('Starter');
      expect(page).toContain(`data-copy="${c.licence}"`);
    });

    it('saves the install URL and re-issues licences', async () => {
      await checkout();
      const c = (await store.findByStripeCustomer(cus))!;
      const form = (data: Record<string, string>) => ({
        method: 'POST',
        headers: { ...auth, origin: 'http://localhost', 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString(),
      });
      expect((await app.request(`http://localhost/admin/customers/${c.id}/install-url`, form({ installUrl: 'https://data.acme.test' }))).status).toBe(303);
      expect((await store.getCustomer(c.id))!.installUrl).toBe('https://data.acme.test');

      expect((await app.request(`http://localhost/admin/customers/${c.id}/reissue`, form({}))).status).toBe(303);
      expect((await store.getCustomer(c.id))!.licence).not.toBe(c.licence);
    });

    it('blocks cross-site form posts', async () => {
      await checkout();
      const c = (await store.findByStripeCustomer(cus))!;
      const res = await app.request(`http://localhost/admin/customers/${c.id}/reissue`, {
        method: 'POST',
        headers: { ...auth, origin: 'https://evil.test', 'content-type': 'application/x-www-form-urlencoded' },
        body: '',
      });
      expect(res.status).toBe(403);
    });
  });
});
