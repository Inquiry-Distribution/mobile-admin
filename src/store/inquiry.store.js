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
function buildPeriodParams(period, customFrom = null, customTo = null) {
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
    case 'custom':
      return customFrom && customTo
        ? { from: customFrom, to: customTo }
        : {};
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
  activePeriod:  'all',   // 'today' | 'week' | 'month' | 'all' | 'custom'
  customFrom:    null,    // 'YYYY-MM-DD' — only used when activePeriod === 'custom'
  customTo:      null,    // 'YYYY-MM-DD'

  // Loading flags
  isLoading:     false,
  isRefreshing:  false,
  isLoadingMore: false,
  isMutating:    false,   // distribute / reassign in progress
  error:         null,

  // ─── Trash ────────────────────────────────────────────────────
  trash:              [],
  trashPage:          1,
  trashHasMore:       true,
  trashTotal:         0,
  isTrashLoading:     false,
  isTrashRefreshing:  false,
  isTrashLoadingMore: false,

  fetchTrash: async () => {
    set({ isTrashLoading: true });
    try {
      const res = await inquiryApi.getTrash({ page: 1 });
      const { data, pagination } = normaliseTrash(res);
      set({
        trash:          data,
        trashTotal:     pagination?.total  ?? data.length,
        trashHasMore:   pagination?.hasMore ?? false,
        trashPage:      1,
        isTrashLoading: false,
      });
    } catch (_) {
      set({ isTrashLoading: false });
    }
  },

  refreshTrash: async () => {
    set({ isTrashRefreshing: true });
    try {
      const res = await inquiryApi.getTrash({ page: 1 });
      const { data, pagination } = normaliseTrash(res);
      set({
        trash:             data,
        trashTotal:        pagination?.total  ?? data.length,
        trashHasMore:      pagination?.hasMore ?? false,
        trashPage:         1,
        isTrashRefreshing: false,
      });
    } catch (_) {
      set({ isTrashRefreshing: false });
    }
  },

  loadMoreTrash: async () => {
    const { isTrashLoadingMore, trashHasMore, trashPage } = get();
    if (isTrashLoadingMore || !trashHasMore) return;
    set({ isTrashLoadingMore: true });
    try {
      const nextPage = trashPage + 1;
      const res      = await inquiryApi.getTrash({ page: nextPage });
      const { data, pagination } = normaliseTrash(res);
      set((state) => ({
        trash:              [...state.trash, ...data],
        trashPage:          nextPage,
        trashHasMore:       pagination?.hasMore ?? false,
        isTrashLoadingMore: false,
      }));
    } catch (_) {
      set({ isTrashLoadingMore: false });
    }
  },

  restoreInquiry: async (id) => {
    try {
      await inquiryApi.restore(id);
      set((state) => ({
        trash:      state.trash.filter((i) => i.id !== id),
        trashTotal: Math.max(0, state.trashTotal - 1),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  permanentDelete: async (id) => {
    try {
      await inquiryApi.permanentDelete(id);
      set((state) => ({
        trash:      state.trash.filter((i) => i.id !== id),
        trashTotal: Math.max(0, state.trashTotal - 1),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

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
      const { filters, activePeriod, customFrom, customTo } = get();
      const periodParams = buildPeriodParams(activePeriod, customFrom, customTo);
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
      const { filters, activePeriod, customFrom, customTo } = get();
      const params = buildParams(filters, 1, buildPeriodParams(activePeriod, customFrom, customTo));
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
    const { isLoadingMore, hasMore, page, filters, activePeriod, customFrom, customTo } = get();
    if (isLoadingMore || !hasMore) return;

    set({ isLoadingMore: true });
    try {
      const nextPage = page + 1;
      const params   = buildParams(filters, nextPage, buildPeriodParams(activePeriod, customFrom, customTo));
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

  // ─── Bulk Distribute ─────────────────────────────────────────
  bulkDistribute: async (inquiryIds, salesPersonId) => {
    set({ isMutating: true });
    try {
      const res    = await inquiryApi.bulkDistribute({ inquiryIds, salesPersonId });
      const result = res.data ?? res;
      // Remove distributed inquiries from the list and refresh counts
      set((state) => ({
        inquiries:  state.inquiries.filter((i) => !inquiryIds.includes(i.id) || result.skippedIds?.includes(i.id)),
        unassigned: state.unassigned.filter((i) => !inquiryIds.includes(i.id)),
        isMutating: false,
      }));
      get().bumpSummaryRefresh();
      return { success: true, ...result };
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

  // ─── Delete image/file from inquiry ──────────────────────────
  deleteImage: async (inquiryId, imageId) => {
    set({ isMutating: true });
    try {
      const res     = await inquiryApi.deleteImage(inquiryId, imageId);
      const updated = res.data ?? res;

      set((state) => ({
        inquiries:       replaceById(state.inquiries, inquiryId, updated),
        selectedInquiry: state.selectedInquiry?.id === inquiryId ? updated : state.selectedInquiry,
        isMutating:      false,
      }));
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Delete audio from inquiry ────────────────────────────────
  deleteAudio: async (inquiryId) => {
    set({ isMutating: true });
    try {
      const res     = await inquiryApi.deleteAudio(inquiryId);
      const updated = res.data ?? res;

      set((state) => ({
        inquiries:       replaceById(state.inquiries, inquiryId, updated),
        selectedInquiry: state.selectedInquiry?.id === inquiryId ? updated : state.selectedInquiry,
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

  // Set a custom date range and immediately fetch
  setCustomPeriod: (from, to) => {
    set({ activePeriod: 'custom', customFrom: from, customTo: to });
    get().fetchInquiries();
  },

  // ─── Filter helpers ───────────────────────────────────────────
  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  clearFilters: () => set({
    filters:      { ...DEFAULT_FILTERS },
    activePeriod: 'all',
    customFrom:   null,
    customTo:     null,
  }),

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

/**
 * Normalise GET /inquiries/trash response.
 * Backend returns: { data: { inquiries: [...], total, limit } }
 */
function normaliseTrash(res) {
  if (res.data?.inquiries && Array.isArray(res.data.inquiries)) {
    const { inquiries, total, limit } = res.data;
    return {
      data:       inquiries,
      pagination: { total, hasMore: inquiries.length >= (limit ?? CONFIG.PAGE_SIZE) },
    };
  }
  if (Array.isArray(res.data)) {
    return { data: res.data, pagination: null };
  }
  if (Array.isArray(res)) {
    return { data: res, pagination: null };
  }
  return { data: [], pagination: null };
}

export default useInquiryStore;
