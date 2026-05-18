/**
 * InquiryListScreen — Admin & Superuser
 *
 * Features:
 *  • Server-side pagination with infinite scroll
 *  • Search bar + Filter button (right) → bottom drawer
 *  • Filter drawer: Period · Status · Priority · Salesperson
 *  • Draft state in drawer — committed only on "Apply Filters"
 *  • Active-filter badge count on filter button
 *  • Pull-to-refresh
 *  • Badge showing total count
 *  • Tap row → InquiryDetail
 */
import React, { useEffect, useState, useCallback } from "react";
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
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import dayjs from "dayjs";

import { COLORS, PRIORITY_COLORS, STATUS_COLORS } from "@constants/colors";
import { STATUS_LABEL, stripHtml } from "@utils/helpers";
import { TYPOGRAPHY, FONTS, FONT_SIZE } from "@constants/typography";
import { SPACING, BORDER_RADIUS } from "@constants/config";

import useInquiryStore from "@store/inquiry.store";
import useUserStore from "@store/user.store";
import Loader from "@components/common/Loader";
import EmptyState from "@components/common/EmptyState";

const { height: SCREEN_H } = Dimensions.get("window");

// ─── Filter config ────────────────────────────────────────────
const DATE_PERIODS = [
  { key: "today", label: "Today", icon: "calendar-today" },
  { key: "week", label: "This Week", icon: "calendar-week" },
  { key: "month", label: "This Month", icon: "calendar-month" },
  { key: "all", label: "All Time", icon: "calendar-blank-multiple" },
];

const STATUS_CHIPS = [
  { label: "All", value: "" },
  { label: "Unassigned", value: "unassigned" },
  { label: "Assigned", value: "assigned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Follow Up", value: "follow_up" },
  { label: "Not Interested", value: "not_interested" },
  { label: "Converted", value: "converted" },
  { label: "Closed", value: "closed" },
];

const PRIORITY_CHIPS = [
  { label: "All", value: "" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

// ─── Main screen ─────────────────────────────────────────────
export default function InquiryListScreen({ navigation, route }) {
  const {
    inquiries,
    total,
    filters,
    activePeriod,
    isLoading,
    isRefreshing,
    isLoadingMore,
    fetchInquiries,
    refreshInquiries,
    loadMore,
    setFilters,
    clearFilters,
    setPeriod,
  } = useInquiryStore();

  const { salespersons, fetchSalespersons } = useUserStore();

  // ── Salesperson picker state ───────────────────────────────
  const [spPickerVisible, setSpPickerVisible] = useState(false);
  const [spSearch, setSpSearch] = useState("");

  // ── Filter drawer state ────────────────────────────────────
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Draft copies — live inside drawer, committed on Apply
  const [draftStatus, setDraftStatus] = useState("");
  const [draftPriority, setDraftPriority] = useState("");
  const [draftPeriod, setDraftPeriod] = useState("all");
  const [draftSpId, setDraftSpId] = useState("");

  // ── Derived ────────────────────────────────────────────────
  const filteredSp = salespersons.filter(
    (sp) =>
      !spSearch || sp.name?.toLowerCase().includes(spSearch.toLowerCase()),
  );
  const draftSp = salespersons.find((sp) => sp.id === draftSpId) ?? null;

  // Count of active filters (excludes search — shown inline)
  const activeFilterCount = [
    filters.status !== "",
    filters.priority !== "",
    filters.assignedToId !== "",
    activePeriod !== "all",
  ].filter(Boolean).length;

  // ── Route params (pre-select from Dashboard / UserDetail) ─
  const presetStatus = route?.params?.filterStatus;
  const presetAssignedToId = route?.params?.filterAssignedToId;

  useEffect(() => {
    const patch = {};
    if (presetStatus) patch.status = presetStatus;
    if (presetAssignedToId) patch.assignedToId = presetAssignedToId;
    if (Object.keys(patch).length) setFilters(patch);
    fetchInquiries();
    fetchSalespersons();
    return () => clearFilters();
  }, [presetAssignedToId, presetStatus]);

  // ── Drawer open / close ────────────────────────────────────
  const openDrawer = useCallback(() => {
    // Seed drafts from committed store values
    setDraftStatus(filters.status);
    setDraftPriority(filters.priority);
    setDraftPeriod(activePeriod);
    setDraftSpId(filters.assignedToId);
    setDrawerVisible(true);
  }, [filters, activePeriod]);

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false);
    setSpSearch("");
  }, []);

  // ── Drawer actions ─────────────────────────────────────────
  const applyFilters = useCallback(() => {
    setFilters({
      status: draftStatus,
      priority: draftPriority,
      assignedToId: draftSpId,
    });
    setPeriod(draftPeriod);
    fetchInquiries();
    closeDrawer();
  }, [draftStatus, draftPriority, draftPeriod, draftSpId]);

  const resetDraft = useCallback(() => {
    setDraftStatus("");
    setDraftPriority("");
    setDraftPeriod("all");
    setDraftSpId("");
  }, []);

  // ── Salesperson picker (inside drawer) ─────────────────────
  const handleSelectSp = useCallback((sp) => {
    setDraftSpId(sp ? sp.id : "");
    setSpPickerVisible(false);
    setSpSearch("");
  }, []);

  // ── Search ─────────────────────────────────────────────────
  const onSearchSubmit = () => fetchInquiries();

  // ── Infinite scroll ────────────────────────────────────────
  const handleEndReached = () => {
    if (!isLoadingMore) loadMore();
  };

  if (isLoading && inquiries.length === 0) return <Loader />;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {/* FAB — Add new inquiry */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("CreateInquiry")}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={26} color={COLORS.white} />
      </TouchableOpacity>

      {/* ── Search + Filter button row ─────────────────────── */}
      <View style={styles.searchRow}>
        {/* Search input */}
        <View style={styles.searchWrap}>
          <Icon
            name="magnify"
            size={20}
            color={COLORS.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search inq code, description, mobile…"
            placeholderTextColor={COLORS.textMuted}
            value={filters.search}
            onChangeText={(v) => setFilters({ search: v })}
            returnKeyType="search"
            onSubmitEditing={onSearchSubmit}
          />
          {filters.search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setFilters({ search: "" });
                fetchInquiries();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter button */}
        <TouchableOpacity
          style={[
            styles.filterBtn,
            activeFilterCount > 0 && styles.filterBtnActive,
          ]}
          onPress={openDrawer}
          activeOpacity={0.8}
        >
          <Icon
            name="tune-variant"
            size={19}
            color={activeFilterCount > 0 ? COLORS.white : COLORS.primary}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Filter-refresh loader ────────────────────────────── */}
      {isLoading && inquiries.length > 0 && (
        <View style={styles.filterLoader}>
          <View style={styles.filterLoaderInner}>
            <ActivityIndicator size={28} color={COLORS.primary} />
          </View>
        </View>
      )}

      {/* ── List ─────────────────────────────────────────────── */}
      <FlatList
        data={inquiries}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <InquiryRow
            inquiry={item}
            onPress={() =>
              navigation.navigate("InquiryDetail", { id: item.id })
            }
          />
        )}
        refreshing={isRefreshing}
        onRefresh={refreshInquiries}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.countText}>
              {total > 0
                ? `${total} inquir${total === 1 ? "y" : "ies"}`
                : `${inquiries.length} result${
                    inquiries.length !== 1 ? "s" : ""
                  }`}
            </Text>
            {activeFilterCount > 0 || filters.search ? (
              <TouchableOpacity
                onPress={() => {
                  clearFilters();
                  fetchInquiries();
                }}
              >
                <Text style={styles.clearFilters}>Clear filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="clipboard-text-off-outline"
              title="No inquiries found"
              message={
                filters.search || filters.status || filters.priority
                  ? "Try adjusting your filters."
                  : "Pull down to refresh."
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
          inquiries.length === 0 ? styles.emptyContent : styles.listContent
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ══════════════════════════════════════════════════════
          Filter Bottom Drawer
      ══════════════════════════════════════════════════════ */}
      <FilterDrawer
        visible={drawerVisible}
        onClose={closeDrawer}
        onApply={applyFilters}
        onReset={resetDraft}
        // Period
        draftPeriod={draftPeriod}
        setDraftPeriod={setDraftPeriod}
        // Status
        draftStatus={draftStatus}
        setDraftStatus={setDraftStatus}
        // Priority
        draftPriority={draftPriority}
        setDraftPriority={setDraftPriority}
        // Salesperson
        draftSp={draftSp}
        onOpenSpPicker={() => setSpPickerVisible(true)}
        onClearSp={() => setDraftSpId("")}
      />

      {/* ── Salesperson picker modal ────────────────────────── */}
      <Modal
        visible={spPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSpPickerVisible(false);
          setSpSearch("");
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setSpPickerVisible(false);
            setSpSearch("");
          }}
        />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Salesperson</Text>
            <TouchableOpacity
              onPress={() => {
                setSpPickerVisible(false);
                setSpSearch("");
              }}
            >
              <Icon name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearch}>
            <Icon
              name="magnify"
              size={18}
              color={COLORS.textMuted}
              style={{ marginRight: 6 }}
            />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search salesperson…"
              placeholderTextColor={COLORS.textMuted}
              value={spSearch}
              onChangeText={setSpSearch}
              autoFocus
            />
            {spSearch.length > 0 && (
              <TouchableOpacity onPress={() => setSpSearch("")}>
                <Icon name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* All option */}
          <TouchableOpacity
            style={[styles.modalItem, !draftSpId && styles.modalItemActive]}
            onPress={() => handleSelectSp(null)}
          >
            <View style={styles.modalAvatar}>
              <Icon
                name="account-group-outline"
                size={14}
                color={COLORS.textSecondary}
              />
            </View>
            <View style={styles.modalItemInfo}>
              <Text
                style={[
                  styles.modalItemName,
                  !draftSpId && styles.modalItemNameActive,
                ]}
              >
                All Salespersons
              </Text>
            </View>
            {!draftSpId && (
              <Icon name="check-circle" size={18} color={COLORS.primary} />
            )}
          </TouchableOpacity>

          <View style={styles.modalDivider} />

          <FlatList
            data={filteredSp}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isActive = draftSpId === item.id;
              const initials = item.name
                ? item.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                : "?";
              return (
                <TouchableOpacity
                  style={[styles.modalItem, isActive && styles.modalItemActive]}
                  onPress={() => handleSelectSp(item)}
                >
                  <View
                    style={[
                      styles.modalAvatar,
                      isActive && styles.modalAvatarActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalAvatarText,
                        isActive && { color: COLORS.white },
                      ]}
                    >
                      {initials}
                    </Text>
                  </View>
                  <View style={styles.modalItemInfo}>
                    <Text
                      style={[
                        styles.modalItemName,
                        isActive && styles.modalItemNameActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {item.email ? (
                      <Text style={styles.modalItemSub} numberOfLines={1}>
                        {item.email}
                      </Text>
                    ) : null}
                  </View>
                  {isActive && (
                    <Icon
                      name="check-circle"
                      size={18}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>No salesperson found</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Filter Bottom Drawer component ──────────────────────────
function FilterDrawer({
  visible,
  onClose,
  onApply,
  onReset,
  draftPeriod,
  setDraftPeriod,
  draftStatus,
  setDraftStatus,
  draftPriority,
  setDraftPriority,
  draftSp,
  onOpenSpPicker,
  onClearSp,
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Dim overlay — tap to close without applying */}
      <TouchableOpacity
        style={styles.drawerOverlay}
        activeOpacity={1}
        onPress={onClose}
      />

      <View
        style={[
          styles.drawerSheet,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.drawerHandle} />

        {/* Header */}
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Filters</Text>
          <TouchableOpacity
            onPress={onReset}
            style={styles.drawerResetBtn}
            activeOpacity={0.7}
          >
            <Icon name="refresh" size={14} color={COLORS.primary} />
            <Text style={styles.drawerResetText}>Reset All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            style={styles.drawerCloseBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.drawerScroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Section: Period ─────────────────────────── */}
          <DrawerSection icon="calendar-outline" title="Period">
            <View style={styles.chipGroup}>
              {DATE_PERIODS.map((p) => {
                const active = draftPeriod === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[
                      styles.drawerChip,
                      active && styles.drawerChipActive,
                    ]}
                    onPress={() => setDraftPeriod(p.key)}
                    activeOpacity={0.75}
                  >
                    <Icon
                      name={p.icon}
                      size={13}
                      color={active ? COLORS.white : COLORS.textSecondary}
                    />
                    <Text
                      style={[
                        styles.drawerChipText,
                        active && styles.drawerChipTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </DrawerSection>

          <DrawerDivider />

          {/* ── Section: Status ─────────────────────────── */}
          <DrawerSection icon="clipboard-list-outline" title="Status">
            <View style={styles.chipGroup}>
              {STATUS_CHIPS.map((c) => {
                const active = draftStatus === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    style={[
                      styles.drawerChip,
                      active && styles.drawerChipActive,
                    ]}
                    onPress={() => setDraftStatus(c.value)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.drawerChipText,
                        active && styles.drawerChipTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </DrawerSection>

          <DrawerDivider />

          {/* ── Section: Priority ───────────────────────── */}
          <DrawerSection icon="flag-outline" title="Priority">
            <View style={styles.chipGroup}>
              {PRIORITY_CHIPS.map((c) => {
                const active = draftPriority === c.value;
                const dot = c.value ? PRIORITY_COLORS[c.value]?.text : null;
                return (
                  <TouchableOpacity
                    key={c.value}
                    style={[
                      styles.drawerChip,
                      active && styles.drawerChipActive,
                    ]}
                    onPress={() => setDraftPriority(c.value)}
                    activeOpacity={0.75}
                  >
                    {dot ? (
                      <View
                        style={[
                          styles.priorityDot,
                          { backgroundColor: active ? "#fff" : dot },
                        ]}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.drawerChipText,
                        active && styles.drawerChipTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </DrawerSection>

          <DrawerDivider />

          {/* ── Section: Salesperson ────────────────────── */}
          <DrawerSection icon="account-outline" title="Salesperson">
            <TouchableOpacity
              style={[styles.spBtn, draftSp && styles.spBtnActive]}
              onPress={onOpenSpPicker}
              activeOpacity={0.75}
            >
              <Icon
                name="account-outline"
                size={15}
                color={draftSp ? COLORS.primary : COLORS.textMuted}
              />
              <Text
                style={[styles.spBtnText, draftSp && styles.spBtnTextActive]}
                numberOfLines={1}
              >
                {draftSp ? draftSp.name : "All Salespersons"}
              </Text>
              {draftSp ? (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={onClearSp}
                >
                  <Icon name="close-circle" size={15} color={COLORS.primary} />
                </TouchableOpacity>
              ) : (
                <Icon name="chevron-right" size={15} color={COLORS.textMuted} />
              )}
            </TouchableOpacity>
          </DrawerSection>
        </ScrollView>

        {/* ── Apply button ────────────────────────────── */}
        <View style={styles.drawerFooter}>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={onApply}
            activeOpacity={0.85}
          >
            <Icon name="check-circle-outline" size={18} color={COLORS.white} />
            <Text style={styles.applyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Small helpers ─────────────────────────────────────────────
function DrawerSection({ icon, title, children }) {
  return (
    <View style={styles.drawerSection}>
      <View style={styles.drawerSectionHeader}>
        <Icon name={icon} size={15} color={COLORS.primary} />
        <Text style={styles.drawerSectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function DrawerDivider() {
  return <View style={styles.drawerDivider} />;
}

// ─── InquiryRow ───────────────────────────────────────────────
function InquiryRow({ inquiry, onPress }) {
  const {
    description,
    title,
    mobile,
    status,
    priority,
    createdAt,
    assignedAt,
    assignedTo,
    source,
    visibleUntil,
    inqCode,
  } = inquiry;

  const pc = PRIORITY_COLORS[priority] ?? {
    bg: "#F3F4F6",
    text: COLORS.textMuted,
  };
  const sc = STATUS_COLORS[status] ?? { bg: "#F3F4F6", text: COLORS.textMuted };
  const isUnassigned = status === "unassigned";
  const ageMinutes = dayjs().diff(dayjs(createdAt), "minute");
  const isUrgent = isUnassigned && ageMinutes >= 60;

  const expiryBadge = (() => {
    if (status !== 'assigned' || !visibleUntil) return null;
    const diff = dayjs(visibleUntil).diff(dayjs(), 'minute');
    if (diff <= 0) return { label: 'Expired', expired: true };
    if (diff < 60) return { label: `Expires in ${diff}m`, expired: false };
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return { label: m > 0 ? `Expires in ${h}h ${m}m` : `Expires in ${h}h`, expired: false };
  })();

  const companyName = assignedTo?.company?.name ?? null;
  const initials = assignedTo?.name
    ? assignedTo.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  const dateLabel = dayjs(createdAt).format("DD MMM YYYY · hh:mm A");
  const timeLabel = dayjs(assignedAt ?? createdAt).format("hh:mm A");

  return (
    <TouchableOpacity
      style={[styles.card, isUrgent && styles.cardUrgent]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      <View style={[styles.cardAccent, { backgroundColor: pc.text }]} />

      <View style={styles.cardBody}>
        {/* Row 1: Priority · Status · Date */}
        <View style={styles.cardTopRow}>
          <View style={[styles.priorityPill, { backgroundColor: pc.bg }]}>
            <View style={[styles.priorityDot, { backgroundColor: pc.text }]} />
            <Text style={[styles.priorityPillText, { color: pc.text }]}>
              {priority
                ? priority.charAt(0).toUpperCase() + priority.slice(1)
                : "None"}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusPillText, { color: sc.text }]}>
              {STATUS_LABEL[status] ?? status}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.cardDate}>{dateLabel}</Text>
        </View>

        {/* Row 2: Inq Code */}
        {inqCode ? (
          <View style={styles.inqCodeChip}>
            <Icon name="tag-outline" size={11} color={COLORS.primary} />
            <Text style={styles.inqCodeText}>{inqCode}</Text>
          </View>
        ) : null}

        {/* Row 3: Description */}
        <Text style={styles.cardDesc} numberOfLines={2}>
          {stripHtml(description || title) || "No description provided."}
        </Text>

        {/* Row 3: Meta chips */}
        {mobile || source || isUrgent || expiryBadge ? (
          <View style={styles.metaRow}>
            {/* {mobile ? (
              <View style={styles.metaChip}>
                <Icon name="phone-outline" size={11} color={COLORS.primary} />
                <Text style={styles.metaChipText}>
                {mobile}
                Mobile Number
                </Text>
              </View>
            ) : null} */}
            {source ? (
              <View style={[styles.metaChip, styles.metaChipSource]}>
                <Icon
                  name="map-marker-outline"
                  size={11}
                  color={COLORS.secondary}
                />
                <Text
                  style={[styles.metaChipText, { color: COLORS.secondary }]}
                >
                  {source}
                </Text>
              </View>
            ) : null}
            {isUrgent ? (
              <View style={styles.urgentChip}>
                <Icon name="alert-circle-outline" size={11} color={COLORS.error} />
                <Text style={styles.urgentChipText}>Overdue</Text>
              </View>
            ) : null}
            {expiryBadge ? (
              <View style={[styles.expiryChip, expiryBadge.expired && styles.expiryChipExpired]}>
                <Icon
                  name={expiryBadge.expired ? 'eye-off-outline' : 'clock-alert-outline'}
                  size={11}
                  color={expiryBadge.expired ? COLORS.error : '#D97706'}
                />
                <Text style={[styles.expiryChipText, expiryBadge.expired && styles.expiryChipTextExpired]}>
                  {expiryBadge.label}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.cardDivider} />

        {/* Footer: assignee + time */}
        <View style={styles.cardFooter}>
          {assignedTo ? (
            <View style={styles.footerAssignee}>
              <View style={styles.avatarBubble}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.footerAssigneeInfo}>
                <Text style={styles.assigneeName} numberOfLines={1}>
                  {assignedTo.name}
                </Text>
                {companyName ? (
                  <Text style={styles.assigneeCompany} numberOfLines={1}>
                    {companyName}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.footerAssignee}>
              <View style={styles.avatarBubbleEmpty}>
                <Icon
                  name="account-off-outline"
                  size={14}
                  color={COLORS.textMuted}
                />
              </View>
              <Text style={styles.unassignedLabel}>Unassigned</Text>
            </View>
          )}
          <View style={styles.footerRight}>
            <Icon
              name={assignedAt ? "send-check-outline" : "clock-outline"}
              size={12}
              color={COLORS.textMuted}
            />
            <Text style={styles.timeText}>{timeLabel}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // ── Search row ───────────────────────────────────────────────
  filterLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  filterLoaderInner: {
    backgroundColor: "#fff",
    borderRadius: 50,
    padding: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 44,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    height: 44,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },

  // ── Filter button ────────────────────────────────────────────
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryMid,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  filterBadgeText: {
    color:      "#fff",
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.bold,
    lineHeight: 13,
  },

  // ── List header ──────────────────────────────────────────────
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  countText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  clearFilters: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: "600",
  },

  // ── Loading / empty ──────────────────────────────────────────
  loadingMore: {
    paddingVertical: SPACING.lg,
    alignItems: "center",
  },
  listContent: { paddingTop: SPACING.xs, paddingBottom: SPACING.xxl + 64 },
  emptyContent: { flexGrow: 1 },

  // ── FAB ──────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: SPACING.xl,
    right: SPACING.md,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },

  // ══════════════════════════════════════════════════════════════
  //  Filter Drawer
  // ══════════════════════════════════════════════════════════════
  drawerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  drawerSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.82,
    // shadow on iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  drawerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SPACING.sm,
  },
  drawerTitle: {
    flex:       1,
    fontSize:   FONT_SIZE.lg,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
  },
  drawerResetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryMid,
  },
  drawerResetText: {
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.medium,
    color:      COLORS.primary,
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerScroll: {
    paddingBottom: SPACING.md,
  },

  // ── Drawer section ───────────────────────────────────────────
  drawerSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  drawerSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 2,
  },
  drawerSectionTitle: {
    fontSize:      FONT_SIZE.sm,
    fontFamily:    FONTS.bold,
    color:         COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: SPACING.lg,
  },

  // ── Chip group (wrapping) ─────────────────────────────────────
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  drawerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  drawerChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  drawerChipText: {
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.medium,
    color:      COLORS.textSecondary,
  },
  drawerChipTextActive: {
    color: COLORS.white,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  // ── Salesperson button inside drawer ─────────────────────────
  spBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  spBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  spBtnText: {
    flex:       1,
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.medium,
    color:      COLORS.textMuted,
  },
  spBtnTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
  },

  // ── Apply footer ─────────────────────────────────────────────
  drawerFooter: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    height: 50,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  applyBtnText: {
    fontSize:   FONT_SIZE.md,
    fontFamily: FONTS.bold,
    color:      COLORS.white,
  },

  // ══════════════════════════════════════════════════════════════
  //  Salesperson picker modal (shared)
  // ══════════════════════════════════════════════════════════════
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_H * 0.75,
    paddingTop: 4,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  modalSearch: {
    flexDirection: "row",
    alignItems: "center",
    margin: SPACING.md,
    paddingHorizontal: SPACING.sm,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalSearchInput: {
    flex: 1,
    height: 40,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  modalItemActive: { backgroundColor: COLORS.primaryLight },
  modalAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalAvatarActive: { backgroundColor: COLORS.primary },
  modalAvatarText: {
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.bold,
    color:      COLORS.textSecondary,
  },
  modalItemInfo: { flex: 1 },
  modalItemName: {
    ...TYPOGRAPHY.body,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  modalItemNameActive: { color: COLORS.primary },
  modalItemSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  modalEmpty: {
    paddingVertical: SPACING.xl,
    alignItems: "center",
  },
  modalEmptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
  },

  // ══════════════════════════════════════════════════════════════
  //  Card
  // ══════════════════════════════════════════════════════════════
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    marginHorizontal: SPACING.md,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardUrgent: {
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FFFAFA",
  },
  cardAccent: { height: 3, width: "100%" },
  cardBody: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm + 2,
    paddingBottom: SPACING.sm + 4,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priorityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityPillText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, letterSpacing: 0.2 },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  statusPillText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, letterSpacing: 0.2 },
  cardDate: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    flexShrink: 0,
  },
  inqCodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inqCodeText: {
    fontSize: 9,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  cardDesc: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  metaChipSource: { backgroundColor: COLORS.secondaryLight },
  metaChipText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.medium, color: COLORS.primary },
  urgentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: "#FEE2E2",
  },
  urgentChipText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, color: COLORS.error },
  expiryChip: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius:   BORDER_RADIUS.full,
    backgroundColor: '#FEF3C7',
    borderWidth:    1,
    borderColor:    '#FCD34D',
  },
  expiryChipExpired: {
    backgroundColor: '#FEE2E2',
    borderColor:     COLORS.error + '60',
  },
  expiryChipText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, color: '#D97706' },
  expiryChipTextExpired: { color: COLORS.error },
  cardDivider: { height: 1, backgroundColor: COLORS.divider },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerAssignee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  avatarBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarBubbleEmpty: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, color: COLORS.primary },
  footerAssigneeInfo: { flex: 1 },
  assigneeName: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  assigneeCompany: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  unassignedLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    fontStyle: "italic",
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  timeText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.medium, color: COLORS.textMuted },
});
