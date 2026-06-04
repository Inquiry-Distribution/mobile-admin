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
  /**
   * Upload images or document files to an inquiry (multipart/form-data).
   * Accepts both react-native-image-picker assets (fileName) and
   * react-native-document-picker assets (name) in the same call.
   */
  uploadImages: async (inquiryId, assets) => {
    const form = new FormData();
    assets.forEach((asset) => {
      form.append('images', {
        uri:  asset.uri,
        type: asset.type || 'application/octet-stream',
        name: asset.fileName || asset.name || `file_${Date.now()}`,
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

  /**
   * Delete a single image/file from an inquiry (admin/superuser only).
   */
  deleteImage: (inquiryId, imageId) =>
    client.delete(`/inquiries/${inquiryId}/images/${imageId}`),

  deleteAudio: (inquiryId) =>
    client.delete(`/inquiries/${inquiryId}/audio`),

  // ─── Assignment ─────────────────────────────────────────────

  /**
   * Distribute an inquiry to a salesperson.
   * Payload: { salespersonId, visibleUntil? }
   */
  distribute: (id, payload) =>
    client.post(`/inquiries/${id}/distribute`, payload),

  /**
   * Bulk distribute multiple inquiries to one salesperson.
   * Payload: { inquiryIds: string[], salesPersonId: string }
   */
  bulkDistribute: (payload) =>
    client.post('/inquiries/bulk-distribute', payload),

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

  // ─── Visibility ─────────────────────────────────────────────

  /**
   * Extend how long an assigned inquiry stays visible to the salesperson.
   * Payload: { days } — 1 to 30
   */
  extendVisibility: (id, days) =>
    client.patch(`/inquiries/${id}/extend`, { days }),

  // ─── Update (superuser only) ────────────────────────────────

  /**
   * Update inquiry fields (superuser only).
   * Payload: { description?, mobile?, inquiryTime?, priority?, source? }
   */
  update: (id, payload) => client.patch(`/inquiries/${id}`, payload),

  // ─── Deletion & Trash ───────────────────────────────────────

  /** Soft-delete — moves inquiry to trash (superuser only). */
  remove: (id) => client.delete(`/inquiries/${id}`),

  /** List trashed inquiries (paginated). */
  getTrash: (params = {}) =>
    client.get(`/inquiries/trash${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`),

  /** Restore a trashed inquiry back to active (superuser only). */
  restore: (id) => client.patch(`/inquiries/${id}/restore`),

  /** Permanently delete a trashed inquiry — irreversible (superuser only). */
  permanentDelete: (id) => client.delete(`/inquiries/${id}/permanent`),

  // ─── CRM ────────────────────────────────────────────────────

  /** Get mapped CRM payload preview (no CRM call — for modal display). */
  getCrmPreview: (id) => client.get(`/inquiries/${id}/crm-preview`),

  /** Push a converted inquiry to the CRM platform with edited form data. */
  pushToCrm: (id, formData) => client.post(`/inquiries/${id}/push-to-crm`, formData),

  /** Upload selected photos/files to CRM after push. fileIds: string[] */
  uploadFilesToCrm: (id, fileIds) => client.post(`/inquiries/${id}/push-to-crm/upload`, { fileIds }),

  // ─── AI Analysis ────────────────────────────────────────────

  /**
   * Analyse the first picked image with Gemini — extract time + summary.
   * asset must include base64 field (use includeBase64:true in launchImageLibrary).
   * Returns { time: "HH:MM"|null, summary: string|null }
   */
  analyseImage: (asset) =>
    client.post('/inquiries/analyse-image', {
      imageBase64: asset.base64,
      mimeType:    asset.type || 'image/jpeg',
    }),
};
