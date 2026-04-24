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

import { COLORS, PRIORITY_COLORS } from '@constants/colors';
import { TYPOGRAPHY }              from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW }  from '@constants/config';

import useInquiryStore from '@store/inquiry.store';
import useUserStore    from '@store/user.store';
import Loader          from '@components/common/Loader';
import EmptyState      from '@components/common/EmptyState';
import StatusBadge     from '@components/common/StatusBadge';
import PriorityBadge   from '@components/common/PriorityBadge';

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
    createdAt, assignedTo, source,
  } = inquiry;

  const priorityColor = PRIORITY_COLORS[priority]?.text ?? COLORS.textMuted;
  const isUnassigned  = status === 'unassigned';
  const ageMinutes    = dayjs().diff(dayjs(createdAt), 'minute');
  const isOld         = isUnassigned && ageMinutes >= 60;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.78}>
      {/* Priority strip */}
      <View style={[styles.rowStrip, { backgroundColor: priorityColor }]} />

      <View style={styles.rowBody}>
        {/* Top row */}
        <View style={styles.rowTop}>
          <Text style={styles.rowDesc} numberOfLines={1}>
            {description || title || 'No description'}
          </Text>
          <PriorityBadge priority={priority} size="sm" />
        </View>

        {/* Mobile + source */}
        <View style={styles.rowMeta}>
          {mobile ? (
            <View style={styles.rowMetaItem}>
              <Icon name="phone-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.rowMetaText}>{mobile}</Text>
            </View>
          ) : null}
          {source ? (
            <View style={styles.rowMetaItem}>
              <Icon name="map-marker-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.rowMetaText}>{source}</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom row */}
        <View style={styles.rowBottom}>
          <StatusBadge status={status} size="sm" />

          <View style={styles.rowRight}>
            {assignedTo ? (
              <View style={styles.assignedChip}>
                <Icon name="account-outline" size={10} color={COLORS.textSecondary} />
                <Text style={styles.assignedText} numberOfLines={1}>
                  {assignedTo.name?.split(' ')[0]}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.rowTime, isOld && { color: COLORS.error }]}>
              {/* {dayjs(createdAt).fromNow()} */}
              {dayjs(createdAt).format('DD MMM · hh:mm A')}
            </Text>
          </View>
        </View>
      </View>

      <Icon name="chevron-right" size={18} color={COLORS.border} style={styles.rowChevron} />
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

  // Row
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:    SPACING.sm,
    overflow:        'hidden',
    ...SHADOW.sm,
  },
  rowStrip: { width: 4, alignSelf: 'stretch' },
  rowBody: { flex: 1, padding: SPACING.md, paddingVertical: 20 },

  rowTop: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   4,
    gap:            8,
  },
  rowDesc: {
    ...TYPOGRAPHY.bodyMedium,
    color:  COLORS.textPrimary,
    flex:   1,
    fontWeight: '700',
    
  },
  rowMeta: {
    flexDirection:  'row',
    gap:            12,
    marginBottom:   6,
  },
  rowMetaItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  rowMetaText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  rowBottom: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  assignedChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             3,
    backgroundColor: COLORS.primaryLight,
    borderRadius:    BORDER_RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  assignedText: {
    fontSize:   10,
    color:      COLORS.primary,
    fontWeight: '600',
    maxWidth:   60,
  },
  rowTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  rowChevron: {
    marginRight: SPACING.sm,
  },

  // Footer
  loadingMore: {
    paddingVertical: SPACING.lg,
    alignItems:      'center',
  },
  listContent:  { paddingBottom: SPACING.xxl + 64 },  // extra room for FAB
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
