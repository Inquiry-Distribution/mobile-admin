/**
 * Reports API — Admin & Superuser
 *
 * System-wide analytics: summary dashboard, inquiry report,
 * salesperson performance, and per-person drill-down.
 * Routes: /api/v1/reports/*
 */
import client from './client';
import { buildQuery } from '@utils/helpers';

export const reportApi = {
  /**
   * Summary / KPI card data for the Dashboard screen.
   * @param {{ from?, to? }} params  — ISO date strings (YYYY-MM-DD) for date-range filter.
   *   Omit both for all-time counts.
   * Returns: { totalInquiries, unassigned, inProgress, closed, totalSales, totalDevices, blockedDevices }
   */
  getSummary: (params = {}) =>
    client.get(`/reports/summary${buildQuery(params)}`),

  /**
   * Inquiry distribution report (filterable by date range).
   * @param {{ from?, to? }} params  — ISO date strings
   */
  getInquiryReport: (params = {}) =>
    client.get(`/reports/inquiries${buildQuery(params)}`),

  /**
   * All-salespersons performance table.
   * Returns an array with inquiry counts, attendance, conversion rate per person.
   * @param {{ from?, to? }} params
   */
  getAllSalespersons: (params = {}) =>
    client.get(`/reports/salespersons${buildQuery(params)}`),

  /**
   * Drill-down report for a single salesperson.
   * @param {string} salespersonId
   * @param {{ from?, to? }} params
   */
  getSalesperson: (salespersonId, params = {}) =>
    client.get(`/reports/salesperson/${salespersonId}${buildQuery(params)}`),
};
