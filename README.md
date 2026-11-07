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
AI_PROVIDER=openai        # anthropic | openai | google | nvidia | azure | bedrock | openai-compatible
AI_MODEL=gpt-5            # optional for most providers; each has a default
OPENAI_API_KEY=...
```

For NVIDIA NIM (build.nvidia.com), set `AI_PROVIDER=nvidia` and `NVIDIA_API_KEY`. The default model is `nvidia/nemotron-3-ultra-550b-a55b`; the model must support tool calling.

#### Private AI (no public AI APIs)

For companies that can't send data to public AI APIs, Chatboat can use a model in your own cloud account or on your own servers:

| Provider | `AI_PROVIDER` | Env vars | `AI_MODEL` |
|---|---|---|---|
| Azure OpenAI | `azure` | `AZURE_RESOURCE_NAME` (the `<name>` in `https://<name>.openai.azure.com`), `AZURE_API_KEY` | **Required**: your deployment name |
| Amazon Bedrock | `bedrock` | `AWS_REGION`, plus `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` (optional `AWS_SESSION_TOKEN`) or a Bedrock API key in `AWS_BEARER_TOKEN_BEDROCK` | Defaults to `us.anthropic.claude-opus-5-5`; use the `eu.` / `apac.` prefix outside US regions |
| vLLM, Ollama or any OpenAI-compatible server | `openai-compatible` | `AI_BASE_URL` (e.g. `http://localhost:11434/v1` for Ollama, `http://<host>:8000/v1` for vLLM), optional `AI_API_KEY` | **Required**: the model name the server serves, e.g. `qwen3:32b` |

```env
# Example: Ollama on the same machine
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=qwen3:32b
```

The agent relies on tool calling, so pick a model that supports it (vLLM needs `--enable-auto-tool-choice` and a matching `--tool-call-parser`). Smaller local models answer fewer questions correctly; check one with `pnpm --filter @chatboat/api eval -- --models openai-compatible:<model>`.

`aiProviderStatus()` in `apps/api/src/ai/model.ts` reports the active provider, model and any missing env vars, without exposing their values.

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

## Features

- **Ask in plain English**: streamed answers with charts, follow-up questions, and a plain-English "How it was calculated".
- **Charts**: switch chart type, full screen, copy data, download PNG / PDF / CSV.
- **Dashboards**: pin charts; refresh re-runs the saved SQL without the AI. "Ask about this chart" starts a chat with the chart as context.
- **Collections**: folders for chats, with drag and drop.
- **Share links**: read-only snapshots of a chat or dashboard at `/s/<token>`, no login needed, SQL hidden, revocable.
- **Email digests**: email a dashboard daily, weekly or monthly in your timezone, with fresh numbers, chart images and what changed since last time.
- **Worth a look**: home-page insights (sales pace, overdue balance, low stock, regional swings) recalculated every 6 hours.

## Email digests and the scheduler

The API runs a one-minute tick that claims due subscriptions with `SELECT … FOR UPDATE SKIP LOCKED`, so several API instances can run without sending a digest twice. Set `DISABLE_SCHEDULER=1` on instances that shouldn't send.

Locally, `docker compose up -d` also starts **Mailpit**, a fake inbox: every digest lands at http://localhost:8025 and nothing reaches real people. In production, set `SMTP_URL` to your provider (Resend, SES, Postmark, …) and `MAIL_FROM` to a verified sender. Digests go to the account's own email address.

## Usage limits and cost

Every AI request is recorded in `app.ai_usage` (model, tokens, duration, outcome). Each user can ask `DAILY_QUESTION_LIMIT` questions per UTC day (default 100); after that the chat explains the limit instead of calling the model. Settings → Usage shows today's count, this month's questions, tokens, average answer time and an estimated cost when `AI_PRICE_INPUT_PER_M` / `AI_PRICE_OUTPUT_PER_M` are set.

## Accuracy eval

`apps/api/evals` holds 25 business questions with explicit periods, each with a reference SQL answer. The runner asks the model each question with the app's real prompt and tools, then checks that the numbers it returns match the reference (names and row order are ignored; counts must match exactly, amounts within 0.5%).

```bash
pnpm --filter @chatboat/api eval -- --limit 5
```

```bash
pnpm --filter @chatboat/api eval -- --models nvidia:nvidia/nemotron-3-ultra-550b-a55b,nvidia:nvidia/nemotron-3.5-lightning-30b-a3b
```

Each run calls the model once per question, so it uses API credits. Reports are written to `apps/api/evals/results/` (git-ignored).

## CI

`.github/workflows/ci.yml` runs on every push and pull request: install, typecheck, unit tests, migrations and seed on an empty Postgres, a check that the `analyst_ro` role can't write or read the `app` schema, the tsup build of the API (what the Docker image runs), and a production build of the web app.

## Docker

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds `apps/api/Dockerfile` and `apps/web/Dockerfile` (a Next.js standalone server), runs migrations once, then starts Postgres, the API and the web app on port 3000. Put `PUBLIC_URL`, `POSTGRES_PASSWORD`, `ANALYST_PASSWORD`, `BETTER_AUTH_SECRET`, the AI provider settings and `SMTP_URL` in `.env`. The API image also runs `migrate` and `seed` as commands, e.g. `docker compose -f docker-compose.prod.yml run --rm api seed` for demo data.

## Deploying

Each customer gets a private install: we host one copy per customer (one Hetzner server each), or they run it in their own cloud. Everything for that is in [`deploy/`](deploy/):

- [`deploy/README.md`](deploy/README.md): install (`./install.sh`), upgrade (`./upgrade.sh <version>`), backups and restore (`./restore.sh`)
- [`deploy/HETZNER.md`](deploy/HETZNER.md): runbook for setting up and running one customer's server on Hetzner Cloud
- [`CHANGELOG.md`](CHANGELOG.md): what changed in each version, plus upgrade notes

The stack is Postgres, a one-shot `migrate` service, the API, the web app, Caddy for HTTPS on the customer's domain, and a nightly `pg_dump` backup job (14 days kept locally, optional S3 copy). It pulls versioned images instead of building from source.

**Releasing a version:** add the notes to `CHANGELOG.md`, then tag and push:

```bash
git tag v1.2.0 && git push origin v1.2.0
```

`.github/workflows/release.yml` builds both images for amd64 and arm64 and pushes them to `ghcr.io/trinevia/chatboat-api` and `ghcr.io/trinevia/chatboat-web`, tagged `1.2.0`, `1.2` and `latest`. It also attaches `chatboat-deploy-v1.2.0.tar.gz` (the `deploy/` folder) to the GitHub release. If the packages are private, customer servers need a read-only token to pull them (see the runbook).

The API image is compiled with tsup (`pnpm --filter @chatboat/api build` → `apps/api/dist/`). Workspace packages and npm dependencies are bundled in, and only the native `@resvg/resvg-js` is installed separately.

## Connecting a company's data

Admins choose where answers come from in **Admin → Data sources**. One source is "in use" at a time; every chart remembers its own source, so dashboards and digests keep refreshing from the right place after a switch.

- **Sample sales data**: the built-in demo tables (`biz` schema).
- **PostgreSQL**: enter host, port, database and a login. "Test connection" lists the tables that login can read and warns if it can write. Admins then tick the tables the AI may use (nothing is ticked by default). Passwords are encrypted with `DATA_ENCRYPTION_KEY` (AES-256-GCM).
- **MongoDB**: paste a connection string (stored encrypted) and the database name. Chatboat samples documents to learn each collection's fields, including nested ones (`customer.city`, `items[].qty`), and the admin ticks the collections the AI may use. The AI writes aggregation pipelines instead of SQL; only read-only stages are accepted (no `$out`, `$merge`, `$function` or `$where`), lookups must stay inside the allowed collections, and each query is capped at 5 seconds and 1,000 results. Use a user with the built-in `read` role.
- **CSV / Excel upload**: each sheet becomes a table in the `uploads` schema, with column types detected automatically. Uploading a file with the same name replaces its table.

Every query the AI writes is checked against that source's allowed tables, runs in a read-only transaction with a 5-second timeout and a 1,000-row limit, and with `search_path` pinned so unqualified table names can't reach other schemas.

**Notes for the AI** (per source) and **Company definitions** (e.g. "Revenue = paid orders minus refunds") are added to the AI's instructions. The home page suggests questions generated from the connected tables; the "Worth a look" insights only apply to the sample data.

To check accuracy on a company's own data, write `[{ "id", "question", "sql" }]` to a JSON file and run:

```bash
pnpm --filter @chatboat/api eval -- --cases company-questions.json
```

## Marketing site, subscriptions and licences

Three pieces sell Chatboat and license each install. None of them run inside a customer's install.

```
apps/site/         Public marketing site (Next.js, port 3100): landing, /pricing, /demo, Stripe Checkout
apps/control/      Our internal control panel (Hono, port 4100): Stripe webhook, customer list, licence refresh
packages/licence/  Plans and limits, Ed25519 licence signing and offline verification
```

**How a sale works:** a buyer picks a plan on `/pricing` (monthly or yearly, optionally "Host it for us", which adds the one-time setup fee). `POST /api/checkout` opens Stripe Checkout and asks for the company name. Stripe then calls `apps/control` at `POST /stripe/webhook`. That handler checks the signature, records the customer in the `control` Postgres schema and signs a licence. We copy the licence from the admin page and send it to the customer. `checkout.session.completed`, `customer.subscription.updated` (plan change, renewal) and `customer.subscription.deleted` are handled. Repeated deliveries are ignored, and any other event type is ignored too.

**Licences** look like `cb1.<payload>.<signature>`. The payload holds company, plan, limits (`maxUsers`, `maxDataSources`, `questionsPerMonth`, where `null` means unlimited), features and `expiresAt`. A licence expires at the end of the paid period plus `LICENCE_BUFFER_DAYS` (default 7). After a cancellation it expires when the subscription ended. Installs check a licence like this:

```ts
import { verifyLicence } from '@chatboat/licence';
const r = verifyLicence(token, process.env.LICENCE_PUBLIC_KEY!); // offline, public key only
// r.status: 'valid' | 'expired' (with graceEndsAt, inGracePeriod, graceDaysLeft; 14 days by default) | 'invalid'
```

Installs that can reach us call `GET /licence/<customerId>/refresh` with `Authorization: Bearer <current licence>`. They get back the latest licence, so renewals and plan changes apply without anyone pasting a key.

**Set up (Stripe test mode):**

```bash
pnpm --filter @chatboat/licence keygen          # prints LICENCE_PRIVATE_KEY (control only) and LICENCE_PUBLIC_KEY (installs)
pnpm --filter @chatboat/control stripe:setup    # creates the products and prices (lookup keys chatboat_<plan>_<month|year>)
stripe listen --forward-to localhost:4100/stripe/webhook   # prints STRIPE_WEBHOOK_SECRET
pnpm --filter @chatboat/control dev             # migrates the control schema, then serves http://localhost:4100/admin
pnpm --filter @chatboat/site dev                # http://localhost:3100
```

Pay with Stripe's test card `4242 4242 4242 4242`. The customer and licence then show up on `/admin` (user `admin`, password `ADMIN_PASSWORD`). Enable the customer portal in the Stripe dashboard under Settings → Billing → Customer portal. Both apps refuse live keys unless `ALLOW_LIVE_STRIPE=1`.

| Variable | Used by | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | site, control | Stripe test key (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | control | Signing secret of the webhook endpoint (`whsec_…`) |
| `LICENCE_PRIVATE_KEY` | control | Ed25519 private key (PEM or base64 PEM). Keep it secret |
| `LICENCE_PUBLIC_KEY` | installs | The matching public key |
| `ADMIN_PASSWORD` | control | Protects `/admin`. If unset, `/admin` is disabled |
| `CONTROL_DATABASE_URL` | control | Postgres for the `control` schema (falls back to `DATABASE_URL`) |
| `CONTROL_PUBLIC_URL`, `CONTROL_PORT` | control | Return URL for the billing portal button; port (default 4100) |
| `LICENCE_BUFFER_DAYS` | control | Days a licence outlives the paid period (default 7) |
| `SITE_URL` | site | Public URL used in Stripe redirects (default: the request's origin) |
| `LIVE_DEMO_URL` | site (build time) | "Try the live demo" link |
| `STRIPE_PORTAL_LOGIN_URL` | site (build time) | Stripe's portal login link for the footer's "Manage subscription" |
| `SMTP_URL`, `MAIL_FROM`, `DEMO_REQUEST_TO` | site | Where "Book a demo" requests are emailed (locally: Mailpit) |

Plan limits live in `packages/licence/src/plans.ts` and list prices in `packages/licence/src/catalogue.ts` (placeholders: $149 / $499 / $1,499 a month, yearly is 10× monthly, setup fee $1,000). To run the control tests against Postgres as well as in memory, use `CONTROL_TEST_DATABASE_URL=postgres://chatboat:chatboat@localhost:5433/chatboat pnpm --filter @chatboat/control test`.

## Not built yet

- Digests to other recipients (today they go to your own email only).
- Teams/workspaces and connecting your own data sources.
