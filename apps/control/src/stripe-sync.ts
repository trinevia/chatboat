import { isPlanId, type PlanId } from '@chatboat/licence';
import type Stripe from 'stripe';
import { ENTITLED_STATUSES, issueLicence, licenceExpiry, type LicensingConfig } from './licensing';
import type { Customer } from './schema';
import type { Store } from './store';

/** The slice of the Stripe client we use, so tests can pass a fake. */
export interface StripeLike {
  subscriptions: { retrieve(id: string, params?: Stripe.SubscriptionRetrieveParams): Promise<Stripe.Subscription> };
}

export interface SyncDeps {
  store: Store;
  stripe: StripeLike;
  licensing: LicensingConfig;
  log?: (msg: string) => void;
}

/**
 * Works out the plan from a price. Prices created by `pnpm stripe:setup` carry `metadata.plan`
 * and a lookup key like `chatboat_business_year`; either is enough.
 */
export function planFromPrice(price: Stripe.Price): PlanId | null {
  if (isPlanId(price.metadata?.plan)) return price.metadata.plan;
  const fromKey = price.lookup_key?.match(/^chatboat_([a-z]+)_(month|year)$/)?.[1];
  return isPlanId(fromKey) ? fromKey : null;
}

interface SubscriptionInfo {
  plan: PlanId;
  billingInterval: string | null;
  status: string;
  currentPeriodEnd: Date | null;
  endedAt: Date | null;
}

function describeSubscription(sub: Stripe.Subscription): SubscriptionInfo | null {
  for (const item of sub.items.data) {
    const plan = planFromPrice(item.price);
    if (!plan) continue;
    return {
      plan,
      billingInterval: item.price.recurring?.interval ?? null,
      status: sub.status,
      currentPeriodEnd: item.current_period_end ? new Date(item.current_period_end * 1000) : null,
      endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : null,
    };
  }
  return null;
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : (v?.id ?? null));

function companyFromSession(session: Stripe.Checkout.Session): string {
  const field = session.custom_fields?.find((f) => f.key === 'company');
  return (
    field?.text?.value?.trim() ||
    session.customer_details?.business_name?.trim() ||
    session.customer_details?.name?.trim() ||
    session.customer_details?.email ||
    'Unknown company'
  );
}

/** Re-issues the licence when anything it encodes has changed. */
async function refreshLicenceIfNeeded(deps: SyncDeps, before: Customer | null, after: Customer, endedAt: Date | null) {
  const exp = licenceExpiry(after, deps.licensing, endedAt);
  const changed =
    !after.licence ||
    before?.plan !== after.plan ||
    before?.company !== after.company ||
    after.licenceExpiresAt?.getTime() !== exp.getTime();
  if (!changed) return after;
  // Don't issue a first licence for a subscription that never became active (e.g. incomplete).
  if (!after.licence && !ENTITLED_STATUSES.has(after.status)) return after;
  return issueLicence(deps.store, after, deps.licensing, exp);
}

export async function handleCheckoutCompleted(deps: SyncDeps, session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return;
  const stripeCustomerId = idOf(session.customer);
  const subscriptionId = idOf(session.subscription);
  if (!stripeCustomerId || !subscriptionId) throw new Error(`Checkout ${session.id} has no customer or subscription`);

  // Fetch the subscription rather than trusting event order: it's the current truth.
  const sub = await deps.stripe.subscriptions.retrieve(subscriptionId);
  const info = describeSubscription(sub);
  if (!info) throw new Error(`Subscription ${subscriptionId} has no Chatboat plan price`);

  const before = await deps.store.findByStripeCustomer(stripeCustomerId);
  const after = await deps.store.upsertByStripeCustomer({
    company: companyFromSession(session),
    email: session.customer_details?.email ?? before?.email ?? '',
    plan: info.plan,
    billingInterval: info.billingInterval,
    status: info.status,
    stripeCustomerId,
    stripeSubscriptionId: subscriptionId,
    currentPeriodEnd: info.currentPeriodEnd,
  });
  await refreshLicenceIfNeeded(deps, before, after, info.endedAt);
  deps.log?.(`checkout completed: ${after.company} (${info.plan}, ${info.status})`);
}

export async function handleSubscriptionChanged(deps: SyncDeps, sub: Stripe.Subscription) {
  const before =
    (await deps.store.findByStripeSubscription(sub.id)) ?? (await deps.store.findByStripeCustomer(idOf(sub.customer) ?? ''));
  if (!before) {
    // Usually means checkout.session.completed hasn't arrived yet; it fetches the latest state itself.
    deps.log?.(`subscription ${sub.id} for an unknown customer; ignored`);
    return;
  }
  const info = describeSubscription(sub);
  const after = await deps.store.updateCustomer(before.id, {
    plan: info?.plan ?? before.plan,
    billingInterval: info?.billingInterval ?? before.billingInterval,
    status: sub.status,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: info?.currentPeriodEnd ?? before.currentPeriodEnd,
  });
  await refreshLicenceIfNeeded(deps, before, after, info?.endedAt ?? null);
  deps.log?.(`subscription ${sub.status}: ${after.company} (${after.plan})`);
}

/** Dispatches a verified Stripe event. Unknown types are ignored. */
export async function handleStripeEvent(deps: SyncDeps, event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(deps, event.data.object);
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return handleSubscriptionChanged(deps, event.data.object);
    default:
      return;
  }
}
