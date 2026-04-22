/**
 * Navigation Ref — Admin App
 *
 * Allows navigation from outside React components:
 *  • Axios 401 interceptor → back to Login
 *  • FCM background tap    → deep-link to Inquiry / Notification
 *  • Socket events         → auto-navigate on certain admin alerts
 */
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

// ─── Generic helpers ──────────────────────────────────────────
export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

export function resetToLogin() {
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
  }
}

// ─── Deep-link: Inquiry Detail ────────────────────────────────
// Route: Tabs → Inquiries (stack) → InquiryDetail
export function navigateToInquiry(inquiryId) {
  if (!inquiryId || !navigationRef.isReady()) return;

  navigationRef.navigate('Tabs', {
    screen: 'Inquiries',
    params: {
      screen: 'InquiryDetail',
      params: { id: inquiryId },
    },
  });
}

// ─── Deep-link: Notifications screen ─────────────────────────
// Route: Tabs → More (stack) → Notifications
export function navigateToNotifications() {
  if (!navigationRef.isReady()) return;

  navigationRef.navigate('Tabs', {
    screen: 'More',
    params: { screen: 'Notifications' },
  });
}

// ─── FCM payload router ───────────────────────────────────────
export function handleNotificationNavigation(remoteMessage) {
  if (!remoteMessage) return;

  const { type, inquiryId } = remoteMessage.data ?? {};

  if (inquiryId) {
    navigateToInquiry(inquiryId);
    return;
  }

  if (type === 'alert' || type === 'general') {
    navigateToNotifications();
  }
}
