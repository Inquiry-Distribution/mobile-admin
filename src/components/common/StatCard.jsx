import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { BORDER_RADIUS, SHADOW, SPACING } from '@constants/config';

export default function StatCard({ label, value, icon, color, onPress, sub, compact = false }) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[styles.card, compact && styles.cardCompact]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.iconBox, compact && styles.iconBoxCompact, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={compact ? 16 : 22} color={color} />
      </View>
      <Text style={[styles.value, compact && styles.valueCompact]}>{value ?? '—'}</Text>
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    margin: SPACING.xs,
    alignItems: 'flex-start',
    ...SHADOW.sm,
  },
  cardCompact: {
    minWidth: '30%',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  iconBoxCompact: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: 6,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 30,
  },
  valueCompact: {
    fontSize: 18,
    lineHeight: 22,
  },
  label: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  labelCompact: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    marginTop: 1,
  },
  sub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
