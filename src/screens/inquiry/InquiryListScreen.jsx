/**
 * InquiryListScreen — Admin & Superuser
 *
 * Features:
 *  • Server-side pagination with infinite scroll
 *  • Horizontal status filter chips (All / Unassigned / Assigned / …)
 *  • Priority filter + search (server params)
 *  • Pull-to-refresh
 *  • Badge showing total count
 *  • Tap row → InquiryDetail
 */
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import Icon               from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs              from 'dayjs';

import { COLORS, PRIORITY_COLORS, STATUS_COLORS } from '@constants/colors';
import { STATUS_LABEL } from '@utils/helpers';
import { TYPOGRAPHY }              from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW }  from '@constants/config';

import useInquiryStore from '@store/inquiry.store';
import useUserStore    from '@store/user.store';
import Loader          from '@components/common/Loader';
import EmptyState      from '@components/common/EmptyState';

// ─── Date period chips ────────────────────────────────────────
const DATE_PERIODS = [
  { key: 'today', label: 'Today',      icon: 'calendar-today' },
  { key: 'week',  label: 'This Week',  icon: 'calendar-week' },
  { key: 'month', label: 'This Month', icon: 'calendar-month' },
  { key: 'all',   label: 'All Time',   icon: 'calendar-blank-multiple' },
];

// ─── Filter config ────────────────────────────────────────────
const STATUS_CHIPS = [
  { label: 'All',         value: '' },
  { label: 'Unassigned',  value: 'unassigned' },
  { label: 'Assigned',    value: 'assigned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Follow Up',   value: 'follow_up' },
  { label: 'Closed',      value: 'closed' },
];

const PRIORITY_CHIPS = [
  { label: 'All',    value: '' },
  { label: 'High',   value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low',    value: 'low' },
];

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

  const [userPickerVisible, setUserPickerVisible] = useState(false);
  const [userSearch,        setUserSearch]        = useState('');

  const selectedSp = salespersons.find((sp) => sp.id === filters.assignedToId) ?? null;

  const filteredSp = salespersons.filter((sp) =>
    !userSearch || sp.name?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleSelectUser = (sp) => {
    setFilters({ assignedToId: sp ? sp.id : '' });
    setUserPickerVisible(false);
    setUserSearch('');
    fetchInquiries();
  };

  // Route params: pre-select filters (from Dashboard alert or UserDetail)
  const presetStatus       = route?.params?.filterStatus;
  const presetAssignedToId = route?.params?.filterAssignedToId;

  useEffect(() => {
    const patch = {};
    if (presetStatus)       patch.status       = presetStatus;
    if (presetAssignedToId) patch.assignedToId = presetAssignedToId;
    if (Object.keys(patch).length) setFilters(patch);
    fetchInquiries();
    fetchSalespersons();
    return () => clearFilters();
  }, [presetAssignedToId, presetStatus]);

  // Re-fetch whenever filters change
  const onChipPress = (key, value) => {
    setFilters({ [key]: value });
    fetchInquiries();
  };

  const onSearchSubmit = () => fetchInquiries();

  const handleEndReached = () => {
    if (!isLoadingMore) loadMore();
  };

  if (isLoading && inquiries.length === 0) return <Loader />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* FAB — Add new inquiry */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateInquiry')}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={26} color={COLORS.white} />
      </TouchableOpacity>

      {/* ── Filter panel ─────────────────────────────── */}
      <View style={styles.filterPanel}>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Icon name="magnify" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search description, mobile, source…"
            placeholderTextColor={COLORS.textMuted}
            value={filters.search}
            onChangeText={(v) => setFilters({ search: v })}
            returnKeyType="search"
            onSubmitEditing={onSearchSubmit}
          />
          {filters.search.length > 0 && (
            <TouchableOpacity
              onPress={() => { setFilters({ search: '' }); fetchInquiries(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Date period chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.periodScroll}
          contentContainerStyle={styles.periodRow}
        >
          {DATE_PERIODS.map((p) => {
            const isActive = activePeriod === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodChip, isActive && styles.periodChipActive]}
                onPress={() => setPeriod(p.key)}
                activeOpacity={0.75}
              >
                {isActive && isLoading ? (
                  <ActivityIndicator size={10} color={COLORS.white} style={{ marginRight: 4 }} />
                ) : (
                  <Icon
                    name={p.icon}
                    size={12}
                    color={isActive ? COLORS.white : COLORS.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text style={[styles.periodChipText, isActive && styles.periodChipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* User (salesperson) select */}
        <View style={styles.userSelectWrap}>
          <TouchableOpacity
            style={[styles.userSelectBtn, selectedSp && styles.userSelectBtnActive]}
            onPress={() => setUserPickerVisible(true)}
            activeOpacity={0.75}
          >
            <Icon
              name="account-outline"
              size={15}
              color={selectedSp ? COLORS.primary : COLORS.textMuted}
            />
            <Text
              style={[styles.userSelectText, selectedSp && styles.userSelectTextActive]}
              numberOfLines={1}
            >
              {selectedSp ? selectedSp.name : 'All Salespersons'}
            </Text>
            {selectedSp ? (
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleSelectUser(null)}
              >
                <Icon name="close-circle" size={15} color={COLORS.primary} />
              </TouchableOpacity>
            ) : (
              <Icon name="chevron-down" size={15} color={COLORS.textMuted} />
            )}
          </TouchableOpacity>
        </View>

        {/* Status + priority chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          {STATUS_CHIPS.map((c) => (
            <TouchableOpacity
              key={c.value}
              style={[styles.chip, filters.status === c.value && styles.chipActive]}
              onPress={() => onChipPress('status', c.value)}
            >
              <Text style={[styles.chipText, filters.status === c.value && styles.chipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Divider */}
          <View style={styles.chipDivider} />

          {/* Priority chips */}
          {PRIORITY_CHIPS.map((c) => (
            <TouchableOpacity
              key={`p-${c.value}`}
              style={[
                styles.chip,
                filters.priority === c.value && c.value !== '' && styles.chipActive,
                filters.priority === '' && c.value === '' && styles.chipActive,
              ]}
              onPress={() => onChipPress('priority', c.value)}
            >
              {c.value ? (
                <View
                  style={[
                    styles.priorityDot,
                    { backgroundColor: PRIORITY_COLORS[c.value]?.text ?? COLORS.textMuted },
                  ]}
                />
              ) : null}
              <Text style={[
                styles.chipText,
                (filters.priority === c.value || (filters.priority === '' && c.value === '')) &&
                  styles.chipTextActive,
              ]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

      </View>{/* end filterPanel */}

      {/* ── User picker modal ────────────────────────── */}
      <Modal
        visible={userPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUserPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { setUserPickerVisible(false); setUserSearch(''); }}
        />
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter by Salesperson</Text>
            <TouchableOpacity onPress={() => { setUserPickerVisible(false); setUserSearch(''); }}>
              <Icon name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.modalSearch}>
            <Icon name="magnify" size={18} color={COLORS.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search salesperson…"
              placeholderTextColor={COLORS.textMuted}
              value={userSearch}
              onChangeText={setUserSearch}
              autoFocus
            />
            {userSearch.length > 0 && (
              <TouchableOpacity onPress={() => setUserSearch('')}>
                <Icon name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* All option */}
          <TouchableOpacity
            style={[styles.modalItem, !filters.assignedToId && styles.modalItemActive]}
            onPress={() => handleSelectUser(null)}
          >
            <View style={styles.modalAvatar}>
              <Icon name="account-group-outline" size={14} color={COLORS.textSecondary} />
            </View>
            <View style={styles.modalItemInfo}>
              <Text style={[styles.modalItemName, !filters.assignedToId && styles.modalItemNameActive]}>
                All Salespersons
              </Text>
            </View>
            {!filters.assignedToId && (
              <Icon name="check-circle" size={18} color={COLORS.primary} />
            )}
          </TouchableOpacity>

          <View style={styles.modalDivider} />

          {/* List */}
          <FlatList
            data={filteredSp}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isActive  = filters.assignedToId === item.id;
              const initials  = item.name
                ? item.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                : '?';
              return (
                <TouchableOpacity
                  style={[styles.modalItem, isActive && styles.modalItemActive]}
                  onPress={() => handleSelectUser(item)}
                >
                  <View style={[styles.modalAvatar, isActive && styles.modalAvatarActive]}>
                    <Text style={[styles.modalAvatarText, isActive && { color: COLORS.white }]}>
                      {initials}
                    </Text>
                  </View>
                  <View style={styles.modalItemInfo}>
                    <Text style={[styles.modalItemName, isActive && styles.modalItemNameActive]}>
                      {item.name}
                    </Text>
                    {item.email ? (
                      <Text style={styles.modalItemSub} numberOfLines={1}>{item.email}</Text>
                    ) : null}
                  </View>
                  {isActive && (
                    <Icon name="check-circle" size={18} color={COLORS.primary} />
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

      {/* ── List ─────────────────────────────────────── */}
      <FlatList
        data={inquiries}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <InquiryRow
            inquiry={item}
            onPress={() => navigation.navigate('InquiryDetail', { id: item.id })}
          />
        )}
        refreshing={isRefreshing}
        onRefresh={refreshInquiries}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.countText}>
              {total > 0 ? `${total} inquir${total === 1 ? 'y' : 'ies'}` : `${inquiries.length} result${inquiries.length !== 1 ? 's' : ''}`}
            </Text>
            {(filters.status || filters.priority || filters.search || filters.assignedToId || activePeriod !== 'all') && (
              <TouchableOpacity onPress={() => { clearFilters(); fetchInquiries(); }}>
                <Text style={styles.clearFilters}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="clipboard-text-off-outline"
              title="No inquiries found"
              message={
                filters.search || filters.status || filters.priority
                  ? 'Try adjusting your filters.'
                  : 'Pull down to refresh.'
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
        contentContainerStyle={inquiries.length === 0 ? styles.emptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─── Row component ────────────────────────────────────────────
function InquiryRow({ inquiry, onPress }) {
  const {
    description, title, mobile, status, priority,
    createdAt, assignedAt, assignedTo, source,
  } = inquiry;

  const pc          = PRIORITY_COLORS[priority] ?? { bg: '#F3F4F6', text: COLORS.textMuted };
  const sc          = STATUS_COLORS[status]     ?? { bg: '#F3F4F6', text: COLORS.textMuted };
  const isUnassigned = status === 'unassigned';
  const ageMinutes  = dayjs().diff(dayjs(createdAt), 'minute');
  const isUrgent    = isUnassigned && ageMinutes >= 60;

  const companyName = assignedTo?.company?.name ?? null;
  const initials    = assignedTo?.name
    ? assignedTo.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : null;

  const dateLabel = dayjs(createdAt).format('DD MMM');
  const timeLabel = dayjs(assignedAt ?? createdAt).format('hh:mm A');

  return (
    <TouchableOpacity
      style={[styles.card, isUrgent && styles.cardUrgent]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      {/* ── Top priority accent bar ── */}
      <View style={[styles.cardAccent, { backgroundColor: pc.text }]} />

      <View style={styles.cardBody}>

        {/* ── Row 1: Priority · Status · Date ── */}
        <View style={styles.cardTopRow}>
          <View style={[styles.priorityPill, { backgroundColor: pc.bg }]}>
            <View style={[styles.priorityDot, { backgroundColor: pc.text }]} />
            <Text style={[styles.priorityPillText, { color: pc.text }]}>
              {priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'None'}
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

        {/* ── Row 2: Description ── */}
        <Text style={styles.cardDesc} numberOfLines={2}>
          {description || title || 'No description provided.'}
        </Text>

        {/* ── Row 3: Meta chips ── */}
        {(mobile || source) ? (
          <View style={styles.metaRow}>
            {mobile ? (
              <View style={styles.metaChip}>
                <Icon name="phone-outline" size={11} color={COLORS.primary} />
                <Text style={styles.metaChipText}>{mobile}</Text>
              </View>
            ) : null}
            {source ? (
              <View style={[styles.metaChip, styles.metaChipSource]}>
                <Icon name="map-marker-outline" size={11} color={COLORS.secondary} />
                <Text style={[styles.metaChipText, { color: COLORS.secondary }]}>{source}</Text>
              </View>
            ) : null}
            {isUrgent ? (
              <View style={styles.urgentChip}>
                <Icon name="alert-circle-outline" size={11} color={COLORS.error} />
                <Text style={styles.urgentChipText}>Overdue</Text>
              </View>
            ) : null}
          </View>
        ) : isUrgent ? (
          <View style={styles.metaRow}>
            <View style={styles.urgentChip}>
              <Icon name="alert-circle-outline" size={11} color={COLORS.error} />
              <Text style={styles.urgentChipText}>Overdue</Text>
            </View>
          </View>
        ) : null}

        {/* ── Divider ── */}
        <View style={styles.cardDivider} />

        {/* ── Footer: assignee + time ── */}
        <View style={styles.cardFooter}>
          {assignedTo ? (
            <View style={styles.footerAssignee}>
              <View style={styles.avatarBubble}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.footerAssigneeInfo}>
                <Text style={styles.assigneeName} numberOfLines={1}>{assignedTo.name}</Text>
                {companyName ? (
                  <Text style={styles.assigneeCompany} numberOfLines={1}>{companyName}</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.footerAssignee}>
              <View style={styles.avatarBubbleEmpty}>
                <Icon name="account-off-outline" size={14} color={COLORS.textMuted} />
              </View>
              <Text style={styles.unassignedLabel}>Unassigned</Text>
            </View>
          )}

          <View style={styles.footerRight}>
            <Icon
              name={assignedAt ? 'send-check-outline' : 'clock-outline'}
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

  // Filter panel — unified surface container for all filters
  filterPanel: {
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingBottom:     SPACING.xs,
  },

  // Search
  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.background,
    borderRadius:      BORDER_RADIUS.md,
    margin:            SPACING.md,
    marginBottom:      SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  searchIcon:  { marginRight: 6 },
  searchInput: {
    flex:           1,
    height:         44,
    ...TYPOGRAPHY.body,
    color:          COLORS.textPrimary,
  },

  // Period chips
  periodScroll: { flexShrink: 0, flexGrow: 0 },
  periodRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    gap:               SPACING.xs,
  },
  periodChip: {
    flexDirection:   'row',
    alignItems:      'center',
    alignSelf:       'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius:    BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth:     1,
    borderColor:     COLORS.border,
    height:          30,
  },
  periodChipActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  periodChipText: {
    fontSize:   11,
    color:      COLORS.textSecondary,
    fontWeight: '600',
  },
  periodChipTextActive: { color: COLORS.white },

  // User select button
  userSelectWrap: {
    paddingHorizontal: SPACING.md,
    paddingBottom:     SPACING.sm,
  },
  userSelectBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    height:            40,
    paddingHorizontal: SPACING.md,
    borderRadius:      BORDER_RADIUS.md,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  userSelectBtnActive: {
    borderColor:     COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  userSelectText: {
    flex:       1,
    fontSize:   13,
    fontWeight: '500',
    color:      COLORS.textMuted,
  },
  userSelectTextActive: {
    color:      COLORS.primary,
    fontWeight: '600',
  },

  // User picker modal
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor:  COLORS.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    maxHeight:        Dimensions.get('window').height * 0.75,
    paddingTop:       4,
  },
  modalHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '700',
    color:      COLORS.textPrimary,
  },
  modalSearch: {
    flexDirection:     'row',
    alignItems:        'center',
    margin:            SPACING.md,
    paddingHorizontal: SPACING.sm,
    height:            40,
    borderRadius:      BORDER_RADIUS.md,
    backgroundColor:   COLORS.background,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  modalSearchInput: {
    flex:   1,
    height: 40,
    ...TYPOGRAPHY.body,
    color:  COLORS.textPrimary,
  },
  modalItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
  },
  modalItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  modalAvatar: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: COLORS.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  modalAvatarActive: {
    backgroundColor: COLORS.primary,
  },
  modalAvatarText: {
    fontSize:   13,
    fontWeight: '700',
    color:      COLORS.textSecondary,
  },
  modalItemInfo: { flex: 1 },
  modalItemName: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color:      COLORS.textPrimary,
  },
  modalItemNameActive: { color: COLORS.primary },
  modalItemSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  modalDivider: {
    height:          1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
    marginBottom:    SPACING.xs,
  },
  modalEmpty: {
    paddingVertical:   SPACING.xl,
    alignItems:        'center',
  },
  modalEmptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
  },

  // Status / priority chips
  chipsScroll: { flexShrink: 0, flexGrow: 0 },
  chips: {
    paddingHorizontal: SPACING.md,
    paddingBottom:     SPACING.sm,
    gap:               SPACING.xs,
    flexDirection:     'row',
    alignItems:        'center',
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'center',
    gap:               4,
    paddingHorizontal: SPACING.md,
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
    height:            32,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  chipText: {
    ...TYPOGRAPHY.small,
    color:      COLORS.textSecondary,
    fontWeight: '600',
  },
  chipTextActive:  { color: COLORS.white },
  chipDivider: {
    width: 1, height: 24,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  priorityDot: {
    width: 7, height: 7, borderRadius: 3.5,
  },

  // List header
  listHeader: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    marginBottom:      SPACING.xs,
  },
  countText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  clearFilters: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.primary,
    fontWeight: '600',
  },

  // ── Card ───────────────────────────────────────────────────
  card: {
    backgroundColor:  COLORS.surface,
    borderRadius:     18,
    marginHorizontal: SPACING.md,
    marginBottom:     12,
    overflow:         'hidden',
    shadowColor:      '#4C1D95',
    shadowOffset:     { width: 0, height: 3 },
    shadowOpacity:    0.08,
    shadowRadius:     8,
    elevation:        3,
  },
  cardUrgent: {
    borderWidth:     1,
    borderColor:     '#FCA5A5',
    backgroundColor: '#FFFAFA',
  },
  cardAccent: {
    height: 3,
    width:  '100%',
  },
  cardBody: {
    paddingHorizontal: SPACING.md,
    paddingTop:        SPACING.sm + 2,
    paddingBottom:     SPACING.sm + 4,
    gap:               10,
  },

  // Top row: priority · status · spacer · date
  cardTopRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  priorityPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      BORDER_RADIUS.full,
  },
  priorityDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  priorityPillText: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.2,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      BORDER_RADIUS.full,
  },
  statusPillText: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.2,
  },
  cardDate: {
    fontSize:   11,
    fontWeight: '500',
    color:      COLORS.textMuted,
    flexShrink: 0,
  },

  // Description
  cardDesc: {
    fontSize:      14,
    fontWeight:    '600',
    color:         COLORS.textPrimary,
    lineHeight:    21,
    letterSpacing: 0.1,
  },

  // Meta chips
  metaRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
  },
  metaChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   COLORS.primaryLight,
  },
  metaChipSource: {
    backgroundColor: COLORS.secondaryLight,
  },
  metaChipText: {
    fontSize:   11,
    fontWeight: '600',
    color:      COLORS.primary,
  },
  urgentChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   '#FEE2E2',
  },
  urgentChipText: {
    fontSize:   11,
    fontWeight: '700',
    color:      COLORS.error,
  },

  // Divider
  cardDivider: {
    height:          1,
    backgroundColor: COLORS.divider,
  },

  // Footer
  cardFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  footerAssignee: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flex:          1,
    marginRight:   8,
  },
  avatarBubble: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  avatarBubbleEmpty: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: COLORS.background,
    borderWidth:     1,
    borderColor:     COLORS.border,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  avatarText: {
    fontSize:   11,
    fontWeight: '800',
    color:      COLORS.primary,
  },
  footerAssigneeInfo: { flex: 1 },
  assigneeName: {
    fontSize:   12,
    fontWeight: '700',
    color:      COLORS.textPrimary,
  },
  assigneeCompany: {
    fontSize:  10,
    fontWeight:'500',
    color:     COLORS.textMuted,
    marginTop: 1,
  },
  unassignedLabel: {
    fontSize:  12,
    color:     COLORS.textMuted,
    fontStyle: 'italic',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    flexShrink:    0,
  },
  timeText: {
    fontSize:   11,
    fontWeight: '600',
    color:      COLORS.textMuted,
  },

  // Footer
  loadingMore: {
    paddingVertical: SPACING.lg,
    alignItems:      'center',
  },
  listContent:  { paddingTop: SPACING.xs, paddingBottom: SPACING.xxl + 64 },  // extra room for FAB
  emptyContent: { flexGrow: 1 },

  // FAB
  fab: {
    position:        'absolute',
    bottom:          SPACING.xl,
    right:           SPACING.md,
    width:           54,
    height:          54,
    borderRadius:    27,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          10,
    shadowColor:     COLORS.primary,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    8,
    elevation:       8,
  },
});
