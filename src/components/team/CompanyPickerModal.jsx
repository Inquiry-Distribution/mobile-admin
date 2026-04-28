/**
 * CompanyPickerModal
 *
 * A full-screen modal to pick a company from the list.
 * Props:
 *  • visible         — boolean
 *  • selectedId      — currently selected company id (or null)
 *  • onSelect(co)    — called with the chosen company object
 *  • onClear()       — called when "No Company" is tapped
 *  • onClose()       — called to dismiss without change
 */
import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS } from '@constants/config';
import useCompanyStore from '@store/company.store';

export default function CompanyPickerModal({ visible, selectedId, onSelect, onClear, onClose }) {
  const { companies, isLoading, fetchCompanies } = useCompanyStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible) {
      setSearch('');
      fetchCompanies();
    }
  }, [visible]);

  const filtered = search.trim()
    ? companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : companies;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="arrow-left" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Company</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Search ── */}
        <View style={styles.searchWrap}>
          <Icon name="magnify" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search companies…"
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>

        {/* ── No company option ── */}
        <TouchableOpacity
          style={[styles.item, !selectedId && styles.itemSelected]}
          onPress={onClear}
          activeOpacity={0.75}
        >
          <View style={styles.itemIcon}>
            <Icon name="domain-off" size={18} color={COLORS.textMuted} />
          </View>
          <Text style={[styles.itemName, !selectedId && styles.itemNameSelected]}>
            No Company
          </Text>
          {!selectedId && (
            <Icon name="check" size={18} color={COLORS.primary} />
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* ── List ── */}
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[styles.item, isSelected && styles.itemSelected]}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.75}
                >
                  <View style={styles.itemIcon}>
                    <Icon name="domain" size={18} color={isSelected ? COLORS.primary : COLORS.textSecondary} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, isSelected && styles.itemNameSelected]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.address ? (
                      <Text style={styles.itemSub} numberOfLines={1}>{item.address}</Text>
                    ) : null}
                  </View>
                  {isSelected && (
                    <Icon name="check" size={18} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    height:            56,
  },
  closeBtn: { width: 36, alignItems: 'center' },
  headerTitle: {
    ...TYPOGRAPHY.h4,
    color:      COLORS.white,
    fontWeight: '700',
  },

  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   COLORS.surface,
    marginHorizontal:  SPACING.md,
    marginVertical:    SPACING.sm,
    borderRadius:      BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    borderWidth:       1,
    borderColor:       COLORS.border,
    height:            44,
  },
  searchInput: {
    flex:  1,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },

  divider: {
    height:          1,
    backgroundColor: COLORS.divider,
    marginHorizontal: SPACING.md,
    marginBottom:    SPACING.xs,
  },

  item: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  itemSelected: { backgroundColor: COLORS.primaryLight },
  itemIcon: {
    width:          36,
    height:         36,
    borderRadius:   18,
    backgroundColor: COLORS.background,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    SPACING.sm,
    flexShrink:     0,
  },
  itemInfo: { flex: 1 },
  itemName: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textPrimary,
    fontWeight: '600',
  },
  itemNameSelected: { color: COLORS.primary, fontWeight: '700' },
  itemSub: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textMuted,
    marginTop: 2,
  },
});
