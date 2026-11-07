import { defineConfig } from 'tsup';

// Compiles the API, migrations and seed to plain JavaScript for the Docker image.
// Everything is bundled (workspace packages and npm dependencies alike) so the runtime
// image needs no node_modules except @resvg/resvg-js, a native module that can't be bundled.
export default defineConfig({
  entry: {
    server: 'src/server.ts',
    migrate: '../../packages/db/src/migrate.ts',
    seed: '../../packages/db/src/seed.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  bundle: true,
  splitting: true,
  clean: true,
  sourcemap: true,
  noExternal: [/^(?!@resvg\/resvg-js)/],
  external: ['@resvg/resvg-js'],
  // Bundled CommonJS dependencies (e.g. nodemailer) call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
});
