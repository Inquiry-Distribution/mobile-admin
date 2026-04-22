/**
 * Location API — Admin & Superuser
 *
 * View real-time and historical GPS data for salespersons.
 * Routes: /api/v1/locations/*
 */
import client from './client';
import { buildQuery } from '@utils/helpers';
import { CONFIG } from '@constants/config';

export const locationApi = {
  /**
   * Get the latest (live) location of every active salesperson.
   * Used by the Live Map screen — polled every MAP_LIVE_REFRESH_MS ms.
   * Returns: [{ salespersonId, name, lat, lng, recordedAt, ... }]
   */
  getLive: () => client.get('/locations/live'),

  /**
   * Get GPS history for a specific salesperson.
   * @param {string} salespersonId
   * @param {{ from?, to?, limit? }} params  — ISO date strings for range
   */
  getHistory: (salespersonId, params = {}) =>
    client.get(
      `/locations/salesperson/${salespersonId}${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`,
    ),
};
