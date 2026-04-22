/**
 * Notification API — Admin & Superuser
 *
 * Send and manage push notifications.
 * Routes: /api/v1/notifications/*
 */
import client from './client';
import { buildQuery } from '@utils/helpers';
import { CONFIG } from '@constants/config';

export const notificationApi = {
  // ─── Inbox ──────────────────────────────────────────────────

  /**
   * Get notifications sent to the current admin user.
   * @param {{ page?, limit?, isRead? }} params
   */
  getMy: (params = {}) =>
    client.get(`/notifications${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`),

  /**
   * Mark a single notification as read.
   */
  markRead: (id) => client.patch(`/notifications/${id}/read`),

  /**
   * Mark all notifications as read.
   */
  markAllRead: () => client.patch('/notifications/read-all'),

  // ─── Sending ────────────────────────────────────────────────

  /**
   * Send a push notification to one or more specific users.
   * Payload: {
   *   recipientIds: string[],
   *   title: string,
   *   body: string,
   *   type?: 'inquiry_assigned' | 'alert' | 'general' | ...,
   *   data?: Record<string, any>
   * }
   */
  send: (payload) => client.post('/notifications/send', payload),

  /**
   * Broadcast a push notification to ALL active salespersons.
   * Payload: { title, body, type?, data? }
   */
  broadcast: (payload) => client.post('/notifications/broadcast', payload),
};
