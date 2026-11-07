import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  schemaFilter: ['control'],
  migrations: { schema: 'control', table: '__drizzle_migrations' },
  dbCredentials: {
    url: process.env.CONTROL_DATABASE_URL ?? process.env.DATABASE_URL ?? 'postgres://chatboat:chatboat@localhost:5433/chatboat',
  },
});
