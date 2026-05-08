/**
 * StatusBadge — shows inquiry status as a coloured pill.
 * size: 'sm' | 'md'
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_COLORS } from '@constants/colors';
import { BORDER_RADIUS } from '@constants/config';
import { FONTS, FONT_SIZE } from '@constants/typography';

const LABELS = {
  unassigned:     'Unassigned',
  assigned:       'Assigned',
  in_progress:    'In Progress',
  follow_up:      'Follow Up',
  not_interested: 'Not Interested',
  converted:      'Converted',
  closed:         'Closed',
};

export default function StatusBadge({ status, size = 'md' }) {
  const colours = STATUS_COLORS[status] ?? { bg: '#F3F4F6', text: '#6B7280' };
  const isSmall = size === 'sm';

  return (
    <View style={[styles.pill, { backgroundColor: colours.bg }, isSmall && styles.pillSm]}>
      <View style={[styles.dot, { backgroundColor: colours.text }]} />
      <Text style={[styles.label, { color: colours.text }, isSmall && styles.labelSm]}>
        {LABELS[status] ?? status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:    BORDER_RADIUS.full,
    alignSelf:       'flex-start',
  },
  pillSm: {
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
  },
  label: {
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.bold,
  },
  labelSm: {
    fontSize: FONT_SIZE.xs,
  },
});
