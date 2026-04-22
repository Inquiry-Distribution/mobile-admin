/**
 * Shared helpers used across screens & components.
 * Pure functions — no side-effects, no imports from stores/api.
 */
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';

dayjs.extend(relativeTime);
dayjs.extend(duration);

// ─── Date / Time ─────────────────────────────────────────────

/** "14 Apr 2025" */
export const formatDate = (date) =>
  date ? dayjs(date).format('DD MMM YYYY') : '—';

/** "14 Apr 2025, 09:30 AM" */
export const formatDateTime = (date) =>
  date ? dayjs(date).format('DD MMM YYYY, hh:mm A') : '—';

/** "09:30 AM" */
export const formatTime = (date) =>
  date ? dayjs(date).format('hh:mm A') : '—';

/** "3 hours ago" / "just now" */
export const timeAgo = (date) =>
  date ? dayjs(date).fromNow() : '—';

/** "2025-04-14"  — for API query params */
export const toISODate = (date) =>
  dayjs(date).format('YYYY-MM-DD');

/** Minutes between two date strings */
export const minutesBetween = (start, end) =>
  dayjs(end).diff(dayjs(start), 'minute');

/** "1h 25m" formatted work duration */
export const formatDuration = (startIso, endIso) => {
  if (!startIso || !endIso) return '—';
  const mins = minutesBetween(startIso, endIso);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// ─── String helpers ───────────────────────────────────────────

/** "john doe" → "John Doe" */
export const capitalize = (str = '') =>
  str
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

/** "john_doe_example" → "John Doe Example" */
export const snakeToTitle = (str = '') =>
  capitalize(str.replace(/_/g, ' '));

/** "John Doe" → "JD" (max 2 chars for avatar initials) */
export const getInitials = (name = '') =>
  name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');

/** Truncate long strings: "Hello World" → "Hello Wo…" */
export const truncate = (str = '', max = 40) =>
  str.length > max ? `${str.slice(0, max)}…` : str;

// ─── Number helpers ───────────────────────────────────────────

/** 1234567 → "1,234,567" */
export const formatNumber = (n) =>
  typeof n === 'number' ? n.toLocaleString('en-IN') : '—';

/** 0.756 → "75.6%" */
export const formatPercent = (ratio, decimals = 1) =>
  typeof ratio === 'number'
    ? `${(ratio * 100).toFixed(decimals)}%`
    : '—';

// ─── Status / label helpers ───────────────────────────────────

export const STATUS_LABEL = {
  unassigned:  'Unassigned',
  assigned:    'Assigned',
  in_progress: 'In Progress',
  follow_up:   'Follow Up',
  closed:      'Closed',
};

export const PRIORITY_LABEL = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
};

export const ROLE_LABEL = {
  superuser: 'Super User',
  admin:     'Admin',
  sales:     'Salesperson',
};

export const ATTENDANCE_LABEL = {
  present:  'Present',
  absent:   'Absent',
  half_day: 'Half Day',
};

export const getStatusLabel  = (s) => STATUS_LABEL[s]     ?? snakeToTitle(s);
export const getPriorityLabel = (p) => PRIORITY_LABEL[p]  ?? capitalize(p);
export const getRoleLabel     = (r) => ROLE_LABEL[r]      ?? capitalize(r);
export const getAttendanceLabel = (a) => ATTENDANCE_LABEL[a] ?? snakeToTitle(a);

// ─── Validation helpers ───────────────────────────────────────

export const isValidEmail = (email = '') =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const isValidPhone = (phone = '') =>
  /^[0-9]{10,15}$/.test(phone.replace(/[\s\-+]/g, ''));

// ─── Pagination helpers ───────────────────────────────────────

/**
 * Build a query string from a params object, skipping null/undefined.
 * buildQuery({ page: 1, status: 'open', q: null }) → "?page=1&status=open"
 */
export const buildQuery = (params = {}) => {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `?${qs}` : '';
};

// ─── Coordinate helpers ────────────────────────────────────────

/** Haversine distance in km between two GPS points */
export const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R   = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Error normaliser ─────────────────────────────────────────

/** Extract a clean error message from an Axios error or unknown throw */
export const getErrorMessage = (err, fallback = 'Something went wrong.') =>
  err?.message || err?.response?.data?.message || fallback;
