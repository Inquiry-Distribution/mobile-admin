import Toast from 'react-native-toast-message';
import useNetworkStore from '@store/network.store';

/**
 * Returns true when online. When offline, shows a toast and returns false.
 */
export function requireOnline(message = 'Connect to the internet to continue.') {
  const isOffline = useNetworkStore.getState().isOffline;
  if (!isOffline) return true;
  Toast.show({
    type:           'error',
    text1:          'You are offline',
    text2:          message,
    visibilityTime: 3500,
    position:       'top',
  });
  return false;
}

export function useIsOffline() {
  return useNetworkStore((s) => s.isOffline);
}
