/**
 * AttendanceScreen — view daily attendance for all salespersons (or one specific person)
 *
 * Features:
 *  • Date navigation (← YYYY-MM-DD →), capped at today
 *  • "Today" shortcut button
 *  • Status filter chips (All / Present / Absent / Half Day)
 *  • Summary row: total / present / absent counts
 *  • FlatList of attendance records — name, check-in/out time, duration, status badge
 *  • Supports salespersonId route param for filtered single-person view (from UserDetail)
 *  • Pull-to-refresh
 */
import React, { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import dayjs from "dayjs";

import { COLORS, ATTENDANCE_STATUS_COLORS } from "@constants/colors";
import { TYPOGRAPHY } from "@constants/typography";
import { SPACING, BORDER_RADIUS, SHADOW } from "@constants/config";
import { formatTime, formatDuration, getInitials } from "@utils/helpers";

import useAttendanceStore from "@store/attendance.store";
import EmptyState from "@components/common/EmptyState";
import StatusBadge from "@components/common/StatusBadge";

// ── Filter chips ──────────────────────────────────────────────
const STATUS_CHIPS = [
  { label: "All", value: "" },
  { label: "Present", value: "present" },
  { label: "Absent", value: "absent" },
  { label: "Half Day", value: "half_day" },
];

export default function AttendanceScreen({ route, navigation }) {
  // Optional route params: salespersonId + name (from UserDetail)
  const routeSalespersonId = route?.params?.salespersonId ?? null;
  const routeName          = route?.params?.name          ?? null;

  const {
    records,
    total,
    date,
    status,
    isLoading,
    isRefreshing,
    fetchRecords,
    refreshRecords,
    goToPrevDate,
    goToNextDate,
    goToToday,
    setStatus,
    setSalespersonId,
    clearFilters,
  } = useAttendanceStore();

  useEffect(() => {
    if (routeSalespersonId) {
      setSalespersonId(routeSalespersonId);
    } else {
      fetchRecords();
    }
    return () => clearFilters();
  }, []);

  const isToday = date === dayjs().format("YYYY-MM-DD");

  // Quick summary counts from current records
  // A record with an open session counts as present
  const hasOpenSession = (r) =>
    r.isCheckedIn || (Array.isArray(r.sessions) && r.sessions.some((s) => !s.checkOutTime));
  const presentCount = records.filter((r) => r.status === "present" || hasOpenSession(r)).length;
  const absentCount  = records.filter((r) => r.status === "absent" && !hasOpenSession(r)).length;
  const halfDayCount = records.filter((r) => r.status === "half_day" && !hasOpenSession(r)).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* ── Date navigator ────────────────────────────── */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.dateNavBtn} onPress={goToPrevDate}>
          <Icon name="chevron-left" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.dateCenter}>
          <Text style={styles.dateText}>
            {dayjs(date).format("ddd, DD MMM YYYY")}
          </Text>
          {isToday && (
            <View style={styles.todayChip}>
              <Text style={styles.todayChipText}>Today</Text>
            </View>
          )}
        </View>

        <View style={styles.dateNavRight}>
          <TouchableOpacity
            style={[styles.dateNavBtn, isToday && styles.dateNavBtnDisabled]}
            onPress={goToNextDate}
            disabled={isToday}
          >
            <Icon
              name="chevron-right"
              size={22}
              color={isToday ? COLORS.border : COLORS.primary}
            />
          </TouchableOpacity>

          {/* Month View shortcut */}
          <TouchableOpacity
            style={styles.monthViewBtn}
            onPress={() =>
              navigation.navigate('AttendanceMonth', routeSalespersonId
                ? { salespersonId: routeSalespersonId, name: routeName }
                : undefined
              )
            }
          >
            <Icon name="calendar-month-outline" size={16} color={COLORS.primary} />
            <Text style={styles.monthViewText}>Month</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* "Go to today" — only visible when not on today */}
      {!isToday && (
        <TouchableOpacity style={styles.goToTodayBtn} onPress={goToToday}>
          <Icon name="calendar-today" size={14} color={COLORS.primary} />
          <Text style={styles.goToTodayText}>Go to Today</Text>
        </TouchableOpacity>
      )}

      {/* ── Optional: single-person banner ────────────── */}
      {routeName && (
        <View style={styles.personBanner}>
          <Icon name="account-outline" size={14} color={COLORS.primary} />
          <Text style={styles.personBannerText} numberOfLines={1}>
            Showing attendance for{" "}
            <Text style={styles.personBannerName}>{routeName}</Text>
          </Text>
        </View>
      )}

      {/* ── Summary row ───────────────────────────────── */}
      {records.length > 0 && !isLoading && (
        <View style={styles.summary}>
          <SummaryChip
            label="Total"
            count={records.length}
            color={COLORS.textSecondary}
          />
          <SummaryChip
            label="Present"
            count={presentCount}
            color={COLORS.success}
          />
          <SummaryChip
            label="Absent"
            count={absentCount}
            color={COLORS.error}
          />
          {halfDayCount > 0 && (
            <SummaryChip
              label="Half Day"
              count={halfDayCount}
              color={COLORS.warning}
            />
          )}
        </View>
      )}

      {/* ── Status filter chips ───────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsWrap}
        contentContainerStyle={styles.chips}
      >
        {STATUS_CHIPS.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[styles.chip, status === c.value && styles.chipActive]}
            onPress={() => setStatus(c.value)}
          >
            {c.value !== "" && (
              <View
                style={[
                  styles.chipDot,
                  {
                    backgroundColor:
                      c.value === "present"
                        ? COLORS.success
                        : c.value === "absent"
                        ? COLORS.error
                        : COLORS.warning,
                  },
                ]}
              />
            )}
            <Text
              style={[
                styles.chipText,
                status === c.value && styles.chipTextActive,
              ]}
            >
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── List ──────────────────────────────────────── */}
      <FlatList
        style={styles.list}
        data={records}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
            <AttendanceRow
              record={item}
              onPress={() => navigation.navigate('AttendanceDayDetail', { record: item })}
            />
          )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshRecords}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <EmptyState
              icon="calendar-blank-outline"
              title="No records found"
              message={
                status
                  ? "No records match the selected status."
                  : `No attendance data for ${dayjs(date).format(
                      "DD MMM YYYY",
                    )}.`
              }
            />
          )
        }
        contentContainerStyle={
          records.length === 0 ? styles.emptyContent : styles.listContent
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ── Summary chip ──────────────────────────────────────────────
function SummaryChip({ label, count, color }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={[styles.summaryCount, { color }]}>{count}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

// ── Attendance row ────────────────────────────────────────────
function AttendanceRow({ record, onPress }) {
  const { salesperson, sessions = [], totalMinutes = 0, sessionsCount = 0, status } = record;

  // Derive first check-in and last check-out from sessions array
  const firstSession   = sessions[0] ?? null;
  const openSession    = sessions.find((s) => !s.checkOutTime) ?? null;
  const lastSession    = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  const firstCheckIn   = firstSession?.checkInTime  ?? null;
  const lastCheckOut   = lastSession?.checkOutTime  ?? null;
  const firstAddress   = firstSession?.checkInAddress ?? null;
  const hasOpenSession = !!openSession || !!record.isCheckedIn;

  const effectiveStatus = hasOpenSession ? 'present' : status;
  const statusColor = ATTENDANCE_STATUS_COLORS[effectiveStatus] ?? { bg: COLORS.border, text: COLORS.textMuted };

  // Total worked — prefer server-aggregated totalMinutes, fall back to live calc
  const workedLabel = (() => {
    if (totalMinutes > 0) {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    if (firstCheckIn && lastCheckOut)
      return formatDuration(firstCheckIn, lastCheckOut);
    return null;
  })();

  const completedSessions = sessionsCount || sessions.filter((s) => !!s.checkOutTime).length;

  const name     = salesperson?.name ?? "Unknown";
  const initials = getInitials(name);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: statusColor.bg }]}>
        <Text style={[styles.avatarText, { color: statusColor.text }]}>
          {initials}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>
            {name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>
              {effectiveStatus === "half_day"
                ? "Half"
                : effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
            </Text>
          </View>
        </View>

        {salesperson?.email ? (
          <Text style={styles.rowEmail} numberOfLines={1}>
            {salesperson.email}
          </Text>
        ) : null}

        {/* Time row — first in / last out */}
        <View style={styles.timeRow}>
          {firstCheckIn ? (
            <View style={styles.timeItem}>
              <Icon name="login" size={11} color={COLORS.success} />
              <Text style={styles.timeText}>{formatTime(firstCheckIn)}</Text>
            </View>
          ) : (
            <View style={styles.timeItem}>
              <Icon name="login" size={11} color={COLORS.textMuted} />
              <Text style={[styles.timeText, { color: COLORS.textMuted }]}>—</Text>
            </View>
          )}

          {lastCheckOut ? (
            <View style={styles.timeItem}>
              <Icon name="logout" size={11} color={COLORS.error} />
              <Text style={styles.timeText}>{formatTime(lastCheckOut)}</Text>
            </View>
          ) : hasOpenSession ? (
            <View style={styles.timeItem}>
              <Icon name="logout" size={11} color={COLORS.textMuted} />
              <Text style={[styles.timeText, { color: COLORS.warning }]}>
                Active
              </Text>
            </View>
          ) : null}

          {workedLabel ? (
            <View style={styles.timeItem}>
              <Icon name="timer-outline" size={11} color={COLORS.primary} />
              <Text style={[styles.timeText, { color: COLORS.primary }]}>
                {workedLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Sessions count + address */}
        <View style={styles.metaRow}>
          {completedSessions > 0 && (
            <View style={styles.timeItem}>
              <Icon name="calendar-check-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.timeText}>
                {completedSessions} session{completedSessions > 1 ? "s" : ""}
              </Text>
            </View>
          )}
          {firstAddress ? (
            <View style={[styles.addressRow, { flex: 1 }]}>
              <Icon name="map-marker-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.addressText} numberOfLines={1}>
                {firstAddress}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Day-level flags */}
        {(record.dayIsLate || record.dayIsEarlyExit) && (
          <View style={styles.flagRow}>
            {record.dayIsLate && (
              <View style={[styles.flagChip, { backgroundColor: COLORS.warning + '22' }]}>
                <Text style={[styles.flagChipText, { color: COLORS.warning }]}>Late</Text>
              </View>
            )}
            {record.dayIsEarlyExit && (
              <View style={[styles.flagChip, { backgroundColor: COLORS.error + '22' }]}>
                <Text style={[styles.flagChipText, { color: COLORS.error }]}>Early Exit</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Chevron */}
      <Icon name="chevron-right" size={18} color={COLORS.border} style={styles.rowChevron} />
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Date navigator
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  dateNavBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
  },
  dateNavBtnDisabled: { backgroundColor: COLORS.background },
  dateNavRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  monthViewBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    backgroundColor:   COLORS.primaryLight,
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical:   6,
  },
  monthViewText: {
    fontSize:   11,
    fontWeight: "700",
    color:      COLORS.primary,
  },
  dateCenter: {
    alignItems: "center",
    gap: 4,
  },
  dateText: { ...TYPOGRAPHY.h4, color: COLORS.textPrimary, fontWeight: "700" },

  todayChip: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  todayChipText: { fontSize: 10, color: COLORS.white, fontWeight: "700" },

  goToTodayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.full,
  },
  goToTodayText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: "700",
  },

  // Person banner (single-user mode)
  personBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primaryMid,
  },
  personBannerText: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    flex: 1,
  },
  personBannerName: { fontWeight: "700", color: COLORS.primary },

  // Summary
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  summaryChip: { alignItems: "center", minWidth: 48 },
  summaryCount: { ...TYPOGRAPHY.h3, fontWeight: "800" },
  summaryLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  // Status chips
  chipsWrap: { flexGrow: 0, flexShrink: 0, backgroundColor: COLORS.background },
  chips: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 36,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  chipTextActive: { color: COLORS.white },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },

  // Loading
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },

  // Attendance row
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
    flexShrink: 0,
  },
  avatarText: { fontSize: 15, fontWeight: "700" },

  rowInfo: { flex: 1 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  rowName: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    fontWeight: "600",
    flex: 1,
  },
  rowEmail: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },

  statusBadge: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: SPACING.xs,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "700" },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  timeItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  timeText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 2,
  },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  addressText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, flex: 1 },

  rowChevron: { alignSelf: 'center', marginLeft: SPACING.xs },
  flagRow: { flexDirection: 'row', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  flagChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  flagChipText: { fontSize: 9, fontWeight: '700' },

  list: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl },
  emptyContent: { flexGrow: 1 },
});
