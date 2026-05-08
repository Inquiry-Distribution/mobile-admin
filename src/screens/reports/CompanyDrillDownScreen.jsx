/**
 * CompanyDrillDownScreen — Admin & Superuser
 *
 * Shows all salespersons belonging to a specific company
 * with their individual inquiry stats for the same date range
 * that was selected in CompanyReportScreen.
 *
 * route.params: { companyId, companyName, from?, to? }
 *
 * Tap a salesperson row → SalespersonReportScreen
 */
import React, { useState, useEffect, useCallback } from "react";
import { CommonActions } from "@react-navigation/native";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import dayjs from "dayjs";

import { COLORS } from "@constants/colors";
import { TYPOGRAPHY, FONTS, FONT_SIZE } from "@constants/typography";
import { SPACING, BORDER_RADIUS, SHADOW } from "@constants/config";
import { getInitials } from "@utils/helpers";
import { reportApi } from "@api/report.api";
import EmptyState from "@components/common/EmptyState";

export default function CompanyDrillDownScreen({ route, navigation }) {
  const { companyId, companyName, from, to } = route.params ?? {};

  // Navigate to Team tab with a clean stack [UserList → target].
  // Uses getParent() because this screen lives inside MoreStack, not the Tab directly.
  const goToTeamScreen = useCallback((screenName, params) => {
    navigation.getParent()?.dispatch((state) => {
      const routes = state.routes.map((r) =>
        r.name === 'Team'
          ? {
              ...r,
              state: {
                routes: [{ name: 'UserList' }, { name: screenName, params }],
                index: 1,
              },
            }
          : r
      );
      return CommonActions.reset({
        ...state,
        routes,
        index: state.routes.findIndex((r) => r.name === 'Team'),
      });
    });
  }, [navigation]);

  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (refreshing = false) => {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const params = { companyId, ...(from && to ? { from, to } : {}) };
        const res = await reportApi.getAllSalespersons(params);
        const list = res.data?.salespersons ?? res.data ?? [];
        // Sort by total desc
        setRows(
          [...list].sort(
            (a, b) => (b.inquiries?.total ?? 0) - (a.inquiries?.total ?? 0),
          ),
        );
      } catch (e) {
        setError(e.message ?? "Failed to load data");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [companyId, from, to],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Date range label
  const rangeLabel =
    from && to
      ? `${dayjs(from).format("DD MMM")} – ${dayjs(to).format("DD MMM YYYY")}`
      : "All time";

  // Grand totals from rows
  const grandTotal = rows.reduce((s, r) => s + (r.inquiries?.total ?? 0), 0);
  const grandClosed = rows.reduce((s, r) => s + (r.inquiries?.closed ?? 0), 0);
  const grandRate =
    grandTotal > 0
      ? ((grandClosed / grandTotal) * 100).toFixed(1) + "%"
      : "0.0%";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {/* ── Company banner ──────────────────────────────────── */}
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Icon name="domain" size={20} color={COLORS.white} />
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerName} numberOfLines={1}>
            {companyName}
          </Text>
          <Text style={styles.bannerSub}>{rangeLabel}</Text>
        </View>
        {/* Totals */}
        <View style={styles.bannerStats}>
          <Text style={styles.bannerStatValue}>{grandTotal}</Text>
          <Text style={styles.bannerStatLabel}>Total</Text>
        </View>
        <View style={styles.bannerDivider} />
        <View style={styles.bannerStats}>
          <Text style={[styles.bannerStatValue, { color: "#86EFAC" }]}>
            {grandClosed}
          </Text>
          <Text style={styles.bannerStatLabel}>Closed</Text>
        </View>
        <View style={styles.bannerDivider} />
        <View style={styles.bannerStats}>
          <Text style={[styles.bannerStatValue, { color: "#C4B5FD" }]}>
            {grandRate}
          </Text>
          <Text style={styles.bannerStatLabel}>Rate</Text>
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorCenter}>
          <Icon name="alert-circle-outline" size={40} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <SalespersonRow
              row={item}
              rank={index + 1}
              grandTotal={grandTotal}
              onPress={() =>
                goToTeamScreen('SalespersonReport', {
                  salespersonId: item.id,
                  name: item.name,
                })
              }
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => load(true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={
            rows.length > 0 ? (
              <View style={styles.tableHeader}>
                <Text
                  style={[styles.headerCell, { flex: 2, textAlign: "left" }]}
                >
                  Salesperson
                </Text>
                <Text style={styles.headerCell}>Assigned</Text>
                <Text style={styles.headerCell}>Closed</Text>
                <Text style={styles.headerCell}>Rate</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="account-group-outline"
              title="No salespersons"
              message="No salespersons found for this company."
            />
          }
          contentContainerStyle={
            rows.length === 0 ? styles.emptyContent : styles.listContent
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ── Salesperson row ───────────────────────────────────────────
function SalespersonRow({ row, rank, grandTotal, onPress }) {
  const inq = row.inquiries ?? {};
  const total = inq.total ?? 0;
  const closed = inq.closed ?? 0;
  const rateStr = inq.conversionRate ?? "0.00%";
  const rateNum = parseFloat(rateStr) || 0;
  const pctOfAll = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;

  const isTop = rank <= 3;
  const topColors = ["#F59E0B", "#9CA3AF", "#B45309"];
  const rankColor = isTop ? topColors[rank - 1] : COLORS.border;

  return (
    <TouchableOpacity
      style={styles.spRow}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Rank */}
      <View
        style={[
          styles.rankBadge,
          { backgroundColor: rankColor + "20", borderColor: rankColor },
        ]}
      >
        <Text style={[styles.rankText, { color: rankColor }]}>{rank}</Text>
      </View>

      {/* Avatar + name */}
      <View style={styles.spAvatar}>
        <Text style={styles.spAvatarText}>{getInitials(row.name)}</Text>
      </View>

      <View style={styles.spInfo}>
        <Text style={styles.spName} numberOfLines={1}>
          {row.name}
        </Text>
        {row.employeeId || row.assignedArea ? (
          <Text style={styles.spMeta} numberOfLines={1}>
            {[row.employeeId, row.assignedArea].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {/* Share-of-company bar */}
        <View style={styles.shareBar}>
          <View style={[styles.shareFill, { width: `${pctOfAll}%` }]} />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.spStats}>
        <View style={styles.spStatCol}>
          <Text style={styles.spStatValue}>{total}</Text>
          <Text style={styles.spStatLabel}>Total</Text>
        </View>
        <View style={styles.spStatCol}>
          <Text style={[styles.spStatValue, { color: COLORS.success }]}>
            {closed}
          </Text>
          <Text style={styles.spStatLabel}>Closed</Text>
        </View>
        <View style={styles.spStatCol}>
          <Text
            style={[
              styles.spStatValue,
              { color: rateNum >= 50 ? COLORS.success : COLORS.textMuted },
            ]}
          >
            {rateStr}
          </Text>
          <Text style={styles.spStatLabel}>Rate</Text>
        </View>
      </View>

      <Icon name="chevron-right" size={16} color={COLORS.border} />
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Banner
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bannerText: { flex: 1 },
  bannerName: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
  bannerSub: {
    ...TYPOGRAPHY.caption,
    color: "rgba(255,255,255,0.7)",
    marginTop: 1,
  },

  bannerStats: { alignItems: "center" },
  bannerStatValue: { fontSize: FONT_SIZE.md, color: COLORS.white, fontFamily: FONTS.bold },
  bannerStatLabel: {
    ...TYPOGRAPHY.caption,
    color: "rgba(255,255,255,0.7)",
    marginTop: 1,
  },
  bannerDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginHorizontal: 4,
  },

  // Loading / error
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  retryText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },

  // Table header
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.primaryLight,
    marginTop: SPACING.sm,
  },
  headerCell: {
    flex: 1,
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontFamily: FONTS.bold,
    textAlign: "center",
  },

  // Salesperson row
  spRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    gap: SPACING.sm,
    ...SHADOW.sm,
  },

  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rankText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold },

  spAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  spAvatarText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontFamily: FONTS.bold },

  spInfo: { flex: 1, minWidth: 0 },
  spName: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    fontFamily: FONTS.medium,
  },
  spMeta: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 1 },
  shareBar: {
    height: 4,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
  },
  shareFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },

  spStats: { flexDirection: "row", gap: SPACING.xs, flexShrink: 0 },
  spStatCol: { alignItems: "center", minWidth: 38 },
  spStatValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    fontFamily: FONTS.bold,
  },
  spStatLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  listContent: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl },
  emptyContent: { flexGrow: 1 },
});
