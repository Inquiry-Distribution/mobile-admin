import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';

export default function StatsCard({ stats, isLoading, person }) {
  const cells = [
    { label: 'Assigned',    value: stats?.total          ?? '—', icon: 'inbox-outline',        color: COLORS.primary },
    { label: 'In Progress', value: stats?.inProgress     ?? '—', icon: 'progress-clock',       color: COLORS.warning },
    { label: 'Closed',      value: stats?.closed         ?? '—', icon: 'check-circle-outline', color: COLORS.success },
    {
      label: 'Converted',
      value: stats?.conversionRate != null
        ? `${Math.round(Number(stats.conversionRate))}%`
        : '—',
      icon:  'trending-up',
      color: '#8B5CF6',
    },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name="chart-bar" size={13} color={COLORS.primary} />
        <Text style={styles.title}>{person.name} — This Month</Text>
        {isLoading && (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 6 }} />
        )}
      </View>
      <View style={styles.cells}>
        {cells.map((cell, idx) => (
          <React.Fragment key={cell.label}>
            {idx > 0 && <View style={styles.divider} />}
            <View style={styles.cell}>
              <Icon name={cell.icon} size={14} color={cell.color} style={{ marginBottom: 3 }} />
              <Text style={[styles.value, { color: cell.color }]}>{cell.value}</Text>
              <Text style={styles.label}>{cell.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal:  SPACING.md,
    marginTop:         SPACING.sm,
    backgroundColor:   COLORS.surface,
    borderRadius:      BORDER_RADIUS.lg,
    borderWidth:       1,
    borderColor:       COLORS.primary + '30',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    ...SHADOW.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    marginBottom:  SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.primary,
    fontWeight: '700',
    flex:       1,
  },
  cells: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  cell: {
    flex:       1,
    alignItems: 'center',
  },
  value: {
    fontSize:   16,
    fontWeight: '800',
    lineHeight: 20,
  },
  label: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textMuted,
    marginTop: 1,
    textAlign: 'center',
  },
  divider: {
    width:            1,
    height:           36,
    backgroundColor:  COLORS.divider,
    marginHorizontal: 4,
  },
});
