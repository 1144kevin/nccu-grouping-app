import { api } from './api';
export type DeletionCounts = {
  owned_posts: number;
  messages: number;
  images: number;
  participations: number;
  proposals: number;
};
export type DeletionStatus = {
  phase: 'none' | 'prepared' | 'deleting';
  recent_auth: boolean;
  counts: DeletionCounts;
};
export type DeletionPreview = {
  phase: 'prepared';
  challenge: string;
  expires_in: 600;
  counts: DeletionCounts;
};
export const accountDeletionApi = {
  status: async () => (await api.get<DeletionStatus>('/account/deletion')).data,
  preview: async () => (await api.post<DeletionPreview>('/account/deletion-preview')).data,
  delete: async (challenge?: string) =>
    (
      await api.delete<{ deleted: true }>('/account', {
        data: { confirmation: 'DELETE', ...(challenge ? { challenge } : {}) },
        timeout: 90_000,
      })
    ).data,
};
