import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS }                    from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW, CONFIG } from '@constants/config';
import { getInitials, formatDateTime } from '@utils/helpers';
import { auditApi }                  from '@api/audit.api';

import Loader     from '@components/common/Loader';
import EmptyState from '@components/common/EmptyState';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Date range presets ────────────────────────────────────────
const DATE_PRESETS = [
  { label: 'Today',   days: 0,    icon: 'calendar-today'         },
  { label: '7 Days',  days: 7,    icon: 'calendar-week'          },
  { label: '30 Days', days: 30,   icon: 'calendar-month-outline' },
  { label: 'All',     days: null, icon: 'calendar-blank-outline' },
];

function getRange(preset) {
  if (preset.days === null) return {};
  if (preset.days === 0) {
    const today = dayjs().format('YYYY-MM-DD');
    return { from: today, to: today };
  }
  return {
    from: dayjs().subtract(preset.days, 'day').format('YYYY-MM-DD'),
    to:   dayjs().format('YYYY-MM-DD'),
  };
}

// ── Target model filter chips ─────────────────────────────────
const MODEL_FILTERS = [
  { label: 'All',     value: null,      icon: 'layers-outline'       },
  { label: 'Inquiry', value: 'Inquiry', icon: 'clipboard-text-outline'},
  { label: 'User',    value: 'User',    icon: 'account-outline'       },
];

// ── Action appearance config ──────────────────────────────────
const ACTION_CONFIG = {
  CREATED:        { bg: '#DCFCE7', text: '#16A34A', icon: 'plus-circle-outline'    },
  UPDATED:        { bg: '#DBEAFE', text: '#2563EB', icon: 'pencil-outline'          },
  DELETED:        { bg: '#FEE2E2', text: '#DC2626', icon: 'trash-can-outline'       },
  LOGIN:          { bg: '#EDE9FE', text: '#7C3AED', icon: 'login'                   },
  LOGOUT:         { bg: '#F3F4F6', text: '#6B7280', icon: 'logout'                  },
  DISTRIBUTED:    { bg: '#BFDBFE', text: '#1D4ED8', icon: 'share-outline'           },
  SHARED:         { bg: '#BFDBFE', text: '#1D4ED8', icon: 'share-variant-outline'   },
  REASSIGNED:     { bg: '#FEF3C7', text: '#D97706', icon: 'swap-horizontal'         },
  UNASSIGNED:     { bg: '#FEF3C7', text: '#B45309', icon: 'account-minus-outline'   },
  STATUS_CHANGED: { bg: '#E0F2FE', text: '#0284C7', icon: 'flag-outline'            },
  NOTE_ADDED:     { bg: '#FEF9C3', text: '#CA8A04', icon: 'note-text-outline'       },
  CONVERTED:      { bg: '#D1FAE5', text: '#059669', icon: 'check-circle-outline'    },
  BLOCKED:        { bg: '#FEF3C7', text: '#D97706', icon: 'block-helper'            },
};

function getActionCfg(action = '') {
  const key = Object.keys(ACTION_CONFIG).find((k) => action.toUpperCase().includes(k));
  return ACTION_CONFIG[key] ?? { bg: COLORS.border, text: COLORS.textMuted, icon: 'information-outline' };
}

// ── Human-readable meta summary (one line) ────────────────────
function getMetaSummary(action = '', meta = {}) {
  if (!meta) return null;
  const a = action.toUpperCase();
  if (a.includes('LOGIN'))          return `${meta.loginType ?? ''} · ${meta.role ?? ''} ${meta.isNewDevice ? '· new device' : ''}`.trim();
  if (a.includes('LOGOUT'))         return `${meta.loginType ?? ''} · ${meta.role ?? ''}`.trim();
  if (a.includes('REASSIGNED'))     return `${meta.fromName ?? '?'} → ${meta.toName ?? '?'}`;
  if (a.includes('DISTRIBUTED'))    return meta.assignedToName ? `→ ${meta.assignedToName}` : null;
  if (a.includes('SHARED'))         return meta.assignedToName ? `→ ${meta.assignedToName}` : null;
  if (a.includes('UNASSIGNED'))     return meta.previousAssigneeName ? `was ${meta.previousAssigneeName}` : null;
  if (a.includes('STATUS_CHANGED')) return meta.from && meta.to ? `${meta.from} → ${meta.to}` : null;
  if (a.includes('NOTE_ADDED'))     return meta.note ? String(meta.note).slice(0, 60) : null;
  if (a.includes('CONVERTED'))      return meta.mobile ?? null;
  if (a.includes('UPDATED'))        return Array.isArray(meta.changedFields) ? meta.changedFields.join(', ') : null;
  if (a.includes('DELETED'))        return meta.mobile ?? meta.description?.slice(0, 50) ?? null;
  if (a.includes('CREATED'))        return meta.mobile ?? null;
  return null;
}

// ── Structured meta rows for expanded view ────────────────────
const META_LABEL = {
  loginType:            'Login via',
  role:                 'Role',
  email:                'Email',
  employeeId:           'Employee ID',
  deviceId:             'Device ID',
  platform:             'Platform',
  isNewDevice:          'New device',
  assignedToName:       'Assigned to',
  assignedToId:         'Assignee ID',
  fromName:             'From',
  toName:               'To',
  previousAssigneeName: 'Prev. assignee',
  from:                 'From status',
  to:                   'To status',
  note:                 'Note',
  changedFields:        'Fields changed',
  description:          'Description',
  mobile:               'Mobile',
  source:               'Source',
  priority:             'Priority',
  status:               'Status',
};

function renderMetaRows(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const entries = Object.entries(meta).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => {
    const label = META_LABEL[k] ?? k;
    let display = Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
    if (display.length > 80) display = display.slice(0, 80) + '…';
    return (
      <View key={k} style={styles.metaRow}>
        <Text style={styles.metaKey}>{label}</Text>
        <Text style={styles.metaVal}>{display}</Text>
      </View>
    );
  });
}

// ── Role badge ────────────────────────────────────────────────
const ROLE_COLORS = {
  superuser: { bg: '#EDE9FE', text: '#7C3AED' },
  admin:     { bg: '#DBEAFE', text: '#2563EB' },
  sales:     { bg: '#D1FAE5', text: '#059669' },
};

function RoleBadge({ role }) {
  if (!role) return null;
  const c = ROLE_COLORS[role] ?? { bg: COLORS.border, text: COLORS.textMuted };
  return (
    <View style={[styles.roleBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.roleBadgeText, { color: c.text }]}>{role}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
export default function AuditLogScreen() {
  const [logs, setLogs]               = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);

  const [search, setSearch]           = useState('');
  const [presetIndex, setPresetIndex] = useState(3);   // default: All
  const [modelFilter, setModelFilter] = useState(null); // null = all

  const [isLoading, setIsLoading]         = useState(true);
  const [isRefreshing, setIsRefreshing]   = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const searchRef = useRef(null);

  const buildParams = useCallback(
    (pg, searchOverride) => {
      const activeSearch = searchOverride !== undefined ? searchOverride : search;
      const range = getRange(DATE_PRESETS[presetIndex]);
      const params = { page: pg, limit: CONFIG.PAGE_SIZE, ...range };
      if (activeSearch.trim())  params.action      = activeSearch.trim();
      if (modelFilter)          params.targetModel  = modelFilter;
      return params;
    },
    [search, presetIndex, modelFilter],
  );

  const fetchPage1 = useCallback(
    async (refreshing = false, searchOverride) => {
      if (refreshing) setIsRefreshing(true);
      else            setIsLoading(true);
      try {
        const res  = await auditApi.getAll(buildParams(1, searchOverride));
        const data = Array.isArray(res?.data?.logs) ? res.data.logs : [];
        setLogs(data);
        setTotal(res?.data?.total ?? data.length);
        setHasMore(data.length === CONFIG.PAGE_SIZE);
        setPage(1);
      } catch (_) {
        // keep stale
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [buildParams],
  );

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res  = await auditApi.getAll(buildParams(nextPage));
      const data = Array.isArray(res?.data?.logs) ? res.data.logs : [];
      setLogs((prev) => [...prev, ...data]);
      setHasMore(data.length === CONFIG.PAGE_SIZE);
      setPage(nextPage);
    } catch (_) {
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page, buildParams]);

  useEffect(() => { fetchPage1(); }, [presetIndex, modelFilter]);

  if (isLoading && logs.length === 0) return <Loader />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* ── Search ───────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Icon name="magnify" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          placeholder="Filter by action (e.g. login, assign)…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={() => fetchPage1()}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => { setSearch(''); fetchPage1(false, ''); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filters row ──────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {/* Date presets */}
        {DATE_PRESETS.map((p, i) => {
          const active = presetIndex === i;
          return (
            <TouchableOpacity
              key={p.label}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setPresetIndex(i)}
              activeOpacity={0.75}
            >
              <Icon name={p.icon} size={11} color={active ? COLORS.white : COLORS.textSecondary} style={{ marginRight: 3 }} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.chipDivider} />

        {/* Model filter */}
        {MODEL_FILTERS.map((f) => {
          const active = modelFilter === f.value;
          return (
            <TouchableOpacity
              key={f.label}
              style={[styles.chip, active && styles.chipModelActive]}
              onPress={() => setModelFilter(f.value)}
              activeOpacity={0.75}
            >
              <Icon name={f.icon} size={11} color={active ? '#0284C7' : COLORS.textSecondary} style={{ marginRight: 3 }} />
              <Text style={[styles.chipText, active && styles.chipModelText]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ─────────────────────────────────────────── */}
      <FlatList
        data={logs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <AuditRow log={item} />}
        refreshing={isRefreshing}
        onRefresh={() => fetchPage1(true)}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.countText}>
              {total} event{total !== 1 ? 's' : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="clipboard-text-off-outline"
              title="No audit logs"
              message="No events found for the selected filters."
            />
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : null
        }
        contentContainerStyle={logs.length === 0 ? styles.emptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ── Audit row ─────────────────────────────────────────────────
function AuditRow({ log }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  const cfg         = getActionCfg(log.action);
  const performer   = log.performedBy;
  const meta        = log.meta;
  const summary     = getMetaSummary(log.action, meta);
  const hasDetail   = !!meta && Object.keys(meta).length > 0;

  return (
    <TouchableOpacity style={styles.row} onPress={toggle} activeOpacity={0.85}>
      {/* Left — performer avatar */}
      <View style={[styles.avatar, { backgroundColor: cfg.bg }]}>
        <Icon name={cfg.icon} size={16} color={cfg.text} />
      </View>

      <View style={styles.rowBody}>
        {/* Top: action badge + time */}
        <View style={styles.rowTop}>
          <View style={[styles.actionBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.actionBadgeText, { color: cfg.text }]}>
              {log.action?.replace(/_/g, ' ')}
            </Text>
          </View>
          <Text style={styles.rowTime}>{dayjs(log.createdAt).fromNow()}</Text>
        </View>

        {/* Performer row */}
        <View style={styles.performerRow}>
          <View style={styles.performerInitials}>
            <Text style={styles.performerInitialsText}>
              {getInitials(performer?.name ?? '?')}
            </Text>
          </View>
          <Text style={styles.performerName} numberOfLines={1}>
            {performer?.name ?? 'System'}
          </Text>
          {performer?.role ? <RoleBadge role={performer.role} /> : null}
        </View>

        {/* Target model + summary line */}
        {(log.targetModel || summary) ? (
          <Text style={styles.summaryLine} numberOfLines={expanded ? undefined : 1}>
            {log.targetModel ? <Text style={styles.modelLabel}>{log.targetModel}  </Text> : null}
            {summary ?? ''}
          </Text>
        ) : null}

        {/* Expanded detail */}
        {expanded && (
          <View style={styles.expandedBox}>
            {/* Structured meta rows */}
            {hasDetail ? (
              <View style={styles.metaTable}>
                {renderMetaRows(meta)}
              </View>
            ) : null}

            {/* Footer: full timestamp + IP */}
            <View style={styles.expandedFooter}>
              <Icon name="clock-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.expandedFooterText}>{formatDateTime(log.createdAt)}</Text>
              {log.ipAddress ? (
                <>
                  <Icon name="ip-outline" size={11} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
                  <Text style={styles.expandedFooterText}>{log.ipAddress}</Text>
                </>
              ) : null}
              {performer?.email ? (
                <>
                  <Icon name="email-outline" size={11} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
                  <Text style={styles.expandedFooterText}>{performer.email}</Text>
                </>
              ) : null}
            </View>
          </View>
        )}
      </View>

      <Icon
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={COLORS.textMuted}
        style={{ marginLeft: SPACING.xs, marginTop: 2 }}
      />
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  searchWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.md,
    margin:          SPACING.md,
    marginBottom:    SPACING.xs,
    paddingHorizontal: SPACING.sm,
    ...SHADOW.sm,
  },
  searchIcon:  { marginRight: 6 },
  searchInput: { flex: 1, height: 44, ...TYPOGRAPHY.body, color: COLORS.textPrimary },

  chipScroll: { flexShrink: 0 },
  chipRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    gap:               SPACING.xs,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    height:            28,
    paddingHorizontal: SPACING.sm,
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  chipActive:      { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipModelActive: { backgroundColor: '#E0F2FE', borderColor: '#0284C7' },
  chipText:        { fontSize: FONT_SIZE.xs, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  chipTextActive:  { color: COLORS.white },
  chipModelText:   { color: '#0284C7' },
  chipDivider:     { width: 1, height: 20, backgroundColor: COLORS.border, marginHorizontal: 2 },

  listHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
  },
  countText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  // Row
  row: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
    padding:          SPACING.md,
    ...SHADOW.sm,
  },

  avatar: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    SPACING.sm,
    flexShrink:     0,
  },

  rowBody: { flex: 1 },

  rowTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   4,
  },
  actionBadge: {
    borderRadius:     BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
    maxWidth:          '75%',
  },
  actionBadgeText: {
    fontSize:      FONT_SIZE.xs,
    fontFamily:    FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rowTime: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  performerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  3,
    gap:           5,
  },
  performerInitials: {
    width:          20,
    height:         20,
    borderRadius:   10,
    backgroundColor: COLORS.primaryLight,
    alignItems:     'center',
    justifyContent: 'center',
  },
  performerInitialsText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, color: COLORS.primary },
  performerName:         { ...TYPOGRAPHY.small, fontFamily: FONTS.bold, color: COLORS.textPrimary, flexShrink: 1 },

  roleBadge: {
    borderRadius:     BORDER_RADIUS.full,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  roleBadgeText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, textTransform: 'capitalize' },

  modelLabel:  { fontFamily: FONTS.bold, color: COLORS.textSecondary },
  summaryLine: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 2 },

  // Expanded
  expandedBox: {
    marginTop:    SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop:   SPACING.xs,
  },
  metaTable: {
    backgroundColor: COLORS.background,
    borderRadius:    BORDER_RADIUS.sm,
    borderWidth:     1,
    borderColor:     COLORS.border,
    overflow:        'hidden',
    marginBottom:    SPACING.xs,
  },
  metaRow: {
    flexDirection:     'row',
    paddingHorizontal: SPACING.sm,
    paddingVertical:   5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  metaKey: {
    width:      110,
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.medium,
    color:      COLORS.textSecondary,
    flexShrink: 0,
  },
  metaVal: {
    flex:     1,
    fontSize: FONT_SIZE.xs,
    color:    COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  expandedFooter: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           3,
  },
  expandedFooterText: {
    fontSize:   FONT_SIZE.xs,
    color:      COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  loadingMore:  { paddingVertical: SPACING.lg, alignItems: 'center' },
  listContent:  { paddingBottom: SPACING.xxl },
  emptyContent: { flexGrow: 1 },
});
