import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { COLORS } from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';

export default function Loader({ message = 'Loading…', fullScreen = true }) {
  if (!fullScreen) {
    return (
      <View style={styles.inline}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        {message ? <Text style={styles.msg}>{message}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.full}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      {message ? <Text style={styles.msg}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: 12,
  },
  inline: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  msg: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
  },
});
