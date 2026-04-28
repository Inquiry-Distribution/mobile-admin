import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { getInitials } from '@utils/helpers';

export default function SalespersonRow({ sp, isSelected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.row, isSelected && styles.rowSelected]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
        <Text style={[styles.avatarText, isSelected && { color: COLORS.white }]}>
          {getInitials(sp.name)}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{sp.name}</Text>
        <View style={styles.meta}>
          {sp.employeeId ? <Text style={styles.metaText}>{sp.employeeId}</Text> : null}
          {sp.assignedArea ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{sp.assignedArea}</Text>
            </>
          ) : null}
        </View>
        {sp.company?.name ? (
          <View style={styles.companyRow}>
            <Icon name="domain" size={10} color={COLORS.primary} />
            <Text style={styles.companyText} numberOfLines={1}>{sp.company.name}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.check, isSelected && styles.checkSelected]}>
        {isSelected ? <Icon name="check" size={14} color={COLORS.white} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
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
  rowSelected: {
    borderColor:     COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  avatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     SPACING.sm,
  },
  avatarSelected: { backgroundColor: COLORS.primary },
  avatarText: {
    fontSize:   14,
    fontWeight: '700',
    color:      COLORS.primary,
  },
  info: { flex: 1 },
  name: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  metaDot:  { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  companyRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  companyText: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '600', flex: 1 },
  check: {
    width:          22,
    height:         22,
    borderRadius:   11,
    borderWidth:    2,
    borderColor:    COLORS.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  checkSelected: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
});
