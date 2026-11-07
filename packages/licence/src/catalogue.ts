import type { PlanId } from './plans';

/**
 * List prices in US cents (placeholders until pricing is confirmed). Used by the site to show
 * prices and by `pnpm --filter @chatboat/control stripe:setup` to create matching Stripe prices.
 * Yearly is ten months' price (two months free).
 */
export const PLAN_PRICES: Record<PlanId, { month: number; year: number }> = {
  starter: { month: 149_00, year: 1_490_00 },
  business: { month: 499_00, year: 4_990_00 },
  enterprise: { month: 1_499_00, year: 14_990_00 },
};

/** One-time fee when we host and set up the install for the customer. */
export const SETUP_FEE_CENTS = 1_000_00;

export type BillingInterval = 'month' | 'year';

/** Stripe price lookup keys, so code never hard-codes price ids. */
export const priceLookupKey = (plan: PlanId, interval: BillingInterval) => `chatboat_${plan}_${interval}`;
export const SETUP_FEE_LOOKUP_KEY = 'chatboat_setup_fee';
