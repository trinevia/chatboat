/**
 * Plan limits shared by the control panel (when issuing licences), the marketing site
 * (when showing plans) and installs (when enforcing them). `null` means unlimited.
 */
export const PLAN_IDS = ['starter', 'business', 'enterprise'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface LicenceLimits {
  maxUsers: number | null;
  maxDataSources: number | null;
  questionsPerMonth: number | null;
}

export type Feature = 'digests' | 'sso' | 'private_ai' | 'priority_support';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  limits: LicenceLimits;
  features: Feature[];
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    limits: { maxUsers: 5, maxDataSources: 1, questionsPerMonth: 1_000 },
    features: [],
  },
  business: {
    id: 'business',
    name: 'Business',
    limits: { maxUsers: 25, maxDataSources: 5, questionsPerMonth: 10_000 },
    features: ['digests'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    limits: { maxUsers: null, maxDataSources: null, questionsPerMonth: null },
    features: ['digests', 'sso', 'private_ai', 'priority_support'],
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value);
}
