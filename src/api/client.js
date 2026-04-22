/**
 * Axios client for Inquiry Desk Admin.
 *
 * Features:
 *  • Attaches Bearer token to every request
 *  • Silent JWT refresh on 401 with a queued-retry strategy
 *  • On refresh failure → clears auth & triggers force-logout via store
 *  • Normalises error shape to { message, status }
 */
import axios from 'axios';
import { CONFIG } from '@constants/config';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  clearAuth,
} from '@utils/storage';

const client = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: CONFIG.API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — attach token ───────────────────────
client.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Token-refresh machinery ──────────────────────────────────
let isRefreshing   = false;
let failedQueue    = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) =>
    error ? p.reject(error) : p.resolve(token),
  );
  failedQueue = [];
};

// Lazy import to avoid circular dependency with auth.store
let _forceLogout = null;
export const setForceLogout = (fn) => { _forceLogout = fn; };

// ─── Response interceptor — handle 401 ───────────────────────
client.interceptors.response.use(
  // Success: unwrap the `data` envelope once so callers get res.data directly
  (response) => response.data,

  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Queue concurrent requests while refresh is in progress
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing            = true;

      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        // Direct axios call (bypass our interceptor to avoid infinite loop)
        const res = await axios.post(
          `${CONFIG.API_BASE_URL}/auth/refresh-token`,
          { refreshToken },
          { timeout: CONFIG.API_TIMEOUT },
        );

        const newToken = res.data?.data?.token;
        if (!newToken) throw new Error('Refresh returned no token');

        setAccessToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuth();
        if (_forceLogout) _forceLogout();
        return Promise.reject({ message: 'Session expired. Please log in again.', status: 401 });

      } finally {
        isRefreshing = false;
      }
    }

    // Normalise error for callers: { message, status }
    const message =
      error.response?.data?.message ||
      error.message ||
      'Something went wrong.';
    return Promise.reject({ message, status: error.response?.status });
  },
);

export default client;
