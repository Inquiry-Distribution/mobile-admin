/**
 * Device API — Admin & Superuser
 *
 * Manage registered mobile devices (block, unblock, reset).
 * Routes: /api/v1/devices/*
 */
import client from './client';
import { buildQuery } from '@utils/helpers';
import { CONFIG } from '@constants/config';

export const deviceApi = {
  // ─── Listing ────────────────────────────────────────────────

  /**
   * Get all registered devices (paginated).
   * @param {{ page?, limit?, isBlocked?, search? }} params
   */
  getAll: (params = {}) =>
    client.get(`/devices${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`),

  /**
   * Get latest live locations of all devices (superuser only).
   */
  getAllLocations: () => client.get('/devices/locations'),

  /**
   * Get a single device record by ID.
   */
  getById: (id) => client.get(`/devices/${id}`),

  // ─── Mutations ──────────────────────────────────────────────

  /**
   * Block a device — prevents the salesperson from logging in.
   * Payload: { reason? }
   */
  block: (id, reason) =>
    client.patch(`/devices/${id}/block`, reason ? { reason } : {}),

  /**
   * Unblock a previously blocked device.
   */
  unblock: (id) => client.patch(`/devices/${id}/unblock`),

  /**
   * Reset (delete) the device record for a salesperson.
   * Allows them to register a fresh device on next login.
   */
  resetBySalesperson: (salespersonId) =>
    client.delete(`/devices/salesperson/${salespersonId}/reset`),
};
