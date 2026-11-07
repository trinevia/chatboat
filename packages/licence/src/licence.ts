import { createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign, verify, type KeyObject } from 'node:crypto';
import { isPlanId, PLANS, type Feature, type LicenceLimits, type PlanId } from './plans';

/**
 * Licence token format: `cb1.<base64url(JSON payload)>.<base64url(Ed25519 signature)>`.
 * The signature covers the ASCII bytes of `cb1.<payload>`, so the version prefix is signed too.
 */
const PREFIX = 'cb1';
export const DEFAULT_GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface LicencePayload {
  v: 1;
  /** Unique id of this licence (a new one each time we issue). */
  id: string;
  /** Our customer id in the control panel; used by installs to refresh. */
  customerId: string;
  company: string;
  plan: PlanId;
  limits: LicenceLimits;
  features: Feature[];
  /** ISO timestamps. */
  issuedAt: string;
  expiresAt: string;
}

export interface SignLicenceInput {
  id?: string;
  customerId: string;
  company: string;
  plan: PlanId;
  expiresAt: Date | string;
  /** Defaults to the plan's limits / features. */
  limits?: LicenceLimits;
  features?: Feature[];
  issuedAt?: Date | string;
}

export type VerifyResult =
  | { status: 'valid'; licence: LicencePayload; expiresAt: Date }
  | {
      status: 'expired';
      licence: LicencePayload;
      expiresAt: Date;
      /** When the grace period ends (expiresAt + graceDays). After that the install goes read-only. */
      graceEndsAt: Date;
      inGracePeriod: boolean;
      /** Whole days left in the grace period, rounded up; 0 once it is over. */
      graceDaysLeft: number;
    }
  | { status: 'invalid'; reason: string };

export interface VerifyOptions {
  now?: Date;
  graceDays?: number;
}

type KeyInput = string | KeyObject;

/** Accepts a PEM string, a PEM with literal `\n`s (as often found in .env files) or base64 of a PEM. */
function normalisePem(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes('-----BEGIN')) return trimmed.replace(/\\n/g, '\n');
  const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
  if (decoded.includes('-----BEGIN')) return decoded;
  throw new Error('Key is not a PEM or base64-encoded PEM');
}

export function loadPrivateKey(key: KeyInput): KeyObject {
  const obj = typeof key === 'string' ? createPrivateKey(normalisePem(key)) : key;
  if (obj.type !== 'private' || obj.asymmetricKeyType !== 'ed25519') throw new Error('Expected an Ed25519 private key');
  return obj;
}

export function loadPublicKey(key: KeyInput): KeyObject {
  const obj = typeof key === 'string' ? createPublicKey(normalisePem(key)) : key;
  if (obj.asymmetricKeyType !== 'ed25519') throw new Error('Expected an Ed25519 public key');
  // A private key also works: derive its public half.
  return obj.type === 'private' ? createPublicKey(obj) : obj;
}

export function generateLicenceKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

const toIso = (d: Date | string) => (typeof d === 'string' ? new Date(d) : d).toISOString();

export function signLicence(input: SignLicenceInput, privateKey: KeyInput): string {
  const plan = PLANS[input.plan];
  if (!plan) throw new Error(`Unknown plan: ${input.plan}`);
  const payload: LicencePayload = {
    v: 1,
    id: input.id ?? randomUUID(),
    customerId: input.customerId,
    company: input.company,
    plan: input.plan,
    limits: input.limits ?? plan.limits,
    features: input.features ?? plan.features,
    issuedAt: toIso(input.issuedAt ?? new Date()),
    expiresAt: toIso(input.expiresAt),
  };
  const body = `${PREFIX}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  const signature = sign(null, Buffer.from(body), loadPrivateKey(privateKey));
  return `${body}.${signature.toString('base64url')}`;
}

const isLimit = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0);

function parsePayload(json: unknown): LicencePayload | null {
  if (!json || typeof json !== 'object') return null;
  const p = json as Record<string, unknown>;
  const limits = p.limits as Record<string, unknown> | undefined;
  if (
    p.v !== 1 ||
    typeof p.id !== 'string' ||
    typeof p.customerId !== 'string' ||
    typeof p.company !== 'string' ||
    !isPlanId(p.plan) ||
    !limits ||
    !isLimit(limits.maxUsers) ||
    !isLimit(limits.maxDataSources) ||
    !isLimit(limits.questionsPerMonth) ||
    !Array.isArray(p.features) ||
    typeof p.issuedAt !== 'string' ||
    typeof p.expiresAt !== 'string' ||
    Number.isNaN(Date.parse(p.expiresAt)) ||
    Number.isNaN(Date.parse(p.issuedAt))
  ) {
    return null;
  }
  return p as unknown as LicencePayload;
}

/** Decodes a token without checking its signature. Only for display; never trust the result. */
export function decodeLicenceUnverified(token: string): LicencePayload | null {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  try {
    return parsePayload(JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')));
  } catch {
    return null;
  }
}

/** Verifies a licence offline using only our public key. */
export function verifyLicence(token: string, publicKey: KeyInput, options: VerifyOptions = {}): VerifyResult {
  const now = options.now ?? new Date();
  const graceDays = options.graceDays ?? DEFAULT_GRACE_DAYS;

  let key: KeyObject;
  try {
    key = loadPublicKey(publicKey);
  } catch (err) {
    return { status: 'invalid', reason: `Bad public key: ${(err as Error).message}` };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return { status: 'invalid', reason: 'Malformed licence' };
  const [prefix, payloadB64, sigB64] = parts as [string, string, string];

  let ok = false;
  try {
    ok = verify(null, Buffer.from(`${prefix}.${payloadB64}`), key, Buffer.from(sigB64, 'base64url'));
  } catch {
    ok = false;
  }
  if (!ok) return { status: 'invalid', reason: 'Signature does not match' };

  let licence: LicencePayload | null;
  try {
    licence = parsePayload(JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')));
  } catch {
    licence = null;
  }
  if (!licence) return { status: 'invalid', reason: 'Payload is not a valid licence' };

  const expiresAt = new Date(licence.expiresAt);
  if (now.getTime() < expiresAt.getTime()) return { status: 'valid', licence, expiresAt };

  const graceEndsAt = new Date(expiresAt.getTime() + graceDays * DAY_MS);
  const msLeft = graceEndsAt.getTime() - now.getTime();
  return {
    status: 'expired',
    licence,
    expiresAt,
    graceEndsAt,
    inGracePeriod: msLeft > 0,
    graceDaysLeft: msLeft > 0 ? Math.ceil(msLeft / DAY_MS) : 0,
  };
}
