import client from './client';
import { buildQuery } from '@utils/helpers';
import { CONFIG } from '@constants/config';

export const complaintApi = {
  // Get all complaints (superuser)
  getAll: (params = {}) =>
    client.get(`/complaints${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`),

  // Get single complaint detail
  getById: (id) => client.get(`/complaints/${id}`),

  // Review / resolve a complaint
  review: (id, body) => client.patch(`/complaints/${id}/review`, body),
};
