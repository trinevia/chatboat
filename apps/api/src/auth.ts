import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, schema } from '@chatboat/db';
import { webOrigins } from './origins';

/**
 * Sign-up is closed: accounts are only created by the setup wizard (first admin) or by
 * accepting an invitation. Those endpoints put the email here for the duration of the call.
 */
const allowedSignups = new Set<string>();

export async function withSignupAllowed<T>(email: string, fn: () => Promise<T>): Promise<T> {
  const key = email.trim().toLowerCase();
  allowedSignups.add(key);
  try {
    return await fn();
  } finally {
    allowedSignups.delete(key);
  }
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: webOrigins(),
  // Own cookie prefix so other apps on localhost can't collide with our session cookie.
  advanced: { cookiePrefix: 'chatboat' },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // No email provider is configured in dev: log the reset link instead of sending it.
    sendResetPassword: async ({ user, url }) => {
      console.log(`[auth] Password reset for ${user.email}: ${url}`);
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'sales', input: true },
      // Never settable by the client; changed only by admins through /api/admin.
      accessRole: { type: 'string', defaultValue: 'member', input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async user => (allowedSignups.has(user.email.toLowerCase()) ? undefined : false),
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
