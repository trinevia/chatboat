/** Product name, domain and public links. Change here if the brand changes. */
export const SITE = {
  name: 'Chatboat',
  domain: 'chatboat.ai',
  tagline: 'Ask your business data anything',
  /** Read at build time. The sample-data install with a one-click demo login. */
  liveDemoUrl: process.env.LIVE_DEMO_URL || 'https://demo.chatboat.ai',
  /** Stripe's no-code customer portal login link (Settings → Billing → Customer portal). Optional. */
  portalLoginUrl: process.env.STRIPE_PORTAL_LOGIN_URL || null,
};

/** Absolute base URL of the site, used for Stripe redirect URLs. */
export function siteUrl(request: Request): string {
  return (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
}
