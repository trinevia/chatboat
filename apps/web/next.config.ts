import path from 'node:path';
import type { NextConfig } from 'next';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

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
  // The browser talks to /api on the same origin, so auth cookies just work.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
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
