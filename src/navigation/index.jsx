/**
 * RootNavigator — Admin App
 *
 * Responsibilities:
 *  1. Wait for auth.store.init() before rendering (prevents login flicker)
 *  2. Show AuthNavigator (Login) when no token
 *  3. Show AppNavigator (tabs) when authenticated
 *  4. Connect Socket.io after login; disconnect on logout
 *  5. Wire FCM notification listeners
 *  6. Handle cold-start deep-links from FCM (app opened from killed state)
 */
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import RNBootSplash from 'react-native-bootsplash';

import useAuthStore         from '@store/auth.store';
import useNotificationStore from '@store/notification.store';
import useInquiryStore      from '@store/inquiry.store';
import useDeviceStore       from '@store/device.store';

import socketService, { setStores } from '@services/socket.service';
import notificationService, {
  setNotificationStore,
} from '@services/notification.service';

import { navigationRef, handleNotificationNavigation } from './navigationRef';
import AuthNavigator from './AuthNavigator';
import AppNavigator  from './AppNavigator';

import { COLORS } from '@constants/colors';

export default function RootNavigator() {
  const { token, user, isReady, init } = useAuthStore();

  // ── Boot ───────────────────────────────────────────────────
  useEffect(() => {
    init();
  }, []);


  // ── Socket + FCM wiring (runs whenever auth state changes) ─
  useEffect(() => {
    if (!token || !user) return;

    // 1. Inject store refs into socket service
    setStores({
      nStore: useNotificationStore,
      iStore: useInquiryStore,
      dStore: useDeviceStore,
    });

    // 2. Connect socket
    socketService.connect(user.id);

    // 3. Wire FCM notification store
    setNotificationStore(useNotificationStore);

    // 4. Setup FCM listeners (foreground + background tap + token refresh)
    const unsubscribeFCM = notificationService.setupNotificationListeners();

    // 5. Request FCM permission on iOS (no-op on Android)
    notificationService.requestFCMPermission();

    return () => {
      unsubscribeFCM();
      socketService.disconnect();
    };
  }, [token, user]);

  // ── Cold-start deep-link (app killed → user taps notification) ─
  // Also the correct place to hide the splash — fires only after
  // the first route has painted, so no blank-frame flicker.
  const onNavigationReady = async () => {
    await RNBootSplash.hide({ fade: true });
    const initialMessage = await notificationService.getInitialNotification();
    if (initialMessage) handleNotificationNavigation(initialMessage);
  };

  // ── Splash / init guard ────────────────────────────────────
  // init() is synchronous so isReady flips on the very first re-render.
  // Hide the splash here only as a safety fallback if NavigationContainer
  // never mounts (e.g. a very fast synchronous boot).
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color={COLORS.white} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={onNavigationReady}>
      {token ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
