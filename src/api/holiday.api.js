import client from './client';

export const holidayApi = {
  /**
   * @param {{ year?, month?, from?, to?, activeOnly? }} params
   */
  getAll: (params = {}) => client.get('/holidays', { params }),

  create: (data) => client.post('/holidays', data),

  update: (id, data) => client.patch(`/holidays/${id}`, data),

  remove: (id) => client.delete(`/holidays/${id}`),
};
