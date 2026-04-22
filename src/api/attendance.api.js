/**
 * Attendance API — Admin & Superuser
 *
 * View attendance records for all salespersons.
 * Routes: /api/v1/attendance/*
 */
import client from './client';
import { buildQuery, toISODate } from '@utils/helpers';
import { CONFIG } from '@constants/config';

export const attendanceApi = {
  /**
   * Get all attendance records (paginated + filterable).
   * @param {{ page?, limit?, date?, salespersonId?, status? }} params
   *
   * `date` should be "YYYY-MM-DD" string.
   */
  getAll: (params = {}) => {
    const normalized = { ...params };
    if (normalized.date instanceof Date) {
      normalized.date = toISODate(normalized.date);
    }
    return client.get(
      `/attendance${buildQuery({ limit: CONFIG.PAGE_SIZE, ...normalized })}`,
    );
  },

  /**
   * Get all attendance records for a specific salesperson.
   * @param {string} salespersonId
   * @param {{ page?, limit?, from?, to? }} params
   */
  getBySalesperson: (salespersonId, params = {}) =>
    client.get(
      `/attendance/salesperson/${salespersonId}${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`,
    ),
};
