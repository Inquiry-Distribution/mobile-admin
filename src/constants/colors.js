/**
 * Admin App Color Palette
 * Primary: Purple/Violet — distinct from the Salesperson app (blue #1A73E8).
 * Superuser UI accents use a gold/amber tint to signal elevated access.
 */

export const COLORS = {
  // ─── Brand ────────────────────────────────────────────────────
  primary:       '#7C3AED',   // violet-600  — main admin colour
  primaryDark:   '#5B21B6',   // violet-800  — pressed / header
  primaryLight:  '#EDE9FE',   // violet-50   — backgrounds / chips
  primaryMid:    '#A78BFA',   // violet-400  — borders / soft accents

  // Superuser-only accent (gold) shown on Audit Logs & role badge
  superuser:     '#D97706',   // amber-600
  superuserLight:'#FEF3C7',   // amber-50

  // ─── Secondary (action/success) ───────────────────────────────
  secondary:      '#059669',  // emerald-600
  secondaryLight: '#D1FAE5',  // emerald-50

  // ─── Inquiry status ───────────────────────────────────────────
  unassigned:    '#9CA3AF',   // gray-400
  assigned:      '#3B82F6',   // blue-500
  inProgress:    '#F59E0B',   // amber-400
  followUp:      '#8B5CF6',   // violet-500
  notInterested: '#EF4444',   // red-500
  converted:     '#10B981',   // emerald-500
  closed:        '#6B7280',   // gray-500

  // ─── Priority ─────────────────────────────────────────────────
  low:    '#059669',          // emerald
  medium: '#D97706',          // amber
  high:   '#DC2626',          // red

  // ─── Neutral surface ─────────────────────────────────────────
  white:       '#FFFFFF',
  black:       '#000000',
  background:  '#F5F3FF',     // faint violet tint on bg
  surface:     '#FFFFFF',
  card:        '#FFFFFF',
  border:      '#DDD6FE',     // violet-200
  divider:     '#EDE9FE',     // violet-50

  // ─── Text ─────────────────────────────────────────────────────
  textPrimary:   '#1E1B4B',   // indigo-950  — deep heading colour
  textSecondary: '#6B7280',   // gray-500
  textMuted:     '#9CA3AF',   // gray-400
  textWhite:     '#FFFFFF',

  // ─── Feedback ─────────────────────────────────────────────────
  success: '#059669',
  error:   '#DC2626',
  warning: '#D97706',
  info:    '#2563EB',

  // ─── Tab bar ─────────────────────────────────────────────────
  tabActive:   '#7C3AED',
  tabInactive: '#9CA3AF',

  // ─── Device status ───────────────────────────────────────────
  deviceActive:  '#059669',
  deviceBlocked: '#DC2626',

  // ─── Attendance ──────────────────────────────────────────────
  present:   '#059669',
  absent:    '#DC2626',
  halfDay:   '#D97706',
  checkIn:   '#059669',
  checkOut:  '#DC2626',

  // ─── Map markers ─────────────────────────────────────────────
  markerOnline:  '#059669',
  markerOffline: '#9CA3AF',
};

// ── Semantic maps used by Badge / StatusBadge components ────────
export const STATUS_COLORS = {
  unassigned:     { bg: '#F3F4F6', text: '#9CA3AF' },
  assigned:       { bg: '#EFF6FF', text: '#3B82F6' },
  in_progress:    { bg: '#FFFBEB', text: '#F59E0B' },
  follow_up:      { bg: '#F5F3FF', text: '#8B5CF6' },
  not_interested: { bg: '#FEF2F2', text: '#EF4444' },
  converted:      { bg: '#ECFDF5', text: '#10B981' },
  closed:         { bg: '#F9FAFB', text: '#6B7280' },
};

export const PRIORITY_COLORS = {
  low:    { bg: '#D1FAE5', text: '#059669' },
  medium: { bg: '#FEF3C7', text: '#D97706' },
  high:   { bg: '#FEE2E2', text: '#DC2626' },
};

export const ROLE_COLORS = {
  superuser: { bg: '#FEF3C7', text: '#D97706' },
  admin:     { bg: '#EDE9FE', text: '#7C3AED' },
  sales:     { bg: '#DBEAFE', text: '#2563EB' },
};

export const DEVICE_STATUS_COLORS = {
  active:   { bg: '#D1FAE5', text: '#059669' },
  blocked:  { bg: '#FEE2E2', text: '#DC2626' },
};

export const ATTENDANCE_STATUS_COLORS = {
  present:   { bg: '#D1FAE5', text: '#059669' },
  absent:    { bg: '#FEE2E2', text: '#DC2626' },
  half_day:  { bg: '#FEF3C7', text: '#D97706' },
};
