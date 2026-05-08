import client from './client';
import { buildQuery } from '@utils/helpers';
import { CONFIG } from '@constants/config';

export const activityApi = {
  getAll: (params = {}) =>
    client.get(`/activity${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`),

  getByUser: (userId, params = {}) =>
    client.get(`/activity/user/${userId}${buildQuery({ limit: CONFIG.PAGE_SIZE, ...params })}`),

  getUserSummary: (userId, params = {}) =>
    client.get(`/activity/user/${userId}/summary${buildQuery(params)}`),

  getInquiryTimeline: (inquiryId) =>
    client.get(`/activity/inquiry/${inquiryId}/timeline`),
};
