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

import useUserStore    from '@store/user.store';
import useInquiryStore from '@store/inquiry.store';
import { reportApi }   from '@api/report.api';
import { stripHtml }   from '@utils/helpers';

import SalespersonRow from './shared/SalespersonRow';
import StatsCard      from './shared/StatsCard';

// ── Date helpers ──────────────────────────────────────────────
const startOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function DistributeModal({ visible, inquiry, onClose, onSuccess }) {
  const { salespersons, isLoadingSalespersons, fetchSalespersons } = useUserStore();
  const { distribute, isMutating } = useInquiryStore();

  const [selected,       setSelected]       = useState(null);
  const [search,         setSearch]         = useState('');
  const [spStats,        setSpStats]        = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchSalespersons();
      setSelected(null);
      setSearch('');
      setSpStats(null);
    }
  }, [visible]);

  // Fetch current-month stats whenever selection changes
  useEffect(() => {
    if (!selected) { setSpStats(null); return; }
    let cancelled = false;
    setIsLoadingStats(true);
    setSpStats(null);
    reportApi
      .getSalesperson(selected.id, { from: startOfMonth(), to: todayStr() })
      .then((res) => {
        if (!cancelled) setSpStats(res.data ?? res);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoadingStats(false); });
    return () => { cancelled = true; };
  }, [selected?.id]);

  const q = search.toLowerCase();
  const filtered = salespersons.filter((sp) =>
    !search ||
    sp.name?.toLowerCase().includes(q) ||
    sp.employeeId?.toLowerCase().includes(q) ||
    sp.assignedArea?.toLowerCase().includes(q) ||
    sp.company?.name?.toLowerCase().includes(q),
  );

  const handleDistribute = async () => {
    if (!selected) {
      Alert.alert('Select Salesperson', 'Please select a salesperson to assign this inquiry.');
      return;
    }
    const result = await distribute(inquiry.id, { salesPersonId: selected.id });
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
            {inquiry?.title?.trim() || stripHtml(inquiry?.description || '').trim()}
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
            placeholder="Search by name, ID, area or company…"
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
          <View style={styles.listContainer}>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              extraData={selected?.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <SalespersonRow
                  sp={item}
                  isSelected={selected?.id === item.id}
                  onPress={() => setSelected(selected?.id === item.id ? null : item)}
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
          </View>
        )}

        {/* ── Stats card (shown when a salesperson is selected) ── */}
        {selected ? (
          <StatsCard stats={spStats} isLoading={isLoadingStats} person={selected} />
        ) : null}

        {/* ── Footer ───────────────────────────────────── */}
        <View style={styles.footer}>
          {selected ? (
            <View style={styles.selectedPreview}>
              <Icon name="account-check-outline" size={16} color={COLORS.primary} />
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedName} numberOfLines={1}>
                  {selected.name}
                </Text>
                {selected.company?.name ? (
                  <Text style={styles.selectedCompany} numberOfLines={1}>
                    {selected.company.name}
                  </Text>
                ) : null}
              </View>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor:   COLORS.surface,
  },
  closeBtn:    { padding: 4 },
  headerTitle: { ...TYPOGRAPHY.h4, color: COLORS.textPrimary, fontWeight: '700' },

  // Inquiry summary
  inquirySummary: {
    backgroundColor:  COLORS.primaryLight,
    marginHorizontal: SPACING.md,
    marginTop:        SPACING.md,
    borderRadius:     BORDER_RADIUS.lg,
    padding:          SPACING.md,
    borderWidth:      1,
    borderColor:      COLORS.primaryMid,
  },
  summaryLabel: {
    ...TYPOGRAPHY.caption,
    color:         COLORS.primary,
    fontWeight:    '700',
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
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.xs,
    backgroundColor:   COLORS.surface,
    borderRadius:      BORDER_RADIUS.md,
    marginHorizontal:  SPACING.md,
    marginTop:         SPACING.md,
    paddingHorizontal: SPACING.sm,
    ...SHADOW.sm,
  },
  searchInput: {
    flex:   1,
    height: 42,
    ...TYPOGRAPHY.body,
    color:  COLORS.textPrimary,
  },

  // List
  listLoader:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContainer: { flex: 1 },
  listContent:   { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  emptyList:     { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyText:     { ...TYPOGRAPHY.small, color: COLORS.textMuted },

  // Footer
  footer: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.md,
    borderTopWidth:    1,
    borderTopColor:    COLORS.divider,
    backgroundColor:   COLORS.surface,
    gap:               SPACING.sm,
    marginTop:         SPACING.sm,
  },
  selectedPreview: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.primary,
    fontWeight: '700',
  },
  selectedCompany: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.textMuted,
    marginTop:  1,
  },
  footerHint: {
    flex: 1,
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
  },
  confirmBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   COLORS.primary,
    borderRadius:      BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
    ...SHADOW.sm,
  },
  confirmBtnDisabled: {
    backgroundColor: COLORS.border,
    shadowOpacity:   0,
    elevation:       0,
  },
  confirmBtnText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.white,
    fontWeight: '700',
  },
});
