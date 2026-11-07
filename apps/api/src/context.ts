import { createMiddleware } from 'hono/factory';
import { auth, type AuthSession } from './auth';

export type AppEnv = {
  Variables: { user: AuthSession['user']; session: AuthSession['session'] };
};

/** Rejects requests without a valid Better Auth session cookie. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) return c.json({ error: 'Unauthorized' }, 401);
  c.set('user', result.user);
  c.set('session', result.session);
  await next();
});

/** Only admins of this install (manage members, branding, data sources). Use after requireUser. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if ((c.get('user') as { accessRole?: string }).accessRole !== 'admin') {
    return c.json({ error: 'Admins only' }, 403);
  }
  await next();
});
