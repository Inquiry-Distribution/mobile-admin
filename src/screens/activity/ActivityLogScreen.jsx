import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS }                          from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, FONTS }     from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW, CONFIG } from '@constants/config';
import { getInitials, formatDateTime, stripHtml, getRoleLabel, getStatusLabel } from '@utils/helpers';
import { activityApi }                     from '@api/activity.api';

import Toast      from 'react-native-toast-message';
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

// ── Select options ────────────────────────────────────────────
const DATE_OPTIONS = DATE_PRESETS.map((p, i) => ({ label: p.label, value: i, icon: p.icon }));

const TYPE_OPTIONS = [
  { label: 'All Types',  value: null,                        icon: 'layers-outline'      },
  { label: 'Views',      value: 'inquiry_viewed',            icon: 'eye-outline'         },
  { label: 'Calls',      value: 'inquiry_call_initiated',    icon: 'phone-outline'       },
  { label: 'Status',     value: 'inquiry_status_changed',    icon: 'flag-outline'        },
  { label: 'Notes',      value: 'inquiry_note_added',        icon: 'note-text-outline'   },
  { label: 'Files',      value: 'inquiry_file_uploaded',     icon: 'file-upload-outline' },
  { label: 'Converted',  value: 'inquiry_converted',         icon: 'check-circle-outline'},
  { label: 'Reminder',   value: 'inquiry_reminder_set',      icon: 'bell-outline'        },
  { label: 'Cancelled',  value: 'inquiry_reminder_cancelled',icon: 'bell-off-outline'    },
];

// ── Event type appearance config ──────────────────────────────
const TYPE_CONFIG = {
  inquiry_viewed:            { bg: '#DBEAFE', text: '#2563EB', icon: 'eye-outline',          label: 'Viewed'     },
  inquiry_call_initiated:    { bg: '#D1FAE5', text: '#059669', icon: 'phone-outline',         label: 'Call'       },
  inquiry_status_changed:    { bg: '#E0F2FE', text: '#0284C7', icon: 'flag-outline',          label: 'Status'     },
  inquiry_note_added:        { bg: '#FEF9C3', text: '#CA8A04', icon: 'note-text-outline',     label: 'Note'       },
  inquiry_file_uploaded:     { bg: '#EDE9FE', text: '#7C3AED', icon: 'file-upload-outline',   label: 'File'       },
  inquiry_converted:         { bg: '#D1FAE5', text: '#059669', icon: 'check-circle-outline',  label: 'Converted'  },
  inquiry_reminder_set:      { bg: '#FEF3C7', text: '#D97706', icon: 'bell-outline',          label: 'Reminder'   },
  inquiry_reminder_cancelled:{ bg: '#F3F4F6', text: '#6B7280', icon: 'bell-off-outline',      label: 'Reminder Off'},
};

function getTypeCfg(type) {
  const t = typeof type === 'string' ? type : '';
  return TYPE_CONFIG[t] ?? { bg: COLORS.border, text: COLORS.textMuted, icon: 'information-outline', label: t.replace(/_/g, ' ') };
}

// ── Meta summary line ─────────────────────────────────────────
function getMetaSummary(type = '', meta) {
  if (!meta) return null;
  if (type === 'inquiry_call_initiated')   return meta.phone ? `Called ${meta.phone}` : null;
  if (type === 'inquiry_status_changed')   return meta.from && meta.to ? `${getStatusLabel(meta.from)} → ${getStatusLabel(meta.to)}` : null;
  if (type === 'inquiry_note_added')       return meta.note || null;
  if (type === 'inquiry_file_uploaded')    return meta.count != null ? `${meta.count} file(s)` : null;
  if (type === 'inquiry_converted')        return meta.mobile ? `Mobile: ${meta.mobile}` : null;
  if (type === 'inquiry_reminder_set')     return meta.reminderAt ? dayjs(meta.reminderAt).format('DD MMM YYYY HH:mm') : null;
  return null;
}

// ── Meta label map ────────────────────────────────────────────
const META_LABEL = {
  phone:      'Phone',
  from:       'From status',
  to:         'To status',
  charCount:  'Char count',
  count:      'File count',
  types:      'File types',
  mobile:     'Mobile',
  reminderAt: 'Reminder at',
  source:     'Source',
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

// ── FilterSelect ──────────────────────────────────────────────
// `isFiltered` lets callers decide when a selection counts as "active" (e.g. date
// index 3 = "All" should not highlight the box).
function FilterSelect({ defaultIcon, defaultLabel, options, value, onChange, isFiltered }) {
  const [open, setOpen] = useState(false);
  const selected  = options.find((o) => o.value === value) ?? null;
  const highlight = isFiltered ?? (value !== null);

  return (
    <>
      <TouchableOpacity
        style={[styles.selectBox, highlight && styles.selectBoxActive]}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
      >
        <Icon
          name={selected?.icon ?? defaultIcon}
          size={13}
          color={highlight ? COLORS.primary : COLORS.textMuted}
          style={styles.selectIcon}
        />
        <Text
          style={[styles.selectLabel, highlight && styles.selectLabelActive]}
          numberOfLines={1}
        >
          {selected?.label ?? defaultLabel}
        </Text>
        <Icon
          name="chevron-down"
          size={14}
          color={highlight ? COLORS.primary : COLORS.textMuted}
        />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity style={styles.overlay} onPress={() => setOpen(false)} activeOpacity={1}>
          <View style={styles.dropdownCard}>
            {options.map((opt) => {
              const active = value === opt.value;
              const cfg    = opt.value ? getTypeCfg(opt.value) : null;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                  onPress={() => { onChange(opt.value); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dropdownIconBox, active && cfg && { backgroundColor: cfg.bg }]}>
                    <Icon
                      name={opt.icon}
                      size={14}
                      color={active && cfg ? cfg.text : active ? COLORS.primary : COLORS.textSecondary}
                    />
                  </View>
                  <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>
                    {opt.label}
                  </Text>
                  {active && (
                    <Icon name="check-circle" size={15} color={COLORS.primary} style={styles.dropdownCheck} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
export default function ActivityLogScreen() {
  const [logs, setLogs]               = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);

  const [search, setSearch]           = useState('');
  const [presetIndex, setPresetIndex] = useState(3); // default: All
  const [typeFilter, setTypeFilter]   = useState(null);

  const [isLoading, setIsLoading]         = useState(true);
  const [isRefreshing, setIsRefreshing]   = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const searchRef = useRef(null);

  const buildParams = useCallback(
    (pg, searchOverride) => {
      const activeSearch = searchOverride !== undefined ? searchOverride : search;
      const range  = getRange(DATE_PRESETS[presetIndex]);
      const params = { page: pg, limit: CONFIG.PAGE_SIZE, ...range };
      if (activeSearch.trim()) params.search = activeSearch.trim();
      if (typeFilter)          params.type   = typeFilter;
      return params;
    },
    [search, presetIndex, typeFilter],
  );

  const fetchPage1 = useCallback(
    async (refreshing = false, searchOverride) => {
      if (refreshing) setIsRefreshing(true);
      else            setIsLoading(true);
      try {
        const res        = await activityApi.getAll(buildParams(1, searchOverride));
        const data       = Array.isArray(res?.data?.logs) ? res.data.logs : [];
        const totalCount = res?.data?.total ?? data.length;
        setLogs(data);
        setTotal(totalCount);
        setHasMore(data.length < totalCount);
        setPage(1);
      } catch (_) {
        Toast.show({ type: 'error', text1: 'Failed to load', text2: 'Could not fetch activity logs.' });
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
      const res  = await activityApi.getAll(buildParams(nextPage));
      const data = Array.isArray(res?.data?.logs) ? res.data.logs : [];
      setLogs((prev) => [...prev, ...data]);
      setHasMore(logs.length + data.length < total);
      setPage(nextPage);
    } catch (_) {
      Toast.show({ type: 'error', text1: 'Load failed', text2: 'Could not load more entries.' });
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page, buildParams, logs.length, total]);

  useEffect(() => { fetchPage1(); }, [presetIndex, typeFilter]);

  if (isLoading && logs.length === 0) return <Loader />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* ── Search by name / employee ID ─────────────────── */}
      <View style={styles.searchWrap}>
        <Icon name="magnify" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          placeholder="Search by name or employee ID…"
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

      {/* ── Filter selects ───────────────────────────────── */}
      <View style={styles.filterRow}>
        <FilterSelect
          defaultIcon="calendar-blank-outline"
          defaultLabel="Date Range"
          options={DATE_OPTIONS}
          value={presetIndex}
          onChange={setPresetIndex}
          isFiltered={presetIndex !== 3}
        />
        <FilterSelect
          defaultIcon="layers-outline"
          defaultLabel="All Types"
          options={TYPE_OPTIONS}
          value={typeFilter}
          onChange={setTypeFilter}
        />
      </View>

      {/* ── List ─────────────────────────────────────────── */}
      <View style={styles.listWrap}>
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ActivityRow log={item} />}
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
                icon="chart-timeline-variant-shimmer"
                title="No activity"
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
      </View>
    </SafeAreaView>
  );
}

// ── Activity row ──────────────────────────────────────────────
function ActivityRow({ log }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  const cfg        = getTypeCfg(log.type);
  const actor      = log.user;
  const inquiry    = log.inquiry;
  const meta       = log.metadata;
  const summary    = getMetaSummary(log.type, meta);
  const hasDetail  = !!meta && Object.keys(meta).length > 0;
  const inquirySnippet = inquiry?.description
    ? stripHtml(inquiry.description).slice(0, 60)
    : inquiry?.mobile ?? null;

  return (
    <TouchableOpacity style={styles.row} onPress={toggle} activeOpacity={0.85}>
      {/* Left — event icon */}
      <View style={[styles.eventIcon, { backgroundColor: cfg.bg }]}>
        <Icon name={cfg.icon} size={16} color={cfg.text} />
      </View>

      <View style={styles.rowBody}>
        {/* Top: type badge + time */}
        <View style={styles.rowTop}>
          <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.typeBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.rowTime}>{dayjs(log.createdAt).fromNow()}</Text>
        </View>

        {/* Actor row */}
        <View style={styles.actorRow}>
          <View style={styles.actorInitials}>
            <Text style={styles.actorInitialsText}>{getInitials(actor?.name ?? '?')}</Text>
          </View>
          <Text style={styles.actorName} numberOfLines={1}>
            {actor?.name ?? 'Unknown'}
          </Text>
          {actor?.employeeId ? (
            <Text style={styles.employeeId}>#{actor.employeeId}</Text>
          ) : null}
        </View>

        {/* Inquiry snippet */}
        {inquirySnippet ? (
          <Text style={styles.inquirySnippet} numberOfLines={1}>
            <Text style={styles.inquiryLabel}>Inquiry · </Text>
            {inquirySnippet}
          </Text>
        ) : null}

        {/* Summary line */}
        {summary ? (
          <Text style={styles.summaryLine} numberOfLines={expanded ? undefined : 1}>
            {summary}
          </Text>
        ) : null}

        {/* Expanded metadata */}
        {expanded && (
          <View style={styles.expandedBox}>
            {hasDetail ? (
              <View style={styles.metaTable}>
                {renderMetaRows(meta)}
              </View>
            ) : null}

            <View style={styles.expandedFooter}>
              <Icon name="clock-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.expandedFooterText}>{formatDateTime(log.createdAt)}</Text>
              {actor?.role ? (
                <>
                  <Icon name="account-outline" size={11} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
                  <Text style={styles.expandedFooterText}>{getRoleLabel(actor.role)}</Text>
                </>
              ) : null}
              {log.deviceId ? (
                <>
                  <Icon name="cellphone" size={11} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
                  <Text style={styles.expandedFooterText}>{log.deviceId.slice(0, 8)}…</Text>
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
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    borderRadius:      BORDER_RADIUS.md,
    margin:            SPACING.md,
    marginBottom:      SPACING.xs,
    paddingHorizontal: SPACING.sm,
    ...SHADOW.sm,
  },
  searchIcon:  { marginRight: 6 },
  searchInput: { flex: 1, height: 44, ...TYPOGRAPHY.body, color: COLORS.textPrimary },

  filterRow: {
    flexDirection:  'row',
    paddingHorizontal: SPACING.md,
    paddingBottom:  SPACING.xs,
    gap:            SPACING.sm,
  },

  // ── Select box ──────────────────────────────────────────────
  selectBox: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    height:            34,
    borderRadius:      BORDER_RADIUS.md,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACING.sm,
    ...SHADOW.sm,
  },
  selectBoxActive: {
    borderColor:     COLORS.primaryMid,
    backgroundColor: COLORS.primaryLight,
  },
  selectIcon:  { marginRight: 5 },
  selectLabel: {
    flex:       1,
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.medium,
    color:      COLORS.textSecondary,
  },
  selectLabelActive: {
    color:      COLORS.primary,
    fontFamily: FONTS.bold,
  },

  // ── Dropdown modal ───────────────────────────────────────────
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent:  'center',
    paddingHorizontal: SPACING.xl,
  },
  dropdownCard: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.xl,
    overflow:        'hidden',
    ...SHADOW.lg,
  },
  dropdownItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  dropdownIconBox: {
    width:           28,
    height:          28,
    borderRadius:    BORDER_RADIUS.sm,
    backgroundColor: COLORS.background,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     SPACING.sm,
  },
  dropdownItemText: {
    flex:       1,
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.medium,
    color:      COLORS.textSecondary,
  },
  dropdownItemTextActive: {
    color:      COLORS.primary,
    fontFamily: FONTS.bold,
  },
  dropdownCheck: { marginLeft: SPACING.xs },

  listHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
  },
  countText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

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

  eventIcon: {
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
  typeBadge: {
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
    maxWidth:          '75%',
  },
  typeBadgeText: {
    fontSize:      FONT_SIZE.xs,
    fontFamily:    FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rowTime: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontSize: FONT_SIZE.xs, flexShrink: 0 },

  actorRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  3,
    gap:           5,
  },
  actorInitials: {
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  actorInitialsText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, color: COLORS.primary },
  actorName:         { ...TYPOGRAPHY.small, fontFamily: FONTS.bold, color: COLORS.textPrimary, flexShrink: 1 },
  employeeId:        { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontFamily: FONTS.medium },

  inquiryLabel:   { fontFamily: FONTS.bold, color: COLORS.textSecondary },
  inquirySnippet: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 2 },
  summaryLine:    { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 2 },

  expandedBox: {
    marginTop:      SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop:     SPACING.xs,
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
    flex:       1,
    fontSize:   FONT_SIZE.xs,
    color:      COLORS.textPrimary,
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

  listWrap:     { flex: 1 },
  loadingMore:  { paddingVertical: SPACING.lg, alignItems: 'center' },
  listContent:  { paddingBottom: SPACING.xxl },
  emptyContent: { flexGrow: 1 },
});
