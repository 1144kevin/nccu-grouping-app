import { isAxiosError } from 'axios';
import { create } from 'zustand';
import { authToken } from '@/lib/api';
import { coreApi, coreError, type CoreSession, type CoreUser } from '@/lib/core-api';
import { queryClient } from '@/lib/query-client';
import { disablePushForLogout } from '@/lib/web-push';

type AuthState = {
  accountDeleted: boolean;
  user: CoreUser | null;
  ready: boolean;
  busy: boolean;
  error: string | null;
  restore: () => Promise<void>;
  authenticate: (
    mode: 'login' | 'register',
    email: string,
    password: string,
    name: string,
  ) => Promise<boolean>;
  logout: () => Promise<boolean>;
  expireSession: () => Promise<void>;
  acceptGoogleSession: (session: CoreSession) => Promise<boolean>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accountDeleted: false,
  user: null,
  ready: false,
  busy: false,
  error: null,
  acceptGoogleSession: async (session) => {
    if (get().busy || get().user || session.user.auth_mode !== 'supabase') return false;
    set({ busy: true, error: null });
    try {
      if (session.refresh_token) await authToken.setSession(session);
      else await authToken.set(session.access_token);
      queryClient.clear();
      set({ user: session.user, ready: true, accountDeleted: false });
      return true;
    } catch (error) {
      set({ error: coreError(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },
  expireSession: async () => {
    if (!get().user) return;
    set({ user: null, ready: true, error: '登入已失效，請重新登入。' });
    queryClient.clear();
    await authToken.clear();
  },
  restore: async () => {
    if (get().busy) return;
    set({ busy: true, error: null });
    try {
      if (await authToken.get()) set({ user: await coreApi.me() });
      else set({ user: null });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) await authToken.clear();
      set({ user: null, error: coreError(error) });
    } finally {
      set({ ready: true, busy: false });
    }
  },
  authenticate: async (mode, email, password, name) => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      const session =
        mode === 'register'
          ? await coreApi.register(email.trim(), password, name.trim())
          : await coreApi.login(email.trim(), password);
      if ('confirmation_required' in session) {
        set({
          error:
            '註冊請求已送出。請完成信箱驗證，再切換至登入；若未收到信，請確認開發專案的寄信設定。',
        });
        return false;
      }
      if (session.refresh_token) await authToken.setSession(session);
      else await authToken.set(session.access_token);
      queryClient.clear();
      set({ user: session.user, ready: true, accountDeleted: false });
      return true;
    } catch (error) {
      set({ error: coreError(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },
  logout: async () => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      await disablePushForLogout();
      await coreApi.logout();
      await authToken.clear();
      queryClient.clear();
      set({ user: null });
      return true;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        await authToken.clear();
        queryClient.clear();
        set({ user: null });
        return true;
      }
      set({ error: coreError(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },
}));

// Ignore responses from a form that completed after logout or an account switch.
export function applyProfileUpdate(updated: CoreUser): boolean {
  const current = useAuthStore.getState().user;
  if (!current || current.id !== updated.id || (updated.version ?? 1) < (current.version ?? 1))
    return false;
  useAuthStore.setState({ user: updated });
  return true;
}

export async function completeAccountDeletion(actor: string): Promise<void> {
  if (useAuthStore.getState().user?.id !== actor) return;
  await authToken.clear();
  if (useAuthStore.getState().user?.id !== actor) return;
  queryClient.clear();
  useAuthStore.setState({
    user: null,
    ready: true,
    busy: false,
    error: null,
    accountDeleted: true,
  });
}
