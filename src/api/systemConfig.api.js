import client from './client';

export const systemConfigApi = {
  getLoginLimit:    ()     => client.get('/system-config/login-limit'),
  updateLoginLimit: (body) => client.patch('/system-config/login-limit', body),
};
