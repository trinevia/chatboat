import { serve } from '@hono/node-server';
import { app } from './app';
import { getModel } from './ai/model';

const port = Number(process.env.API_PORT ?? 4000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API listening on http://localhost:${port} (model: ${getModel().label})`);
});
