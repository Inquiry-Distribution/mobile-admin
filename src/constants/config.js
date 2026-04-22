// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — Inquiry Desk Admin
//
// Values are read from .env via react-native-config.
// Fallbacks are provided for dev convenience.
//
// Find your server IP:
//   Windows: ipconfig → IPv4 Address
//   Mac/Linux: ifconfig | grep "inet "
// ─────────────────────────────────────────────────────────────────────────────
import Config from 'react-native-config';

export const CONFIG = {
  // ── API & Socket ──────────────────────────────────────────────
  API_BASE_URL: Config.API_BASE_URL  || 'http://145.223.102.253:5001/api/v1',
  SOCKET_URL:   Config.SOCKET_URL    || 'http://145.223.102.253:5001',

  // ── Google Maps ───────────────────────────────────────────────
  GOOGLE_MAPS_API_KEY: Config.GOOGLE_MAPS_API_KEY || '',

  // ── Request timeout ───────────────────────────────────────────
  API_TIMEOUT: 20000,           // 20 s  (admin calls can be heavier)

  // ── Pagination defaults ───────────────────────────────────────
  PAGE_SIZE: 20,

  // ── Map config ────────────────────────────────────────────────
  MAP_LIVE_REFRESH_MS:    15000,  // poll live locations every 15 s
  MAP_DEFAULT_LATITUDE:   28.6139,
  MAP_DEFAULT_LONGITUDE:  77.2090,
  MAP_DEFAULT_DELTA:      0.05,

  // ── MMKV storage keys ─────────────────────────────────────────
  STORAGE_KEYS: {
    ACCESS_TOKEN:  'admin_access_token',
    REFRESH_TOKEN: 'admin_refresh_token',
    USER:          'admin_user',
  },
};

// ─── Spacing scale (used across StyleSheet objects) ────────────
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

// ─── Border radius scale ───────────────────────────────────────
export const BORDER_RADIUS = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 999,
};

// ─── Shadow presets (iOS & Android) ───────────────────────────
export const SHADOW = {
  sm: {
    shadowColor:   '#7C3AED',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius:  3,
    elevation:     2,
  },
  md: {
    shadowColor:   '#7C3AED',
    shadowOffset:  { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius:  6,
    elevation:     4,
  },
  lg: {
    shadowColor:   '#7C3AED',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius:  12,
    elevation:     8,
  },
};

// ─── Human-readable labels ────────────────────────────────────
export const INQUIRY_STATUS_LABELS = {
  unassigned:  'Unassigned',
  assigned:    'Assigned',
  in_progress: 'In Progress',
  follow_up:   'Follow Up',
  closed:      'Closed',
};

export const PRIORITY_LABELS = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
};

export const ROLE_LABELS = {
  superuser: 'Super User',
  admin:     'Admin',
  sales:     'Salesperson',
};

export const ATTENDANCE_STATUS_LABELS = {
  present:  'Present',
  absent:   'Absent',
  half_day: 'Half Day',
};
