import {
  AlertItem,
  AuthResponse,
  DashboardStats,
  GestureMapping,
  HistoryItem,
  MonitoringLive,
  ProfileSettings,
} from '@/types';

function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return 'http://172.20.10.4:4000';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${path}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  login(email: string, password: string) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  getDashboardStats() {
    return request<DashboardStats>('/dashboard/stats');
  },
  getMonitoringLive() {
    return request<MonitoringLive>('/monitoring/live');
  },
  getMappings() {
    return request<GestureMapping[]>('/mappings');
  },
  getHistory(params?: { date?: string; gesture?: string; result?: string }) {
    const search = new URLSearchParams();
    if (params?.date) search.set('date', params.date);
    if (params?.gesture) search.set('gesture', params.gesture);
    if (params?.result) search.set('result', params.result);
    const query = search.toString();
    return request<HistoryItem[]>(`/history${query ? `?${query}` : ''}`);
  },
  getAlerts() {
    return request<AlertItem[]>('/alerts');
  },
  resolveAlert(id: string) {
    return request<AlertItem>(`/alerts/${id}/resolve`, { method: 'PATCH' });
  },
  getProfile() {
    return request<ProfileSettings>('/settings/profile');
  },
};
