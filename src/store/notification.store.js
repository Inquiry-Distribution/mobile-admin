/**
 * Notification Store — Admin & Superuser
 *
 * Handles:
 *  • Admin's own notification inbox (markRead, markAllRead)
 *  • Sending push notifications to salespersons (send / broadcast)
 *  • Real-time badge count incremented by socket & FCM
 */
import { create } from 'zustand';
import { notificationApi } from '@api/notification.api';

const useNotificationStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────────────────
  notifications: [],
  unreadCount:   0,

  // Loading
  isLoading:    false,
  isRefreshing: false,
  isSending:    false,
  error:        null,

  // ─── Fetch notifications (inbox) ─────────────────────────────
  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const res           = await notificationApi.getMy();
      const notifications = res.data ?? res ?? [];
      const unreadCount   = notifications.filter((n) => !n.isRead).length;
      set({ notifications, unreadCount, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // ─── Pull-to-refresh ─────────────────────────────────────────
  refreshNotifications: async () => {
    set({ isRefreshing: true });
    try {
      const res           = await notificationApi.getMy();
      const notifications = res.data ?? res ?? [];
      const unreadCount   = notifications.filter((n) => !n.isRead).length;
      set({ notifications, unreadCount, isRefreshing: false });
    } catch (_) {
      set({ isRefreshing: false });
    }
  },

  // ─── Mark single read (optimistic) ───────────────────────────
  markRead: async (id) => {
    const prev = get().notifications;

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await notificationApi.markRead(id);
    } catch (_) {
      // Revert on server failure
      set({ notifications: prev, unreadCount: prev.filter((n) => !n.isRead).length });
    }
  },

  // ─── Mark all read (optimistic) ──────────────────────────────
  markAllRead: async () => {
    const prev = get().notifications;

    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    }));

    try {
      await notificationApi.markAllRead();
    } catch (_) {
      set({ notifications: prev, unreadCount: prev.filter((n) => !n.isRead).length });
    }
  },

  // ─── Send notification to specific users ─────────────────────
  send: async (payload) => {
    set({ isSending: true, error: null });
    try {
      const res = await notificationApi.send(payload);
      set({ isSending: false });
      return { success: true, data: res.data ?? res };
    } catch (err) {
      set({ isSending: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  // ─── Broadcast to ALL salespersons ───────────────────────────
  broadcast: async (payload) => {
    set({ isSending: true, error: null });
    try {
      const res = await notificationApi.broadcast(payload);
      set({ isSending: false });
      return { success: true, data: res.data ?? res };
    } catch (err) {
      set({ isSending: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  // ─── Real-time injection (FCM foreground / socket) ───────────
  pushNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount:   state.unreadCount + 1,
    }));
  },

  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),

  clearError: () => set({ error: null }),
}));

export default useNotificationStore;
