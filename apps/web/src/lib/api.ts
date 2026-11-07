import type {
  ChartSpec,
  ChatListItem,
  Collection,
  InsightInfo,
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
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
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
