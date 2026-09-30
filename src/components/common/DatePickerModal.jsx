/**
 * Simple JS-only month calendar — no native modules required.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS } from '@constants/config';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DatePickerModal({ visible, value, onSelect, onClose }) {
  const selected = dayjs(value).isValid() ? dayjs(value) : dayjs();
  const [cursor, setCursor] = useState(selected.startOf('month'));

  const days = useMemo(() => {
    const start = cursor.startOf('month');
    const end = cursor.endOf('month');
    const startPad = start.day(); // 0=Sun
    const total = end.date();
    const cells = [];
    for (let i = 0; i < startPad; i += 1) cells.push(null);
    for (let d = 1; d <= total; d += 1) cells.push(start.date(d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setCursor((c) => c.subtract(1, 'month'))}
              hitSlop={10}
            >
              <Icon name="chevron-left" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{cursor.format('MMMM YYYY')}</Text>
            <TouchableOpacity
              onPress={() => setCursor((c) => c.add(1, 'month'))}
              hitSlop={10}
            >
              <Icon name="chevron-right" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekLabel}>{w}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((d, idx) => {
              if (!d) {
                return <View key={`e-${idx}`} style={styles.dayCell} />;
              }
              const isSelected = d.format('YYYY-MM-DD') === selected.format('YYYY-MM-DD');
              const isSunday = d.day() === 0;
              return (
                <TouchableOpacity
                  key={d.format('YYYY-MM-DD')}
                  style={styles.dayCell}
                  onPress={() => onSelect(d.format('YYYY-MM-DD'))}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.dayInner,
                      isSelected && styles.daySelected,
                      isSunday && !isSelected && styles.daySunday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                        isSunday && !isSelected && styles.dayTextSunday,
                      ]}
                    >
                      {d.date()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  monthTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontFamily: FONTS.bold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: COLORS.primary,
  },
  daySunday: {
    backgroundColor: COLORS.warning + '22',
  },
  dayText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm + 2,
    color: COLORS.textPrimary,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  dayTextSelected: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
  dayTextSunday: {
    color: COLORS.warning,
  },
  cancelBtn: {
    marginTop: SPACING.md,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.bold,
  },
});
