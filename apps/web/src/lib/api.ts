import type {
  ChartSpec,
  ChatListItem,
  Collection,
  ConnectionCheckResult,
  DataSourceInfo,
  InsightInfo,
  PgConnectionInput,
  TableSummary,
  Member,
  PendingInvite,
  SetupStatus,
  PublicShare,
  ShareLinkInfo,
  SubscriptionInfo,
  SubscriptionInput,
  SuggestedQuestions,
} from '@chatboat/shared';
import type { UIMessage } from 'ai';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    // An expired session on the home page shows the landing page; elsewhere, sign in again.
    const here = window.location.pathname;
    window.location.href = here === '/' ? '/welcome' : `/login?next=${encodeURIComponent(here)}`;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export interface ChatDetail {
  chat: { id: string; title: string; isSaved: boolean; groupId: number | null; context: ChartSpec | null };
  messages: UIMessage[];
}
export interface UsageSummary {
  today: { used: number; limit: number };
  month: {
    questions: number;
    failed: number;
    inputTokens: number;
    outputTokens: number;
    avgSeconds: number | null;
    estimatedCost: number | null;
  };
  days: { day: string; questions: number }[];
}
export interface DashboardSummary { id: number; name: string; widgetCount: number; createdAt: string }
export interface Widget { id: number; dashboardId: number; chatId: string | null; chart: ChartSpec; sql: string | null }
export interface DashboardDetail { id: number; name: string; widgets: Widget[] }

export interface Branding {
  companyName: string;
  logo: string | null;
}

export const api = {
  setupStatus: () => request<SetupStatus>('/setup/status'),
  setup: (body: { companyName: string; name: string; email: string; password: string; role: string }) =>
    request<unknown>('/setup', { method: 'POST', body: JSON.stringify(body) }),
  invitation: (token: string) => request<{ email: string; companyName: string }>(`/invitations/${token}`),
  acceptInvitation: (token: string, body: { name: string; password: string }) =>
    request<unknown>(`/invitations/${token}/accept`, { method: 'POST', body: JSON.stringify(body) }),
  adminMembers: () => request<{ members: Member[]; pending: PendingInvite[]; emailConfigured: boolean }>('/admin/members'),
  invite: (body: { email: string; accessRole: string; role: string }) =>
    request<{ link: string; emailed: boolean }>('/admin/invitations', { method: 'POST', body: JSON.stringify(body) }),
  revokeInvite: (token: string) => request<void>(`/admin/invitations/${token}`, { method: 'DELETE' }),
  updateMember: (id: string, body: { accessRole?: string; role?: string }) =>
    request<void>(`/admin/members/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  removeMember: (id: string) => request<void>(`/admin/members/${id}`, { method: 'DELETE' }),
  dataSources: () => request<DataSourceInfo[]>('/admin/data-sources'),
  checkConnection: (body: PgConnectionInput) =>
    request<ConnectionCheckResult>('/admin/data-sources/check', { method: 'POST', body: JSON.stringify(body) }),
  checkMongo: (body: { uri: string; database: string }) =>
    request<ConnectionCheckResult>('/admin/data-sources/check-mongo', { method: 'POST', body: JSON.stringify(body) }),
  createMongoSource: (body: { name: string; connection: { uri: string; database: string }; collections: string[] }) =>
    request<DataSourceInfo>('/admin/data-sources/mongodb', { method: 'POST', body: JSON.stringify(body) }),
  createDataSource: (body: { name: string; connection: PgConnectionInput; allowedTables: string[] }) =>
    request<DataSourceInfo>('/admin/data-sources', { method: 'POST', body: JSON.stringify(body) }),
  updateDataSource: (id: number, body: { name?: string; allowedTables?: string[]; notes?: string }) =>
    request<DataSourceInfo>(`/admin/data-sources/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  activateDataSource: (id: number) => request<DataSourceInfo>(`/admin/data-sources/${id}/activate`, { method: 'POST' }),
  deleteDataSource: (id: number) => request<void>(`/admin/data-sources/${id}`, { method: 'DELETE' }),
  dataSourceSchema: (id: number) => request<{ doc: string; tables: TableSummary[] }>(`/admin/data-sources/${id}/schema`),
  uploadSpreadsheet: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/uploads', { method: 'POST', body: form, credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, body.error ?? 'Upload failed');
    return body as { sourceId: number; tables: { table: string; rows: number; columns: { name: string; type: string }[] }[] };
  },
  deleteUploadedTable: (table: string) => request<void>(`/admin/uploads/${encodeURIComponent(table)}`, { method: 'DELETE' }),
  glossary: () => request<{ terms: { term: string; definition: string }[] }>('/admin/glossary'),
  saveGlossary: (terms: { term: string; definition: string }[]) =>
    request<{ terms: { term: string; definition: string }[] }>('/admin/glossary', { method: 'PUT', body: JSON.stringify({ terms }) }),
  saveBranding: (body: Branding) => request<Branding>('/admin/branding', { method: 'PUT', body: JSON.stringify(body) }),

  listChats: (q?: string) => request<ChatListItem[]>(`/chats${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createChat: (body: { title?: string; contextChart?: ChartSpec } = {}) =>
    request<{ id: string }>('/chats', { method: 'POST', body: JSON.stringify(body) }),
  getChat: (id: string) => request<ChatDetail>(`/chats/${id}`),
  updateChat: (id: string, patch: { title?: string; isSaved?: boolean; groupId?: number | null }) =>
    request(`/chats/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteChat: (id: string) => request<void>(`/chats/${id}`, { method: 'DELETE' }),
  listCollections: () => request<Collection[]>('/collections'),
  createCollection: (name: string) =>
    request<Collection>('/collections', { method: 'POST', body: JSON.stringify({ name }) }),
  renameCollection: (id: number, name: string) =>
    request<void>(`/collections/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteCollection: (id: number) => request<void>(`/collections/${id}`, { method: 'DELETE' }),
  getShare: (kind: 'chat' | 'dashboard', id: string) =>
    request<ShareLinkInfo | null>(`/shares?kind=${kind}&id=${encodeURIComponent(id)}`),
  createShare: (kind: 'chat' | 'dashboard', id: string) =>
    request<ShareLinkInfo>('/shares', { method: 'POST', body: JSON.stringify({ kind, id }) }),
  revokeShare: (token: string) => request<void>(`/shares/${token}`, { method: 'DELETE' }),
  publicShare: (token: string) => request<PublicShare>(`/public/shares/${token}`),
  listSubscriptions: (dashboardId?: number) =>
    request<{ emailConfigured: boolean; subscriptions: SubscriptionInfo[] }>(
      `/subscriptions${dashboardId ? `?dashboardId=${dashboardId}` : ''}`
    ),
  createSubscription: (body: SubscriptionInput) =>
    request<SubscriptionInfo>('/subscriptions', { method: 'POST', body: JSON.stringify(body) }),
  updateSubscription: (id: number, body: SubscriptionInput | { isActive: boolean }) =>
    request<SubscriptionInfo>(`/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSubscription: (id: number) => request<void>(`/subscriptions/${id}`, { method: 'DELETE' }),
  sendSubscription: (id: number) =>
    request<{ ok: boolean; sentTo?: string; error?: string }>(`/subscriptions/${id}/send`, { method: 'POST' }),
  usage: () => request<UsageSummary>('/usage'),
  insights: () => request<InsightInfo[]>('/insights'),
  refreshInsights: () => request<InsightInfo[]>('/insights/refresh', { method: 'POST' }),
  suggestions: () => request<SuggestedQuestions>('/suggestions'),
  feedback: (body: { messageId: string; rating: 'up' | 'down'; reasons?: string[]; comment?: string }) =>
    request<void>('/feedback', { method: 'POST', body: JSON.stringify(body) }),
  listDashboards: () => request<DashboardSummary[]>('/dashboards'),
  getDashboard: (id: number) => request<DashboardDetail>(`/dashboards/${id}`),
  renameDashboard: (id: number, name: string) =>
    request(`/dashboards/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteDashboard: (id: number) => request<void>(`/dashboards/${id}`, { method: 'DELETE' }),
  pinWidget: (body: { dashboardId?: number; dashboardName?: string; chatId?: string; chart: ChartSpec }) =>
    request<{ dashboardId: number }>('/dashboards/widgets', { method: 'POST', body: JSON.stringify(body) }),
  refreshWidget: (id: number) => request<Widget>(`/dashboards/widgets/${id}/refresh`, { method: 'POST' }),
  deleteWidget: (id: number) => request<void>(`/dashboards/widgets/${id}`, { method: 'DELETE' }),
};
