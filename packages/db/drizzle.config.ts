import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  schemaFilter: ['app', 'biz'],
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://chatboat:chatboat@localhost:5433/chatboat' },
});
