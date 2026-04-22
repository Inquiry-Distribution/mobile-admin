/**
 * Attendance Store — Admin & Superuser
 *
 * Manages attendance records:
 *  • Date navigation (one date at a time)
 *  • All-salesperson view (fetches from GET /attendance?date=…)
 *  • Per-salesperson view (from GET /attendance/salesperson/:id)
 *  • Status filter: all / present / absent / half_day
 */
import { create } from 'zustand';
import dayjs from 'dayjs';
import { attendanceApi } from '@api/attendance.api';

const useAttendanceStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────────────────
  records:      [],
  total:        0,

  // Filters
  date:         dayjs().format('YYYY-MM-DD'),   // current date
  status:       '',                             // '' | 'present' | 'absent' | 'half_day'
  salespersonId: null,                          // null = all, string = specific salesperson

  // Loading
  isLoading:    false,
  isRefreshing: false,
  error:        null,

  // ─── Fetch records ────────────────────────────────────────────
  fetchRecords: async () => {
    const { date, status, salespersonId } = get();
    set({ isLoading: true, error: null });
    try {
      let res;
      const params = { date };
      if (status) params.status = status;

      if (salespersonId) {
        res = await attendanceApi.getBySalesperson(salespersonId, params);
      } else {
        res = await attendanceApi.getAll(params);
      }

      const records = Array.isArray(res.data) ? res.data
                    : Array.isArray(res)       ? res
                    : [];

      set({
        records,
        total:     res.total ?? res.pagination?.total ?? records.length,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // ─── Pull-to-refresh ─────────────────────────────────────────
  refreshRecords: async () => {
    const { date, status, salespersonId } = get();
    set({ isRefreshing: true });
    try {
      let res;
      const params = { date };
      if (status) params.status = status;

      if (salespersonId) {
        res = await attendanceApi.getBySalesperson(salespersonId, params);
      } else {
        res = await attendanceApi.getAll(params);
      }

      const records = Array.isArray(res.data) ? res.data
                    : Array.isArray(res)       ? res
                    : [];

      set({ records, total: res.total ?? records.length, isRefreshing: false });
    } catch (_) {
      set({ isRefreshing: false });
    }
  },

  // ─── Date navigation ──────────────────────────────────────────
  goToPrevDate: () => {
    const prev = dayjs(get().date).subtract(1, 'day').format('YYYY-MM-DD');
    set({ date: prev, records: [], total: 0 });
    get().fetchRecords();
  },

  goToNextDate: () => {
    const next = dayjs(get().date).add(1, 'day').format('YYYY-MM-DD');
    // Don't go past today
    if (next > dayjs().format('YYYY-MM-DD')) return;
    set({ date: next, records: [], total: 0 });
    get().fetchRecords();
  },

  goToToday: () => {
    const today = dayjs().format('YYYY-MM-DD');
    set({ date: today, records: [], total: 0 });
    get().fetchRecords();
  },

  // ─── Filter helpers ───────────────────────────────────────────
  setStatus: (status) => {
    set({ status });
    get().fetchRecords();
  },

  setSalespersonId: (salespersonId) => {
    set({ salespersonId });
    get().fetchRecords();
  },

  clearFilters: () => {
    set({
      status:        '',
      salespersonId: null,
      date:          dayjs().format('YYYY-MM-DD'),
      records:       [],
      total:         0,
    });
  },
}));

export default useAttendanceStore;
