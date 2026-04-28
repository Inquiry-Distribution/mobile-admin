/**
 * AttendanceMonthScreen — Admin & Superuser
 *
 * Mode 1 — All users (no salespersonId param):
 *   Aggregated summary card per salesperson for the chosen month.
 *   Tap a card → Mode 2 for that person.
 *
 * Mode 2 — Single person (salespersonId + name in route.params):
 *   Every calendar day of the month listed with status, times, hours.
 *   Tap a day that has a record → AttendanceDayDetail.
 *
 * Month navigation is shared across both modes via attendance.store.
 * useFocusEffect re-fetches whenever the screen gains focus or the
 * month changes, so coming back from a child screen always shows
 * fresh data for the correct mode.
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS, ATTENDANCE_STATUS_COLORS } from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { getInitials } from '@utils/helpers';

import useAttendanceStore from '@store/attendance.store';
import EmptyState from '@components/common/EmptyState';

// ── Helpers ───────────────────────────────────────────────────
function formatMins(mins) {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getDaysInMonth(year, month) {
  const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  return Array.from({ length: start.daysInMonth() }, (_, i) =>
    start.date(i + 1).format('YYYY-MM-DD'),
  );
}

// ─────────────────────────────────────────────────────────────
export default function AttendanceMonthScreen({ route, navigation }) {
  const salespersonId = route?.params?.salespersonId ?? null;
  const personName    = route?.params?.name          ?? null;

  const {
    monthYear,
    monthRecords,
    isLoadingMonth,
    isRefreshingMonth,
    fetchMonthRecords,
    refreshMonthRecords,
    prevMonth,
    nextMonth,
  } = useAttendanceStore();

  const { month, year } = monthYear;

  // Re-fetch every time: screen gains focus OR month/year changes
  useFocusEffect(
    useCallback(() => {
      fetchMonthRecords(salespersonId);
    }, [salespersonId, month, year]),
  );

  const isCurrentMonth =
    dayjs().month() + 1 === month && dayjs().year() === year;

  const monthLabel = dayjs(
    `${year}-${String(month).padStart(2, '0')}-01`,
  ).format('MMMM YYYY');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Month navigator ───────────────────────────────────── */}
      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
          <Icon name="chevron-left" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.monthCenter}>
          <Icon name="calendar-month-outline" size={15} color={COLORS.primary} />
          <Text style={styles.monthText}>{monthLabel}</Text>
        </View>

        <TouchableOpacity
          style={[styles.navBtn, isCurrentMonth && styles.navBtnDisabled]}
          onPress={nextMonth}
          disabled={isCurrentMonth}
        >
          <Icon
            name="chevron-right"
            size={22}
            color={isCurrentMonth ? COLORS.border : COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Person banner (Mode 2 only) ───────────────────────── */}
      {personName ? (
        <View style={styles.personBanner}>
          <Icon name="account-outline" size={14} color={COLORS.primary} />
          <Text style={styles.personBannerText} numberOfLines={1}>
            Attendance for{' '}
            <Text style={styles.personBannerName}>{personName}</Text>
          </Text>
        </View>
      ) : null}

      {/* ── Content ───────────────────────────────────────────── */}
      {isLoadingMonth && monthRecords.length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : salespersonId ? (
        <SinglePersonView
          records={monthRecords}
          year={year}
          month={month}
          isRefreshing={isRefreshingMonth}
          onRefresh={() => refreshMonthRecords(salespersonId)}
          navigation={navigation}
        />
      ) : (
        <AllUsersView
          records={monthRecords}
          year={year}
          month={month}
          isRefreshing={isRefreshingMonth}
          onRefresh={() => refreshMonthRecords(null)}
          navigation={navigation}
          monthYear={monthYear}
        />
      )}
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════
// Mode 1 — All Users
// ══════════════════════════════════════════════════════════════
function AllUsersView({ records, year, month, isRefreshing, onRefresh, navigation, monthYear }) {

  // Group records by salesperson
  const grouped = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      if (!r.salesperson) return;
      const id = r.salesperson.id;
      if (!map[id]) map[id] = { salesperson: r.salesperson, records: [] };
      map[id].records.push(r);
    });
    return Object.values(map).sort((a, b) =>
      a.salesperson.name.localeCompare(b.salesperson.name),
    );
  }, [records]);

  // Top-line summary
  const totalPresent  = records.filter((r) => r.status === 'present').length;
  const totalAbsent   = records.filter((r) => r.status === 'absent').length;
  const totalHalfDay  = records.filter((r) => r.status === 'half_day').length;

  return (
    <FlatList
      data={grouped}
      keyExtractor={(item) => item.salesperson.id}
      renderItem={({ item }) => (
        <PersonMonthCard
          item={item}
          onPress={() =>
            navigation.push('AttendanceMonth', {
              salespersonId: item.salesperson.id,
              name: item.salesperson.name,
            })
          }
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
      ListHeaderComponent={
        grouped.length > 0 ? (
          <View style={styles.summaryStrip}>
            <SummaryCell label="Salespersons" value={grouped.length} color={COLORS.primary} icon="account-group-outline" />
            <View style={styles.stripDivider} />
            <SummaryCell label="Present"  value={totalPresent}  color={COLORS.success} icon="check-circle-outline" />
            <View style={styles.stripDivider} />
            <SummaryCell label="Absent"   value={totalAbsent}   color={COLORS.error}   icon="close-circle-outline" />
            <View style={styles.stripDivider} />
            <SummaryCell label="Half Day" value={totalHalfDay}  color={COLORS.warning} icon="circle-half-full" />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon="account-group-outline"
          title="No attendance records"
          message={`No records found for this month.`}
        />
      }
      contentContainerStyle={
        grouped.length === 0 ? styles.emptyContent : styles.listContent
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

function PersonMonthCard({ item, onPress }) {
  const { salesperson, records } = item;
  const present  = records.filter((r) => r.status === 'present').length;
  const absent   = records.filter((r) => r.status === 'absent').length;
  const halfDay  = records.filter((r) => r.status === 'half_day').length;
  const totalMins = records.reduce((sum, r) => sum + (r.totalMinutes ?? 0), 0);
  const totalHours = formatMins(totalMins);

  return (
    <TouchableOpacity style={styles.personCard} onPress={onPress} activeOpacity={0.75}>
      {/* Avatar */}
      <View style={styles.personAvatar}>
        <Text style={styles.personAvatarText}>{getInitials(salesperson.name)}</Text>
      </View>

      {/* Info */}
      <View style={styles.personInfo}>
        <Text style={styles.personName} numberOfLines={1}>{salesperson.name}</Text>

        <View style={styles.countRow}>
          {/* Present */}
          <View style={[styles.countChip, { backgroundColor: COLORS.success + '18' }]}>
            <View style={[styles.countDot, { backgroundColor: COLORS.success }]} />
            <Text style={[styles.countNum, { color: COLORS.success }]}>{present}</Text>
            <Text style={styles.countLabel}>P</Text>
          </View>

          {/* Absent */}
          <View style={[styles.countChip, { backgroundColor: COLORS.error + '18' }]}>
            <View style={[styles.countDot, { backgroundColor: COLORS.error }]} />
            <Text style={[styles.countNum, { color: COLORS.error }]}>{absent}</Text>
            <Text style={styles.countLabel}>A</Text>
          </View>

          {/* Half Day */}
          {halfDay > 0 ? (
            <View style={[styles.countChip, { backgroundColor: COLORS.warning + '18' }]}>
              <View style={[styles.countDot, { backgroundColor: COLORS.warning }]} />
              <Text style={[styles.countNum, { color: COLORS.warning }]}>{halfDay}</Text>
              <Text style={styles.countLabel}>H</Text>
            </View>
          ) : null}

          {/* Hours */}
          {totalHours ? (
            <View style={styles.hoursChip}>
              <Icon name="clock-outline" size={10} color={COLORS.primary} />
              <Text style={styles.hoursText}>{totalHours}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Icon name="chevron-right" size={18} color={COLORS.border} style={{ marginLeft: SPACING.xs }} />
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════
// Mode 2 — Single Person
// ══════════════════════════════════════════════════════════════
function SinglePersonView({ records, year, month, isRefreshing, onRefresh, navigation }) {

  // Build a map from date string → record
  const recordMap = useMemo(() => {
    const m = {};
    records.forEach((r) => { m[r.date] = r; });
    return m;
  }, [records]);

  // All calendar days in the month
  const dayList = useMemo(
    () => getDaysInMonth(year, month).map((date) => ({ date, record: recordMap[date] ?? null })),
    [recordMap, year, month],
  );

  // Summary counts from actual records
  const present   = records.filter((r) => r.status === 'present').length;
  const absent    = records.filter((r) => r.status === 'absent').length;
  const halfDay   = records.filter((r) => r.status === 'half_day').length;
  const totalMins = records.reduce((sum, r) => sum + (r.totalMinutes ?? 0), 0);
  const totalHours = formatMins(totalMins);

  return (
    <FlatList
      data={dayList}
      keyExtractor={(item) => item.date}
      renderItem={({ item }) => (
        <DayRow
          dateStr={item.date}
          record={item.record}
          onPress={
            item.record
              ? () => navigation.navigate('AttendanceDayDetail', { record: item.record })
              : null
          }
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
      ListHeaderComponent={
        records.length > 0 ? (
          <View style={styles.summaryStrip}>
            <SummaryCell label="Present"  value={present}  color={COLORS.success} icon="check-circle-outline" />
            <View style={styles.stripDivider} />
            <SummaryCell label="Absent"   value={absent}   color={COLORS.error}   icon="close-circle-outline" />
            <View style={styles.stripDivider} />
            <SummaryCell label="Half Day" value={halfDay}  color={COLORS.warning} icon="circle-half-full" />
            <View style={styles.stripDivider} />
            <SummaryCell label="Hours"    value={totalHours ?? '0'} color={COLORS.primary} icon="clock-outline" />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon="calendar-blank-outline"
          title="No records this month"
          message="No attendance data recorded for this period."
        />
      }
      contentContainerStyle={
        dayList.length === 0 ? styles.emptyContent : styles.listContent
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

function DayRow({ dateStr, record, onPress }) {
  const d          = dayjs(dateStr);
  const dayNum     = d.format('DD');
  const dayName    = d.format('ddd');
  const isToday    = dateStr === dayjs().format('YYYY-MM-DD');
  const isWeekend  = d.day() === 0 || d.day() === 6;
  const isFuture   = d.isAfter(dayjs(), 'day');

  // No record
  if (!record) {
    return (
      <View
        style={[
          styles.dayRow,
          isWeekend && styles.dayRowWeekend,
          isFuture  && styles.dayRowFuture,
        ]}
      >
        <View style={styles.dayDateBlock}>
          <Text style={[styles.dayNum, (isWeekend || isFuture) && styles.dayNumMuted]}>
            {dayNum}
          </Text>
          <Text style={[styles.dayName, (isWeekend || isFuture) && styles.dayNameMuted]}>
            {dayName}
          </Text>
        </View>
        <View style={styles.dayContent}>
          <Text style={styles.noRecordText}>
            {isFuture ? '—' : 'No record'}
          </Text>
        </View>
      </View>
    );
  }

  // Has record
  const statusColor = ATTENDANCE_STATUS_COLORS[record.status] ?? {
    bg: COLORS.border, text: COLORS.textMuted,
  };
  const sessions     = record.sessions ?? [];
  const firstIn      = sessions[0]?.checkInTime ?? null;
  const lastSession  = sessions[sessions.length - 1];
  const lastOut      = lastSession?.checkOutTime ?? null;
  const hasOpen      = sessions.some((s) => !s.checkOutTime);
  const worked       = formatMins(record.totalMinutes);

  return (
    <TouchableOpacity
      style={[styles.dayRow, isToday && styles.dayRowToday]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      {/* Date column */}
      <View style={styles.dayDateBlock}>
        <Text style={[styles.dayNum, isToday && { color: COLORS.primary }]}>{dayNum}</Text>
        <Text style={[styles.dayName, isToday && { color: COLORS.primary }]}>{dayName}</Text>
        {isToday ? <View style={styles.todayDot} /> : null}
      </View>

      {/* Content column */}
      <View style={styles.dayContent}>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusText, { color: statusColor.text }]}>
            {record.status === 'half_day'
              ? 'Half Day'
              : record.status.charAt(0).toUpperCase() + record.status.slice(1)}
          </Text>
        </View>

        {/* Times row */}
        <View style={styles.timesRow}>
          {firstIn ? (
            <View style={styles.timeItem}>
              <Icon name="login" size={10} color={COLORS.success} />
              <Text style={styles.timeText}>{dayjs(firstIn).format('hh:mm A')}</Text>
            </View>
          ) : null}

          {lastOut ? (
            <View style={styles.timeItem}>
              <Icon name="logout" size={10} color={COLORS.error} />
              <Text style={styles.timeText}>{dayjs(lastOut).format('hh:mm A')}</Text>
            </View>
          ) : hasOpen ? (
            <View style={styles.timeItem}>
              <Icon name="logout" size={10} color={COLORS.warning} />
              <Text style={[styles.timeText, { color: COLORS.warning }]}>Active</Text>
            </View>
          ) : null}

          {worked ? (
            <View style={styles.timeItem}>
              <Icon name="timer-outline" size={10} color={COLORS.primary} />
              <Text style={[styles.timeText, { color: COLORS.primary }]}>{worked}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Chevron (only when tappable) */}
      {onPress ? (
        <Icon name="chevron-right" size={16} color={COLORS.border} style={{ marginLeft: 4 }} />
      ) : null}
    </TouchableOpacity>
  );
}

// ── Shared sub-components ─────────────────────────────────────
function SummaryCell({ label, value, color, icon }) {
  return (
    <View style={styles.summaryCell}>
      <Icon name={icon} size={14} color={color} style={{ marginBottom: 2 }} />
      <Text style={[styles.summaryCellValue, { color }]}>{value}</Text>
      <Text style={styles.summaryCellLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // ── Month navigator ──────────────────────────────────────────
  monthNav: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  navBtn: {
    width:          40,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   20,
    backgroundColor: COLORS.primaryLight,
  },
  navBtnDisabled: { backgroundColor: COLORS.background },
  monthCenter: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  monthText: { ...TYPOGRAPHY.h4, color: COLORS.textPrimary, fontWeight: '700' },

  // ── Person banner ────────────────────────────────────────────
  personBanner: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    backgroundColor:  COLORS.primaryLight,
    borderRadius:     BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginTop:        SPACING.sm,
    padding:          SPACING.sm,
    borderWidth:      1,
    borderColor:      COLORS.primaryMid,
  },
  personBannerText: { ...TYPOGRAPHY.small, color: COLORS.textSecondary, flex: 1 },
  personBannerName: { fontWeight: '700', color: COLORS.primary },

  // ── Summary strip ────────────────────────────────────────────
  summaryStrip: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    borderRadius:      BORDER_RADIUS.lg,
    marginHorizontal:  SPACING.md,
    marginTop:         SPACING.md,
    marginBottom:      SPACING.sm,
    paddingVertical:   SPACING.md,
    paddingHorizontal: SPACING.sm,
    ...SHADOW.sm,
  },
  summaryCell: {
    flex:       1,
    alignItems: 'center',
  },
  summaryCellValue: {
    fontSize:   18,
    fontWeight: '800',
    lineHeight: 22,
  },
  summaryCellLabel: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textMuted,
    marginTop: 1,
    textAlign: 'center',
  },
  stripDivider: {
    width:           1,
    height:          40,
    backgroundColor: COLORS.divider,
    marginHorizontal: 4,
  },

  // ── Person card (Mode 1) ─────────────────────────────────────
  personCard: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
    padding:          SPACING.md,
    ...SHADOW.sm,
  },
  personAvatar: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     SPACING.sm,
    flexShrink:      0,
  },
  personAvatarText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  personInfo:       { flex: 1 },
  personName:       { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600', marginBottom: 6 },

  countRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    flexWrap:      'wrap',
  },
  countChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical:   3,
  },
  countDot:   { width: 6, height: 6, borderRadius: 3 },
  countNum:   { fontSize: 12, fontWeight: '800' },
  countLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  hoursChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical:   3,
    backgroundColor:   COLORS.primaryLight,
  },
  hoursText: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '700' },

  // ── Day row (Mode 2) ─────────────────────────────────────────
  dayRow: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.xs,
    paddingVertical:  SPACING.sm,
    paddingHorizontal: SPACING.md,
    ...SHADOW.sm,
  },
  dayRowWeekend: { backgroundColor: COLORS.background, elevation: 0, shadowOpacity: 0 },
  dayRowFuture:  { opacity: 0.4 },
  dayRowToday:   { borderWidth: 1.5, borderColor: COLORS.primary + '50' },

  dayDateBlock: {
    width:          44,
    alignItems:     'center',
    marginRight:    SPACING.sm,
    flexShrink:     0,
  },
  dayNum:     { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 22 },
  dayNumMuted: { color: COLORS.textMuted },
  dayName:    { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontWeight: '600' },
  dayNameMuted: { color: COLORS.border },
  todayDot:   { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.primary, marginTop: 2 },

  dayContent: { flex: 1 },

  statusBadge: {
    alignSelf:         'flex-start',
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   3,
    marginBottom:      4,
  },
  statusText: { fontSize: 10, fontWeight: '700' },

  timesRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    flexWrap:      'wrap',
  },
  timeItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  timeText:  { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },

  noRecordText: { ...TYPOGRAPHY.small, color: COLORS.textMuted, fontStyle: 'italic' },

  // ── Common ───────────────────────────────────────────────────
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent:   { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl },
  emptyContent:  { flexGrow: 1 },
});
