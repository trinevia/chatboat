# Chatboat — ask your business data

Chatboat is a "chat with your data" analytics assistant. A business user types a question in plain English, for example *"Show me the sales data for California"*, and gets back a chart built from live company data, along with a short takeaway and suggested follow-up questions. Charts can be switched between chart types, exported, and pinned to dashboards that refresh from the database.

The app is a full-stack rebuild of the `chatapp` frontend (same subject: sales, invoices, customers, finance, inventory), this time with its own backend, AI agent and demo database.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend (`apps/web`) | Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS v4, TanStack Query, AI SDK UI (`useChat`), Recharts |
| Backend (`apps/api`) | Hono on Node, Vercel AI SDK v7 (`streamText` + tools), Better Auth |
| AI model | Provider-agnostic: Anthropic Claude by default (`claude-opus-5-5`); OpenAI, Google or NVIDIA NIM via env |
| Database (`packages/db`) | PostgreSQL 17 + Drizzle ORM, seeded demo business data |
| Shared (`packages/shared`) | Zod schemas for chart specs and API payloads |

## How a question is answered

1. The browser streams the question to `POST /api/chat` (Next.js rewrites `/api/*` to the Hono server, so auth cookies stay same-origin).
2. The API loads the chat history and calls the model with three tools:
   - **`runSql`** runs one `SELECT` against the `biz` schema. It returns a short preview to the model; the full rows stay on the server.
   - **`renderChart`** turns a query result into a chart spec (type, x/y keys, title, summary) that streams to the browser.
   - **`suggestFollowups`** returns follow-up questions that the UI shows as clickable chips.
3. The finished answer is saved to Postgres, so reloading the page shows the same conversation.

### Safety of AI-written SQL

- Queries run as a separate Postgres role, `analyst_ro`. It can only `SELECT` from the `biz` schema, has no access to the `app` schema (users, sessions, chats), runs every transaction read-only, and has a 5-second statement timeout.
- Before a query reaches the database, it is parsed and rejected unless it is a single `SELECT` over `biz.*` tables (`apps/api/src/ai/sql-guard.ts`, covered by tests).
- Every query is wrapped with `LIMIT 1000`.

## Getting started

Requirements: Node 22+, pnpm 10, Docker.

```bash
pnpm install
```

```bash
cp .env.example .env
```

Edit `.env`: set `BETTER_AUTH_SECRET` to a long random string, and set the API key for your AI provider (`ANTHROPIC_API_KEY` by default).

```bash
pnpm db:up
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

Open http://localhost:3000, create an account, and pick a role. The role decides which questions are suggested on the home page.

### Switching AI provider

```env
AI_PROVIDER=openai        # anthropic | openai | google | nvidia
AI_MODEL=gpt-5            # optional; each provider has a default
OPENAI_API_KEY=...
```

For NVIDIA NIM (build.nvidia.com), set `AI_PROVIDER=nvidia` and `NVIDIA_API_KEY`. The default model is `nvidia/nemotron-3-ultra-550b-a55b`; the model must support tool calling.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Runs web (port 3000) and API (port 4000) |
| `pnpm typecheck` | Typechecks every package |
| `pnpm test` | Runs the API tests (SQL guard, schema doc) |
| `pnpm db:migrate` | Applies Drizzle migrations and configures the `analyst_ro` role |
| `pnpm db:seed` | Resets and reseeds ~2 years of demo sales data |
| `pnpm --filter @chatboat/db generate` | Generates a migration after a schema change |

## Project layout

```
apps/web/        Next.js frontend: auth pages, ask box, streaming conversation, charts, dashboards
apps/api/        Hono API: Better Auth, AI agent (src/ai), chat / dashboard / suggestion routes
packages/db/     Drizzle schemas (app + biz), migrations, seed script, schema doc for the prompt
packages/shared/ Zod chart spec, DTOs, long-to-wide pivot helper
```

## Not built yet

- Reports and scheduled questions (planned with pg-boss, re-running the stored SQL on a cron).
- Chat groups/folders in the sidebar (the `chat_group` table exists; there is no UI yet).
- Sending real password-reset emails. In development the reset link is printed in the API log.
