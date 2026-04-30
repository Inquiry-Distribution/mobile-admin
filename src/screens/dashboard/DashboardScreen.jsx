/**
 * DashboardScreen — Admin & Superuser
 *
 * Improvements:
 *  1. "Add Inquiry" quick action
 *  2. Extra KPI cards: Devices + Blocked Devices
 *  3. Date box shows day-of-week name
 *  4. Team section uses correct API fields (totalSales, totalDevices)
 *  6. Inline Distribute button on unassigned rows
 *  7. "X new today" badge on Inquiry Overview
 *  8. Toast feedback after pull-to-refresh
 *  9. Error state with Retry button
 * 10. Conversion-rate removed (not in summary API); replaced by device stats
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import Icon                from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast               from 'react-native-toast-message';
import dayjs               from 'dayjs';

import { COLORS }                             from '@constants/colors';
import { TYPOGRAPHY }                         from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW }     from '@constants/config';
import { toISODate }                          from '@utils/helpers';

import { reportApi }         from '@api/report.api';
import { inquiryApi }        from '@api/inquiry.api';
import useAuthStore          from '@store/auth.store';
import useInquiryStore       from '@store/inquiry.store';
import useNotificationStore  from '@store/notification.store';

import Loader          from '@components/common/Loader';
import StatCard        from '@components/common/StatCard';
import StatusBadge     from '@components/common/StatusBadge';
import DistributeModal from '@components/inquiry/DistributeModal';

// ─── Period filter config ─────────────────────────────────────
const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all',   label: 'All Time' },
];

function getPeriodRange(key) {
  const today = dayjs();
  switch (key) {
    case 'today':
      return { from: toISODate(today.toDate()), to: toISODate(today.toDate()) };
    case 'week': {
      const day    = today.day(); // 0=Sun
      const monday = day === 0
        ? today.subtract(6, 'day')
        : today.subtract(day - 1, 'day');
      return { from: toISODate(monday.toDate()), to: toISODate(today.toDate()) };
    }
    case 'month':
      return { from: toISODate(today.startOf('month').toDate()), to: toISODate(today.toDate()) };
    case 'all':
    default:
      return {};
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Screen ───────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  // ── Navigate to a tab with a clean nested stack ──────────────
  // Resets the target tab's stack so pressing Back never leads to
  // a stale deep screen left over from a previous session in that tab.
  // screens = array of { name, params? } defining the exact stack to set.
  const goToTab = useCallback((tabName, screens) => {
    navigation.dispatch((state) => {
      const routes = state.routes.map((r) =>
        r.name === tabName
          ? { ...r, state: { routes: screens, index: screens.length - 1 } }
          : r
      );
      return CommonActions.reset({
        ...state,
        routes,
        index: state.routes.findIndex((r) => r.name === tabName),
      });
    });
  }, [navigation]);

  const { user, isSuperuser } = useAuthStore();
  const {
    unassigned,
    fetchUnassigned,
    summaryRefreshKey,
  } = useInquiryStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const [summary,        setSummary]        = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [kpiLoading,     setKpiLoading]     = useState(false);  // chip-switch spinner
  const [summaryError,   setSummaryError]   = useState(false);
  const [todayCount,     setTodayCount]     = useState(null);
  const [refreshing,     setRefreshing]     = useState(false);
  const [activePeriod,   setActivePeriod]   = useState('all');

  // Distribute modal state
  const [distributeInquiry, setDistributeInquiry] = useState(null);

  // Track whether this is the very first focus (to show full loader only on mount)
  const isFirstFocus = useRef(true);

  // ── Loaders ──────────────────────────────────────────────────
  const loadSummary = useCallback(async (periodKey = 'all', isInitial = false) => {
    setSummaryError(false);
    if (isInitial) setSummaryLoading(true);
    else           setKpiLoading(true);
    try {
      const range = getPeriodRange(periodKey);
      const res   = await reportApi.getSummary(range);
      setSummary(res.data ?? res);
    } catch (_) {
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
      setKpiLoading(false);
    }
  }, []);

  const loadTodayCount = useCallback(async () => {
    try {
      const today = toISODate(new Date());
      const res   = await inquiryApi.getAll({ from: today, to: today, limit: 1, page: 1 });
      setTodayCount(res.data?.total ?? res.data?.inquiries?.length ?? null);
    } catch (_) {}
  }, []);

  // ── Reload every time the screen gains focus ─────────────────
  // Covers: initial mount AND returning to this tab from any other tab.
  // Full loader (isInitial=true) only on first mount; silent refresh on return.
  useFocusEffect(
    useCallback(() => {
      const first = isFirstFocus.current;
      isFirstFocus.current = false;
      loadSummary(activePeriod, first);
      loadTodayCount();
      fetchUnassigned();
    }, [activePeriod]),
  );

  // ── React to inquiry creation / mutation from any screen ─────
  // summaryRefreshKey is incremented by CreateInquiry (and any other
  // mutation screen). This fires even if Dashboard never lost focus
  // (e.g. user returns to Dashboard tab, or a socket event triggers it).
  useEffect(() => {
    if (summaryRefreshKey === 0) return; // skip on initial mount
    loadSummary(activePeriod, false);
    loadTodayCount();
  }, [summaryRefreshKey]);

  const onPeriodChange = useCallback((key) => {
    setActivePeriod(key);
    loadSummary(key);
  }, [loadSummary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSummary(activePeriod), loadTodayCount(), fetchUnassigned()]);
    setRefreshing(false);
    Toast.show({
      type:  'success',
      text1: 'Dashboard refreshed',
      visibilityTime: 1500,
    });
  }, [activePeriod]);

  // ── Error / Loading states ────────────────────────────────────
  if (summaryLoading && !refreshing) return <Loader />;

  if (summaryError && !summary) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.errorState}>
          <Icon name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>Failed to load dashboard</Text>
          <Text style={styles.errorSub}>Check your connection and try again.</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { loadSummary(activePeriod, true); loadTodayCount(); fetchUnassigned(); }}
            activeOpacity={0.85}
          >
            <Icon name="refresh" size={16} color={COLORS.white} />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const s           = summary ?? {};
  const urgentCount = unassigned.length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >

        {/* ── Greeting header ──────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name?.split(' ')[0] ?? 'Admin'}
            </Text>
            <View style={styles.roleChip}>
              <Icon
                name={isSuperuser() ? 'crown' : 'shield-star-outline'}
                size={10}
                color={isSuperuser() ? COLORS.superuser : COLORS.primary}
              />
              <Text style={[
                styles.roleChipText,
                { color: isSuperuser() ? COLORS.superuser : COLORS.primary },
              ]}>
                {isSuperuser() ? 'Superuser' : 'Admin'}
              </Text>
            </View>
          </View>

          {/* Improvement #3 — date box with day name */}
          <View style={styles.dateBox}>
            <Text style={styles.dateDayName}>{dayjs().format('ddd').toUpperCase()}</Text>
            <Text style={styles.dateDay}>{dayjs().format('DD')}</Text>
            <Text style={styles.dateMonth}>
              {dayjs().format('MMM')} '{dayjs().format('YY')}
            </Text>
          </View>
        </View>

        {/* ── Period filter chips ──────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodRow}
          style={styles.periodScroll}
        >
          {PERIODS.map((p) => {
            const isActive = activePeriod === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodChip, isActive && styles.periodChipActive]}
                onPress={() => onPeriodChange(p.key)}
                activeOpacity={0.75}
              >
                {isActive && kpiLoading ? (
                  <ActivityIndicator size={10} color={COLORS.white} style={{ marginRight: 4 }} />
                ) : null}
                <Text style={[styles.periodChipText, isActive && styles.periodChipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Urgent alert — unassigned inquiries ─────── */}
        {urgentCount > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            activeOpacity={0.88}
            onPress={() =>
              navigation.navigate('Inquiries', {
                screen: 'InquiryList',
                params: { filterStatus: 'unassigned' },
              })
            }
          >
            <View style={styles.alertIconBox}>
              <Icon name="alert-circle" size={22} color={COLORS.error} />
            </View>
            <View style={styles.alertBody}>
              <Text style={styles.alertTitle}>
                {urgentCount} Unassigned {urgentCount === 1 ? 'Inquiry' : 'Inquiries'}
              </Text>
              <Text style={styles.alertSub}>
                Tap to distribute them to your team
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={COLORS.error} />
          </TouchableOpacity>
        )}

        {/* ── Inquiry Overview ─────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inquiry Overview</Text>
          {/* Improvement #7 — today count badge */}
          {todayCount !== null && todayCount > 0 && activePeriod !== 'today' && (
            <View style={styles.todayBadge}>
              <Icon name="plus-circle-outline" size={11} color={COLORS.primary} />
              <Text style={styles.todayBadgeText}>
                {todayCount} new today
              </Text>
            </View>
          )}
        </View>

        {/* KPI cards — one card per status so counts always match the list */}
        <View style={styles.statsGrid}>
          <StatCard compact
            label="Total"
            value={s.totalInquiries ?? '—'}
            icon="clipboard-list-outline"
            color={COLORS.primary}
            onPress={() => navigation.navigate('Inquiries', { screen: 'InquiryList' })}
          />
          <StatCard compact
            label="Unassigned"
            value={s.unassigned ?? urgentCount}
            icon="clipboard-alert-outline"
            color={COLORS.error}
            onPress={() =>
              navigation.navigate('Inquiries', {
                screen: 'InquiryList',
                params: { filterStatus: 'unassigned' },
              })
            }
          />
          <StatCard compact
            label="Assigned"
            value={s.assigned ?? '—'}
            icon="account-check-outline"
            color={COLORS.warning}
            onPress={() =>
              navigation.navigate('Inquiries', {
                screen: 'InquiryList',
                params: { filterStatus: 'assigned' },
              })
            }
          />
          <StatCard compact
            label="In Progress"
            value={s.inProgress ?? '—'}
            icon="progress-clock"
            color={COLORS.inProgress}
            onPress={() =>
              navigation.navigate('Inquiries', {
                screen: 'InquiryList',
                params: { filterStatus: 'in_progress' },
              })
            }
          />
          <StatCard compact
            label="Follow Up"
            value={s.followUp ?? '—'}
            icon="calendar-clock-outline"
            color={COLORS.info}
            onPress={() =>
              navigation.navigate('Inquiries', {
                screen: 'InquiryList',
                params: { filterStatus: 'follow_up' },
              })
            }
          />
          <StatCard compact
            label="Closed"
            value={s.closed ?? '—'}
            icon="check-circle-outline"
            color={COLORS.secondary}
            onPress={() =>
              navigation.navigate('Inquiries', {
                screen: 'InquiryList',
                params: { filterStatus: 'closed' },
              })
            }
          />
          <StatCard compact
            label="Devices"
            value={s.totalDevices ?? '—'}
            icon="cellphone-check"
            color={COLORS.info}
            onPress={() =>
              goToTab('Team', [{ name: 'UserList' }, { name: 'DeviceList' }])
            }
          />
          <StatCard compact
            label="Blocked"
            value={s.blockedDevices ?? '—'}
            icon="cellphone-lock"
            color={COLORS.error}
            onPress={() =>
              goToTab('Team', [{ name: 'UserList' }, { name: 'DeviceList' }])
            }
          />
        </View>

        {/* ── Team Status ──────────────────────────────── */}
        {/* Improvement #4 — correct API field (totalSales) */}
        <View style={[styles.sectionHeader, { marginTop: SPACING.sm }]}>
          <Text style={styles.sectionTitle}>Team Status</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            label="Salespersons"
            value={s.totalSales ?? '—'}
            icon="account-group-outline"
            color={COLORS.primary}
            onPress={() => navigation.navigate('Team', { screen: 'UserList' })}
          />
          <StatCard
            label="Attendance"
            value={s.presentToday ?? '—'}
            icon="calendar-check-outline"
            color={COLORS.secondary}
            onPress={() =>
              goToTab('Team', [{ name: 'UserList' }, { name: 'Attendance' }])
            }
          />
        </View>

        {/* ── Quick Actions ─────────────────────────────── */}
        {/* Improvement #1 — "Add Inquiry" as first action */}
        <View style={[styles.sectionHeader, { marginTop: SPACING.sm }]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.actionsRow}>
          <QuickAction
            icon="clipboard-plus-outline"
            label="Add Inquiry"
            color={COLORS.primary}
            onPress={() =>
              navigation.navigate('Inquiries', { screen: 'CreateInquiry' })
            }
          />
          <QuickAction
            icon="map-marker-multiple-outline"
            label="Live Map"
            color={COLORS.inProgress}
            onPress={() => navigation.navigate('More', { screen: 'LiveMap' })}
          />
          <QuickAction
            icon="chart-bar"
            label="Reports"
            color={COLORS.secondary}
            onPress={() =>
              navigation.navigate('More', { screen: 'Reports' })
            }
          />
          <QuickAction
            icon="bell-plus-outline"
            label="Notify"
            color={COLORS.warning}
            badge={unreadCount > 0 ? unreadCount : null}
            onPress={() =>
              navigation.navigate('More', { screen: 'Notifications' })
            }
          />
          <QuickAction
            icon="cellphone-check"
            label="Devices"
            color={COLORS.info}
            onPress={() =>
              goToTab('Team', [{ name: 'UserList' }, { name: 'DeviceList' }])
            }
          />
        </View>

        {/* ── Needs Assignment ─────────────────────────── */}
        {/* Improvement #6 — inline Distribute button */}
        {unassigned.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: SPACING.sm }]}>
              <Text style={styles.sectionTitle}>Needs Assignment</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Inquiries', {
                    screen: 'InquiryList',
                    params: { filterStatus: 'unassigned' },
                  })
                }
              >
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>

            {unassigned.slice(0, 4).map((inq) => (
              <UnassignedRow
                key={inq.id}
                inquiry={inq}
                onPress={() =>
                  navigation.navigate('Inquiries', {
                    screen: 'InquiryDetail',
                    params: { id: inq.id },
                  })
                }
                onDistribute={() => setDistributeInquiry(inq)}
              />
            ))}
          </>
        )}

      </ScrollView>

      {/* Distribute modal — opened from inline button */}
      {distributeInquiry && (
        <DistributeModal
          visible={!!distributeInquiry}
          inquiry={distributeInquiry}
          onClose={() => setDistributeInquiry(null)}
          onSuccess={() => {
            setDistributeInquiry(null);
            fetchUnassigned();
            Toast.show({ type: 'success', text1: 'Inquiry distributed!' });
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── QuickAction ──────────────────────────────────────────────
function QuickAction({ icon, label, color, onPress, badge }) {
  return (
    <TouchableOpacity style={styles.qaBtn} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.qaIconBox, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={22} color={color} />
        {badge ? (
          <View style={styles.qaBadge}>
            <Text style={styles.qaBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── UnassignedRow ────────────────────────────────────────────
function UnassignedRow({ inquiry, onPress, onDistribute }) {
  const ageMinutes = dayjs().diff(dayjs(inquiry.createdAt), 'minute');
  const isUrgent   = ageMinutes >= 60;

  return (
    <TouchableOpacity style={styles.unassignedRow} onPress={onPress} activeOpacity={0.78}>
      <View style={[
        styles.unassignedStrip,
        { backgroundColor: isUrgent ? COLORS.error : COLORS.warning },
      ]} />

      <View style={styles.unassignedBody}>
        <Text style={styles.unassignedDesc} numberOfLines={1}>
          {inquiry.description || inquiry.title || 'No description'}
        </Text>
        <View style={styles.unassignedMeta}>
          {inquiry.mobile ? (
            <View style={styles.unassignedMetaItem}>
              <Icon name="phone-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.unassignedMetaText}>{inquiry.mobile}</Text>
            </View>
          ) : null}
          <View style={styles.unassignedMetaItem}>
            <Icon
              name="clock-outline"
              size={11}
              color={isUrgent ? COLORS.error : COLORS.textMuted}
            />
            <Text style={[
              styles.unassignedMetaText,
              isUrgent && { color: COLORS.error, fontWeight: '700' },
            ]}>
              {dayjs(inquiry.createdAt).format('DD MMM · hh:mm A')}
              {/* {ageMinutes < 60
                ? `${ageMinutes}m ago`
                : `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m ago`} */}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.unassignedRight}>
        {/* Improvement #6 — inline distribute button */}
        <TouchableOpacity
          style={styles.distributeBtn}
          onPress={(e) => { e.stopPropagation?.(); onDistribute(); }}
          activeOpacity={0.8}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Icon name="account-arrow-right-outline" size={13} color={COLORS.primary} />
          <Text style={styles.distributeBtnText}>Assign</Text>
        </TouchableOpacity>
        <Icon name="chevron-right" size={16} color={COLORS.textMuted} style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xxl },

  // ── Period chips ──────────────────────────────────────────────
  periodScroll: { marginBottom: SPACING.md },
  periodRow: {
    paddingHorizontal: SPACING.md,
    gap:               SPACING.xs,
    flexDirection:     'row',
    alignItems:        'center',
  },
  periodChip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   7,
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   COLORS.surface,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    ...SHADOW.sm,
  },
  periodChipActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  periodChipText: {
    ...TYPOGRAPHY.smallMedium,
    color:      COLORS.textSecondary,
    fontWeight: '600',
  },
  periodChipTextActive: {
    color: COLORS.white,
  },

  // ── Error state (#9) ──────────────────────────────────────────
  errorState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        SPACING.xl,
    gap:            SPACING.sm,
  },
  errorTitle: {
    ...TYPOGRAPHY.h4,
    color:      COLORS.textPrimary,
    fontWeight: '700',
    marginTop:  SPACING.sm,
  },
  errorSub: {
    ...TYPOGRAPHY.body,
    color:     COLORS.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius:    BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
    marginTop:       SPACING.sm,
    ...SHADOW.sm,
  },
  retryBtnText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.white,
    fontWeight: '700',
  },

  // ── Header ────────────────────────────────────────────────────
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: SPACING.md,
    paddingTop:      SPACING.sm,
    paddingBottom:   SPACING.lg,
  },
  headerLeft: { flex: 1 },
  greeting: {
    ...TYPOGRAPHY.small,
    color:      COLORS.textSecondary,
    fontWeight: '500',
  },
  userName: {
    fontSize:   26,
    fontWeight: '800',
    color:      COLORS.textPrimary,
    marginTop:  1,
  },
  roleChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    marginTop:         4,
    alignSelf:         'flex-start',
    backgroundColor:   COLORS.primaryLight,
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  roleChipText: { fontSize: 10, fontWeight: '700' },

  // Improvement #3 — enhanced date box
  dateBox: {
    backgroundColor:   COLORS.primary,
    borderRadius:      BORDER_RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical:   8,
    alignItems:        'center',
    minWidth:          52,
    ...SHADOW.sm,
  },
  dateDayName: {
    fontSize:      9,
    fontWeight:    '700',
    color:         'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    marginBottom:  1,
  },
  dateDay: {
    fontSize:   22,
    fontWeight: '800',
    color:      COLORS.white,
    lineHeight: 24,
  },
  dateMonth: {
    fontSize:    9,
    fontWeight:  '600',
    color:       'rgba(255,255,255,0.7)',
    marginTop:   1,
    letterSpacing: 0.3,
  },

  // ── Alert banner ──────────────────────────────────────────────
  alertBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   '#FFF1F1',
    borderWidth:       1.5,
    borderColor:       COLORS.error + '40',
    borderRadius:      BORDER_RADIUS.lg,
    marginHorizontal:  SPACING.md,
    marginBottom:      SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    gap:               SPACING.sm,
  },
  alertIconBox: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: '#FEE2E2',
    alignItems:      'center',
    justifyContent:  'center',
  },
  alertBody:  { flex: 1 },
  alertTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.error, fontWeight: '700' },
  alertSub:   { ...TYPOGRAPHY.caption, color: COLORS.error + 'AA', marginTop: 1 },

  // ── Section header ────────────────────────────────────────────
  sectionHeader: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    marginBottom:      SPACING.sm,
  },
  sectionTitle: { ...TYPOGRAPHY.h4, color: COLORS.textPrimary, fontWeight: '700' },
  seeAll:       { ...TYPOGRAPHY.small, color: COLORS.primary, fontWeight: '600' },

  // Improvement #7 — today badge
  todayBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    backgroundColor:   COLORS.primaryLight,
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  todayBadgeText: {
    fontSize:   11,
    color:      COLORS.primary,
    fontWeight: '700',
  },

  // ── Stats grid ────────────────────────────────────────────────
  statsGrid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    paddingHorizontal: SPACING.sm,
    marginBottom:      SPACING.xs,
  },

  // ── Quick actions ─────────────────────────────────────────────
  actionsRow: {
    flexDirection:     'row',
    justifyContent:    'space-around',
    paddingHorizontal: SPACING.sm,
    marginBottom:      SPACING.sm,
  },
  qaBtn:    { alignItems: 'center', gap: 6 },
  qaIconBox: {
    width:          52,
    height:         52,
    borderRadius:   BORDER_RADIUS.lg,
    alignItems:     'center',
    justifyContent: 'center',
  },
  qaBadge: {
    position:          'absolute',
    top:               -4,
    right:             -4,
    backgroundColor:   COLORS.error,
    borderRadius:      10,
    minWidth:          18,
    height:            18,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 4,
  },
  qaBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.white },
  qaLabel:     { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontWeight: '600' },

  // ── Unassigned rows ───────────────────────────────────────────
  unassignedRow: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
    overflow:         'hidden',
    ...SHADOW.sm,
  },
  unassignedStrip: { width: 4, alignSelf: 'stretch' },
  unassignedBody: {
    flex:           1,
    padding:        SPACING.sm,
    paddingVertical: 12,
  },
  unassignedDesc: {
    ...TYPOGRAPHY.bodyMedium,
    color:        COLORS.textPrimary,
    marginBottom: 4,
  },
  unassignedMeta:     { flexDirection: 'row', gap: 12 },
  unassignedMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  unassignedMetaText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  unassignedRight: {
    paddingRight: SPACING.sm,
    alignItems:   'flex-end',
    gap:          4,
  },

  // Improvement #6 — inline distribute button
  distributeBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    backgroundColor:   COLORS.primaryLight,
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       COLORS.primaryMid,
  },
  distributeBtnText: {
    fontSize:   10,
    color:      COLORS.primary,
    fontWeight: '700',
  },
});
