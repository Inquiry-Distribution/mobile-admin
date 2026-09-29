import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS } from '@constants/config';

export default function EmptyState({
  icon = 'inbox-outline',
  title = 'Nothing here',
  message = 'Pull down to refresh.',
  actionLabel,
  onAction,
  compact = false,
}) {
  return (
    <View style={[styles.root, compact && styles.compact]}>
      <View style={styles.iconBox}>
        <Icon name={icon} size={38} color={COLORS.primaryMid || COLORS.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.btn} onPress={onAction} activeOpacity={0.85}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  compact: { flex: 0, paddingVertical: SPACING.xl },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.h4,
    color: COLORS.textPrimary,
    fontFamily: FONTS.bold,
    textAlign: 'center',
  },
  msg: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
  },
  btnText: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
});
