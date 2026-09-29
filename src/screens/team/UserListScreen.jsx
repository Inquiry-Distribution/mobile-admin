/**
 * UserListScreen — paginated list of all users (admin / superuser view)
 *
 * Features:
 *  • Search by name / email / employeeId
 *  • Role filter chips (All / Sales / Admin / Superuser)
 *  • Active / Inactive filter
 *  • Infinite scroll via user.store
 *  • Tap row → UserDetailScreen
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import { COLORS, ROLE_COLORS } from "@constants/colors";
import { TYPOGRAPHY, FONTS, FONT_SIZE } from "@constants/typography";
import { SPACING, BORDER_RADIUS, SHADOW } from "@constants/config";
import { getInitials } from "@utils/helpers";

import useUserStore from "@store/user.store";
import { userApi } from "@api/user.api";
import EmptyState from "@components/common/EmptyState";
import ErrorState from "@components/common/ErrorState";
import { ListSkeleton } from "@components/common/Skeleton";
import { showSuccessToast, showErrorToast } from "@utils/errorHandler";
import { requireOnline } from "@utils/offline";

// ── Filter config ─────────────────────────────────────────────
const ROLE_CHIPS = [
  { label: "Sales", value: "sales" },
  { label: "Admin", value: "admin" },
  { label: "Superuser", value: "superuser" },
];

const ACTIVE_CHIPS = [
  { label: "All", value: "" },
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];

export default function UserListScreen({ navigation }) {
  const {
    users,
    total,
    filters,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    fetchUsers,
    refreshUsers,
    loadMore,
    setFilters,
    clearFilters,
  } = useUserStore();

  const [menuVisible, setMenuVisible] = useState(false);
  const [isSyncing,   setIsSyncing]   = useState(false);
  const searchDebounce = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerMenuBtn}
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="dots-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleSync = async () => {
    setMenuVisible(false);
    if (!requireOnline('Connect to sync users.')) return;
    setIsSyncing(true);
    try {
      const res = await userApi.sync();
      const { created, updated, skipped, total: tot } = res.data ?? res;
      showSuccessToast(
        `Total: ${tot}  •  Created: ${created}  •  Updated: ${updated}  •  Skipped: ${skipped}`,
        'Sync complete',
      );
      refreshUsers();
    } catch {
      showErrorToast('Could not sync users. Please try again.', 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    return () => {
      clearFilters();
      clearTimeout(searchDebounce.current);
    };
  }, []);

  const onChipPress = (key, value) => {
    setFilters({ [key]: value });
    fetchUsers();
  };

  const handleEndReached = () => {
    if (!isLoadingMore) loadMore();
  };

  if (isLoading && users.length === 0 && !error) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ListSkeleton count={6} />
      </SafeAreaView>
    );
  }

  if (error && users.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ErrorState
          title="Could not load users"
          message={error}
          onAction={() => fetchUsers()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {/* ── Filter panel ─────────────────────────────────── */}
      <View style={styles.filterPanel}>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Icon
            name="magnify"
            size={20}
            color={COLORS.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, email, employee ID…"
            placeholderTextColor={COLORS.textMuted}
            value={filters.search}
            onChangeText={(v) => {
              setFilters({ search: v });
              clearTimeout(searchDebounce.current);
              searchDebounce.current = setTimeout(fetchUsers, 400);
            }}
            returnKeyType="search"
            onSubmitEditing={() => {
              clearTimeout(searchDebounce.current);
              fetchUsers();
            }}
            autoCapitalize="none"
          />
          {filters.search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                clearTimeout(searchDebounce.current);
                setFilters({ search: "" });
                fetchUsers();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          {ROLE_CHIPS.map((c) => (
            <TouchableOpacity
              key={c.value}
              style={[styles.chip, filters.role === c.value && styles.chipActive]}
              onPress={() => onChipPress("role", c.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  filters.role === c.value && styles.chipTextActive,
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.chipDivider} />

          {ACTIVE_CHIPS.map((c) => (
            <TouchableOpacity
              key={`a-${c.value}`}
              style={[
                styles.chip,
                filters.isActive === c.value && styles.chipActive,
              ]}
              onPress={() => onChipPress("isActive", c.value)}
            >
              {c.value === "true" && (
                <View
                  style={[styles.statusDot, { backgroundColor: COLORS.success }]}
                />
              )}
              {c.value === "false" && (
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: COLORS.textMuted },
                  ]}
                />
              )}
              <Text
                style={[
                  styles.chipText,
                  filters.isActive === c.value && styles.chipTextActive,
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

      </View>{/* end filterPanel */}

      {/* ── List ──────────────────────────────────────────── */}
      <FlatList
        data={users}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            onPress={() => navigation.navigate("UserDetail", { id: item.id })}
          />
        )}
        refreshing={isRefreshing}
        onRefresh={refreshUsers}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.countText}>
              {total > 0
                ? `${total} user${total !== 1 ? "s" : ""}`
                : `${users.length} result${users.length !== 1 ? "s" : ""}`}
            </Text>
            {(filters.role || filters.isActive || filters.search) && (
              <TouchableOpacity
                onPress={() => {
                  clearFilters();
                  fetchUsers();
                }}
              >
                <Text style={styles.clearFilters}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="account-group-outline"
              title="No users found"
              message={
                filters.search || filters.role || filters.isActive
                  ? "Try adjusting your filters."
                  : "Add a user or pull down to refresh."
              }
              actionLabel={
                filters.search || filters.role || filters.isActive
                  ? "Clear filters"
                  : "Add user"
              }
              onAction={
                filters.search || filters.role || filters.isActive
                  ? () => {
                      clearFilters();
                      fetchUsers();
                    }
                  : () => navigation.navigate("CreateUser")
              }
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
          users.length === 0 ? styles.emptyContent : styles.listContent
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── FAB — Add User ──────────────────────────────── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("CreateUser")}
        activeOpacity={0.85}
      >
        <Icon name="account-plus-outline" size={24} color={COLORS.white} />
      </TouchableOpacity>

      {/* ── Three-dot dropdown menu ──────────────────────── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuBox}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Icon name="sync" size={18} color={COLORS.primary} />
              )}
              <Text style={styles.menuItemText}>
                {isSyncing ? "Syncing…" : "Sync Users"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Row ──────────────────────────────────────────────────────
function UserRow({ user, onPress }) {
  const { name, email, role, employeeId, assignedArea, isActive, pin, company } = user;
  const roleColor = ROLE_COLORS[role] ?? {
    bg: COLORS.primaryLight,
    text: COLORS.primary,
  };

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.78}>
      {/* Active strip */}
      <View
        style={[
          styles.rowStrip,
          { backgroundColor: isActive ? COLORS.success : COLORS.border },
        ]}
      />

      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: roleColor.bg }]}>
        <Text style={[styles.avatarText, { color: roleColor.text }]}>
          {getInitials(name)}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.nameText} numberOfLines={1}>
            {name}
          </Text>
          {!isActive && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>Inactive</Text>
            </View>
          )}
        </View>

        <Text style={styles.emailText} numberOfLines={1}>
          {email}
        </Text>

        {/* Company row */}
        {company?.name ? (
          <View style={styles.companyRow}>
            <Icon name="domain" size={11} color={COLORS.primary} />
            <Text style={styles.companyText} numberOfLines={1}>
              {company.name}
            </Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
            <Text style={[styles.roleBadgeText, { color: roleColor.text }]}>
              {role}
            </Text>
          </View>

          {employeeId ? (
            <Text style={styles.metaText}>{employeeId}</Text>
          ) : null}
          {assignedArea ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText} numberOfLines={1}>
                {assignedArea}
              </Text>
            </>
          ) : null}

          {pin === true && (
            <View style={styles.pinChip}>
              <Icon name="lock-check-outline" size={9} color={COLORS.success} />
              <Text style={styles.pinChipText}>PIN</Text>
            </View>
          )}
        </View>
      </View>

      <Icon
        name="chevron-right"
        size={18}
        color={COLORS.border}
        style={{ marginRight: SPACING.sm }}
      />
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { backgroundColor: COLORS.background, flex: 1 },

  // Filter panel — unified surface container
  filterPanel: {
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingBottom:     SPACING.xs,
  },

  searchWrap: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   COLORS.background,
    borderRadius:      BORDER_RADIUS.md,
    margin:            SPACING.md,
    marginBottom:      SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    height: 44,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },

  chipsScroll: { flexShrink: 0, flexGrow: 0 },
  chips: {
    paddingHorizontal: SPACING.md,
    paddingBottom:     SPACING.sm,
    gap:               SPACING.xs,
    flexDirection:     "row",
    alignItems:        "center",
  },
  chip: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: SPACING.md,
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   COLORS.background,
    borderWidth:       1,
    borderColor:       COLORS.border,
    height:            32,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    includeFontPadding: false,
    fontFamily: FONTS.medium,
  },
  chipTextActive: { color: COLORS.white },
  chipDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },

  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  countText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  clearFilters: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontFamily: FONTS.medium,
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    overflow: "hidden",
    ...SHADOW.sm,
  },
  rowStrip: { width: 4, alignSelf: "stretch" },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    margin: SPACING.sm,
    marginRight: SPACING.xs,
  },
  avatarText: { fontSize: FONT_SIZE.md, fontFamily: FONTS.bold },

  info: { flex: 1, paddingVertical: 12 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  nameText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    fontFamily: FONTS.medium,
    flex: 1,
  },

  inactiveBadge: {
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  inactiveBadgeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontFamily: FONTS.bold,
  },

  emailText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },

  roleBadge: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  roleBadgeText: {
    fontSize: FONT_SIZE.xs,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontFamily: FONTS.bold,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
    marginBottom:  3,
  },
  companyText: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.primary,
    fontFamily: FONTS.medium,
    flex:       1,
  },

  metaText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  metaDot: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  pinChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#DCFCE7",
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pinChipText: { fontSize: FONT_SIZE.xs, color: COLORS.success, fontFamily: FONTS.bold },

  loadingMore: { paddingVertical: SPACING.lg, alignItems: "center" },
  listContent: { paddingBottom: 90 }, // extra room for FAB
  emptyContent: { flexGrow: 1 },

  headerMenuBtn: {
    marginRight: 12,
    padding: 4,
  },

  // ── Dropdown menu ───────────────────────────────────────────────
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  menuBox: {
    position: "absolute",
    top: 56,
    right: 12,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 4,
    minWidth: 160,
    ...SHADOW.md,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  menuItemText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },

  // ── FAB ────────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
});
