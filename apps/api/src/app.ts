import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './auth';
import { chatRoutes } from './routes/chat';
import { dashboardRoutes } from './routes/dashboards';
import { miscRoutes } from './routes/misc';
import { collectionRoutes } from './routes/collections';
import { publicShareRoutes, shareRoutes } from './routes/shares';
import { subscriptionRoutes } from './routes/subscriptions';
import { insightRoutes } from './routes/insights';
import { setupRoutes } from './routes/setup';
import { invitationRoutes } from './routes/invitations';
import { adminRoutes } from './routes/admin';

const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

export const app = new Hono()
  .use(logger())
  .use('/api/*', cors({ origin, credentials: true }))
  .get('/health', c => c.json({ ok: true }))
  .on(['GET', 'POST'], '/api/auth/*', c => auth.handler(c.req.raw))
  // Public routes must be registered before the signed-in routes below.
  .route('/api', publicShareRoutes)
  .route('/api', setupRoutes)
  .route('/api', invitationRoutes)
  .route('/api', adminRoutes)
  .route('/api', chatRoutes)
  .route('/api', dashboardRoutes)
  .route('/api', miscRoutes)
  .route('/api', collectionRoutes)
  .route('/api', shareRoutes)
  .route('/api', subscriptionRoutes)
  .route('/api', insightRoutes)
  .onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Internal server error' }, 500);
  });

export type AppType = typeof app;
