/**
 * User Store — Admin & Superuser
 *
 * Manages the full user/salesperson roster.
 * `salespersons` is a lean list used by distribute / reassign dropdowns.
 */
import { create } from 'zustand';
import { userApi } from '@api/user.api';
import { CONFIG } from '@constants/config';

const DEFAULT_FILTERS = {
  search: '',
  role: 'sales',     // '' | 'admin' | 'sales' | 'superuser'
  isActive: '',     // '' | 'true' | 'false'
};

const useUserStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────────────────
  users: [],
  salespersons: [],     // role=sales only — for dropdowns
  selectedUser: null,

  // Pagination
  page: 1,
  hasMore: true,
  total: 0,

  // Unified filter object (matches UserListScreen usage)
  filters: { ...DEFAULT_FILTERS },

  // Loading
  isLoading: false,
  isLoadingDetail: false,   // used by UserDetailScreen
  isRefreshing: false,
  isLoadingMore: false,
  isMutating: false,
  isLoadingSalespersons: false,
  error: null,

  // ─── Fetch users (page 1) ─────────────────────────────────────
  fetchUsers: async () => {
    set({ isLoading: true, error: null, page: 1 });
    try {
      const params = buildParams(get().filters, 1);
      const res = await userApi.getAll(params);
      const { data, pagination } = normalise(res);

      set({
        users: data,
        total: pagination?.total ?? data.length,
        hasMore: pagination?.hasMore ?? data.length === CONFIG.PAGE_SIZE,
        page: 1,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // ─── Pull-to-refresh ─────────────────────────────────────────
  refreshUsers: async () => {
    set({ isRefreshing: true, page: 1 });
    try {
      const params = buildParams(get().filters, 1);
      const res = await userApi.getAll(params);
      const { data, pagination } = normalise(res);

      set({
        users: data,
        total: pagination?.total ?? data.length,
        hasMore: pagination?.hasMore ?? data.length === CONFIG.PAGE_SIZE,
        page: 1,
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
      const params = buildParams(get().filters, nextPage);
      const res = await userApi.getAll(params);
      const { data, pagination } = normalise(res);

      set((state) => ({
        users: [...state.users, ...data],
        page: nextPage,
        hasMore: pagination?.hasMore ?? data.length === CONFIG.PAGE_SIZE,
        isLoadingMore: false,
      }));
    } catch (_) {
      set({ isLoadingMore: false });
    }
  },

  // ─── Salesperson dropdown list (all active sales) ─────────────
  fetchSalespersons: async () => {
    set({ isLoadingSalespersons: true });
    try {
      const res = await userApi.getSalespersons({ isActive: true, limit: 200 });
      const { data } = normalise(res);
      set({ salespersons: data, isLoadingSalespersons: false });
    } catch (_) {
      set({ isLoadingSalespersons: false });
    }
  },

  // ─── Fetch single user for detail screen ─────────────────────
  // Called by UserDetailScreen on mount and on pull-to-refresh.
  fetchUser: async (id) => {
    set({ isLoadingDetail: true, error: null });
    try {
      const res = await userApi.getById(id);
      set({ selectedUser: res.data ?? res, isLoadingDetail: false });
    } catch (err) {
      set({ error: err.message, isLoadingDetail: false });
    }
  },

  // ─── Toggle active / inactive ─────────────────────────────────
  toggleStatus: async (id) => {
    set({ isMutating: true });
    try {
      const res = await userApi.toggleStatus(id);
      const updated = res.data ?? res;

      set((state) => ({
        users: replaceById(state.users, id, updated),
        selectedUser: state.selectedUser?.id === id
          ? { ...state.selectedUser, ...updated }
          : state.selectedUser,
        isMutating: false,
      }));
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Set PIN ──────────────────────────────────────────────────
  setPin: async (id, pin) => {
    set({ isMutating: true });
    try {
      await userApi.setPin(id, pin);
      // Update selectedUser pin flag
      set((state) => ({
        isMutating: false,
        selectedUser: state.selectedUser?.id === id
          ? { ...state.selectedUser, pin: true }
          : state.selectedUser,
      }));
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Update user ─────────────────────────────────────────────
  updateUser: async (id, payload) => {
    set({ isMutating: true });
    try {
      const res = await userApi.update(id, payload);
      const updated = res.data ?? res;

      set((state) => ({
        users: replaceById(state.users, id, updated),
        selectedUser: state.selectedUser?.id === id ? updated : state.selectedUser,
        isMutating: false,
      }));
      return { success: true, user: updated };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Create user ─────────────────────────────────────────────
  createUser: async (payload) => {
    set({ isMutating: true });
    try {
      const res = await userApi.create(payload);
      const newUser = res.data ?? res;

      set((state) => ({
        users: [newUser, ...state.users],
        total: state.total + 1,
        isMutating: false,
      }));
      return { success: true, user: newUser };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Update admin password (superuser only) ──────────────────
  updateAdminPassword: async (id, password) => {
    set({ isMutating: true });
    try {
      await userApi.updateAdminPassword(id, password);
      set({ isMutating: false });
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Remove user (superuser only) ────────────────────────────
  removeUser: async (id) => {
    set({ isMutating: true });
    try {
      await userApi.remove(id);
      set((state) => ({
        users: state.users.filter((u) => u.id !== id),
        total: Math.max(0, state.total - 1),
        selectedUser: state.selectedUser?.id === id ? null : state.selectedUser,
        isMutating: false,
      }));
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Filter helpers ───────────────────────────────────────────
  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  clearFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  clearSelected: () => set({ selectedUser: null }),
  clearError: () => set({ error: null }),
}));

// ─── Internal helpers ──────────────────────────────────────────
function buildParams(filters, page) {
  const params = { page };
  if (filters.search) params.search = filters.search;
  if (filters.role) params.role = filters.role;
  // isActive is a string 'true'/'false' from the chip — convert to boolean
  if (filters.isActive) params.isActive = filters.isActive;
  return params;
}

function normalise(res) {
  // Backend returns: { data: { users: [...], total, page, limit } }
  if (res.data?.users && Array.isArray(res.data.users)) {
    const { users, total, limit } = res.data;
    return {
      data: users,
      pagination: { total, hasMore: users.length >= (limit ?? users.length) },
    };
  }
  // Bare array inside data (e.g. getSalespersons dropdown)
  if (Array.isArray(res.data)) return { data: res.data, pagination: res.pagination ?? null };
  if (Array.isArray(res)) return { data: res, pagination: null };
  return { data: [], pagination: null };
}

function replaceById(list, id, updated) {
  return list.map((item) => (item.id === id ? updated : item));
}

export default useUserStore;
