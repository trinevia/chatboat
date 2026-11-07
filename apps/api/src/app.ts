import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './auth';
import { chatRoutes } from './routes/chat';
import { dashboardRoutes } from './routes/dashboards';
import { miscRoutes } from './routes/misc';

const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

export const app = new Hono()
  .use(logger())
  .use('/api/*', cors({ origin, credentials: true }))
  .get('/health', c => c.json({ ok: true }))
  .on(['GET', 'POST'], '/api/auth/*', c => auth.handler(c.req.raw))
  .route('/api', chatRoutes)
  .route('/api', dashboardRoutes)
  .route('/api', miscRoutes)
  .onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Internal server error' }, 500);
  });

export type AppType = typeof app;
