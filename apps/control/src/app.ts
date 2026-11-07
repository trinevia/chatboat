import { verifyLicence } from '@chatboat/licence';
import { createPublicKey } from 'node:crypto';
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { csrf } from 'hono/csrf';
import type Stripe from 'stripe';
import { adminPage } from './admin-page';
import { issueLicence, type LicensingConfig } from './licensing';
import type { Store } from './store';
import { handleStripeEvent, type StripeLike } from './stripe-sync';

export interface AppDeps {
  store: Store;
  stripe: StripeLike & {
    webhooks: Pick<Stripe['webhooks'], 'constructEventAsync'>;
    billingPortal: { sessions: Pick<Stripe['billingPortal']['sessions'], 'create'> };
  };
  webhookSecret: string;
  licensing: LicensingConfig;
  /** Protects /admin. If unset, /admin is disabled. */
  adminPassword?: string;
  /** Public base URL of this service, used as the portal's return URL. */
  publicUrl: string;
  log?: (msg: string) => void;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const log = deps.log ?? (() => {});
  const publicKey = createPublicKey(deps.licensing.privateKey);

  app.get('/health', (c) => c.json({ ok: true }));

  // ---- Stripe webhook -------------------------------------------------------------------
  app.post('/stripe/webhook', async (c) => {
    const signature = c.req.header('stripe-signature');
    if (!signature) return c.json({ error: 'Missing Stripe-Signature header' }, 400);
    const body = await c.req.text(); // raw body: the signature covers the exact bytes

    let event: Stripe.Event;
    try {
      event = await deps.stripe.webhooks.constructEventAsync(body, signature, deps.webhookSecret);
    } catch (err) {
      log(`webhook signature rejected: ${(err as Error).message}`);
      return c.json({ error: 'Invalid signature' }, 400);
    }

    if (await deps.store.hasProcessedEvent(event.id)) return c.json({ received: true, duplicate: true });
    try {
      await handleStripeEvent({ store: deps.store, stripe: deps.stripe, licensing: deps.licensing, log }, event);
    } catch (err) {
      // 500 makes Stripe retry later.
      log(`webhook ${event.type} ${event.id} failed: ${(err as Error).stack ?? err}`);
      return c.json({ error: 'Processing failed' }, 500);
    }
    await deps.store.markEventProcessed(event.id, event.type);
    return c.json({ received: true });
  });

  // ---- Licence refresh for installs that can reach us -----------------------------------
  // The install proves who it is with the licence it already holds (any licence we signed for
  // this customer, even an expired one), so customer ids alone can't be used to fetch licences.
  app.get('/licence/:customerId/refresh', async (c) => {
    const customerId = c.req.param('customerId');
    const token = c.req.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return c.json({ error: 'Send your current licence as a Bearer token' }, 401);

    const current = verifyLicence(token, publicKey);
    if (current.status === 'invalid' || current.licence.customerId !== customerId) {
      return c.json({ error: 'Licence not recognised for this customer' }, 401);
    }
    const customer = await deps.store.getCustomer(customerId);
    if (!customer?.licence) return c.json({ error: 'Unknown customer' }, 404);

    const latest = verifyLicence(customer.licence, publicKey);
    if (latest.status === 'invalid') return c.json({ error: 'Stored licence is invalid; contact support' }, 500);
    return c.json({
      licence: customer.licence,
      status: latest.status,
      subscriptionStatus: customer.status,
      plan: latest.licence.plan,
      expiresAt: latest.expiresAt.toISOString(),
      changed: customer.licence !== token.trim(),
    });
  });

  // ---- Internal admin page -------------------------------------------------------------
  const admin = new Hono();
  admin.use('*', async (c, next) => {
    if (!deps.adminPassword) return c.text('Admin is disabled: set ADMIN_PASSWORD', 503);
    return basicAuth({ username: 'admin', password: deps.adminPassword, realm: 'Chatboat control' })(c, next);
  });
  // Basic auth credentials are sent automatically by the browser, so refuse cross-site form posts.
  admin.use('*', csrf());

  admin.get('/', async (c) => c.html(adminPage(await deps.store.listCustomers(), c.req.query('flash'))));

  admin.post('/customers/:id/install-url', async (c) => {
    const customer = await deps.store.getCustomer(c.req.param('id'));
    if (!customer) return c.notFound();
    const raw = String((await c.req.parseBody()).installUrl ?? '').trim();
    if (raw && !/^https?:\/\/[^\s]+$/i.test(raw)) return c.redirect('/admin?flash=Install+URL+must+start+with+http(s)://', 303);
    await deps.store.updateCustomer(customer.id, { installUrl: raw || null });
    return c.redirect('/admin?flash=Saved', 303);
  });

  admin.post('/customers/:id/reissue', async (c) => {
    const customer = await deps.store.getCustomer(c.req.param('id'));
    if (!customer) return c.notFound();
    await issueLicence(deps.store, customer, deps.licensing);
    return c.redirect(`/admin?flash=${encodeURIComponent(`New licence issued for ${customer.company}`)}`, 303);
  });

  admin.post('/customers/:id/portal', async (c) => {
    const customer = await deps.store.getCustomer(c.req.param('id'));
    if (!customer) return c.notFound();
    const session = await deps.stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${deps.publicUrl}/admin`,
    });
    return c.redirect(session.url, 303);
  });

  app.route('/admin', admin);
  app.get('/', (c) => c.redirect('/admin'));
  return app;
}
