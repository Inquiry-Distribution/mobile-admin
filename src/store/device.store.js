/**
 * Device Store — Admin & Superuser
 *
 * Manages registered mobile devices: list, block, unblock, reset.
 */
import { create } from 'zustand';
import { deviceApi } from '@api/device.api';
import { CONFIG } from '@constants/config';

const useDeviceStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────────────────
  devices:        [],
  selectedDevice: null,

  // Pagination
  page:    1,
  hasMore: true,
  total:   0,

  // Filters
  blockedFilter: null,   // null = all, true = blocked only, false = active only
  search:        '',

  // Loading
  isLoading:     false,
  isRefreshing:  false,
  isLoadingMore: false,
  isMutating:    false,
  error:         null,

  // ─── Fetch (page 1) ───────────────────────────────────────────
  fetchDevices: async () => {
    set({ isLoading: true, error: null, page: 1 });
    try {
      const params = buildParams(get(), 1);
      const res    = await deviceApi.getAll(params);
      const { data, pagination } = normalise(res);

      set({
        devices:   data,
        total:     pagination?.total  ?? data.length,
        hasMore:   pagination?.hasMore ?? data.length === CONFIG.PAGE_SIZE,
        page:      1,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // ─── Pull-to-refresh ─────────────────────────────────────────
  refreshDevices: async () => {
    set({ isRefreshing: true, page: 1 });
    try {
      const params = buildParams(get(), 1);
      const res    = await deviceApi.getAll(params);
      const { data, pagination } = normalise(res);

      set({
        devices:     data,
        total:       pagination?.total  ?? data.length,
        hasMore:     pagination?.hasMore ?? data.length === CONFIG.PAGE_SIZE,
        page:        1,
        isRefreshing: false,
      });
    } catch (_) {
      set({ isRefreshing: false });
    }
  },

  // ─── Infinite scroll ─────────────────────────────────────────
  loadMore: async () => {
    const { isLoadingMore, hasMore, page } = get();
    if (isLoadingMore || !hasMore) return;

    set({ isLoadingMore: true });
    try {
      const nextPage = page + 1;
      const params   = buildParams(get(), nextPage);
      const res      = await deviceApi.getAll(params);
      const { data, pagination } = normalise(res);

      set((state) => ({
        devices:       [...state.devices, ...data],
        page:          nextPage,
        hasMore:       pagination?.hasMore ?? data.length === CONFIG.PAGE_SIZE,
        isLoadingMore: false,
      }));
    } catch (_) {
      set({ isLoadingMore: false });
    }
  },

  // ─── Select single device ─────────────────────────────────────
  selectDevice: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await deviceApi.getById(id);
      set({ selectedDevice: res.data ?? res, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // ─── Block device ─────────────────────────────────────────────
  // Optimistic: mark blocked in list immediately, revert on failure.
  block: async (id, reason) => {
    set({ isMutating: true });
    const prev = get().devices;

    // Optimistic update
    set((state) => ({
      devices:        patchById(state.devices, id, { isBlocked: true }),
      selectedDevice: state.selectedDevice?.id === id
        ? { ...state.selectedDevice, isBlocked: true }
        : state.selectedDevice,
    }));

    try {
      const res     = await deviceApi.block(id, reason);
      const updated = res.data ?? res;

      set((state) => ({
        devices:        replaceById(state.devices, id, updated),
        selectedDevice: state.selectedDevice?.id === id ? updated : state.selectedDevice,
        isMutating:     false,
      }));
      return { success: true };
    } catch (err) {
      // Revert
      set({ devices: prev, isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Unblock device ───────────────────────────────────────────
  unblock: async (id) => {
    set({ isMutating: true });
    const prev = get().devices;

    // Optimistic update
    set((state) => ({
      devices:        patchById(state.devices, id, { isBlocked: false }),
      selectedDevice: state.selectedDevice?.id === id
        ? { ...state.selectedDevice, isBlocked: false }
        : state.selectedDevice,
    }));

    try {
      const res     = await deviceApi.unblock(id);
      const updated = res.data ?? res;

      set((state) => ({
        devices:        replaceById(state.devices, id, updated),
        selectedDevice: state.selectedDevice?.id === id ? updated : state.selectedDevice,
        isMutating:     false,
      }));
      return { success: true };
    } catch (err) {
      set({ devices: prev, isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Reset device (delete registration) ───────────────────────
  resetBySalesperson: async (salespersonId) => {
    set({ isMutating: true });
    try {
      await deviceApi.resetBySalesperson(salespersonId);
      // Remove from list
      set((state) => ({
        devices:    state.devices.filter((d) => d.salespersonId !== salespersonId),
        isMutating: false,
      }));
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Real-time socket inject ──────────────────────────────────
  // Called by socket.service when device:blocked / device:unblocked fires
  updateDeviceInList: (updatedDevice) =>
    set((state) => ({
      devices:        replaceById(state.devices, updatedDevice.id, updatedDevice),
      selectedDevice: state.selectedDevice?.id === updatedDevice.id
        ? updatedDevice
        : state.selectedDevice,
    })),

  // ─── Filter helpers ───────────────────────────────────────────
  setSearch:        (search)        => set({ search }),
  setBlockedFilter: (blockedFilter) => set({ blockedFilter }),
  clearFilters:     ()              => set({ search: '', blockedFilter: null }),

  clearSelected: () => set({ selectedDevice: null }),
  clearError:    () => set({ error: null }),
}));

// ─── Internal helpers ──────────────────────────────────────────
function buildParams(state, page) {
  const params = { page };
  if (state.search)                          params.search    = state.search;
  if (state.blockedFilter !== null)          params.isBlocked = state.blockedFilter;
  return params;
}

function normalise(res) {
  if (Array.isArray(res.data)) return { data: res.data, pagination: res.pagination ?? null };
  if (Array.isArray(res))      return { data: res,      pagination: null };
  return { data: [], pagination: null };
}

function replaceById(list, id, updated) {
  return list.map((item) => (item.id === id ? updated : item));
}

function patchById(list, id, patch) {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export default useDeviceStore;
