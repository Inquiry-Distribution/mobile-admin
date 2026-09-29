import { create } from 'zustand';

/** Shared offline flag for mobile-admin (synced by OfflineBanner / NetInfo). */
const useNetworkStore = create((set) => ({
  isOffline: false,
  setOffline: (v) => set({ isOffline: !!v }),
}));

export default useNetworkStore;
