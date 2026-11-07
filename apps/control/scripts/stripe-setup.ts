// Creates (or finds) the Chatboat products and prices in Stripe TEST mode, keyed by lookup key.
// Safe to run more than once. Usage: pnpm --filter @chatboat/control stripe:setup
import { PLAN_IDS, PLAN_PRICES, PLANS, priceLookupKey, SETUP_FEE_CENTS, SETUP_FEE_LOOKUP_KEY } from '@chatboat/licence';
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith('sk_test_')) throw new Error('Set STRIPE_SECRET_KEY to a test key (sk_test_...)');
const stripe = new Stripe(key);

async function ensurePrice(lookupKey: string, create: () => Promise<Stripe.Price>) {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (existing.data[0]) return console.log(`exists  ${lookupKey} ${existing.data[0].id}`);
  const price = await create();
  console.log(`created ${lookupKey} ${price.id}`);
}

for (const plan of PLAN_IDS) {
  const products = await stripe.products.search({ query: `metadata['chatboat_plan']:'${plan}'` });
  const product =
    products.data[0] ??
    (await stripe.products.create({ name: `Chatboat ${PLANS[plan].name}`, metadata: { chatboat_plan: plan } }));
  for (const interval of ['month', 'year'] as const) {
    await ensurePrice(priceLookupKey(plan, interval), () =>
      stripe.prices.create({
        product: product.id,
        currency: 'usd',
        unit_amount: PLAN_PRICES[plan][interval],
        recurring: { interval },
        lookup_key: priceLookupKey(plan, interval),
        metadata: { plan },
      }),
    );
  }
}

await ensurePrice(SETUP_FEE_LOOKUP_KEY, async () => {
  const product = await stripe.products.create({ name: 'Chatboat hosted setup', metadata: { chatboat_setup: '1' } });
  return stripe.prices.create({ product: product.id, currency: 'usd', unit_amount: SETUP_FEE_CENTS, lookup_key: SETUP_FEE_LOOKUP_KEY });
});
console.log('Done. Enable the customer portal in the Stripe dashboard (Settings → Billing → Customer portal).');
