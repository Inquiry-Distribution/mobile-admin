import { create } from 'zustand';
import { companyApi } from '@api/company.api';

const useCompanyStore = create((set, get) => ({
  companies:    [],
  selected:     null,
  isLoading:    false,
  isRefreshing: false,
  isMutating:   false,
  error:        null,

  // ── Fetch all ──────────────────────────────────────────────
  fetchCompanies: async (search = '') => {
    set({ isLoading: true, error: null });
    try {
      const res = await companyApi.getAll({ search });
      set({ companies: res.data ?? [], isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // ── Pull-to-refresh ────────────────────────────────────────
  refreshCompanies: async () => {
    set({ isRefreshing: true });
    try {
      const res = await companyApi.getAll({});
      set({ companies: res.data ?? [], isRefreshing: false });
    } catch (_) {
      set({ isRefreshing: false });
    }
  },

  // ── Create ─────────────────────────────────────────────────
  createCompany: async (body) => {
    set({ isMutating: true });
    try {
      const res     = await companyApi.create(body);
      const created = res.data ?? res;
      set((s) => ({
        companies:  [...s.companies, created].sort((a, b) => a.name.localeCompare(b.name)),
        isMutating: false,
      }));
      return { success: true, data: created };
    } catch (err) {
      set({ isMutating: false });
      const msg = err.response?.data?.message ?? err.message ?? 'Failed to create company.';
      return { success: false, message: msg };
    }
  },

  // ── Update ─────────────────────────────────────────────────
  updateCompany: async (id, body) => {
    set({ isMutating: true });
    try {
      const res     = await companyApi.update(id, body);
      const updated = res.data ?? res;
      set((s) => ({
        companies:  s.companies.map((c) => (c.id === id ? updated : c))
                               .sort((a, b) => a.name.localeCompare(b.name)),
        selected:   s.selected?.id === id ? updated : s.selected,
        isMutating: false,
      }));
      return { success: true, data: updated };
    } catch (err) {
      set({ isMutating: false });
      const msg = err.response?.data?.message ?? err.message ?? 'Failed to update company.';
      return { success: false, message: msg };
    }
  },

  // ── Delete ─────────────────────────────────────────────────
  deleteCompany: async (id) => {
    set({ isMutating: true });
    try {
      await companyApi.remove(id);
      set((s) => ({
        companies:  s.companies.filter((c) => c.id !== id),
        selected:   s.selected?.id === id ? null : s.selected,
        isMutating: false,
      }));
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      const msg = err.response?.data?.message ?? err.message ?? 'Failed to delete company.';
      return { success: false, message: msg };
    }
  },

  setSelected: (company) => set({ selected: company }),
  clearSelected: () => set({ selected: null }),
}));

export default useCompanyStore;
