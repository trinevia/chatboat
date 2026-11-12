import path from 'node:path';
import type { NextConfig } from 'next';

// /api/* is forwarded to the API by src/proxy.ts (it reads API_INTERNAL_URL).

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image; trace files from the monorepo root.
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ['@chatboat/shared'],
  experimental: {
    // Signed-in pages render on the client from the user's session, so there's no static
    // shell to check. Only validate segments that explicitly export `instant`.
    instantInsights: { validationLevel: 'manual-warning' },
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
