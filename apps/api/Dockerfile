# Build from the repo root:  docker build -f apps/api/Dockerfile -t chatboat-api .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# Compile the API, migrations and seed to JavaScript with tsup. Workspace packages and npm
# dependencies are bundled into dist/, so the runtime stage needs no tsx and no dev deps.
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@chatboat/api..."
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @chatboat/api build
# @resvg/resvg-js is a native module and stays external: install just that package (same
# version as the lockfile) with its musl binary, for the Alpine runtime below.
FROM node:22-alpine AS native
WORKDIR /native
COPY --from=build /app/apps/api/node_modules/@resvg/resvg-js/package.json /tmp/resvg.json
RUN version=$(node -p "require('/tmp/resvg.json').version") \
 && echo '{"private":true,"type":"module"}' > package.json \
 && npm install --omit=dev --no-audit --no-fund "@resvg/resvg-js@$version"

FROM node:22-alpine AS runner
ARG APP_VERSION=dev
ENV NODE_ENV=production APP_VERSION=$APP_VERSION
LABEL org.opencontainers.image.source="https://github.com/trinevia/chatboat" \
      org.opencontainers.image.title="chatboat-api" \
      org.opencontainers.image.version=$APP_VERSION
# Chart images in digest emails are drawn with resvg, which needs a system font for labels
# (Liberation Sans is metric-compatible with Arial, the font the charts ask for).
RUN apk add --no-cache ttf-liberation
WORKDIR /app
COPY --from=native /native/package.json ./package.json
COPY --from=native /native/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
# migrate.js resolves migrations relative to itself: dist/../migrations
COPY packages/db/migrations ./migrations
COPY --chmod=755 apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# Run migrations with:  docker run --rm --env-file .env chatboat-api migrate
ENTRYPOINT ["entrypoint"]
CMD ["serve"]
