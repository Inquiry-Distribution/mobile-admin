/**
 * ReassignModal — move an already-assigned inquiry to a different salesperson.
 *
 * Props:
 *  visible    boolean
 *  inquiry    Inquiry object
 *  onClose    () => void
 *  onSuccess  () => void
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

export default function ReassignModal({ visible, inquiry, onClose, onSuccess }) {
  const { salespersons, isLoadingSalespersons, fetchSalespersons } = useUserStore();
  const { reassign, isMutating } = useInquiryStore();

  const [selected, setSelected] = useState(null);
  const [reason,   setReason]   = useState('');
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    if (visible) {
      fetchSalespersons();
      setSelected(null);
      setReason('');
      setSearch('');
    }
  }, [visible]);

  // Exclude currently assigned salesperson
  const currentAssignedId = inquiry?.assignedTo?.id;
  const filtered = salespersons.filter((sp) => {
    if (sp.id === currentAssignedId) return false;
    if (!search) return true;
    return (
      sp.name?.toLowerCase().includes(search.toLowerCase()) ||
      sp.employeeId?.toLowerCase().includes(search.toLowerCase()) ||
      sp.assignedArea?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleReassign = async () => {
    if (!selected) {
      Alert.alert('Select Salesperson', 'Choose the new salesperson to reassign to.');
      return;
    }
    const payload = { salespersonId: selected.id };
    if (reason.trim()) payload.reason = reason.trim();

    const result = await reassign(inquiry.id, payload);
    if (result.success) {
      onSuccess?.();
      onClose();
    } else {
      Alert.alert('Error', result.message ?? 'Failed to reassign inquiry.');
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
          <Text style={styles.headerTitle}>Reassign Inquiry</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* ── Current assignment banner ─────────────────── */}
        {inquiry?.assignedTo && (
          <View style={styles.currentBanner}>
            <Icon name="account-arrow-right-outline" size={16} color={COLORS.warning} />
            <Text style={styles.currentText}>
              Currently assigned to{' '}
              <Text style={styles.currentName}>{inquiry.assignedTo.name}</Text>
            </Text>
          </View>
        )}

        {/* ── Reason field ──────────────────────────────── */}
        <View style={styles.reasonWrap}>
          <Text style={styles.reasonLabel}>Reason (optional)</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="e.g. Salesperson is unavailable…"
            placeholderTextColor={COLORS.textMuted}
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={200}
          />
        </View>

        {/* ── Search ───────────────────────────────────── */}
        <View style={styles.searchWrap}>
          <Icon name="magnify" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search salesperson…"
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
              <SpRow
                sp={item}
                isSelected={selected?.id === item.id}
                onPress={() => setSelected(item)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>
                  {search ? 'No match found.' : 'No other salespersons available.'}
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* ── Footer ───────────────────────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {selected ? (
              <>
                <Icon name="account-check-outline" size={15} color={COLORS.primary} />
                <Text style={styles.selectedName} numberOfLines={1}>{selected.name}</Text>
              </>
            ) : (
              <Text style={styles.footerHint}>Select new salesperson</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, (!selected || isMutating) && styles.confirmBtnDisabled]}
            onPress={handleReassign}
            disabled={!selected || isMutating}
            activeOpacity={0.85}
          >
            {isMutating ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Icon name="account-switch-outline" size={16} color={COLORS.white} />
                <Text style={styles.confirmBtnText}>Reassign</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function SpRow({ sp, isSelected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.spRow, isSelected && styles.spRowSelected]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={[styles.spAvatar, isSelected && styles.spAvatarSel]}>
        <Text style={[styles.spAvatarText, isSelected && { color: COLORS.white }]}>
          {getInitials(sp.name)}
        </Text>
      </View>
      <View style={styles.spInfo}>
        <Text style={styles.spName}>{sp.name}</Text>
        <View style={styles.spMeta}>
          {sp.employeeId ? <Text style={styles.spMetaText}>{sp.employeeId}</Text> : null}
          {sp.assignedArea ? (
            <>
              <Text style={styles.spMetaDot}>·</Text>
              <Text style={styles.spMetaText}>{sp.assignedArea}</Text>
            </>
          ) : null}
        </View>
      </View>
      <View style={[styles.spCheck, isSelected && styles.spCheckSel]}>
        {isSelected ? <Icon name="check" size={13} color={COLORS.white} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: COLORS.background },

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

  currentBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: '#FEF3C7',
    borderRadius:    BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginTop:       SPACING.md,
    padding:         SPACING.sm,
    borderWidth:     1,
    borderColor:     COLORS.warning + '60',
  },
  currentText: { ...TYPOGRAPHY.small, color: COLORS.textSecondary },
  currentName: { fontWeight: '700', color: COLORS.textPrimary },

  reasonWrap: {
    marginHorizontal: SPACING.md,
    marginTop:       SPACING.md,
  },
  reasonLabel: {
    ...TYPOGRAPHY.smallMedium,
    color:        COLORS.textSecondary,
    fontWeight:   '600',
    marginBottom: 6,
  },
  reasonInput: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.md,
    borderWidth:     1.5,
    borderColor:     COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   SPACING.sm,
    ...TYPOGRAPHY.body,
    color:           COLORS.textPrimary,
    maxHeight:       80,
    textAlignVertical: 'top',
  },

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
  searchInput: { flex: 1, height: 42, ...TYPOGRAPHY.body, color: COLORS.textPrimary },

  listLoader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 100 },
  emptyList:   { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyText:   { ...TYPOGRAPHY.small, color: COLORS.textMuted },

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
  spRowSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  spAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  spAvatarSel:  { backgroundColor: COLORS.primary },
  spAvatarText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  spInfo:       { flex: 1 },
  spName:       { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600' },
  spMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  spMetaText:   { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  spMetaDot:    { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  spCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  spCheckSel: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  footer: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth:  1,
    borderTopColor:  COLORS.divider,
    backgroundColor: COLORS.surface,
    gap:             SPACING.sm,
  },
  footerLeft: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  selectedName: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.primary, fontWeight: '700', flex: 1,
  },
  footerHint: { flex: 1, ...TYPOGRAPHY.small, color: COLORS.textMuted },
  confirmBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: COLORS.primary,
    borderRadius:    BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
    ...SHADOW.sm,
  },
  confirmBtnDisabled: { backgroundColor: COLORS.border, elevation: 0, shadowOpacity: 0 },
  confirmBtnText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.white, fontWeight: '700' },
});
