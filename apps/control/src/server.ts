import { loadPrivateKey } from '@chatboat/licence';
import { serve } from '@hono/node-server';
import Stripe from 'stripe';
import { createApp } from './app';
import { connect } from './db';
import { runMigrations } from './migrate';
import { PgStore } from './store';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see apps/control in the README)`);
  return v;
}

const dbUrl = process.env.CONTROL_DATABASE_URL ?? required('DATABASE_URL');
const secretKey = required('STRIPE_SECRET_KEY');
if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('rk_test_') && process.env.ALLOW_LIVE_STRIPE !== '1') {
  throw new Error('STRIPE_SECRET_KEY is not a test key. Set ALLOW_LIVE_STRIPE=1 when going live on purpose.');
}

const port = Number(process.env.CONTROL_PORT ?? 4100);
const { db } = connect(dbUrl);
await runMigrations(db);

const app = createApp({
  store: new PgStore(db),
  stripe: new Stripe(secretKey),
  webhookSecret: required('STRIPE_WEBHOOK_SECRET'),
  licensing: {
    privateKey: loadPrivateKey(required('LICENCE_PRIVATE_KEY')),
    bufferDays: Number(process.env.LICENCE_BUFFER_DAYS ?? 7),
  },
  adminPassword: process.env.ADMIN_PASSWORD || undefined,
  publicUrl: (process.env.CONTROL_PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
  log: (msg) => console.log(`[control] ${msg}`),
});

serve({ fetch: app.fetch, port }, () => console.log(`[control] listening on http://localhost:${port}`));
