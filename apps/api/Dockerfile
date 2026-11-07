# Build from the repo root:  docker build -f apps/api/Dockerfile -t chatboat-api .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
# API plus its workspace dependencies (db, shared). tsx stays installed: the API and
# migrations run TypeScript directly, there is no separate compile step.
RUN pnpm install --frozen-lockfile --filter "@chatboat/api..."

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app ./
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
USER node
WORKDIR /app/apps/api
EXPOSE 4000
# Run migrations with:  docker run --rm --env-file .env chatboat-api migrate
COPY --chown=node:node apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint
ENTRYPOINT ["entrypoint"]
CMD ["serve"]
