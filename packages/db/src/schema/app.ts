import { relations } from 'drizzle-orm';
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
