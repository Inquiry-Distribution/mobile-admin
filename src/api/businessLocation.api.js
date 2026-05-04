import client from './client';

export const businessLocationApi = {
  getAll:  ()         => client.get('/business-locations'),
  create:  (data)     => client.post('/business-locations', data),
  update:  (id, data) => client.patch(`/business-locations/${id}`, data),
  remove:  (id)       => client.delete(`/business-locations/${id}`),
};
