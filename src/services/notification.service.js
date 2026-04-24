/**
 * Notification Service — Admin & Superuser
 *
 * Handles Firebase Cloud Messaging (FCM) for the admin device:
 *  • Requests notification permission on iOS
 *  • Receives foreground push messages → pushes to notification store
 *  • Handles background tap → navigates to relevant screen
 *  • Refreshes FCM token on rotation
 *
 * Note: Admin devices don't have a "deviceId" (no device registration).
 * FCM token is NOT synced back to the server — admin push is sent by
 * the server to the admin's user record directly via Firebase Admin SDK.
 * Token syncing can be added later if the backend requires it.
 */
import {
  getMessaging,
  getToken,
  requestPermission,
  onMessage,
  onTokenRefresh,
  onNotificationOpenedApp,
  getInitialNotification as fcmGetInitialNotification,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { handleNotificationNavigation } from '@navigation/navigationRef';

let notificationStore = null;

// ─── Store injection (breaks circular dep) ────────────────────
export const setNotificationStore = (store) => {
  notificationStore = store;
};

// ─── iOS permission request ───────────────────────────────────
export const requestFCMPermission = async () => {
  try {
    const status = await requestPermission(getMessaging());
    return (
      status === AuthorizationStatus.AUTHORIZED ||
      status === AuthorizationStatus.PROVISIONAL
    );
  } catch (_) {
    return false;
  }
};

// ─── Get FCM token (for debugging / manual send) ──────────────
export const getFCMToken = async () => {
  try {
    return await getToken(getMessaging());
  } catch (_) {
    return null;
  }
};

// ─── Process an incoming FCM message ──────────────────────────
function handleIncomingMessage(remoteMessage) {
  if (!notificationStore) return;

  // Group message pushes are real-time via socket — skip notification list
  if (remoteMessage.data?.groupId) return;

  const store     = notificationStore.getState();
  const title     = remoteMessage.notification?.title ?? remoteMessage.data?.title ?? 'Notification';
  const body      = remoteMessage.notification?.body  ?? remoteMessage.data?.body  ?? '';
  const type      = remoteMessage.data?.type      ?? 'general';
  const inquiryId = remoteMessage.data?.inquiryId ?? null;

  store.pushNotification({
    id:        remoteMessage.messageId ?? Date.now().toString(),
    title,
    body,
    type,
    data:      remoteMessage.data ?? {},
    isRead:    false,
    createdAt: new Date().toISOString(),
  });

  console.log('[Admin FCM] received:', type, inquiryId ?? '');
}

// ─── Setup all FCM listeners ──────────────────────────────────
export const setupNotificationListeners = () => {
  const m = getMessaging();

  // 1. Foreground message (app is open)
  const unsubForeground = onMessage(m, async (remoteMessage) => {
    handleIncomingMessage(remoteMessage);
  });

  // 2. Background tap (app backgrounded, user taps notification)
  const unsubBackgroundTap = onNotificationOpenedApp(m, (remoteMessage) => {
    console.log('[Admin FCM] background tap:', remoteMessage?.data);
    handleNotificationNavigation(remoteMessage);
  });

  // 3. Token refresh
  const unsubTokenRefresh = onTokenRefresh(m, (newToken) => {
    console.log('[Admin FCM] token refreshed:', newToken?.slice(0, 20));
  });

  return () => {
    unsubForeground();
    unsubBackgroundTap();
    unsubTokenRefresh();
  };
};

// ─── Cold-start: app opened from killed state via notification ─
export const getInitialNotification = async () => {
  try {
    return await fcmGetInitialNotification(getMessaging());
  } catch (_) {
    return null;
  }
};

export default {
  requestFCMPermission,
  getFCMToken,
  setupNotificationListeners,
  getInitialNotification,
  setNotificationStore,
};
