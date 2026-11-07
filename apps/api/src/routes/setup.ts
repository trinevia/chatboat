import { zValidator } from '@hono/zod-validator';
import { count, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, schema } from '@chatboat/db';
import { setupInput, type SetupStatus } from '@chatboat/shared';
import { auth, withSignupAllowed } from '../auth';
import { getBranding, setSetting } from '../settings';

const { user } = schema;

async function userCount() {
  const [{ n }] = await db.select({ n: count() }).from(user);
  return n;
}

let setupRunning = false;

/** Public: first-run setup. Only works while the install has no users at all. */
export const setupRoutes = new Hono()
  .get('/setup/status', async c => {
    const branding = await getBranding();
    const body: SetupStatus = { needsSetup: (await userCount()) === 0, ...branding };
    return c.json(body);
  })

  .post('/setup', zValidator('json', setupInput), async c => {
    if (setupRunning || (await userCount()) > 0) return c.json({ error: 'This install is already set up.' }, 409);
    setupRunning = true;
    try {
      const input = c.req.valid('json');
      // Creates the account and signs in (the response carries the session cookie).
      const res = await withSignupAllowed(input.email, () =>
        auth.api.signUpEmail({
          body: { name: input.name, email: input.email, password: input.password },
          headers: c.req.raw.headers,
          asResponse: true,
        })
      );
      if (!res.ok) return res;
      await db.update(user).set({ accessRole: 'admin', role: input.role }).where(eq(user.email, input.email.toLowerCase()));
      await setSetting('branding', { companyName: input.companyName, logo: null });
      return res;
    } finally {
      setupRunning = false;
    }
  });
