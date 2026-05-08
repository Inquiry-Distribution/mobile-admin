/**
 * ComplaintListScreen — Superuser only
 *
 * Shows all complaints & suggestions submitted by salespersons.
 * Filter by type (complaint / suggestion) and status (pending / reviewed / resolved).
 * Tap a row to open ComplaintDetailScreen.
 */
import React, { useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS }    from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { getInitials } from '@utils/helpers';
import EmptyState from '@components/common/EmptyState';

import useComplaintStore from '@store/complaint.store';

// ── Config ────────────────────────────────────────────────────
const TYPE_CONFIG = {
  complaint:  { label: 'Complaint',  color: '#DC2626', icon: 'alert-circle-outline' },
  suggestion: { label: 'Suggestion', color: '#7C3AED', icon: 'lightbulb-outline'    },
};
const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: '#D97706', icon: 'clock-outline'        },
  reviewed: { label: 'Reviewed', color: '#2563EB', icon: 'eye-check-outline'    },
  resolved: { label: 'Resolved', color: '#059669', icon: 'check-circle-outline' },
};

const TYPE_CHIPS   = [{ label: 'All', value: '' }, { label: 'Complaint', value: 'complaint' }, { label: 'Suggestion', value: 'suggestion' }];
const STATUS_CHIPS = [{ label: 'All', value: '' }, { label: 'Pending', value: 'pending' }, { label: 'Reviewed', value: 'reviewed' }, { label: 'Resolved', value: 'resolved' }];

export default function ComplaintListScreen({ navigation }) {
  const {
    records, total, typeFilter, statusFilter,
    isLoading, isRefreshing, isLoadingMore, hasMore,
    fetchRecords, refreshRecords, loadMore,
    setTypeFilter, setStatusFilter,
    selectById,
  } = useComplaintStore();

  useEffect(() => { fetchRecords(); }, []);

  const pendingCount = records.filter((r) => r.status === 'pending').length;

  const handlePress = async (item) => {
    await selectById(item.id);
    navigation.navigate('ComplaintDetail');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Pending alert banner ── */}
      {pendingCount > 0 && (
        <View style={styles.alertBanner}>
          <Icon name="bell-ring-outline" size={14} color="#92400E" />
          <Text style={styles.alertText}>
            {pendingCount} pending submission{pendingCount > 1 ? 's' : ''} need your attention
          </Text>
        </View>
      )}

      {/* ── Type filter ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipContent}>
        {TYPE_CHIPS.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[styles.chip, typeFilter === c.value && styles.chipActive]}
            onPress={() => setTypeFilter(c.value)}
          >
            <Text style={[styles.chipText, typeFilter === c.value && styles.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.chipDivider} />
        {STATUS_CHIPS.map((c) => {
          const cfg = STATUS_CONFIG[c.value];
          return (
            <TouchableOpacity
              key={'s' + c.value}
              style={[styles.chip, statusFilter === c.value && styles.chipActive, cfg && { borderColor: cfg.color }]}
              onPress={() => setStatusFilter(c.value)}
            >
              {cfg && <View style={[styles.chipDot, { backgroundColor: cfg.color }]} />}
              <Text style={[styles.chipText, statusFilter === c.value && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ── */}
      <FlatList
        data={records}
        keyExtractor={(r) => r.id}
        contentContainerStyle={records.length === 0 ? styles.emptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshRecords} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          !isLoading && total > 0 ? (
            <Text style={styles.totalLabel}>{total} submission{total !== 1 ? 's' : ''}</Text>
          ) : null
        }
        ListFooterComponent={
          isLoadingMore
            ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
            : null
        }
        renderItem={({ item }) => (
          <ComplaintRow item={item} onPress={() => handlePress(item)} />
        )}
        ListEmptyComponent={
          isLoading
            ? <View style={styles.loadCenter}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            : <EmptyState icon="message-alert-outline" title="No submissions" message="No complaints or suggestions yet." />
        }
      />
    </SafeAreaView>
  );
}

// ── Row card ──────────────────────────────────────────────────
function ComplaintRow({ item, onPress }) {
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const type   = TYPE_CONFIG[item.type]     ?? TYPE_CONFIG.complaint;
  const name   = item.submittedBy?.name ?? 'Unknown';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.78}>
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: type.color + '18' }]}>
        <Text style={[styles.avatarText, { color: type.color }]}>{getInitials(name)}</Text>
      </View>

      {/* Content */}
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.typeRow}>
          <Icon name={type.icon} size={12} color={type.color} />
          <Text style={[styles.typeLabel, { color: type.color }]}>{type.label}</Text>
        </View>

        <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
        <Text style={styles.preview} numberOfLines={1}>{item.message}</Text>

        <Text style={styles.date}>{dayjs(item.createdAt).format('DD MMM YYYY, hh:mm A')}</Text>
      </View>

      <Icon name="chevron-right" size={16} color={COLORS.border} />
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  alertText: { ...TYPOGRAPHY.small, color: '#92400E', fontFamily: FONTS.medium, flex: 1 },

  chipRow:     { flexGrow: 0, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  chipContent: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.xs, flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { ...TYPOGRAPHY.small, color: COLORS.textSecondary, fontFamily: FONTS.medium },
  chipTextActive: { color: COLORS.white },
  chipDot:        { width: 7, height: 7, borderRadius: 3.5 },
  chipDivider:    { width: 1, height: 20, backgroundColor: COLORS.divider, marginHorizontal: 4 },

  listContent:  { padding: SPACING.md, paddingBottom: SPACING.xxl },
  emptyContent: { flexGrow: 1 },
  loadCenter:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  totalLabel:   { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontFamily: FONTS.medium, marginBottom: SPACING.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOW.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: FONT_SIZE.md, fontFamily: FONTS.bold },

  rowContent:  { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  rowName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontFamily: FONTS.medium, flex: 1 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold },

  typeRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  typeLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold },

  subject: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontFamily: FONTS.medium, marginBottom: 2 },
  preview: { ...TYPOGRAPHY.small, color: COLORS.textSecondary, marginBottom: 3 },
  date:    { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
});
