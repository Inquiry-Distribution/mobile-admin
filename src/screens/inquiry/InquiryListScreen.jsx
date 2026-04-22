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
import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import Icon               from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs              from 'dayjs';

import { COLORS, PRIORITY_COLORS } from '@constants/colors';
import { TYPOGRAPHY }              from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW }  from '@constants/config';

import useInquiryStore from '@store/inquiry.store';
import Loader          from '@components/common/Loader';
import EmptyState      from '@components/common/EmptyState';
import StatusBadge     from '@components/common/StatusBadge';
import PriorityBadge   from '@components/common/PriorityBadge';

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
    isLoading,
    isRefreshing,
    isLoadingMore,
    fetchInquiries,
    refreshInquiries,
    loadMore,
    setFilters,
    clearFilters,
  } = useInquiryStore();

  // Route params: pre-select filters (from Dashboard alert or UserDetail)
  const presetStatus       = route?.params?.filterStatus;
  const presetAssignedToId = route?.params?.filterAssignedToId;
  const didApplyPreset     = useRef(false);

  useEffect(() => {
    if (!didApplyPreset.current) {
      didApplyPreset.current = true;
      const patch = {};
      if (presetStatus)       patch.status       = presetStatus;
      if (presetAssignedToId) patch.assignedToId = presetAssignedToId;
      if (Object.keys(patch).length) setFilters(patch);
    }
    fetchInquiries();
    return () => clearFilters();
  }, []);

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* FAB — Add new inquiry */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateInquiry')}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={26} color={COLORS.white} />
      </TouchableOpacity>

      {/* ── Search bar ───────────────────────────────── */}
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

      {/* ── Status chips ─────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
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
            {(filters.status || filters.priority || filters.search) && (
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
              {dayjs(createdAt).fromNow()}
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
  safe: { backgroundColor: COLORS.background },

  // Search
  searchWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.md,
    margin:          SPACING.md,
    marginBottom:    SPACING.sm,
    paddingHorizontal: SPACING.sm,
    ...SHADOW.sm,
  },
  searchIcon:  { marginRight: 6 },
  searchInput: {
    flex:           1,
    height:         44,
    ...TYPOGRAPHY.body,
    color:          COLORS.textPrimary,
  },

  // Chips
  chips: {
    paddingHorizontal: SPACING.md,
    paddingBottom:     SPACING.sm,
    gap:               SPACING.xs,
    flexDirection:     'row',
    alignItems:        'center',
  },
  chip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius:    BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth:     1,
    borderColor:     COLORS.border,
    marginVertical: SPACING.xs,
    height: 32,
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
