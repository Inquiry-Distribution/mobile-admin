/**
 * Inquiry API — Admin & Superuser
 *
 * All endpoints require role: admin | superuser.
 * Routes: /api/v1/inquiries/*
 */
import { Platform } from 'react-native';
import client from './client';
import { buildQuery } from '@utils/helpers';
import { CONFIG } from '@constants/config';
import { getAccessToken } from '@utils/storage';

export const inquiryApi = {
  // ─── Listing ────────────────────────────────────────────────

  /**
   * Get all inquiries (paginated + filterable).
   * @param {{ page?, limit?, status?, priority?, assignedToId?, search?, from?, to? }} params
   */
  getAll: (params = {}) =>
    client.get(`/inquiries${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`),

  /**
   * Get unassigned inquiries only.
   * @param {{ page?, limit? }} params
   */
  getUnassigned: (params = {}) =>
    client.get(`/inquiries/unassigned${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`),

  /**
   * Get a single inquiry by ID.
   */
  getById: (id) => client.get(`/inquiries/${id}`),

  // ─── Creation ───────────────────────────────────────────────

  /**
   * Create a single text/image inquiry.
   * Payload: { title, description, type, source, priority, mobile, assignedToId? }
   */
  create: (payload) => client.post('/inquiries', payload),

  /**
   * Bulk-create inquiries from parsed CSV rows.
   * Payload: { inquiries: [{ title, ... }] }
   */
  bulkCreate: (inquiries) => client.post('/inquiries/bulk', { inquiries }),

  /**
   * Share an inquiry (creates a copy visible to sales for 24h).
   */
  share: (payload) => client.post('/inquiries/share', payload),

  /**
   * Upload images to an inquiry (multipart/form-data).
   * Uses native fetch so FormData is handled by RN's XMLHttpRequest layer.
   */
  uploadImages: async (inquiryId, assets) => {
    const form = new FormData();
    assets.forEach((asset) => {
      form.append('images', {
        uri:  asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `inquiry_${Date.now()}.jpg`,
      });
    });
    const token = getAccessToken();
    const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries/${inquiryId}/images`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: form,
    });
    const json = await res.json();
    if (!json.success) throw { message: json.message };
    return json.data;
  },

  /**
   * Upload a voice note audio file to an inquiry (multipart/form-data).
   * @param {string} inquiryId
   * @param {string} filePath  — local file path returned by AudioRecorderPlayer
   */
  uploadAudio: async (inquiryId, filePath) => {
    const uri      = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
    const filename = filePath.split('/').pop() || `inquiry_audio_${Date.now()}.mp4`;
    const form     = new FormData();
    form.append('audio', { uri, type: 'audio/mp4', name: filename });
    const token = getAccessToken();
    const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries/${inquiryId}/audio`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      body:    form,
    });
    const json = await res.json();
    if (!json.success) throw { message: json.message };
    return json.data;
  },

  // ─── Assignment ─────────────────────────────────────────────

  /**
   * Distribute an inquiry to a salesperson.
   * Payload: { salespersonId, visibleUntil? }
   */
  distribute: (id, payload) =>
    client.post(`/inquiries/${id}/distribute`, payload),

  /**
   * Reassign an already-assigned inquiry to another salesperson.
   * Payload: { salespersonId, reason? }
   */
  reassign: (id, payload) =>
    client.post(`/inquiries/${id}/reassign`, payload),

  /**
   * Unassign an inquiry — resets it back to unassigned status.
   * Allowed for assigned / in_progress / follow_up. Blocked for closed.
   */
  unassign: (id) =>
    client.patch(`/inquiries/${id}/unassign`),

  // ─── Update (superuser only) ────────────────────────────────

  /**
   * Update inquiry fields (superuser only).
   * Payload: { description?, mobile?, inquiryTime?, priority?, source? }
   */
  update: (id, payload) => client.patch(`/inquiries/${id}`, payload),

  // ─── Deletion ───────────────────────────────────────────────

  /**
   * Permanently delete an inquiry (superuser only).
   */
  remove: (id) => client.delete(`/inquiries/${id}`),
};
