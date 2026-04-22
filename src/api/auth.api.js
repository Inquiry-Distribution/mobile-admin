/**
 * Auth API — Admin & Superuser
 *
 * Admin/Superuser login uses email + password (POST /auth/login).
 * There is NO device registration step — just a standard web-panel login.
 */
import client from './client';

export const authApi = {
  /**
   * Login with email + password.
   * Returns: { token, refreshToken, user }
   */
  login: (email, password) =>
    client.post('/auth/login', { email, password }),

  /**
   * Exchange a refresh token for a new access token.
   * Returns: { token }
   */
  refreshToken: (refreshToken) =>
    client.post('/auth/refresh-token', { refreshToken }),

  /**
   * Get the currently authenticated admin's profile.
   * Returns: { id, name, email, role, ... }
   */
  getMe: () => client.get('/auth/me'),

  /**
   * Logout — invalidates the refresh token server-side.
   */
  logout: () => client.post('/auth/logout'),
};
