import type {
  AnalyticsOverview,
  Appointment,
  AppointmentsAnalytics,
  AvailableSlot,
  CallSummary,
  ChatResponse,
  HealthStatus,
  KnowledgeDocument,
  Lead,
  LeadsAnalytics,
  SentimentAnalytics,
  WorkspaceSettings,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = data.detail || data.message || detail;
    } catch {
      // Ignore parse error
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  baseUrl: API_BASE,

  getHealth: () => request<HealthStatus>('/api/health'),

  sendChat: (payload: {
    session_id?: string | null;
    message: string;
    language: 'en' | 'hi';
    channel: 'voice' | 'text';
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    company?: string;
  }) => request<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify(payload) }),

  getConversationMessages: (id: string) =>
    request<Array<{ id: number; role: 'user' | 'assistant'; content: string; language: string; sentiment?: string; sources: any[]; created_at: string }>>(
      `/api/conversations/${encodeURIComponent(id)}/messages`
    ),

  summarizeConversation: (id: string, markCompleted = true) =>
    request<{ conversation_id: string; status: string; summary: CallSummary }>(
      `/api/conversations/${encodeURIComponent(id)}/summary?mark_completed=${markCompleted}`,
      { method: 'POST' }
    ),

  listLeads: (params?: { search?: string; status?: string; sentiment?: string; sort_by?: string; sort_order?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status && params.status !== 'All') qs.set('status', params.status);
    if (params?.sentiment && params.sentiment !== 'All') qs.set('sentiment', params.sentiment);
    if (params?.sort_by) qs.set('sort_by', params.sort_by);
    if (params?.sort_order) qs.set('sort_order', params.sort_order);
    const query = qs.toString();
    return request<Lead[]>(`/api/leads${query ? `?${query}` : ''}`);
  },

  createLead: (payload: Partial<Lead>) =>
    request<Lead>('/api/leads', { method: 'POST', body: JSON.stringify(payload) }),

  updateLead: (id: number, payload: Partial<Lead>) =>
    request<Lead>(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteLead: (id: number) =>
    request<{ message: string }>(`/api/leads/${id}`, { method: 'DELETE' }),

  listAppointments: (params?: { search?: string; date?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.date) qs.set('date', params.date);
    if (params?.status && params.status !== 'All') qs.set('status', params.status);
    const query = qs.toString();
    return request<Appointment[]>(`/api/appointments${query ? `?${query}` : ''}`);
  },

  getAvailableSlots: (date?: string, duration = 30) => {
    const qs = new URLSearchParams({ duration_minutes: String(duration) });
    if (date) qs.set('date', date);
    return request<{ timezone: string; slots: AvailableSlot[] }>(`/api/appointments/slots/available?${qs.toString()}`);
  },

  createAppointment: (payload: {
    lead_id?: number | null;
    conversation_id?: string | null;
    customer_name: string;
    customer_email?: string;
    customer_phone?: string;
    company?: string;
    service_topic: string;
    scheduled_date: string;
    scheduled_time: string;
    duration_minutes?: number;
    confirmed_by_customer: boolean;
    notes?: string;
  }) => request<Appointment>('/api/appointments', { method: 'POST', body: JSON.stringify(payload) }),

  updateAppointment: (id: number, payload: Partial<Appointment>) =>
    request<Appointment>(`/api/appointments/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  cancelAppointment: (id: number) =>
    request<{ message: string }>(`/api/appointments/${id}`, { method: 'DELETE' }),

  listKnowledge: () => request<KnowledgeDocument[]>('/api/knowledge'),

  uploadKnowledgeFile: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<KnowledgeDocument>('/api/knowledge/upload', { method: 'POST', body: form });
  },

  addKnowledgeText: (title: string, content: string) =>
    request<KnowledgeDocument>('/api/knowledge/text', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    }),

  reindexKnowledge: () =>
    request<{ documents_indexed: number; total_documents: number; total_chunks: number }>('/api/knowledge/reindex', {
      method: 'POST',
    }),

  deleteKnowledge: (id: number) =>
    request<{ message: string; total_chunks: number }>(`/api/knowledge/${id}`, { method: 'DELETE' }),

  getAnalyticsOverview: () => request<AnalyticsOverview>('/api/analytics/overview'),
  getAnalyticsLeads: () => request<LeadsAnalytics>('/api/analytics/leads'),
  getAnalyticsSentiment: () => request<SentimentAnalytics>('/api/analytics/sentiment'),
  getAnalyticsAppointments: () => request<AppointmentsAnalytics>('/api/analytics/appointments'),

  getSettings: () => request<WorkspaceSettings>('/api/settings'),
  updateSettings: (payload: WorkspaceSettings) =>
    request<WorkspaceSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  seedDemoData: () => request<{ seeded: boolean; message: string }>('/api/demo/seed', { method: 'POST' }),
};
