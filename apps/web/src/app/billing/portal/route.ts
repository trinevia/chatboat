import { SITE, siteUrl } from '@/lib/marketing/site';
import { getStripe } from '@/lib/marketing/stripe';

const MAX_SESSION_AGE_S = 24 * 60 * 60;

/**
 * Opens the Stripe customer portal (invoices, card changes, cancelling).
 * With `session_id` (from the checkout success page) it opens the portal for that buyer directly;
 * otherwise it sends people to Stripe's portal login link, where they confirm their email.
 */
export async function POST(request: Request) {
  const base = siteUrl(request);
  const form = await request.formData();
  const sessionId = String(form.get('session_id') ?? '');
  const stripe = getStripe();

  if (stripe && sessionId.startsWith('cs_')) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const fresh = Date.now() / 1000 - session.created < MAX_SESSION_AGE_S;
      const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      if (fresh && customer && session.status === 'complete') {
        const portal = await stripe.billingPortal.sessions.create({ customer, return_url: `${base}/` });
        return Response.redirect(portal.url, 303);
      }
    } catch (err) {
      console.error('[portal]', err);
    }
  }
  if (SITE.portalLoginUrl) return Response.redirect(SITE.portalLoginUrl, 303);
  return Response.redirect(`${base}/demo?topic=billing`, 303);
}
