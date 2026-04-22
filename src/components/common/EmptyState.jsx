import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING } from '@constants/config';

export default function EmptyState({
  icon    = 'inbox-outline',
  title   = 'Nothing here',
  message = 'Pull down to refresh.',
}) {
  return (
    <View style={styles.root}>
      <View style={styles.iconBox}>
        <Icon name={icon} size={38} color={COLORS.primaryMid} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
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
    fontWeight: '700',
    textAlign: 'center',
  },
  msg: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
