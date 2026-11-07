import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** Application data: users, chats, dashboards. The AI never reads this schema. */
export const app = pgSchema('app');

// ---- Better Auth tables -------------------------------------------------
export const user = app.table('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  /** Business role, used for role-based suggested questions. */
  role: text('role').notNull().default('sales'),
  /** What the person may do in this install: admins manage members, branding and data. */
  accessRole: text('access_role', { enum: ['admin', 'member'] }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const session = app.table('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = app.table('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verification = app.table('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---- Install settings & invitations ------------------------------------------
/** Install-wide settings an admin can change in the app (company name, logo, …). Secrets stay in env. */
export const setting = app.table('setting', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** Sign-up is invite-only: an admin invites by email, the link lets that person create an account. */
export const invitation = app.table('invitation', {
  token: text('token').primaryKey(),
  email: text('email').notNull(),
  accessRole: text('access_role', { enum: ['admin', 'member'] }).notNull().default('member'),
  businessRole: text('business_role').notNull().default('sales'),
  invitedBy: text('invited_by').references(() => user.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---- Data sources ------------------------------------------------------------
/**
 * Where the AI's questions are answered from. Exactly one is active: the sample
 * data, a company database (read-only login) or the uploaded spreadsheets.
 */
export const dataSource = app.table(
  'data_source',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['sample', 'postgres', 'upload'] }).notNull(),
    /** Non-secret connection details: host, port, database, user, ssl. */
    config: jsonb('config').notNull().default({}),
    /** Encrypted password (AES-256-GCM with DATA_ENCRYPTION_KEY). */
    secret: text('secret'),
    /** Tables the AI may query, as "schema.table". */
    allowedTables: text('allowed_tables').array().notNull().default([]),
    /** Admin's notes for the AI about this data (meanings of columns, gotchas). */
    notes: text('notes').notNull().default(''),
    /** Example questions generated from the tables, shown on the home page. */
    suggestions: text('suggestions').array().notNull().default([]),
    isActive: boolean('is_active').notNull().default(false),
    lastCheckedAt: timestamp('last_checked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  t => [uniqueIndex('data_source_one_active').on(t.isActive).where(sql`${t.isActive}`)]
);

// ---- Chats ---------------------------------------------------------------
export const chatGroup = app.table('chat_group', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const chat = app.table('chat', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New chat'),
  isSaved: boolean('is_saved').notNull().default(false),
  groupId: integer('group_id').references(() => chatGroup.id, { onDelete: 'set null' }),
  /** Chart the chat was started from ("Ask about this chart"); given to the model as context. */
  context: jsonb('context'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** One row per UI message; `parts` is the AI SDK UIMessage parts array. */
export const message = app.table('message', {
  id: text('id').primaryKey(),
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  parts: jsonb('parts').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const feedback = app.table(
  'feedback',
  {
    id: serial('id').primaryKey(),
    messageId: text('message_id')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rating: text('rating', { enum: ['up', 'down'] }).notNull(),
    /** Reason codes picked on a thumbs-down, see FEEDBACK_REASONS in @chatboat/shared. */
    reasons: text('reasons').array().notNull().default([]),
    comment: text('comment'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  t => [uniqueIndex('feedback_message_user').on(t.messageId, t.userId)]
);

// ---- Dashboards ------------------------------------------------------------
export const dashboard = app.table('dashboard', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** A pinned chart. Stores the chart spec + the SQL so it can be refreshed without the LLM. */
export const dashboardWidget = app.table('dashboard_widget', {
  id: serial('id').primaryKey(),
  dashboardId: integer('dashboard_id')
    .notNull()
    .references(() => dashboard.id, { onDelete: 'cascade' }),
  chatId: text('chat_id').references(() => chat.id, { onDelete: 'set null' }),
  chart: jsonb('chart').notNull(),
  sql: text('sql'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Read-only public link to a frozen copy of a chat or dashboard.
 * The snapshot is taken when the link is created or refreshed, so viewers never run queries.
 */
export const shareLink = app.table('share_link', {
  token: text('token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['chat', 'dashboard'] }).notNull(),
  targetId: text('target_id').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  revokedAt: timestamp('revoked_at'),
});

// ---- Scheduled digests ----------------------------------------------------------
/** Emails a dashboard on a schedule. The tick in apps/api claims rows whose next_run_at has passed. */
export const subscription = app.table('subscription', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  dashboardId: integer('dashboard_id')
    .notNull()
    .references(() => dashboard.id, { onDelete: 'cascade' }),
  frequency: text('frequency', { enum: ['daily', 'weekly', 'monthly'] }).notNull(),
  hour: integer('hour').notNull(),
  minute: integer('minute').notNull().default(0),
  /** 0 = Sunday … 6 = Saturday (weekly only). */
  dayOfWeek: integer('day_of_week'),
  /** 1–28 (monthly only, so every month has the day). */
  dayOfMonth: integer('day_of_month'),
  timezone: text('timezone').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  nextRunAt: timestamp('next_run_at').notNull(),
  lastRunAt: timestamp('last_run_at'),
  /** Per-widget totals from the last digest, used to say what changed. */
  lastTotals: jsonb('last_totals'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const subscriptionRun = app.table('subscription_run', {
  id: serial('id').primaryKey(),
  subscriptionId: integer('subscription_id')
    .notNull()
    .references(() => subscription.id, { onDelete: 'cascade' }),
  trigger: text('trigger', { enum: ['schedule', 'manual'] }).notNull(),
  status: text('status', { enum: ['sent', 'failed'] }).notNull(),
  error: text('error'),
  sentTo: text('sent_to'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** Company-wide observations shown on the home page; recomputed by a daily job. */
export const insight = app.table('insight', {
  key: text('key').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  /** Question to ask when the user clicks the insight. */
  question: text('question').notNull(),
  tone: text('tone', { enum: ['good', 'bad', 'neutral'] }).notNull(),
  /** Bigger = more important; the home page shows the top few. */
  score: integer('score').notNull().default(0),
  computedAt: timestamp('computed_at').notNull().defaultNow(),
});

/** One row per AI request: who, which model, tokens and outcome. Used for limits and cost. */
export const aiUsage = app.table('ai_usage', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  chatId: text('chat_id'),
  model: text('model').notNull(),
  status: text('status', { enum: ['started', 'completed', 'failed'] }).notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const chatRelations = relations(chat, ({ many, one }) => ({
  messages: many(message),
  group: one(chatGroup, { fields: [chat.groupId], references: [chatGroup.id] }),
}));
export const messageRelations = relations(message, ({ one }) => ({
  chat: one(chat, { fields: [message.chatId], references: [chat.id] }),
}));
export const dashboardRelations = relations(dashboard, ({ many }) => ({
  widgets: many(dashboardWidget),
}));
export const widgetRelations = relations(dashboardWidget, ({ one }) => ({
  dashboard: one(dashboard, { fields: [dashboardWidget.dashboardId], references: [dashboard.id] }),
}));
