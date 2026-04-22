/**
 * Audit Log API — Superuser ONLY
 *
 * Read-only access to the full audit trail of admin actions.
 * Routes: /api/v1/audit/*
 */
import client from './client';
import { buildQuery } from '@utils/helpers';
import { CONFIG } from '@constants/config';

export const auditApi = {
  /**
   * Get all audit log entries (paginated + filterable).
   * @param {{ page?, limit?, action?, performedById?, targetModel?, from?, to? }} params
   */
  getAll: (params = {}) =>
    client.get(`/audit${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`),

  /**
   * Get audit logs performed by a specific user.
   * @param {string} userId
   * @param {{ page?, limit? }} params
   */
  getByUser: (userId, params = {}) =>
    client.get(
      `/audit/user/${userId}${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`,
    ),
};
