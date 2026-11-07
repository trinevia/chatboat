import Stripe from 'stripe';

let client: Stripe | null = null;

/** Lazily created so the site builds without Stripe keys. Test keys only unless ALLOW_LIVE_STRIPE=1. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_') && process.env.ALLOW_LIVE_STRIPE !== '1') {
    throw new Error('STRIPE_SECRET_KEY is not a test key. Set ALLOW_LIVE_STRIPE=1 when going live on purpose.');
  }
  client ??= new Stripe(key);
  return client;
}
