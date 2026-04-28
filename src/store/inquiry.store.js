/**
 * Inquiry Store — Admin & Superuser
 *
 * Manages the full inquiry list, filters, pagination,
 * and admin-only mutations: distribute, reassign.
 *
 * Pagination strategy: cursor-style via `page` counter.
 * `fetchInquiries(reset=true)` restarts from page 1.
 * `loadMore()` increments page and appends results.
 */
import { create } from 'zustand';
import dayjs from 'dayjs';
import { inquiryApi } from '@api/inquiry.api';
import { CONFIG } from '@constants/config';

const DEFAULT_FILTERS = {
  status:       '',
  priority:     '',
  search:       '',
  assignedToId: '',
};

// ─── Build date params from period key ────────────────────────
function buildPeriodParams(period) {
  const today = dayjs().format('YYYY-MM-DD');
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week': {
      const day    = dayjs().day();           // 0 = Sun
      const monday = day === 0
        ? dayjs().subtract(6, 'day')
        : dayjs().subtract(day - 1, 'day');
      return { from: monday.format('YYYY-MM-DD'), to: today };
    }
    case 'month':
      return { from: dayjs().startOf('month').format('YYYY-MM-DD'), to: today };
    case 'all':
      return {};                              // no date restriction
    case 'today_and_before':
      return { to: today };
    default:                                  // 'all' or unknown → no restriction
      return {};
  }
}

const useInquiryStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────────────────
  inquiries:        [],
  unassigned:       [],
  selectedInquiry:  null,

  // Pagination
  page:    1,
  hasMore: true,
  total:   0,

  // Active filters
  filters:       { ...DEFAULT_FILTERS },
  activePeriod:  'all',   // 'today' | 'week' | 'month' | 'all'

  // Loading flags
  isLoading:     false,
  isRefreshing:  false,
  isLoadingMore: false,
  isMutating:    false,   // distribute / reassign in progress
  error:         null,

  // ─── Dashboard summary refresh trigger ────────────────────────
  // Increment this after any mutation that should cause Dashboard
  // KPI cards to re-fetch (create, distribute, reassign, status-change, etc.)
  summaryRefreshKey: 0,
  bumpSummaryRefresh: () =>
    set((state) => ({ summaryRefreshKey: state.summaryRefreshKey + 1 })),

  // ─── Fetch (first page) ───────────────────────────────────────
  fetchInquiries: async (extraParams = {}) => {
    set({ isLoading: true, error: null, page: 1 });
    try {
      const { filters, activePeriod } = get();
      const periodParams = buildPeriodParams(activePeriod);
      const params = buildParams(filters, 1, { ...periodParams, ...extraParams });
      const res    = await inquiryApi.getAll(params);
      const { data, pagination } = normalise(res);

      set({
        inquiries: data,
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
  refreshInquiries: async () => {
    set({ isRefreshing: true, page: 1 });
    try {
      const { filters, activePeriod } = get();
      const params = buildParams(filters, 1, buildPeriodParams(activePeriod));
      const res    = await inquiryApi.getAll(params);
      const { data, pagination } = normalise(res);

      set({
        inquiries:    data,
        total:        pagination?.total  ?? data.length,
        hasMore:      pagination?.hasMore ?? data.length === CONFIG.PAGE_SIZE,
        page:         1,
        isRefreshing: false,
      });
    } catch (_) {
      set({ isRefreshing: false });
    }
  },

  // ─── Infinite scroll ─────────────────────────────────────────
  loadMore: async () => {
    const { isLoadingMore, hasMore, page, filters, activePeriod } = get();
    if (isLoadingMore || !hasMore) return;

    set({ isLoadingMore: true });
    try {
      const nextPage = page + 1;
      const params   = buildParams(filters, nextPage, buildPeriodParams(activePeriod));
      const res      = await inquiryApi.getAll(params);
      const { data, pagination } = normalise(res);

      set((state) => ({
        inquiries:     [...state.inquiries, ...data],
        page:          nextPage,
        hasMore:       pagination?.hasMore ?? data.length === CONFIG.PAGE_SIZE,
        isLoadingMore: false,
      }));
    } catch (_) {
      set({ isLoadingMore: false });
    }
  },

  // ─── Fetch unassigned bucket ──────────────────────────────────
  fetchUnassigned: async () => {
    try {
      const res = await inquiryApi.getUnassigned({ limit: 50 });
      const { data } = normalise(res);
      set({ unassigned: data });
    } catch (_) {}
  },

  // ─── Select / load detail ────────────────────────────────────
  selectInquiry: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await inquiryApi.getById(id);
      set({ selectedInquiry: res.data ?? res, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // ─── Distribute (assign to salesperson) ──────────────────────
  distribute: async (id, payload) => {
    set({ isMutating: true });
    try {
      const res     = await inquiryApi.distribute(id, payload);
      const updated = res.data ?? res;

      set((state) => ({
        inquiries:       replaceById(state.inquiries, id, updated),
        unassigned:      state.unassigned.filter((i) => i.id !== id),
        selectedInquiry: state.selectedInquiry?.id === id ? updated : state.selectedInquiry,
        isMutating:      false,
      }));
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Reassign ────────────────────────────────────────────────
  reassign: async (id, payload) => {
    set({ isMutating: true });
    try {
      const res     = await inquiryApi.reassign(id, payload);
      const updated = res.data ?? res;

      set((state) => ({
        inquiries:       replaceById(state.inquiries, id, updated),
        selectedInquiry: state.selectedInquiry?.id === id ? updated : state.selectedInquiry,
        isMutating:      false,
      }));
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Real-time socket inject ──────────────────────────────────
  // Called by socket.service when inquiry:created / inquiry:updated arrives
  prependInquiry: (inquiry) =>
    set((state) => ({
      inquiries: [inquiry, ...state.inquiries],
      total:     state.total + 1,
    })),

  updateInquiryInList: (updated) =>
    set((state) => ({
      inquiries:       replaceById(state.inquiries, updated.id, updated),
      selectedInquiry: state.selectedInquiry?.id === updated.id ? updated : state.selectedInquiry,
    })),

  // ─── Period (date range) ─────────────────────────────────────
  setPeriod: (period) => {
    set({ activePeriod: period });
    get().fetchInquiries();
  },

  // ─── Filter helpers ───────────────────────────────────────────
  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  clearFilters: () => set({ filters: { ...DEFAULT_FILTERS }, activePeriod: 'all' }),

  clearSelected:  () => set({ selectedInquiry: null }),
  clearError:     () => set({ error: null }),
}));

// ─── Internal helpers ──────────────────────────────────────────

/** Build API query params from filter state + page */
function buildParams(filters, page, extra = {}) {
  const params = { page, ...extra };
  if (filters.status)       params.status       = filters.status;
  if (filters.priority)     params.priority     = filters.priority;
  if (filters.search)       params.search       = filters.search;
  if (filters.assignedToId) params.assignedToId = filters.assignedToId;
  return params;
}

/**
 * Normalise API responses into { data: [], pagination: {} }.
 *
 * Backend getAll returns:
 *   { success, message, data: { inquiries: [...], total, page, limit } }
 *
 * Backend getUnassigned returns:
 *   { success, message, data: [...] }   ← bare array inside data
 */
function normalise(res) {
  // ── Primary format: data.inquiries (getAll) ───────────────────
  if (res.data?.inquiries && Array.isArray(res.data.inquiries)) {
    const { inquiries, total, limit } = res.data;
    return {
      data:       inquiries,
      pagination: {
        total,
        hasMore: inquiries.length >= (limit ?? inquiries.length),
      },
    };
  }

  // ── Bare array inside data (getUnassigned) ────────────────────
  if (Array.isArray(res.data)) {
    return { data: res.data, pagination: res.pagination ?? null };
  }

  // ── Bare array at root (legacy fallback) ──────────────────────
  if (Array.isArray(res)) {
    return { data: res, pagination: null };
  }

  return { data: [], pagination: null };
}

/** Immutable list update by id */
function replaceById(list, id, updated) {
  return list.map((item) => (item.id === id ? updated : item));
}

export default useInquiryStore;
