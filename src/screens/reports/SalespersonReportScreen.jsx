/**
 * SalespersonReportScreen
 *
 * Individual performance drill-down for a single salesperson.
 * Navigated to from UserDetailScreen with params: { salespersonId, name }
 *
 * Sections:
 *  • Date preset chips (Today / This Week / This Month / Last Month)
 *  • KPI cards — Assigned, Closed, Conversion %, Present days
 *  • Inquiry status breakdown
 *  • Attendance summary
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import dayjs from "dayjs";

import { COLORS, STATUS_COLORS } from "@constants/colors";
import { TYPOGRAPHY, FONT_SIZE, FONTS } from "@constants/typography";
import { reportApi } from "@api/report.api";
import { formatPercent, formatNumber, getInitials } from "@utils/helpers";

// ─── Date presets ──────────────────────────────────────────────────────────────
const PRESETS = [
  { label: "Today", days: 0 },
  { label: "This Week", days: 7 },
  { label: "This Month", month: true },
  { label: "Last 30d", days: 30 },
];

function getRange(preset) {
  const to = dayjs().format("YYYY-MM-DD");
  if (preset.month) {
    return { from: dayjs().startOf("month").format("YYYY-MM-DD"), to };
  }
  if (preset.days === 0) {
    return { from: to, to };
  }
  return {
    from: dayjs().subtract(preset.days, "day").format("YYYY-MM-DD"),
    to,
  };
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function PresetChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function KpiCard({ icon, label, value, color, sub }) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: color }]}>
      <View style={[styles.kpiIconBox, { backgroundColor: color + "20" }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value ?? "—"}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

function StatusBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={styles.statusBarWrap}>
      <View style={styles.statusBarHeader}>
        <View style={styles.statusBarLeft}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={styles.statusLabel}>{label}</Text>
        </View>
        <Text style={styles.statusCount}>
          {count} <Text style={styles.statusPct}>({pct}%)</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

function AttendancePill({ label, count, color }) {
  return (
    <View
      style={[
        styles.attPill,
        { backgroundColor: color + "18", borderColor: color + "40" },
      ]}
    >
      <Text style={[styles.attCount, { color }]}>{count ?? 0}</Text>
      <Text style={[styles.attLabel, { color }]}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Icon name={icon} size={16} color={COLORS.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SalespersonReportScreen({ route }) {
  const { salespersonId, name } = route.params ?? {};

  const [preset, setPreset] = useState(1); // default: This Week
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (presetIdx, refreshing = false) => {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const range = getRange(PRESETS[presetIdx]);
        const res = await reportApi.getSalesperson(salespersonId, range);
        setReport(res.data ?? res);
      } catch (err) {
        setError(err.message ?? "Failed to load report");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [salespersonId],
  );

  useEffect(() => {
    load(preset);
  }, [preset]);

  // ── Derived values ─────────────────────────────────────────────
  // API returns fields flat: { total, closed, inProgress, followUp, notInterested, converted, conversionRate }
  const total         = report?.total         ?? 0;
  const closed        = report?.closed        ?? 0;
  const inProgress    = report?.inProgress    ?? 0;
  const followUp      = report?.followUp      ?? 0;
  const notInterested = report?.notInterested ?? 0;
  const converted     = report?.converted     ?? 0;
  const assigned      = Math.max(0, total - closed - inProgress - followUp - notInterested - converted);
  // conversionRate arrives as "30.00%" string — parse to 0-1 float for formatPercent
  const convRate   = report?.conversionRate
    ? parseFloat(report.conversionRate) / 100
    : total > 0 ? converted / total : 0;

  const att         = report?.attendance ?? {};
  const present     = att.present  ?? 0;
  const absent      = att.absent   ?? 0;
  const halfDay     = att.halfDay  ?? att.half_day ?? 0;
  const workingDays = present + absent + halfDay;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load(preset, true)}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ── Name banner ───────────────────────────────── */}
        <View style={styles.banner}>
          <View style={styles.bannerAvatar}>
            <Text style={styles.bannerInitials}>
              {getInitials(name ?? "U")}
            </Text>
          </View>
          <View>
            <Text style={styles.bannerName}>{name ?? "Salesperson"}</Text>
            <Text style={styles.bannerSub}>Performance Report</Text>
          </View>
        </View>

        {/* ── Date presets ──────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {PRESETS.map((p, i) => (
            <PresetChip
              key={p.label}
              label={p.label}
              selected={preset === i}
              onPress={() => setPreset(i)}
            />
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading report…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={40} color={COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => load(preset)}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── KPI cards ─────────────────────────────── */}
            <View style={styles.kpiGrid}>
              <KpiCard
                icon="clipboard-list-outline"
                label="Total Assigned"
                value={formatNumber(total)}
                color={COLORS.primary}
              />
              <KpiCard
                icon="check-circle-outline"
                label="Closed"
                value={formatNumber(closed)}
                color={COLORS.closed}
              />
              <KpiCard
                icon="percent-outline"
                label="Conversion"
                value={formatPercent(convRate)}
                color={COLORS.info}
                sub={`${converted} of ${total}`}
              />
              <KpiCard
                icon="calendar-check-outline"
                label="Present"
                value={present}
                color={COLORS.secondary}
                sub={workingDays > 0 ? `of ${workingDays} days` : undefined}
              />
            </View>

            {/* ── Inquiry breakdown ─────────────────────── */}
            <SectionCard
              title="Inquiry Breakdown"
              icon="clipboard-text-outline"
            >
              {total === 0 ? (
                <Text style={styles.emptyCardText}>
                  No inquiries in this period.
                </Text>
              ) : (
                <>
                  <StatusBar
                    label="Closed"
                    count={closed}
                    total={total}
                    color={COLORS.closed}
                  />
                  <StatusBar
                    label="Converted"
                    count={converted}
                    total={total}
                    color={STATUS_COLORS.converted.text}
                  />
                  <StatusBar
                    label="In Progress"
                    count={inProgress}
                    total={total}
                    color={COLORS.inProgress}
                  />
                  <StatusBar
                    label="Follow Up"
                    count={followUp}
                    total={total}
                    color={COLORS.followUp}
                  />
                  <StatusBar
                    label="Not Interested"
                    count={notInterested}
                    total={total}
                    color={STATUS_COLORS.not_interested.text}
                  />
                  <StatusBar
                    label="Assigned"
                    count={assigned}
                    total={total}
                    color={COLORS.assigned}
                  />
                </>
              )}
            </SectionCard>

            {/* ── Attendance ────────────────────────────── */}
            <SectionCard title="Attendance" icon="calendar-month-outline">
              {workingDays === 0 ? (
                <Text style={styles.emptyCardText}>
                  No attendance data for this period.
                </Text>
              ) : (
                <View style={styles.attRow}>
                  <AttendancePill
                    label="Present"
                    count={present}
                    color={COLORS.present}
                  />
                  <AttendancePill
                    label="Half Day"
                    count={halfDay}
                    color={COLORS.halfDay}
                  />
                  <AttendancePill
                    label="Absent"
                    count={absent}
                    color={COLORS.absent}
                  />
                </View>
              )}
            </SectionCard>

            {/* ── Extra stats (if available) ────────────── */}
            {report?.avgResponseTime || report?.avgCloseTime ? (
              <SectionCard title="Performance" icon="speedometer-outline">
                {report.avgResponseTime != null && (
                  <View style={styles.perfRow}>
                    <Text style={styles.perfLabel}>Avg. First Response</Text>
                    <Text style={styles.perfValue}>
                      {report.avgResponseTime}h
                    </Text>
                  </View>
                )}
                {report.avgCloseTime != null && (
                  <View style={styles.perfRow}>
                    <Text style={styles.perfLabel}>Avg. Close Time</Text>
                    <Text style={styles.perfValue}>{report.avgCloseTime}h</Text>
                  </View>
                )}
              </SectionCard>
            ) : null}
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 16, gap: 12 },

  // ── Banner ─────────────────────────────────────────────────────
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
  },
  bannerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerInitials: { ...TYPOGRAPHY.h4, color: COLORS.white, fontFamily: FONTS.bold },
  bannerName: { ...TYPOGRAPHY.h4, color: COLORS.white, fontFamily: FONTS.bold },
  bannerSub: {
    ...TYPOGRAPHY.caption,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },

  // ── Preset chips ───────────────────────────────────────────────
  chips: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 36,
  },
  chipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  chipText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  chipTextActive: { color: COLORS.primary },

  // ── KPI ────────────────────────────────────────────────────────
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 3,
    gap: 4,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kpiValue: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, fontFamily: FONTS.bold },
  kpiLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  kpiSub: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  // ── Card ───────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: {
    ...TYPOGRAPHY.body,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  emptyCardText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textAlign: "center",
    paddingVertical: 12,
  },

  // ── Status bars ────────────────────────────────────────────────
  statusBarWrap: { gap: 6 },
  statusBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBarLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  statusCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
    fontFamily: FONTS.bold,
  },
  statusPct: { color: COLORS.textMuted },
  barTrack: {
    height: 6,
    backgroundColor: COLORS.background,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },

  // ── Attendance pills ───────────────────────────────────────────
  attRow: { flexDirection: "row", gap: 10 },
  attPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  attCount: { ...TYPOGRAPHY.h3, fontFamily: FONTS.bold },
  attLabel: { ...TYPOGRAPHY.caption, fontFamily: FONTS.medium },

  // ── Performance rows ───────────────────────────────────────────
  perfRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  perfLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  perfValue: {
    ...TYPOGRAPHY.body,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },

  // ── Loading / error ────────────────────────────────────────────
  loadingBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  loadingText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  errorBox: { alignItems: "center", paddingVertical: 48, gap: 12 },
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryText: { ...TYPOGRAPHY.body, color: COLORS.white, fontFamily: FONTS.bold },

  bottomPad: { height: 24 },
});
