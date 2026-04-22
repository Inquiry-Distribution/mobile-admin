/**
 * Inquiry Desk Admin — Root App Component
 * Roles: admin | superuser
 */
import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import Toast from 'react-native-toast-message';

import { COLORS } from '@constants/colors';
import RootNavigator from '@navigation/index';
import ErrorBoundary from '@components/common/ErrorBoundary';
import OfflineBanner from '@components/common/OfflineBanner';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <ErrorBoundary>
            <StatusBar
              backgroundColor={COLORS.primary}
              barStyle="light-content"
            />
            <RootNavigator />
            {/* OfflineBanner sits above Toast so it appears under toasts */}
            <OfflineBanner />
            <Toast />
          </ErrorBoundary>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
