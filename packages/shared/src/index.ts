import { z } from 'zod';

/** Chart types, same set as the original chatapp's VisualizationType (plus `kpi`). */
export const CHART_TYPES = [
  'table',
  'bar',
  'line',
  'pie',
  'stacked',
  'grouped',
  'multi_line',
  'kpi',
] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  table: 'Table',
  bar: 'Bar chart',
  line: 'Line chart',
  pie: 'Pie chart',
  stacked: 'Stacked bar',
  grouped: 'Grouped bar',
  multi_line: 'Multi-line',
  kpi: 'Single number',
};

const cell = z.union([z.string(), z.number(), z.null()]);
export const rowSchema = z.record(z.string(), cell);
export type Row = z.infer<typeof rowSchema>;

/** What the AI sends to `renderChart`. The server swaps queryId for real rows. */
export const renderChartInput = z.object({
  queryId: z
    .string()
    .describe('The queryId returned by runSql whose rows should be charted.'),
  type: z.enum(CHART_TYPES).describe('Best visualization for this data.'),
  title: z.string().describe('Short human title, e.g. "Monthly sales in California".'),
  xKey: z.string().describe('Column used for the category / x axis (ignored for kpi).'),
  yKeys: z
    .array(z.string())
    .min(1)
    .describe('Numeric column(s) to plot. Multiple keys for stacked/grouped/multi_line.'),
  seriesKey: z
    .string()
    .optional()
    .describe(
      'For long-format rows (e.g. month, region, total): the column whose values become separate series. Use with exactly one yKey.'
    ),
  summary: z
    .string()
    .describe('One or two sentences explaining the key takeaway from the numbers.'),
  explanation: z
    .string()
    .describe(
      'Plain-English description of how the numbers were calculated, for a non-technical reader: the metric definition, filters and date range. E.g. "Sum of invoice totals, excluding void invoices, for customers in California, Nov 2025 to Oct 2026, grouped by month."'
    ),
});
export type RenderChartInput = z.infer<typeof renderChartInput>;

/** Fully resolved chart stored in messages and dashboard widgets. */
export const chartSpec = z.object({
  type: z.enum(CHART_TYPES),
  title: z.string(),
  xKey: z.string(),
  yKeys: z.array(z.string()),
  seriesKey: z.string().optional(),
  summary: z.string().optional(),
  explanation: z.string().optional(),
  /** Data source the SQL runs against (absent = the built-in sample data). */
  sourceId: z.number().int().optional(),
  columns: z.array(z.string()),
  rows: z.array(rowSchema),
  sql: z.string().optional(),
});
export type ChartSpec = z.infer<typeof chartSpec>;

export const suggestFollowupsInput = z.object({
  questions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe('Short follow-up questions the user is likely to ask next.'),
});

// ---- REST DTOs ----------------------------------------------------------------
export const chatPatch = z.object({
  title: z.string().min(1).max(120).optional(),
  isSaved: z.boolean().optional(),
  groupId: z.number().int().nullable().optional(),
});
export type ChatPatch = z.infer<typeof chatPatch>;

export const FEEDBACK_REASONS = {
  wrong_numbers: 'Numbers look wrong',
  misunderstood: 'Misunderstood my question',
  wrong_chart: 'Wrong chart type',
  incomplete: 'Missing data or details',
  unclear: 'Hard to understand',
  slow: 'Too slow',
} as const;
export type FeedbackReason = keyof typeof FEEDBACK_REASONS;

// ---- Collections & sharing ------------------------------------------------------
export interface Collection {
  id: number;
  name: string;
  chatCount: number;
}

/** Chart without the SQL, as shown to people viewing a public share link. */
export type PublicChart = Omit<ChartSpec, 'sql'>;

export type ShareSnapshot =
  | {
      kind: 'chat';
      title: string;
      messages: { role: 'user' | 'assistant'; text: string; charts: PublicChart[] }[];
    }
  | { kind: 'dashboard'; title: string; charts: PublicChart[] };

export interface PublicShare {
  snapshot: ShareSnapshot;
  sharedBy: string;
  updatedAt: string;
}

export interface ShareLinkInfo {
  token: string;
  updatedAt: string;
}

// ---- Subscriptions & insights -----------------------------------------------------
export const subscriptionInput = z
  .object({
    dashboardId: z.number().int(),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    dayOfWeek: z.number().int().min(0).max(6).nullable(),
    dayOfMonth: z.number().int().min(1).max(28).nullable(),
    timezone: z.string().min(1).max(64),
  })
  .refine(s => s.frequency !== 'weekly' || s.dayOfWeek != null, { message: 'Pick a day of the week' })
  .refine(s => s.frequency !== 'monthly' || s.dayOfMonth != null, { message: 'Pick a day of the month' });
export type SubscriptionInput = z.infer<typeof subscriptionInput>;

export interface SubscriptionInfo extends SubscriptionInput {
  id: number;
  dashboardName: string;
  isActive: boolean;
  schedule: string;
  nextRunAt: string;
  lastRun: { status: 'sent' | 'failed'; at: string; error: string | null } | null;
}

export interface InsightInfo {
  key: string;
  title: string;
  body: string;
  question: string;
  tone: 'good' | 'bad' | 'neutral';
  computedAt: string;
}

// Business roles (drive suggested questions).
export const ROLES = ['sales', 'finance', 'operations', 'executive'] as const;
export type Role = (typeof ROLES)[number];

// ---- Setup, team & branding --------------------------------------------------------
export const ACCESS_ROLES = ['admin', 'member'] as const;
export type AccessRole = (typeof ACCESS_ROLES)[number];

const password = z.string().min(8, 'Use at least 8 characters').max(128);
const personName = z.string().trim().min(1).max(80);

/** Small raster logo as a data URL (rendered with <img>, so no scripts). ~200 KB max. */
export const logoDataUrl = z
  .string()
  .max(280_000, 'Logo must be under 200 KB')
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Use a PNG, JPEG or WebP image');

export const setupInput = z.object({
  companyName: z.string().trim().min(1).max(80),
  name: personName,
  email: z.string().email(),
  password,
  role: z.enum(ROLES).default('executive'),
});

export const inviteInput = z.object({
  email: z.string().email(),
  accessRole: z.enum(ACCESS_ROLES).default('member'),
  role: z.enum(ROLES).default('sales'),
});

export const acceptInviteInput = z.object({ name: personName, password });

export const memberPatch = z.object({
  accessRole: z.enum(ACCESS_ROLES).optional(),
  role: z.enum(ROLES).optional(),
});

export const brandingInput = z.object({
  companyName: z.string().trim().min(1).max(80),
  logo: logoDataUrl.nullable(),
});

export interface SetupStatus {
  needsSetup: boolean;
  companyName: string;
  logo: string | null;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  accessRole: AccessRole;
  role: string;
  createdAt: string;
  questionsThisMonth: number;
}

export interface PendingInvite {
  token: string;
  email: string;
  accessRole: AccessRole;
  role: string;
  expiresAt: string;
}

// ---- Data sources ------------------------------------------------------------------
export const DATA_SOURCE_KINDS = ['sample', 'postgres', 'upload'] as const;
export type DataSourceKind = (typeof DATA_SOURCE_KINDS)[number];

export const pgConnectionInput = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().trim().min(1).max(128),
  user: z.string().trim().min(1).max(128),
  password: z.string().max(512),
  ssl: z.boolean().default(false),
});
export type PgConnectionInput = z.infer<typeof pgConnectionInput>;

export const createDataSourceInput = z.object({
  name: z.string().trim().min(1).max(80),
  connection: pgConnectionInput,
  allowedTables: z.array(z.string().regex(/^[^.]+\.[^.]+$/)).min(1, 'Pick at least one table').max(500),
});

export const updateDataSourceInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  allowedTables: z.array(z.string().regex(/^[^.]+\.[^.]+$/)).min(1).max(500).optional(),
  notes: z.string().max(4000).optional(),
  /** Leave out to keep the saved password. */
  connection: pgConnectionInput.partial({ password: true }).optional(),
});

export const glossaryInput = z.object({
  terms: z
    .array(z.object({ term: z.string().trim().min(1).max(80), definition: z.string().trim().min(1).max(500) }))
    .max(100),
});

export interface TableSummary {
  schema: string;
  table: string;
  rows: number;
  columns: { name: string; type: string }[];
}

export interface DataSourceInfo {
  id: number;
  name: string;
  kind: DataSourceKind;
  isActive: boolean;
  /** Connection details without the password. */
  config: { host?: string; port?: number; database?: string; user?: string; ssl?: boolean };
  allowedTables: string[];
  notes: string;
  updatedAt: string;
}

export interface ConnectionCheckResult {
  ok: boolean;
  error?: string;
  canWrite?: boolean;
  isSuperuser?: boolean;
  tables?: TableSummary[];
}

export const createChatInput = z.object({
  title: z.string().max(200).optional(),
  /** Start the chat from an existing chart ("Ask about this chart"). */
  contextChart: chartSpec.optional(),
});

export const feedbackInput = z.object({
  messageId: z.string(),
  rating: z.enum(['up', 'down']),
  reasons: z
    .array(z.enum(Object.keys(FEEDBACK_REASONS) as [FeedbackReason, ...FeedbackReason[]]))
    .max(6)
    .optional(),
  comment: z.string().max(1000).optional(),
});

export const pinWidgetInput = z.object({
  dashboardId: z.number().int().optional(),
  dashboardName: z.string().min(1).max(80).optional(),
  chatId: z.string().optional(),
  chart: chartSpec,
});

export interface ChatListItem {
  id: string;
  title: string;
  isSaved: boolean;
  groupId: number | null;
  updatedAt: string;
}

export interface SuggestedQuestions {
  recent: string[];
  roleBased: string[];
  role: string;
  /** Which kind of data questions are answered from (changes home-page wording). */
  sourceKind: 'sample' | 'postgres' | 'upload';
  sourceName: string;
}


/**
 * Long -> wide pivot for multi-series charts.
 * rows [{month, region, total}] with seriesKey=region -> [{month, West: n, East: n}]
 */
export function toWide(spec: ChartSpec): { rows: Row[]; yKeys: string[] } {
  if (!spec.seriesKey) return { rows: spec.rows, yKeys: spec.yKeys };
  const y = spec.yKeys[0];
  const byX = new Map<string, Row>();
  const series: string[] = [];
  for (const r of spec.rows) {
    const x = String(r[spec.xKey]);
    const s = String(r[spec.seriesKey]);
    if (!series.includes(s)) series.push(s);
    const row = byX.get(x) ?? { [spec.xKey]: r[spec.xKey] };
    row[s] = r[y];
    byX.set(x, row);
  }
  return { rows: [...byX.values()], yKeys: series };
}
