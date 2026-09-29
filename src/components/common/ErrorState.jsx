import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS } from '@constants/config';

export default function ErrorState({
  icon = 'cloud-off-outline',
  title = 'Something went wrong',
  message = 'Could not load data. Check your connection and try again.',
  actionLabel = 'Retry',
  onAction,
  compact = false,
}) {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={styles.iconBox}>
        <Icon name={icon} size={compact ? 32 : 40} color={COLORS.error} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.btn} onPress={onAction} activeOpacity={0.85}>
          <Icon name="refresh" size={16} color={COLORS.white} />
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
  },
  compact: {
    flex: 0,
    paddingVertical: SPACING.xl,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h4,
    color: COLORS.textPrimary,
    fontFamily: FONTS.bold,
    textAlign: 'center',
  },
  message: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  btn: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.full,
  },
  btnText: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
});
