/**
 * TrashScreen — Superuser only
 *
 * Lists soft-deleted inquiries with two actions per item:
 *  • Restore   — moves inquiry back to active list
 *  • Delete    — permanently removes from database (irreversible)
 */
import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS, PRIORITY_COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { stripHtml }               from '@utils/helpers';

import useInquiryStore from '@store/inquiry.store';
import Loader          from '@components/common/Loader';
import EmptyState      from '@components/common/EmptyState';

export default function TrashScreen() {
  const {
    trash,
    trashTotal,
    trashHasMore,
    isTrashLoading,
    isTrashRefreshing,
    isTrashLoadingMore,
    fetchTrash,
    refreshTrash,
    loadMoreTrash,
    restoreInquiry,
    permanentDelete,
  } = useInquiryStore();

  useEffect(() => { fetchTrash(); }, []);

  // ── Restore ──────────────────────────────────────────────────
  const handleRestore = useCallback((item) => {
    Alert.alert(
      'Restore Inquiry',
      'Move this inquiry back to the active list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            const result = await restoreInquiry(item.id);
            if (!result.success) {
              Alert.alert('Error', result.message ?? 'Failed to restore.');
            }
          },
        },
      ],
    );
  }, [restoreInquiry]);

  // ── Permanent delete ──────────────────────────────────────────
  const handlePermanentDelete = useCallback((item) => {
    Alert.alert(
      'Permanently Delete',
      'This will erase the inquiry forever and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            const result = await permanentDelete(item.id);
            if (!result.success) {
              Alert.alert('Error', result.message ?? 'Failed to delete.');
            }
          },
        },
      ],
    );
  }, [permanentDelete]);

  // ── Row ───────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }) => {
    const priorityColor = PRIORITY_COLORS[item.priority]?.text ?? COLORS.textMuted;
    const desc = stripHtml(item.description || item.title) || 'No description';

    return (
      <View style={styles.card}>
        {/* Left accent bar coloured by priority */}
        <View style={[styles.accent, { backgroundColor: priorityColor }]} />

        <View style={styles.cardBody}>
          {/* Top row */}
          <View style={styles.cardTop}>
            <View style={[styles.priorityTag, { backgroundColor: priorityColor + '18' }]}>
              <Text style={[styles.priorityText, { color: priorityColor }]}>
                {item.priority?.toUpperCase() ?? '—'}
              </Text>
            </View>
            <Text style={styles.deletedDate}>
              Deleted {dayjs(item.deletedAt).format('DD MMM, hh:mm A')}
            </Text>
          </View>

          {/* Description */}
          <Text style={styles.desc} numberOfLines={2}>{desc}</Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            {!!item.mobile && (
              <View style={styles.metaItem}>
                <Icon name="phone-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{item.mobile}</Text>
              </View>
            )}
            {!!item.source && (
              <View style={styles.metaItem}>
                <Icon name="source-branch" size={12} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{item.source}</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={() => handleRestore(item)}
              activeOpacity={0.8}
            >
              <Icon name="restore" size={15} color={COLORS.secondary} />
              <Text style={styles.restoreText}>Restore</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handlePermanentDelete(item)}
              activeOpacity={0.8}
            >
              <Icon name="delete-forever-outline" size={15} color={COLORS.error} />
              <Text style={styles.deleteText}>Delete Forever</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [handleRestore, handlePermanentDelete]);

  // ── Footer spinner for load-more ──────────────────────────────
  const ListFooter = () =>
    isTrashLoadingMore
      ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 16 }} />
      : null;

  if (isTrashLoading && trash.length === 0) return <Loader message="Loading trash…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Total count pill */}
      {trashTotal > 0 && (
        <View style={styles.countBar}>
          <Icon name="trash-can-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.countText}>
            {trashTotal} {trashTotal === 1 ? 'item' : 'items'} in trash
          </Text>
        </View>
      )}

      <FlatList
        data={trash}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          trash.length === 0 && styles.listEmpty,
        ]}
        onRefresh={refreshTrash}
        refreshing={isTrashRefreshing}
        onEndReached={() => { if (!isTrashLoadingMore) loadMoreTrash(); }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={
          <EmptyState
            icon="trash-can-outline"
            title="Trash is empty"
            subtitle="Deleted inquiries will appear here"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.background,
  },

  countBar: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  countText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },

  list: {
    padding: SPACING.md,
    gap:     SPACING.sm,
  },
  listEmpty: {
    flex:           1,
    justifyContent: 'center',
  },

  // ── Card ─────────────────────────────────────────────────────
  card: {
    flexDirection:   'row',
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.md,
    marginBottom:    SPACING.sm,
    overflow:        'hidden',
    ...SHADOW.sm,
  },
  accent: {
    width:        4,
    alignSelf:    'stretch',
  },
  cardBody: {
    flex:    1,
    padding: SPACING.md,
    gap:     SPACING.xs,
  },

  cardTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   2,
  },
  priorityTag: {
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      BORDER_RADIUS.full,
  },
  priorityText: {
    ...TYPOGRAPHY.caption,
    fontFamily: FONTS.bold,
    fontSize:   FONT_SIZE.xs,
  },
  deletedDate: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },

  desc: {
    ...TYPOGRAPHY.body2,
    color:      COLORS.textPrimary,
    lineHeight: 20,
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACING.sm,
    marginTop:     2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  metaText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },

  // ── Action buttons ───────────────────────────────────────────
  actions: {
    flexDirection:  'row',
    gap:            SPACING.sm,
    marginTop:      SPACING.sm,
    paddingTop:     SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  restoreBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: 8,
    borderRadius:    BORDER_RADIUS.sm,
    backgroundColor: COLORS.secondaryLight,
  },
  restoreText: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.secondary,
    fontFamily: FONTS.bold,
  },
  deleteBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: 8,
    borderRadius:    BORDER_RADIUS.sm,
    backgroundColor: '#FEE2E2',
  },
  deleteText: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.error,
    fontFamily: FONTS.bold,
  },
});
