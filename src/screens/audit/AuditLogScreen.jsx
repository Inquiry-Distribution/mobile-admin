/**
 * AuditLogScreen — superuser only
 *
 * Paginated, filterable read-only audit trail of all admin actions.
 *
 * Filter: action keyword search + date range chips
 * Each row: performer, action, target model, timestamp, expandable detail
 */
import React, { useEffect, useState, useRef } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import dayjs from "dayjs";

import { COLORS } from "@constants/colors";
import { TYPOGRAPHY } from "@constants/typography";
import { SPACING, BORDER_RADIUS, SHADOW } from "@constants/config";
import { getInitials, formatDateTime } from "@utils/helpers";
import { auditApi } from "@api/audit.api";
import { CONFIG } from "@constants/config";

import Loader from "@components/common/Loader";
import EmptyState from "@components/common/EmptyState";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Date range presets ────────────────────────────────────────
const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "All", days: null },
];

function getRange(preset) {
  if (preset.days === null) return {};
  if (preset.days === 0) {
    const today = dayjs().format("YYYY-MM-DD");
    return { from: today, to: today };
  }
  return {
    from: dayjs().subtract(preset.days, "day").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
  };
}

// ── Action colour map ─────────────────────────────────────────
const ACTION_COLORS = {
  CREATE: { bg: "#DCFCE7", text: "#16A34A" },
  UPDATE: { bg: "#DBEAFE", text: "#2563EB" },
  DELETE: { bg: "#FEE2E2", text: "#DC2626" },
  LOGIN: { bg: "#EDE9FE", text: "#7C3AED" },
  BLOCK: { bg: "#FEF3C7", text: "#D97706" },
  ASSIGN: { bg: "#DBEAFE", text: "#2563EB" },
};

function getActionColor(action) {
  const key = Object.keys(ACTION_COLORS).find((k) =>
    action?.toUpperCase().includes(k),
  );
  return ACTION_COLORS[key] ?? { bg: COLORS.border, text: COLORS.textMuted };
}

export default function AuditLogScreen() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [search, setSearch] = useState("");
  const [presetIndex, setPresetIndex] = useState(3); // default All

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const searchRef = useRef(null);

  // ── Fetch page 1 ───────────────────────────────────────────
  const fetchPage1 = async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const range = getRange(DATE_PRESETS[presetIndex]);
      const params = { page: 1, limit: CONFIG.PAGE_SIZE, ...range };
      if (search.trim()) params.action = search.trim();

      const res = await auditApi.getAll(params);
      console.log("res  : ", res);

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
  };

  // ── Load more ──────────────────────────────────────────────
  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const range = getRange(DATE_PRESETS[presetIndex]);
      const params = { page: nextPage, limit: CONFIG.PAGE_SIZE, ...range };
      if (search.trim()) params.action = search.trim();

      const res = await auditApi.getAll(params);
      const data = Array.isArray(res?.data?.logs) ? res.data.logs : [];

      setLogs((prev) => [...prev, ...data]);
      setHasMore(data.length === CONFIG.PAGE_SIZE);
      setPage(nextPage);
    } catch (_) {
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPage1();
  }, [presetIndex]);

  if (isLoading && logs.length === 0) return <Loader />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* ── Search ──────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Icon
          name="magnify"
          size={20}
          color={COLORS.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          placeholder="Filter by action (e.g. assign, block)…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={() => fetchPage1()}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearch("");
              fetchPage1();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Date presets ─────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presets}
      >
        {DATE_PRESETS.map((p, i) => (
          <TouchableOpacity
            key={p.label}
            style={[styles.preset, presetIndex === i && styles.presetActive]}
            onPress={() => setPresetIndex(i)}
          >
            <Text
              style={[
                styles.presetText,
                presetIndex === i && styles.presetTextActive,
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── List ──────────────────────────────────────────── */}
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
              {total > 0 ? `${total} events` : `${logs.length} events`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="clipboard-text-off-outline"
              title="No audit logs"
              message="No events found for the selected period."
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
        contentContainerStyle={
          logs.length === 0 ? styles.emptyContent : styles.listContent
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ── Audit row ─────────────────────────────────────────────────
function AuditRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const actionColor = getActionColor(log.action);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  const performer = log.performedBy ?? log.performer;
  const targetModel = log.targetModel ?? log.model;
  const targetId = log.targetId;
  const meta = log.metadata ?? log.details ?? log.meta;

  return (
    <TouchableOpacity style={styles.row} onPress={toggle} activeOpacity={0.85}>
      {/* Left — performer avatar */}
      <View style={styles.rowAvatar}>
        <Text style={styles.rowAvatarText}>
          {getInitials(performer?.name ?? "?")}
        </Text>
      </View>

      <View style={styles.rowBody}>
        {/* Top row */}
        <View style={styles.rowTop}>
          <View
            style={[styles.actionBadge, { backgroundColor: actionColor.bg }]}
          >
            <Text style={[styles.actionBadgeText, { color: actionColor.text }]}>
              {log.action}
            </Text>
          </View>
          <Text style={styles.rowTime}>{dayjs(log.createdAt).fromNow()}</Text>
        </View>

        {/* Performer + target */}
        <Text style={styles.rowDesc} numberOfLines={expanded ? undefined : 1}>
          <Text style={styles.rowPerformer}>{performer?.name ?? "System"}</Text>
          {targetModel ? ` · ${targetModel}` : ""}
          {targetId ? ` #${String(targetId).slice(0, 8)}` : ""}
        </Text>

        {/* Expanded detail */}
        {expanded && meta ? (
          <View style={styles.metaBox}>
            <Text style={styles.metaText}>
              {typeof meta === "string" ? meta : JSON.stringify(meta, null, 2)}
            </Text>
          </View>
        ) : null}

        {expanded && log.createdAt ? (
          <Text style={styles.fullTime}>{formatDateTime(log.createdAt)}</Text>
        ) : null}
      </View>

      <Icon
        name={expanded ? "chevron-up" : "chevron-down"}
        size={16}
        color={COLORS.textMuted}
        style={{ marginLeft: SPACING.xs }}
      />
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { backgroundColor: COLORS.background,flex: 1 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    margin: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    ...SHADOW.sm,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    height: 44,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },

  presets: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  preset: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  presetText: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  presetTextActive: { color: COLORS.white },

  listHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  countText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  // Row
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
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
    flexShrink: 0,
  },
  rowAvatarText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },

  rowBody: { flex: 1 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  rowTime: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  actionBadge: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  rowDesc: { ...TYPOGRAPHY.small, color: COLORS.textSecondary },
  rowPerformer: { fontWeight: "700", color: COLORS.textPrimary },

  metaBox: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: COLORS.textSecondary,
  },
  fullTime: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 4 },

  loadingMore: { paddingVertical: SPACING.lg, alignItems: "center" },
  listContent: { paddingBottom: SPACING.xxl },
  emptyContent: { flexGrow: 1 },
});
