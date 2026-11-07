import { isPlanId, priceLookupKey, SETUP_FEE_LOOKUP_KEY } from '@chatboat/licence';
import type Stripe from 'stripe';
import { siteUrl } from '@/lib/site';
import { getStripe } from '@/lib/stripe';

/**
 * Starts a Stripe Checkout for a plan. Posted by the pricing page:
 * plan=starter|business|enterprise, interval=month|year, hosted=on (adds the one-time setup fee).
 * The control panel's webhook records the customer and issues the licence once payment succeeds.
 */
export async function POST(request: Request) {
  const base = siteUrl(request);
  const back = (error: string) => Response.redirect(`${base}/pricing?error=${encodeURIComponent(error)}#plans`, 303);

  const form = await request.formData();
  const plan = form.get('plan');
  const interval = form.get('interval') === 'year' ? 'year' : 'month';
  const hosted = form.get('hosted') === 'on';
  if (!isPlanId(plan)) return back('Unknown plan');

  const stripe = getStripe();
  if (!stripe) return back('Online checkout is not configured yet. Please book a demo and we will set you up.');

  try {
    const keys = [priceLookupKey(plan, interval), ...(hosted ? [SETUP_FEE_LOOKUP_KEY] : [])];
    const prices = await stripe.prices.list({ lookup_keys: keys, active: true });
    const byKey = new Map(prices.data.map((p) => [p.lookup_key, p.id]));
    const planPrice = byKey.get(priceLookupKey(plan, interval));
    if (!planPrice) return back('This plan is not available right now');

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: planPrice, quantity: 1 }];
    const setupPrice = byKey.get(SETUP_FEE_LOOKUP_KEY);
    if (hosted && setupPrice) lineItems.push({ price: setupPrice, quantity: 1 });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: lineItems,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      custom_fields: [{ key: 'company', label: { type: 'custom', custom: 'Company name' }, type: 'text' }],
      subscription_data: { metadata: { plan, hosted: hosted ? 'yes' : 'no' } },
      metadata: { plan, interval, hosted: hosted ? 'yes' : 'no' },
      success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing#plans`,
    });
    if (!session.url) return back('Could not start checkout');
    return Response.redirect(session.url, 303);
  } catch (err) {
    console.error('[checkout]', err);
    return back('Could not start checkout. Please try again.');
  }
}
