import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, schema } from '@chatboat/db';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.WEB_ORIGIN ?? 'http://localhost:3000'],
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
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
