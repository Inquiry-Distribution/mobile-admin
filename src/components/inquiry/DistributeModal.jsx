/**
 * DistributeModal — assign an unassigned inquiry to a salesperson.
 *
 * Props:
 *  visible      boolean
 *  inquiry      Inquiry object
 *  onClose      () => void
 *  onSuccess    () => void   — called after successful distribute
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { getInitials } from '@utils/helpers';

import useUserStore    from '@store/user.store';
import useInquiryStore from '@store/inquiry.store';

export default function DistributeModal({ visible, inquiry, onClose, onSuccess }) {
  const { salespersons, isLoadingSalespersons, fetchSalespersons } = useUserStore();
  const { distribute, isMutating } = useInquiryStore();

  const [selected, setSelected] = useState(null);
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    if (visible) {
      fetchSalespersons();
      setSelected(null);
      setSearch('');
    }
  }, [visible]);

  const filtered = salespersons.filter((sp) =>
    !search ||
    sp.name?.toLowerCase().includes(search.toLowerCase()) ||
    sp.employeeId?.toLowerCase().includes(search.toLowerCase()) ||
    sp.assignedArea?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDistribute = async () => {
    if (!selected) {
      Alert.alert('Select Salesperson', 'Please select a salesperson to assign this inquiry.');
      return;
    }
    const result = await distribute(inquiry.id, { salespersonId: selected.id });
    if (result.success) {
      onSuccess?.();
      onClose();
    } else {
      Alert.alert('Error', result.message ?? 'Failed to distribute inquiry.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* ── Header ───────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Distribute Inquiry</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* ── Inquiry summary ───────────────────────────── */}
        <View style={styles.inquirySummary}>
          <Text style={styles.summaryLabel}>Assigning</Text>
          <Text style={styles.summaryDesc} numberOfLines={2}>
            {inquiry?.description || inquiry?.title || 'No description'}
          </Text>
          {inquiry?.mobile ? (
            <View style={styles.summaryMeta}>
              <Icon name="phone-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.summaryMobile}>{inquiry.mobile}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Search ───────────────────────────────────── */}
        <View style={styles.searchWrap}>
          <Icon name="magnify" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, ID or area…"
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Salesperson list ──────────────────────────── */}
        {isLoadingSalespersons ? (
          <View style={styles.listLoader}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SalespersonRow
                sp={item}
                isSelected={selected?.id === item.id}
                onPress={() => setSelected(item)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>No salespersons found.</Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* ── Confirm button ────────────────────────────── */}
        <View style={styles.footer}>
          {selected ? (
            <View style={styles.selectedPreview}>
              <Icon name="account-check-outline" size={16} color={COLORS.primary} />
              <Text style={styles.selectedName} numberOfLines={1}>
                {selected.name}
              </Text>
            </View>
          ) : (
            <Text style={styles.footerHint}>Select a salesperson above</Text>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, (!selected || isMutating) && styles.confirmBtnDisabled]}
            onPress={handleDistribute}
            disabled={!selected || isMutating}
            activeOpacity={0.85}
          >
            {isMutating ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Icon name="send-check-outline" size={16} color={COLORS.white} />
                <Text style={styles.confirmBtnText}>Assign</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function SalespersonRow({ sp, isSelected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.spRow, isSelected && styles.spRowSelected]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      {/* Avatar */}
      <View style={[styles.spAvatar, isSelected && styles.spAvatarSelected]}>
        <Text style={[styles.spAvatarText, isSelected && { color: COLORS.white }]}>
          {getInitials(sp.name)}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.spInfo}>
        <Text style={styles.spName}>{sp.name}</Text>
        <View style={styles.spMeta}>
          {sp.employeeId ? (
            <Text style={styles.spMetaText}>{sp.employeeId}</Text>
          ) : null}
          {sp.assignedArea ? (
            <>
              <Text style={styles.spMetaDot}>·</Text>
              <Text style={styles.spMetaText}>{sp.assignedArea}</Text>
            </>
          ) : null}
        </View>
      </View>

      {/* Check */}
      <View style={[styles.spCheck, isSelected && styles.spCheckSelected]}>
        {isSelected ? (
          <Icon name="check" size={14} color={COLORS.white} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surface,
  },
  closeBtn:    { padding: 4 },
  headerTitle: { ...TYPOGRAPHY.h4, color: COLORS.textPrimary, fontWeight: '700' },

  // Inquiry summary
  inquirySummary: {
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: SPACING.md,
    marginTop:       SPACING.md,
    borderRadius:    BORDER_RADIUS.lg,
    padding:         SPACING.md,
    borderWidth:     1,
    borderColor:     COLORS.primaryMid,
  },
  summaryLabel: {
    ...TYPOGRAPHY.caption,
    color:        COLORS.primary,
    fontWeight:   '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom:  4,
  },
  summaryDesc: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  summaryMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     4,
  },
  summaryMobile: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },

  // Search
  searchWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginTop:       SPACING.md,
    paddingHorizontal: SPACING.sm,
    ...SHADOW.sm,
  },
  searchInput: {
    flex:           1,
    height:         42,
    ...TYPOGRAPHY.body,
    color:          COLORS.textPrimary,
  },
  listLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent:  { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 100 },
  emptyList:    { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyText:    { ...TYPOGRAPHY.small, color: COLORS.textMuted },

  // Salesperson row
  spRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    marginBottom:    SPACING.sm,
    padding:         SPACING.md,
    borderWidth:     1.5,
    borderColor:     'transparent',
    ...SHADOW.sm,
  },
  spRowSelected: {
    borderColor:     COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  spAvatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     SPACING.sm,
  },
  spAvatarSelected: { backgroundColor: COLORS.primary },
  spAvatarText: {
    fontSize:   14,
    fontWeight: '700',
    color:      COLORS.primary,
  },
  spInfo: { flex: 1 },
  spName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600' },
  spMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  spMetaText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  spMetaDot:  { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  spCheck: {
    width:        22,
    height:       22,
    borderRadius: 11,
    borderWidth:  2,
    borderColor:  COLORS.border,
    alignItems:   'center',
    justifyContent: 'center',
  },
  spCheckSelected: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },

  // Footer
  footer: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth:  1,
    borderTopColor:  COLORS.divider,
    backgroundColor: COLORS.surface,
    gap:             SPACING.sm,
  },
  selectedPreview: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  selectedName: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.primary,
    fontWeight: '700',
    flex:       1,
  },
  footerHint: {
    flex:       1,
    ...TYPOGRAPHY.small,
    color:      COLORS.textMuted,
  },
  confirmBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: COLORS.primary,
    borderRadius:    BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    ...SHADOW.sm,
  },
  confirmBtnDisabled: {
    backgroundColor: COLORS.border,
    elevation: 0, shadowOpacity: 0,
  },
  confirmBtnText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.white,
    fontWeight: '700',
  },
});
