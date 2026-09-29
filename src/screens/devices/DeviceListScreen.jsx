/**
 * DeviceListScreen — view, block, unblock and reset registered devices
 *
 * Features:
 *  • Filter chips: All / Active / Blocked
 *  • Search by salesperson name or device ID
 *  • Inline block / unblock with reason prompt
 *  • Reset device (clears salesperson binding)
 *  • Infinite scroll via device.store
 *  • Socket real-time updates via device.store.updateDeviceInList
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
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS, DEVICE_STATUS_COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, FONTS }  from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { formatDateTime } from '@utils/helpers';
import { showErrorToast, showSuccessToast } from '@utils/errorHandler';
import { requireOnline } from '@utils/offline';

import useDeviceStore from '@store/device.store';
import EmptyState     from '@components/common/EmptyState';
import ErrorState     from '@components/common/ErrorState';
import { ListSkeleton } from '@components/common/Skeleton';

// ── Filter config ─────────────────────────────────────────────
const STATUS_CHIPS = [
  { label: 'All',     value: '' },
  { label: 'Active',  value: 'false' },
  { label: 'Blocked', value: 'true' },
];

export default function DeviceListScreen({ navigation }) {
  const {
    devices,
    total,
    search,
    blockedFilter,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    fetchDevices,
    refreshDevices,
    loadMore,
    setSearch,
    setBlockedFilter,
    clearFilters,
    block,
    unblock,
    resetBySalesperson,
    isMutating,
  } = useDeviceStore();

  const [blockTarget, setBlockTarget] = useState(null);
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    fetchDevices();
    return () => clearFilters();
  }, []);

  const onChipPress = (value) => {
    // value is '' | 'true' | 'false' — map to boolean or null for store
    const mapped = value === '' ? null : value === 'true';
    setBlockedFilter(mapped);
    fetchDevices();
  };

  const handleEndReached = () => {
    if (!isLoadingMore) loadMore();
  };

  const confirmBlock = async () => {
    if (!blockTarget) return;
    if (!requireOnline('Connect to block a device.')) return;
    const result = await block(blockTarget.id, blockReason.trim() || undefined);
    setBlockTarget(null);
    setBlockReason('');
    if (!result.success) {
      showErrorToast(result.message ?? 'Failed to block device.');
    } else {
      showSuccessToast('Device blocked');
    }
  };

  // ── Block (iOS prompt / Android modal with reason) ─────────
  const handleBlock = (device) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Block Device',
        `Enter a reason for blocking ${device.salesperson?.name ?? device.deviceId}'s device:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async (reason) => {
              if (!requireOnline('Connect to block a device.')) return;
              const result = await block(device.id, reason?.trim() || undefined);
              if (!result.success) {
                showErrorToast(result.message ?? 'Failed to block device.');
              } else {
                showSuccessToast('Device blocked');
              }
            },
          },
        ],
        'plain-text',
      );
    } else {
      setBlockReason('');
      setBlockTarget(device);
    }
  };

  const handleUnblock = (device) => {
    Alert.alert(
      'Unblock Device',
      `Unblock ${device.salesperson?.name ?? 'this device'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            if (!requireOnline('Connect to unblock a device.')) return;
            const result = await unblock(device.id);
            if (!result.success) {
              showErrorToast(result.message ?? 'Failed to unblock device.');
            } else {
              showSuccessToast('Device unblocked');
            }
          },
        },
      ],
    );
  };

  const handleReset = (device) => {
    Alert.alert(
      'Reset Device',
      `This will unlink the device from ${device.salesperson?.name ?? 'this salesperson'}. They will need to register again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (!requireOnline('Connect to reset a device.')) return;
            const result = await resetBySalesperson(device.salespersonId);
            if (!result.success) {
              showErrorToast(result.message ?? 'Failed to reset device.');
            } else {
              showSuccessToast('Device reset');
            }
          },
        },
      ],
    );
  };

  if (isLoading && devices.length === 0 && !error) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ListSkeleton count={5} />
      </SafeAreaView>
    );
  }

  if (error && devices.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ErrorState
          title="Could not load devices"
          message={error}
          onAction={() => fetchDevices()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Filter panel ─────────────────────────────────── */}
      <View style={styles.filterPanel}>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Icon name="magnify" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search salesperson, device ID…"
            placeholderTextColor={COLORS.textMuted}
            value={search ?? ''}
            onChangeText={(v) => setSearch(v)}
            returnKeyType="search"
            onSubmitEditing={fetchDevices}
          />
          {(search ?? '').length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearch(''); fetchDevices(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Status chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          {STATUS_CHIPS.map((c) => {
            const chipBool = c.value === '' ? null : c.value === 'true';
            const isActive = blockedFilter === chipBool;
            return (
              <TouchableOpacity
                key={c.value}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => onChipPress(c.value)}
              >
                {c.value === 'true' && (
                  <Icon name="cellphone-lock" size={12}
                    color={isActive ? COLORS.white : COLORS.error} />
                )}
                {c.value === 'false' && (
                  <Icon name="cellphone-check" size={12}
                    color={isActive ? COLORS.white : COLORS.success} />
                )}
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

      </View>{/* end filterPanel */}

      {/* ── List ──────────────────────────────────────────── */}
      <FlatList
        data={devices}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <DeviceRow
            device={item}
            isMutating={isMutating}
            onBlock={() => handleBlock(item)}
            onUnblock={() => handleUnblock(item)}
            onReset={() => handleReset(item)}
          />
        )}
        refreshing={isRefreshing}
        onRefresh={refreshDevices}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.countText}>
              {total > 0
                ? `${total} device${total !== 1 ? 's' : ''}`
                : `${devices.length} result${devices.length !== 1 ? 's' : ''}`}
            </Text>
            {(blockedFilter !== null || search) && (
              <TouchableOpacity onPress={() => { clearFilters(); fetchDevices(); }}>
                <Text style={styles.clearFilters}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="cellphone-off"
              title="No devices found"
              message={
                search || blockedFilter !== null
                  ? 'Try adjusting your filters.'
                  : 'No devices registered yet.'
              }
              actionLabel={search || blockedFilter !== null ? 'Clear filters' : 'Retry'}
              onAction={
                search || blockedFilter !== null
                  ? () => { clearFilters(); fetchDevices(); }
                  : () => fetchDevices()
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
        contentContainerStyle={devices.length === 0 ? styles.emptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Android block-reason modal */}
      <Modal
        visible={!!blockTarget}
        transparent
        animationType="fade"
        onRequestClose={() => { setBlockTarget(null); setBlockReason(''); }}
      >
        <View style={styles.blockModalOverlay}>
          <View style={styles.blockModalCard}>
            <Text style={styles.blockModalTitle}>Block Device</Text>
            <Text style={styles.blockModalMsg}>
              {`Enter a reason for blocking ${blockTarget?.salesperson?.name ?? 'this device'}:`}
            </Text>
            <TextInput
              style={styles.blockModalInput}
              placeholder="Reason (optional)"
              placeholderTextColor={COLORS.textMuted}
              value={blockReason}
              onChangeText={setBlockReason}
              autoFocus
            />
            <View style={styles.blockModalActions}>
              <TouchableOpacity
                style={styles.blockModalCancel}
                onPress={() => { setBlockTarget(null); setBlockReason(''); }}
              >
                <Text style={styles.blockModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.blockModalConfirm} onPress={confirmBlock}>
                <Text style={styles.blockModalConfirmText}>Block</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Device row ────────────────────────────────────────────────
function DeviceRow({ device, isMutating, onBlock, onUnblock, onReset }) {
  const {
    deviceId,
    platform,
    isBlocked,
    blockReason,
    blockedAt,
    blockedBy,
    lastSeen,
    appVersion,
    mobileNumber,
    salesperson,
  } = device;

  const statusColor = isBlocked
    ? DEVICE_STATUS_COLORS.blocked
    : DEVICE_STATUS_COLORS.active;

  const maskedId = deviceId
    ? `${deviceId.slice(0, 8)}…${deviceId.slice(-4)}`
    : 'Unknown';

  return (
    <View style={[styles.card, isBlocked && styles.cardBlocked]}>

      {/* Top row — platform icon + salesperson + badge */}
      <View style={styles.cardTop}>
        <View style={styles.platformIcon}>
          <Icon
            name={platform === 'ios' ? 'apple' : 'android'}
            size={22}
            color={platform === 'ios' ? '#333' : '#3DDC84'}
          />
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.spName} numberOfLines={1}>
            {salesperson?.name ?? 'Unlinked Device'}
          </Text>
          <Text style={styles.deviceId}>{maskedId}</Text>
          {mobileNumber ? (
            <Text style={styles.mobileNum}>{mobileNumber}</Text>
          ) : null}
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>
            {isBlocked ? 'Blocked' : 'Active'}
          </Text>
        </View>
      </View>

      {/* Meta row */}
      <View style={styles.cardMeta}>
        {lastSeen ? (
          <View style={styles.metaItem}>
            <Icon name="clock-outline" size={11} color={COLORS.textMuted} />
            <Text style={styles.metaText}>
              Last seen {dayjs(lastSeen).fromNow()}
            </Text>
          </View>
        ) : null}
        {appVersion ? (
          <View style={styles.metaItem}>
            <Icon name="application-outline" size={11} color={COLORS.textMuted} />
            <Text style={styles.metaText}>v{appVersion}</Text>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <Icon
            name={platform === 'ios' ? 'apple' : 'android'}
            size={11}
            color={COLORS.textMuted}
          />
          <Text style={styles.metaText}>{platform ?? 'unknown'}</Text>
        </View>
      </View>

      {/* Block reason */}
      {isBlocked && blockReason ? (
        <View style={styles.blockReasonWrap}>
          <Icon name="information-outline" size={12} color={COLORS.error} />
          <Text style={styles.blockReasonText} numberOfLines={2}>
            {blockReason}
          </Text>
        </View>
      ) : null}

      {isBlocked && blockedBy ? (
        <Text style={styles.blockedByText}>
          Blocked by {blockedBy.name}
          {blockedAt ? ` · ${formatDateTime(blockedAt)}` : ''}
        </Text>
      ) : null}

      {/* Action buttons */}
      <View style={styles.cardActions}>
        {isBlocked ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnUnblock]}
            onPress={onUnblock}
            disabled={isMutating}
            activeOpacity={0.8}
          >
            <Icon name="lock-open-variant-outline" size={14} color={COLORS.success} />
            <Text style={[styles.actionBtnText, { color: COLORS.success }]}>Unblock</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnBlock]}
            onPress={onBlock}
            disabled={isMutating}
            activeOpacity={0.8}
          >
            <Icon name="cellphone-lock" size={14} color={COLORS.error} />
            <Text style={[styles.actionBtnText, { color: COLORS.error }]}>Block</Text>
          </TouchableOpacity>
        )}

        {salesperson && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnReset]}
            onPress={onReset}
            disabled={isMutating}
            activeOpacity={0.8}
          >
            <Icon name="cellphone-remove" size={14} color={COLORS.warning} />
            <Text style={[styles.actionBtnText, { color: COLORS.warning }]}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  filterPanel: {
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingBottom:     SPACING.xs,
  },

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
  searchInput: { flex: 1, height: 44, ...TYPOGRAPHY.body, color: COLORS.textPrimary },

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
    gap:               4,
    paddingHorizontal: SPACING.md,
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   COLORS.background,
    borderWidth:       1,
    borderColor:       COLORS.border,
    height:            32,
  },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { ...TYPOGRAPHY.small, color: COLORS.textSecondary, fontFamily: FONTS.medium },
  chipTextActive: { color: COLORS.white },

  listHeader: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    marginBottom:      SPACING.xs,
  },
  countText:    { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  clearFilters: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontFamily: FONTS.medium },

  // Card
  card: {
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
    padding:          SPACING.md,
    borderWidth:      1.5,
    borderColor:      'transparent',
    ...SHADOW.sm,
  },
  cardBlocked: {
    borderColor:     COLORS.error + '40',
    backgroundColor: '#FFF5F5',
  },

  cardTop: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
    marginBottom:  SPACING.xs,
  },
  platformIcon: {
    width:          40,
    height:         40,
    borderRadius:   20,
    backgroundColor: COLORS.background,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    borderColor:    COLORS.border,
  },
  cardInfo:  { flex: 1 },
  spName:    { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontFamily: FONTS.medium },
  deviceId:  { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontFamily: 'monospace' },
  mobileNum: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  statusBadge: {
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  statusBadgeText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold },

  cardMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginBottom:  SPACING.sm,
    flexWrap:      'wrap',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:  { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  blockReasonWrap: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            4,
    backgroundColor: '#FEE2E2',
    borderRadius:   BORDER_RADIUS.sm,
    padding:        SPACING.xs,
    marginBottom:   6,
  },
  blockReasonText: { ...TYPOGRAPHY.caption, color: COLORS.error, flex: 1 },
  blockedByText:   { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: SPACING.sm },

  cardActions: {
    flexDirection: 'row',
    gap:           SPACING.sm,
    marginTop:     SPACING.xs,
  },
  actionBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    borderRadius:      BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical:   7,
    borderWidth:       1.5,
  },
  actionBtnText:    { ...TYPOGRAPHY.small, fontFamily: FONTS.bold },
  actionBtnBlock:   { borderColor: COLORS.error   + '50', backgroundColor: '#FEE2E2' },
  actionBtnUnblock: { borderColor: COLORS.success + '50', backgroundColor: '#DCFCE7' },
  actionBtnReset:   { borderColor: COLORS.warning + '50', backgroundColor: '#FEF3C7' },

  loadingMore:  { paddingVertical: SPACING.lg, alignItems: 'center' },
  listContent:  { paddingBottom: SPACING.xxl },
  emptyContent: { flexGrow: 1 },

  blockModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  blockModalCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  blockModalTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.textPrimary,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.xs,
  },
  blockModalMsg: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  blockModalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  blockModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  blockModalCancel: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  blockModalCancelText: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  blockModalConfirm: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
  },
  blockModalConfirmText: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
});
