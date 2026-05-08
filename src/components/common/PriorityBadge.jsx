import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PRIORITY_COLORS } from '@constants/colors';
import { BORDER_RADIUS } from '@constants/config';
import { FONTS, FONT_SIZE } from '@constants/typography';

export default function PriorityBadge({ priority, size = 'md' }) {
  const colours = PRIORITY_COLORS[priority] ?? { bg: '#F3F4F6', text: '#6B7280' };
  const isSmall = size === 'sm';

  return (
    <View style={[styles.pill, { backgroundColor: colours.bg }, isSmall && styles.pillSm]}>
      <Text style={[styles.label, { color: colours.text }, isSmall && styles.labelSm]}>
        {priority?.toUpperCase() ?? '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      BORDER_RADIUS.full,
    alignSelf:         'flex-start',
  },
  pillSm: { paddingHorizontal: 6, paddingVertical: 2 },
  label: {
    fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, letterSpacing: 0.8,
  },
  labelSm: { fontSize: FONT_SIZE.xs },
});
