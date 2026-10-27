/**
 * Secure MMKV storage for Admin App.
 * Uses a separate MMKV instance & key namespace from the sales app
 * so both apps can coexist on the same device (e.g. QA/testing).
 */
import { MMKV } from 'react-native-mmkv';
import { CONFIG } from '@constants/config';

export const storage = new MMKV({
  id:            'inquiry-admin-storage',      // different from sales 'inquiry-app-storage'
  encryptionKey: 'inquiry-admin-secret-key',
});

const { STORAGE_KEYS: K } = CONFIG;

// ─── Access Token ─────────────────────────────────────────────
export const getAccessToken  = ()      => storage.getString(K.ACCESS_TOKEN) || null;
export const setAccessToken  = (token) => storage.set(K.ACCESS_TOKEN, token);
export const removeAccessToken = ()    => storage.delete(K.ACCESS_TOKEN);

// ─── Refresh Token ────────────────────────────────────────────
export const getRefreshToken   = ()      => storage.getString(K.REFRESH_TOKEN) || null;
export const setRefreshToken   = (token) => storage.set(K.REFRESH_TOKEN, token);
export const removeRefreshToken = ()     => storage.delete(K.REFRESH_TOKEN);

// ─── User (admin / superuser) ─────────────────────────────────
export const getUser = () => {
  const raw = storage.getString(K.USER);
  return raw ? JSON.parse(raw) : null;
};
export const setUser   = (user) => storage.set(K.USER, JSON.stringify(user));
export const removeUser = ()    => storage.delete(K.USER);

// ─── Role helpers (read-only conveniences) ────────────────────
export const isAdmin     = () => getUser()?.role === 'admin';
export const isSuperuser = () => getUser()?.role === 'superuser';
export const isAdminOrSuperuser = () => {
  const role = getUser()?.role;
  return role === 'admin' || role === 'superuser';
};

// ─── Atomic clear on logout ───────────────────────────────────
export const clearAuth = () => {
  removeAccessToken();
  removeRefreshToken();
  removeUser();
};

export const getRememberedLogin = () => ({
  email:    storage.getString(K.REMEMBER_EMAIL) || '',
  password: storage.getString(K.REMEMBER_PASSWORD) || '',
});

export const setRememberedLogin = (email, password) => {
  storage.set(K.REMEMBER_EMAIL, email);
  storage.set(K.REMEMBER_PASSWORD, password);
};

export const clearRememberedLogin = () => {
  storage.delete(K.REMEMBER_EMAIL);
  storage.delete(K.REMEMBER_PASSWORD);
};

/** Wipe the entire MMKV instance (factory reset / QA) */
export const clearAll = () => storage.clearAll();
