import type { ChartSpec, ChatListItem, SuggestedQuestions } from '@chatboat/shared';
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
  chat: { id: string; title: string; isSaved: boolean; groupId: number | null };
  messages: UIMessage[];
}
export interface DashboardSummary { id: number; name: string; widgetCount: number; createdAt: string }
export interface Widget { id: number; dashboardId: number; chatId: string | null; chart: ChartSpec; sql: string | null }
export interface DashboardDetail { id: number; name: string; widgets: Widget[] }

export const api = {
  listChats: (q?: string) => request<ChatListItem[]>(`/chats${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createChat: (title?: string) => request<{ id: string }>('/chats', { method: 'POST', body: JSON.stringify({ title }) }),
  getChat: (id: string) => request<ChatDetail>(`/chats/${id}`),
  updateChat: (id: string, patch: { title?: string; isSaved?: boolean }) =>
    request(`/chats/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteChat: (id: string) => request<void>(`/chats/${id}`, { method: 'DELETE' }),
  suggestions: () => request<SuggestedQuestions>('/suggestions'),
  feedback: (messageId: string, rating: 'up' | 'down') =>
    request<void>('/feedback', { method: 'POST', body: JSON.stringify({ messageId, rating }) }),
  listDashboards: () => request<DashboardSummary[]>('/dashboards'),
  getDashboard: (id: number) => request<DashboardDetail>(`/dashboards/${id}`),
  deleteDashboard: (id: number) => request<void>(`/dashboards/${id}`, { method: 'DELETE' }),
  pinWidget: (body: { dashboardId?: number; dashboardName?: string; chatId?: string; chart: ChartSpec }) =>
    request<{ dashboardId: number }>('/dashboards/widgets', { method: 'POST', body: JSON.stringify(body) }),
  refreshWidget: (id: number) => request<Widget>(`/dashboards/widgets/${id}/refresh`, { method: 'POST' }),
  deleteWidget: (id: number) => request<void>(`/dashboards/widgets/${id}`, { method: 'DELETE' }),
};
