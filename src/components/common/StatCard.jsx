import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { BORDER_RADIUS, SHADOW, SPACING } from '@constants/config';

export default function StatCard({ label, value, icon, color, onPress, sub }) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.iconBox, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <Text style={styles.value}>{value ?? '—'}</Text>
      <Text style={styles.label}>{label}</Text>
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
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 30,
  },
  label: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  sub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
