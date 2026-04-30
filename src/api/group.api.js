import client from './client';

export const groupApi = {
  // ── Groups ────────────────────────────────────────────────
  getGroups:    ()                  => client.get('/groups'),
  getGroup:     (id)                => client.get(`/groups/${id}`),
  createGroup:  (payload)           => client.post('/groups', payload),
  deleteGroup:  (id)                => client.delete(`/groups/${id}`),

  // ── Members ───────────────────────────────────────────────
  addMembers:   (id, userIds)       => client.post(`/groups/${id}/members`, { userIds }),
  removeMember: (id, userId)        => client.delete(`/groups/${id}/members/${userId}`),

  // ── Messages ──────────────────────────────────────────────
  getMessages:  (id, cursor)        => client.get(`/groups/${id}/messages${cursor ? `?cursor=${cursor}` : ''}`),

  // Text-only message
  sendMessage: (id, payload) => client.post(`/groups/${id}/messages`, payload),

  // Message with an image/file attached (FormData)
  sendMessageWithFile: (id, formData) =>
    client.post(`/groups/${id}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  markAllRead:  (id)                => client.post(`/groups/${id}/messages/read`),
  editMessage:  (id, msgId, text)   => client.patch(`/groups/${id}/messages/${msgId}`, { text }),
  getReadReceipts: (id, msgId)      => client.get(`/groups/${id}/messages/${msgId}/reads`),
};
