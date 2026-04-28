import client from './client';

export const companyApi = {
  getAll:   (params = {}) => {
    const qs = params.search ? `?search=${encodeURIComponent(params.search)}` : '';
    return client.get(`/companies${qs}`);
  },
  getById:  (id)       => client.get(`/companies/${id}`),
  create:   (body)     => client.post('/companies', body),
  update:   (id, body) => client.patch(`/companies/${id}`, body),
  remove:   (id)       => client.delete(`/companies/${id}`),
};
