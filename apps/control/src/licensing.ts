import { isPlanId, signLicence, type PlanId } from '@chatboat/licence';
import type { KeyObject } from 'node:crypto';
import type { Customer } from './schema';
import type { Store } from './store';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Subscription statuses that still entitle the customer to a working licence. */
export const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

export interface LicensingConfig {
  privateKey: KeyObject;
  /** Extra days past the paid period, so a late renewal webhook or a slow refresh doesn't lock anyone out. */
  bufferDays: number;
  now?: () => Date;
}

/**
 * When a licence should expire for this customer:
 * - while entitled: end of the paid period plus the buffer
 * - once cancelled: when the subscription ended (the install then shows its grace period)
 */
export function licenceExpiry(customer: Pick<Customer, 'status' | 'currentPeriodEnd'>, cfg: LicensingConfig, endedAt?: Date | null): Date {
  const now = cfg.now?.() ?? new Date();
  if (!ENTITLED_STATUSES.has(customer.status)) return endedAt ?? customer.currentPeriodEnd ?? now;
  const periodEnd = customer.currentPeriodEnd ?? now;
  return new Date(periodEnd.getTime() + cfg.bufferDays * DAY_MS);
}

/** Signs a new licence for the customer's current plan and saves it. */
export async function issueLicence(store: Store, customer: Customer, cfg: LicensingConfig, expiresAt?: Date): Promise<Customer> {
  if (!isPlanId(customer.plan)) throw new Error(`Customer ${customer.id} has unknown plan ${customer.plan}`);
  const now = cfg.now?.() ?? new Date();
  const exp = expiresAt ?? licenceExpiry(customer, cfg);
  const licence = signLicence(
    { customerId: customer.id, company: customer.company, plan: customer.plan as PlanId, expiresAt: exp, issuedAt: now },
    cfg.privateKey,
  );
  return store.updateCustomer(customer.id, { licence, licenceIssuedAt: now, licenceExpiresAt: exp });
}
