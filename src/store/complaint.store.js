import { create } from 'zustand';
import { complaintApi } from '@api/complaint.api';

const useComplaintStore = create((set, get) => ({
  records:     [],
  total:       0,
  selected:    null,

  // Filters
  typeFilter:   '',    // '' | 'complaint' | 'suggestion'
  statusFilter: '',    // '' | 'pending' | 'reviewed' | 'resolved'
  page:         1,
  hasMore:      true,

  isLoading:    false,
  isRefreshing: false,
  isLoadingMore: false,
  error:        null,

  // ── Fetch first page ───────────────────────────────────────
  fetchRecords: async () => {
    const { typeFilter, statusFilter } = get();
    set({ isLoading: true, error: null, page: 1 });
    try {
      const params = { page: 1, limit: 20 };
      if (typeFilter)   params.type   = typeFilter;
      if (statusFilter) params.status = statusFilter;

      const res     = await complaintApi.getAll(params);
      const records = res.data?.records ?? res.data ?? [];
      const total   = res.data?.total   ?? records.length;

      set({ records, total, hasMore: records.length < total, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // ── Pull-to-refresh ────────────────────────────────────────
  refreshRecords: async () => {
    const { typeFilter, statusFilter } = get();
    set({ isRefreshing: true, page: 1 });
    try {
      const params = { page: 1, limit: 20 };
      if (typeFilter)   params.type   = typeFilter;
      if (statusFilter) params.status = statusFilter;

      const res     = await complaintApi.getAll(params);
      const records = res.data?.records ?? res.data ?? [];
      const total   = res.data?.total   ?? records.length;

      set({ records, total, hasMore: records.length < total, isRefreshing: false });
    } catch (_) {
      set({ isRefreshing: false });
    }
  },

  // ── Load next page ─────────────────────────────────────────
  loadMore: async () => {
    const { isLoadingMore, hasMore, page, typeFilter, statusFilter, records } = get();
    if (isLoadingMore || !hasMore) return;

    const nextPage = page + 1;
    set({ isLoadingMore: true });
    try {
      const params = { page: nextPage, limit: 20 };
      if (typeFilter)   params.type   = typeFilter;
      if (statusFilter) params.status = statusFilter;

      const res      = await complaintApi.getAll(params);
      const newRows  = res.data?.records ?? res.data ?? [];
      const total    = res.data?.total   ?? records.length;
      const combined = [...records, ...newRows];

      set({ records: combined, total, page: nextPage, hasMore: combined.length < total, isLoadingMore: false });
    } catch (_) {
      set({ isLoadingMore: false });
    }
  },

  // ── Select detail ──────────────────────────────────────────
  selectById: async (id) => {
    // Optimistic: pick from list first
    const fromList = get().records.find((r) => r.id === id);
    if (fromList) set({ selected: fromList });
    try {
      const res = await complaintApi.getById(id);
      set({ selected: res.data ?? res });
    } catch (_) {}
  },

  clearSelected: () => set({ selected: null }),

  // ── Review / resolve ───────────────────────────────────────
  reviewComplaint: async (id, body) => {
    const res     = await complaintApi.review(id, body);
    const updated = res.data ?? res;
    set((state) => ({
      selected: updated,
      records:  state.records.map((r) => (r.id === id ? updated : r)),
    }));
    return updated;
  },

  // ── Filter helpers ─────────────────────────────────────────
  setTypeFilter: (v) => { set({ typeFilter: v });   get().fetchRecords(); },
  setStatusFilter: (v) => { set({ statusFilter: v }); get().fetchRecords(); },
  clearFilters: () => { set({ typeFilter: '', statusFilter: '' }); get().fetchRecords(); },
}));

export default useComplaintStore;
