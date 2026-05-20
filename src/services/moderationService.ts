import api from './api';
import type { ApiUser } from './authService';

export interface ApiBan {
  id: string;
  user: ApiUser;
  banned_by: ApiUser;
  unbanned_by: ApiUser | null;
  reason: string;
  /** Specific message/content that triggered the ban — shown highlighted in UI. */
  trigger_message: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  unbanned_at: string | null;
}

export interface BanPayload {
  user_id: string;
  reason: string;
  trigger_message?: string;
}

// ─── BanRequest (redator solicita, admin decide) ───────────────────────

export type BanRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ApiBanRequest {
  id: string;
  target: ApiUser;
  requested_by: ApiUser | null;
  reason: string;
  trigger_message: string;
  status: BanRequestStatus;
  decided_by: ApiUser | null;
  decided_at: string | null;
  decision_note: string;
  created_at: string;
}

export interface BanRequestPayload {
  target_id: string;
  reason: string;
  trigger_message?: string;
}

export interface BanRequestDecisionPayload {
  action: 'approve' | 'reject';
  decision_note?: string;
}

const moderationService = {
  // ─── Direct bans (admin only) ────────────────────────────
  listUsers: (params?: Record<string, string>) =>
    api.get<{ results: ApiUser[]; count: number }>('/api/auth/users/', {
      params,
    }),

  listBans: (params?: Record<string, string>) =>
    api.get<{ results: ApiBan[]; count: number }>('/api/moderation/bans/', {
      params,
    }),

  ban: (payload: BanPayload) =>
    api.post<ApiBan>('/api/moderation/bans/', payload),

  unban: (banId: string) => api.delete(`/api/moderation/bans/${banId}/`),

  // ─── BanRequests (editor solicita / admin decide) ────────
  listBanRequests: (params?: Record<string, string>) =>
    api.get<{ results: ApiBanRequest[]; count: number }>(
      '/api/moderation/ban-requests/',
      { params },
    ),

  createBanRequest: (payload: BanRequestPayload) =>
    api.post<ApiBanRequest>('/api/moderation/ban-requests/', payload),

  decideBanRequest: (id: string, payload: BanRequestDecisionPayload) =>
    api.post<ApiBanRequest>(
      `/api/moderation/ban-requests/${id}/decide/`,
      payload,
    ),
};

export default moderationService;
