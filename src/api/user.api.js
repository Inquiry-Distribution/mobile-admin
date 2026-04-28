/**
 * User / Salesperson API — Admin & Superuser
 *
 * Manages the full user roster (salespeople, admins).
 * Routes: /api/v1/users/*
 */
import client from './client';
import { buildQuery } from '@utils/helpers';
import { CONFIG } from '@constants/config';

export const userApi = {
  // ─── Listing ────────────────────────────────────────────────

  /**
   * Get all users (all roles).
   * @param {{ page?, limit?, role?, isActive?, search? }} params
   */
  getAll: (params = {}) =>
    client.get(`/users${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`),

  /**
   * Get only salesperson-role users (role=sales).
   * Useful for populate dropdowns (distribute, reassign, etc.)
   */
  getSalespersons: (params = {}) =>
    client.get(`/users/sales${buildQuery(params)}`),

  /**
   * Get a single user by ID.
   */
  getById: (id) => client.get(`/users/${id}`),

  // ─── Mutations ──────────────────────────────────────────────

  /**
   * Create a new user.
   * Payload: { name, email, role, phone, employeeId, assignedArea?, password? }
   */
  create: (payload) => client.post('/users', payload),

  /**
   * Update a user's profile fields.
   * Payload: partial user fields
   */
  update: (id, payload) => client.patch(`/users/${id}`, payload),

  /**
   * Toggle a user's active/inactive status.
   * Returns: { isActive }
   */
  toggleStatus: (id) => client.patch(`/users/${id}/toggle-status`),

  /**
   * Set / reset a salesperson's PIN.
   * Payload: { pin }  — superuser / admin only
   */
  setPin: (id, pin) => client.patch(`/users/${id}/pin`, { pin }),

  /**
   * Permanently delete a user (superuser only).
   */
  remove: (id) => client.delete(`/users/${id}`),

  /**
   * Sync sales users from external API.
   * Returns: { total, created, updated, skipped }
   */
  sync: () => client.post('/users/sync'),
};
