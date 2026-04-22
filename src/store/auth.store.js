/**
 * Auth Store — Admin & Superuser
 *
 * Login flow: email + password (POST /auth/login)
 * No device registration — admin uses web-panel credentials.
 *
 * Wires forceLogout into the Axios client so the 401 interceptor
 * can trigger a clean logout from anywhere in the app.
 */
import { create } from 'zustand';
import { authApi } from '@api/auth.api';
import { setForceLogout } from '@api/client';
import {
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  setUser,
  getUser,
  clearAuth,
} from '@utils/storage';

const useAuthStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────────────────
  user:      getUser(),          // persisted across app restarts
  token:     getAccessToken(),
  isReady:   false,              // prevents flicker on cold start
  isLoading: false,
  error:     null,

  // ─── Init ─────────────────────────────────────────────────────
  // Called once in RootNavigator on mount.
  // Wires the forceLogout callback into the Axios client.
  init: () => {
    setForceLogout(() => get().forceLogout());
    set({ isReady: true });
  },

  // ─── Login ────────────────────────────────────────────────────
  // Returns { success, message? } — callers decide what to show.
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);
      const { token, refreshToken, user } = res.data;

      // Validate role — reject sales accounts on this app
      if (!['admin', 'superuser'].includes(user?.role)) {
        set({ isLoading: false, error: 'Access denied. Admin account required.' });
        return { success: false, message: 'Access denied. Admin account required.' };
      }

      setAccessToken(token);
      setRefreshToken(refreshToken);
      setUser(user);

      set({ token, user, isLoading: false });
      return { success: true };
    } catch (err) {
      const message = err.message || 'Login failed. Please check your credentials.';
      set({ isLoading: false, error: message });
      return { success: false, message };
    }
  },

  // ─── Fetch / refresh profile ──────────────────────────────────
  fetchProfile: async () => {
    try {
      const res  = await authApi.getMe();
      const user = res.data;
      setUser(user);
      set({ user });
    } catch (_) {
      // Silent — best-effort refresh
    }
  },

  // ─── Logout ───────────────────────────────────────────────────
  logout: async () => {
    try {
      await authApi.logout();
    } catch (_) {
      // Always clear local state even if server call fails
    } finally {
      clearAuth();
      set({ user: null, token: null, error: null });
    }
  },

  // ─── Force logout (called by Axios 401 interceptor) ──────────
  forceLogout: () => {
    clearAuth();
    set({ user: null, token: null, error: null });
  },

  // ─── Role helpers ─────────────────────────────────────────────
  isSuperuser:        () => get().user?.role === 'superuser',
  isAdmin:            () => get().user?.role === 'admin',
  isAdminOrSuperuser: () => ['admin', 'superuser'].includes(get().user?.role),

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
