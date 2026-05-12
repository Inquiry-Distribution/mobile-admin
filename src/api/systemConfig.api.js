import client from './client';

export const systemConfigApi = {
  getLoginLimit:        ()     => client.get('/system-config/login-limit'),
  updateLoginLimit:     (body) => client.patch('/system-config/login-limit', body),
  getAttendanceHours:   ()     => client.get('/system-config/attendance-hours'),
  updateAttendanceHours:(body) => client.patch('/system-config/attendance-hours', body),
};
