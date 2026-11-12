import { PLAN_PRICES, PLANS, SETUP_FEE_CENTS, type PlanId } from '@chatboat/licence';

export interface PlanCard {
  id: PlanId;
  name: string;
  forWho: string;
  monthly: number;
  yearly: number;
  highlights: string[];
  featured?: boolean;
}

const n = (v: number | null) => (v === null ? 'Unlimited' : v.toLocaleString('en-US'));
const lim = (id: PlanId) => PLANS[id].limits;

export const PLAN_CARDS: PlanCard[] = [
  {
    id: 'starter',
    name: PLANS.starter.name,
    forWho: 'For small teams getting their first answers',
    monthly: PLAN_PRICES.starter.month / 100,
    yearly: PLAN_PRICES.starter.year / 100,
    highlights: [
      `${n(lim('starter').maxUsers)} users`,
      `${n(lim('starter').maxDataSources)} data source`,
      `${n(lim('starter').questionsPerMonth)} questions a month`,
      'Charts, tables and saved dashboards',
      'Email support',
    ],
  },
  {
    id: 'business',
    name: PLANS.business.name,
    forWho: 'For growing teams who run on their numbers',
    monthly: PLAN_PRICES.business.month / 100,
    yearly: PLAN_PRICES.business.year / 100,
    featured: true,
    highlights: [
      `${n(lim('business').maxUsers)} users`,
      `${n(lim('business').maxDataSources)} data sources`,
      `${n(lim('business').questionsPerMonth)} questions a month`,
      'Scheduled email digests',
      'Everything in Starter',
    ],
  },
  {
    id: 'enterprise',
    name: PLANS.enterprise.name,
    forWho: 'For large companies with strict requirements',
    monthly: PLAN_PRICES.enterprise.month / 100,
    yearly: PLAN_PRICES.enterprise.year / 100,
    highlights: [
      'Unlimited users and data sources',
      'Unlimited questions',
      'Single sign-on (SSO)',
      'Private AI model in your cloud',
      'Priority support',
    ],
  },
];

export const SETUP_FEE = SETUP_FEE_CENTS / 100;
export const usd = (v: number) => `$${v.toLocaleString('en-US')}`;
