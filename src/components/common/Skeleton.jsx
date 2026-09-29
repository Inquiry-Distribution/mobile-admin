import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS } from '@constants/colors';
import { SPACING, BORDER_RADIUS } from '@constants/config';

export function SkeletonBox({
  width = '100%',
  height = 14,
  borderRadius = BORDER_RADIUS.sm,
  style,
}) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: COLORS.border, opacity }, style]}
    />
  );
}

export function ListSkeleton({ count = 5 }) {
  return (
    <View style={styles.wrap}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <SkeletonBox height={4} borderRadius={0} />
          <View style={{ padding: SPACING.md, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <SkeletonBox width={90} height={18} borderRadius={BORDER_RADIUS.full} />
              <SkeletonBox width={60} height={12} />
            </View>
            <SkeletonBox width="85%" height={15} />
            <SkeletonBox width="55%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.dash}>
      <View style={{ paddingHorizontal: SPACING.md, gap: 8, marginBottom: SPACING.lg }}>
        <SkeletonBox width={120} height={12} />
        <SkeletonBox width={180} height={26} />
      </View>
      <View style={styles.statsRow}>
        {[1, 2, 3].map((k) => (
          <View key={k} style={styles.stat}>
            <SkeletonBox width={40} height={40} borderRadius={20} />
            <SkeletonBox width={36} height={20} style={{ marginTop: 8 }} />
            <SkeletonBox width={50} height={10} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      <ListSkeleton count={3} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: SPACING.md, gap: SPACING.sm },
  card: {
    backgroundColor: COLORS.surface ?? COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  dash: { flex: 1, paddingTop: SPACING.md, backgroundColor: COLORS.background },
  statsRow: { flexDirection: 'row', paddingHorizontal: SPACING.sm, marginBottom: SPACING.md },
  stat: {
    flex: 1,
    backgroundColor: COLORS.surface ?? COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    alignItems: 'center',
    margin: SPACING.xs,
  },
});
