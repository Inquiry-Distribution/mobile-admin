/**
 * DashboardScreen — Admin & Superuser
 *
 * Shows system-wide KPIs, an urgent unassigned inquiry alert,
 * and quick-action shortcuts to the most common admin tasks.
 * Data: reportApi.getSummary() + inquiryStore.unassigned
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS, STATUS_COLORS }  from '@constants/colors';
import { TYPOGRAPHY }             from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';

import { reportApi }            from '@api/report.api';
import useAuthStore             from '@store/auth.store';
import useInquiryStore          from '@store/inquiry.store';
import useNotificationStore     from '@store/notification.store';

import Loader      from '@components/common/Loader';
import StatCard    from '@components/common/StatCard';
import StatusBadge from '@components/common/StatusBadge';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen({ navigation }) {
  const { user, isSuperuser } = useAuthStore();
  const {
    unassigned,
    fetchUnassigned,
    isLoading: inquiryLoading,
  } = useInquiryStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const [summary,         setSummary]         = useState(null);
  const [summaryLoading,  setSummaryLoading]  = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);

  // ── Data loaders ─────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    try {
      const res = await reportApi.getSummary();
      setSummary(res.data ?? res);
    } catch (_) {}
    setSummaryLoading(false);
  }, []);

  useEffect(() => {
    loadSummary();
    fetchUnassigned();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSummary(), fetchUnassigned()]);
    setRefreshing(false);
  }, []);

  if (summaryLoading && !refreshing) return <Loader />;

  const s = summary ?? {};
  const urgentCount = unassigned.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
        {/* ── Greeting header ───────────────────────────── */}
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

          <View style={styles.dateBox}>
            <Text style={styles.dateDay}>{dayjs().format('DD')}</Text>
            <Text style={styles.dateMonth}>{dayjs().format('MMM')}</Text>
          </View>
        </View>

        {/* ── Urgent alert — unassigned inquiries ───────── */}
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

        {/* ── KPI stats grid ────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inquiry Overview</Text>
          {s.conversionRate !== undefined && (
            <View style={styles.convBadge}>
              <Icon name="trending-up" size={11} color={COLORS.secondary} />
              <Text style={styles.convText}>
                {typeof s.conversionRate === 'number'
                  ? `${(s.conversionRate * 100).toFixed(1)}%`
                  : s.conversionRate}
                {' '}converted
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            label="Total"
            value={s.totalInquiries ?? '—'}
            icon="clipboard-list-outline"
            color={COLORS.primary}
            onPress={() => navigation.navigate('Inquiries')}
          />
          <StatCard
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
          <StatCard
            label="In Progress"
            value={s.inProgress ?? '—'}
            icon="progress-clock"
            color={COLORS.inProgress}
          />
          <StatCard
            label="Closed"
            value={s.closed ?? '—'}
            icon="check-circle-outline"
            color={COLORS.secondary}
          />
        </View>

        {/* ── Team overview ─────────────────────────────── */}
        <View style={[styles.sectionHeader, { marginTop: SPACING.sm }]}>
          <Text style={styles.sectionTitle}>Team Status</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            label="Salespersons"
            value={s.totalSalespersons ?? '—'}
            icon="account-group-outline"
            color={COLORS.primary}
            onPress={() => navigation.navigate('Team')}
          />
          <StatCard
            label="Present Today"
            value={s.presentToday ?? '—'}
            icon="calendar-check-outline"
            color={COLORS.secondary}
            onPress={() =>
              navigation.navigate('Team', {
                screen: 'Attendance',
              })
            }
          />
        </View>

        {/* ── Quick actions ─────────────────────────────── */}
        <View style={[styles.sectionHeader, { marginTop: SPACING.sm }]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.actionsRow}>
          <QuickAction
            icon="map-marker-multiple-outline"
            label="Live Map"
            color={COLORS.primary}
            onPress={() => navigation.navigate('Map')}
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
              navigation.navigate('Team', { screen: 'DeviceList' })
            }
          />
        </View>

        {/* ── Recent unassigned inquiries ───────────────── */}
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
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function QuickAction({ icon, label, color, onPress, badge }) {
  return (
    <TouchableOpacity style={styles.qaBtn} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.qaIconBox, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={22} color={color} />
        {badge ? (
          <View style={styles.qaBadge}>
            <Text style={styles.qaBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function UnassignedRow({ inquiry, onPress }) {
  const ageMinutes = dayjs().diff(dayjs(inquiry.createdAt), 'minute');
  const isUrgent   = ageMinutes >= 60;

  return (
    <TouchableOpacity style={styles.unassignedRow} onPress={onPress} activeOpacity={0.78}>
      {/* Left priority strip */}
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
            <Icon name="clock-outline" size={11} color={isUrgent ? COLORS.error : COLORS.textMuted} />
            <Text style={[styles.unassignedMetaText, isUrgent && { color: COLORS.error, fontWeight: '700' }]}>
              {ageMinutes < 60
                ? `${ageMinutes}m ago`
                : `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m ago`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.unassignedRight}>
        <StatusBadge status="unassigned" size="sm" />
        <Icon name="chevron-right" size={16} color={COLORS.textMuted} style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xxl },

  // ── Header ────────────────────────────────────────────────────
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: SPACING.md,
    paddingTop:      SPACING.sm,
    paddingBottom:   SPACING.lg,
  },
  headerLeft:  { flex: 1 },
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
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    marginTop:       4,
    alignSelf:       'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius:    BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleChipText: {
    fontSize:   10,
    fontWeight: '700',
  },
  dateBox: {
    backgroundColor:  COLORS.primary,
    borderRadius:     BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical:   6,
    alignItems:       'center',
    minWidth:         46,
  },
  dateDay: {
    fontSize:   20,
    fontWeight: '800',
    color:      COLORS.white,
    lineHeight: 22,
  },
  dateMonth: {
    fontSize:        10,
    fontWeight:      '600',
    color:           'rgba(255,255,255,0.8)',
    textTransform:   'uppercase',
    letterSpacing:   0.5,
  },

  // ── Alert banner ──────────────────────────────────────────────
  alertBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#FFF1F1',
    borderWidth:     1.5,
    borderColor:     COLORS.error + '40',
    borderRadius:    BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:    SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    gap:             SPACING.sm,
  },
  alertIconBox: {
    width:  40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBody:  { flex: 1 },
  alertTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.error,
    fontWeight: '700',
  },
  alertSub: {
    ...TYPOGRAPHY.caption,
    color:    COLORS.error + 'AA',
    marginTop: 1,
  },

  // ── Section header ────────────────────────────────────────────
  sectionHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: SPACING.md,
    marginBottom:    SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h4,
    color:      COLORS.textPrimary,
    fontWeight: '700',
  },
  seeAll: {
    ...TYPOGRAPHY.small,
    color:      COLORS.primary,
    fontWeight: '600',
  },
  convBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             3,
    backgroundColor: COLORS.secondaryLight,
    borderRadius:    BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  convText: {
    fontSize:   11,
    color:      COLORS.secondary,
    fontWeight: '700',
  },

  // ── Stats grid ────────────────────────────────────────────────
  statsGrid: {
    flexDirection:    'row',
    flexWrap:         'wrap',
    paddingHorizontal: SPACING.sm,
    marginBottom:     SPACING.xs,
  },

  // ── Quick actions ─────────────────────────────────────────────
  actionsRow: {
    flexDirection:    'row',
    justifyContent:   'space-around',
    paddingHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
  },
  qaBtn: {
    alignItems:  'center',
    gap:         6,
  },
  qaIconBox: {
    width:        56,
    height:       56,
    borderRadius: BORDER_RADIUS.lg,
    alignItems:   'center',
    justifyContent: 'center',
  },
  qaBadge: {
    position:        'absolute',
    top:             -4,
    right:           -4,
    backgroundColor: COLORS.error,
    borderRadius:    10,
    minWidth:        18,
    height:          18,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 4,
  },
  qaBadgeText: {
    fontSize:   10,
    fontWeight: '700',
    color:      COLORS.white,
  },
  qaLabel: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.textSecondary,
    fontWeight: '600',
  },

  // ── Unassigned list rows ──────────────────────────────────────
  unassignedRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:    SPACING.sm,
    overflow:        'hidden',
    ...SHADOW.sm,
  },
  unassignedStrip: {
    width: 4,
    alignSelf: 'stretch',
  },
  unassignedBody: {
    flex:    1,
    padding: SPACING.sm,
    paddingVertical: 12,
  },
  unassignedDesc: {
    ...TYPOGRAPHY.bodyMedium,
    color:        COLORS.textPrimary,
    marginBottom: 4,
  },
  unassignedMeta: {
    flexDirection: 'row',
    gap:           12,
  },
  unassignedMetaItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  unassignedMetaText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  unassignedRight: {
    paddingRight: SPACING.sm,
    alignItems:   'flex-end',
  },
});
