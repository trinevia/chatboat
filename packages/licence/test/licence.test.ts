import { createPrivateKey, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decodeLicenceUnverified,
  generateLicenceKeyPair,
  PLANS,
  signLicence,
  verifyLicence,
} from '../src/index';

const keys = generateLicenceKeyPair();
const other = generateLicenceKeyPair();
const now = new Date('2026-11-07T12:00:00Z');
const day = 24 * 60 * 60 * 1000;

const issue = (expiresAt: Date, extra: Partial<Parameters<typeof signLicence>[0]> = {}) =>
  signLicence({ customerId: 'cus_1', company: 'Acme Ltd', plan: 'starter', expiresAt, issuedAt: now, ...extra }, keys.privateKeyPem);

describe('signLicence / verifyLicence', () => {
  it('round-trips a valid licence with the plan limits', () => {
    const token = issue(new Date(now.getTime() + 30 * day));
    expect(token.startsWith('cb1.')).toBe(true);
    const res = verifyLicence(token, keys.publicKeyPem, { now });
    expect(res.status).toBe('valid');
    if (res.status !== 'valid') return;
    expect(res.licence.company).toBe('Acme Ltd');
    expect(res.licence.plan).toBe('starter');
    expect(res.licence.limits).toEqual({ maxUsers: 5, maxDataSources: 1, questionsPerMonth: 1000 });
    expect(res.licence.features).toEqual([]);
  });

  it('keeps unlimited (null) limits for enterprise', () => {
    const token = issue(new Date(now.getTime() + day), { plan: 'enterprise' });
    const res = verifyLicence(token, keys.publicKeyPem, { now });
    expect(res.status === 'valid' && res.licence.limits).toEqual(PLANS.enterprise.limits);
  });

  it('accepts base64-encoded PEM keys and a private key in place of the public key', () => {
    const token = signLicence(
      { customerId: 'c', company: 'B', plan: 'business', expiresAt: new Date(now.getTime() + day) },
      Buffer.from(keys.privateKeyPem).toString('base64'),
    );
    expect(verifyLicence(token, Buffer.from(keys.publicKeyPem).toString('base64'), { now }).status).toBe('valid');
    expect(verifyLicence(token, keys.privateKeyPem, { now }).status).toBe('valid');
  });

  it('reports expired licences inside the grace period', () => {
    const token = issue(new Date(now.getTime() - 3 * day));
    const res = verifyLicence(token, keys.publicKeyPem, { now });
    expect(res.status).toBe('expired');
    if (res.status !== 'expired') return;
    expect(res.inGracePeriod).toBe(true);
    expect(res.graceDaysLeft).toBe(11);
    expect(res.graceEndsAt.toISOString()).toBe(new Date(now.getTime() + 11 * day).toISOString());
  });

  it('reports expired licences after the grace period', () => {
    const token = issue(new Date(now.getTime() - 20 * day));
    const res = verifyLicence(token, keys.publicKeyPem, { now, graceDays: 14 });
    expect(res.status === 'expired' && { inGrace: res.inGracePeriod, left: res.graceDaysLeft }).toEqual({ inGrace: false, left: 0 });
  });

  it('honours a custom grace period', () => {
    const token = issue(new Date(now.getTime() - 20 * day));
    const res = verifyLicence(token, keys.publicKeyPem, { now, graceDays: 30 });
    expect(res.status === 'expired' && res.graceDaysLeft).toBe(10);
  });

  it('rejects a licence signed by another key', () => {
    const token = signLicence(
      { customerId: 'c', company: 'Evil', plan: 'enterprise', expiresAt: new Date(now.getTime() + day) },
      other.privateKeyPem,
    );
    expect(verifyLicence(token, keys.publicKeyPem, { now })).toEqual({ status: 'invalid', reason: 'Signature does not match' });
  });

  it('rejects a tampered payload', () => {
    const token = issue(new Date(now.getTime() + day));
    const [p, body, sig] = token.split('.');
    const payload = JSON.parse(Buffer.from(body!, 'base64url').toString());
    payload.plan = 'enterprise';
    payload.limits = PLANS.enterprise.limits;
    const forged = `${p}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${sig}`;
    expect(verifyLicence(forged, keys.publicKeyPem, { now }).status).toBe('invalid');
  });

  it('rejects garbage and malformed tokens', () => {
    for (const t of ['', 'abc', 'cb1.x.y', 'cb2.a.b', 'cb1..']) {
      expect(verifyLicence(t, keys.publicKeyPem, { now }).status).toBe('invalid');
    }
  });

  it('rejects a correctly signed token whose payload is not a licence', () => {
    // Sign a nonsense payload with the real key by going through the same format by hand.
    const body = `cb1.${Buffer.from(JSON.stringify({ v: 1, hello: 'world' })).toString('base64url')}`;
    const sig = sign(null, Buffer.from(body), createPrivateKey(keys.privateKeyPem)).toString('base64url');
    expect(verifyLicence(`${body}.${sig}`, keys.publicKeyPem, { now })).toEqual({
      status: 'invalid',
      reason: 'Payload is not a valid licence',
    });
  });

  it('returns invalid for a bad public key instead of throwing', () => {
    const token = issue(new Date(now.getTime() + day));
    expect(verifyLicence(token, 'not a key', { now }).status).toBe('invalid');
  });

  it('decodes without verifying for display', () => {
    const token = issue(new Date(now.getTime() + day));
    expect(decodeLicenceUnverified(token)?.company).toBe('Acme Ltd');
    expect(decodeLicenceUnverified('nope')).toBeNull();
  });
});
