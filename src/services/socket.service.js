/**
 * Socket Service — Admin & Superuser
 *
 * Admin-specific real-time events:
 *  • inquiry:created    → prepend to inquiry list, badge on Dashboard
 *  • inquiry:updated    → patch inquiry in list / detail view
 *  • inquiry:assigned   → update list (status change)
 *  • location:update    → push salesperson GPS position to map store ref
 *  • device:blocked     → patch device in device list
 *  • device:unblocked   → patch device in device list
 *  • user:online        → mark salesperson as online on map
 *  • user:offline       → mark salesperson as offline on map
 *
 * Store references are injected via setStores() to avoid circular deps.
 * The socket authenticates using the admin JWT (same mechanism as sales).
 */
import { io } from 'socket.io-client';
import { CONFIG } from '@constants/config';
import { getAccessToken } from '@utils/storage';

// ─── Module-level singletons ──────────────────────────────────
let socket            = null;
let notificationStore = null;
let inquiryStore      = null;
let deviceStore       = null;
let groupStore        = null;
let onLocationUpdate  = null;  // callback: (locationData) => void  (used by LiveMap)

// ─── Store injection ──────────────────────────────────────────
export const setStores = ({ nStore, iStore, dStore, gStore }) => {
  notificationStore = nStore;
  inquiryStore      = iStore;
  deviceStore       = dStore;
  groupStore        = gStore;
};

/**
 * Register a callback for live location updates.
 * LiveMapScreen calls this on mount and clears on unmount.
 * Only one listener at a time (the map screen).
 */
export const setLocationListener = (cb) => { onLocationUpdate = cb; };
export const clearLocationListener = ()  => { onLocationUpdate = null; };

// ─── Connect ──────────────────────────────────────────────────
export const connect = (adminId) => {
  if (socket?.connected) return;

  socket = io(CONFIG.SOCKET_URL, {
    auth:                { token: getAccessToken() },
    transports:          ['websocket'],
    reconnection:        true,
    reconnectionDelay:   3000,
    reconnectionAttempts: 15,
  });

  // ── Lifecycle ──────────────────────────────────────────────
  socket.on('connect', () => {
    console.warn('[Admin Socket] connected:', socket.id);
    socket.emit('join', adminId);
    socket.emit('join:admin');
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Admin Socket] disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Admin Socket] error:', err.message);
  });

  // ── Inquiry events ─────────────────────────────────────────

  /** New inquiry created by another admin / uploaded in bulk */
  socket.on('inquiry:created', (data) => {
    console.warn('[Admin Socket] inquiry:created', data?.id);
    if (inquiryStore) inquiryStore.getState().prependInquiry(data);
    if (notificationStore) notificationStore.getState().incrementUnread();
  });

  /** Status / assignment changed on any inquiry */
  socket.on('inquiry:updated', (data) => {
    console.warn('[Admin Socket] inquiry:updated', data?.id);
    if (inquiryStore) inquiryStore.getState().updateInquiryInList(data);
  });

  /** Inquiry assigned / distributed to a salesperson */
  socket.on('inquiry:assigned', (data) => {
    console.warn('[Admin Socket] inquiry:assigned', data?.inquiryId);
    // Re-fetch unassigned bucket count
    if (inquiryStore) inquiryStore.getState().fetchUnassigned();
    // Push a notification item
    if (notificationStore) {
      notificationStore.getState().pushNotification({
        id:        Date.now().toString(),
        title:     data?.title     ?? 'Inquiry Assigned',
        body:      data?.body      ?? '',
        type:      'inquiry_assigned',
        data:      data ?? {},
        isRead:    false,
        createdAt: new Date().toISOString(),
      });
    }
  });

  // ── Location events ────────────────────────────────────────

  /** Live GPS update from a salesperson device */
  socket.on('location:update', (data) => {
    // Forward to LiveMapScreen callback if it's mounted
    if (onLocationUpdate) onLocationUpdate(data);
  });

  /** Salesperson came online */
  socket.on('user:online', (data) => {
    if (onLocationUpdate) onLocationUpdate({ ...data, isOnline: true });
  });

  /** Salesperson went offline */
  socket.on('user:offline', (data) => {
    if (onLocationUpdate) onLocationUpdate({ ...data, isOnline: false });
  });

  // ── Global group message handler ───────────────────────────
  // Runs on every screen — keeps unread counts up-to-date
  socket.on('group:message', (msg) => {
    if (groupStore) groupStore.getState().appendMessage(msg);
  });

  // ── Device events ──────────────────────────────────────────

  socket.on('device:blocked', (data) => {
    console.warn('[Admin Socket] device:blocked', data?.deviceId);
    if (deviceStore) deviceStore.getState().updateDeviceInList(data);
  });

  socket.on('device:unblocked', (data) => {
    console.warn('[Admin Socket] device:unblocked', data?.deviceId);
    if (deviceStore) deviceStore.getState().updateDeviceInList(data);
  });
};

// ─── Group room helpers ───────────────────────────────────────
export const joinGroup  = (groupId) => { if (socket?.connected) socket.emit('join:group',  groupId); };
export const leaveGroup = (groupId) => { if (socket?.connected) socket.emit('leave:group', groupId); };

export const onGroupMessage = (handler) => {
  if (!socket) return () => {};
  socket.on('group:message', handler);
  return () => socket.off('group:message', handler);
};

export const onGroupMessageEdited = (handler) => {
  if (!socket) return () => {};
  socket.on('group:message:edited', handler);
  return () => socket.off('group:message:edited', handler);
};

// ─── Disconnect ───────────────────────────────────────────────
export const disconnect = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const isConnected = () => socket?.connected ?? false;

export default {
  connect,
  disconnect,
  isConnected,
  setStores,
  setLocationListener,
  clearLocationListener,
  joinGroup,
  leaveGroup,
  onGroupMessage,
  onGroupMessageEdited,
};
