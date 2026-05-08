import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONTS, FONT_SIZE, LINE_HEIGHT } from '@constants/typography';
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
    fontSize: FONT_SIZE.xxl,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    lineHeight: LINE_HEIGHT.xxl,
  },
  valueCompact: {
    fontSize: FONT_SIZE.lg,
    lineHeight: LINE_HEIGHT.md,
  },
  label: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontFamily: FONTS.medium,
  },
  labelCompact: {
    ...TYPOGRAPHY.caption,
    fontFamily: FONTS.medium,
    marginTop: 1,
  },
  sub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
