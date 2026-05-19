/**
 * DateRangePickerModal — pure-JS calendar date range picker
 * No native dependencies required.
 *
 * Props:
 *  visible      — boolean
 *  onClose      — () => void
 *  onApply      — (from: 'YYYY-MM-DD', to: 'YYYY-MM-DD') => void
 *  initialFrom  — 'YYYY-MM-DD' | null
 *  initialTo    — 'YYYY-MM-DD' | null
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter  from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

import { COLORS } from '@constants/colors';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { FONTS, FONT_SIZE } from '@constants/typography';

const WEEK_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W   = SCREEN_W - SPACING.md * 4;
const CELL_W   = Math.floor(CARD_W / 7);

// ─────────────────────────────────────────────────────────────
export default function DateRangePickerModal({
  visible,
  onClose,
  onApply,
  initialFrom = null,
  initialTo   = null,
}) {
  const [month, setMonth] = useState(
    dayjs(initialFrom || undefined).startOf('month'),
  );
  const [from, setFrom] = useState(initialFrom ? dayjs(initialFrom) : null);
  const [to,   setTo  ] = useState(initialTo   ? dayjs(initialTo)   : null);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setFrom(initialFrom ? dayjs(initialFrom) : null);
      setTo  (initialTo   ? dayjs(initialTo)   : null);
      setMonth(dayjs(initialFrom || undefined).startOf('month'));
    }
  }, [visible]);

  // Build grid: array of dayjs | null (null = empty cell)
  const cells = useMemo(() => {
    const start  = month.startOf('month');
    const total  = month.daysInMonth();
    let dow      = start.day(); // 0=Sun … 6=Sat
    dow          = dow === 0 ? 6 : dow - 1; // convert to Mon-based (0=Mon)

    const grid = [];
    for (let i = 0; i < dow; i++) grid.push(null);
    for (let d = 1; d <= total; d++) grid.push(month.date(d));
    return grid;
  }, [month]);

  const handleDay = (day) => {
    if (!day) return;

    // No from yet, or both already set → start fresh
    if (!from || (from && to)) {
      setFrom(day);
      setTo(null);
      return;
    }

    // From is set, to is not → pick to (swap if before from)
    if (day.isBefore(from, 'day')) {
      setFrom(day);
      setTo(null);
    } else if (day.isSame(from, 'day')) {
      // tapping same day = single-day range
      setTo(day);
    } else {
      setTo(day);
    }
  };

  const isFrom    = (d) => d && from && d.isSame(from, 'day');
  const isTo      = (d) => d && to   && d.isSame(to,   'day');
  const inRange   = (d) =>
    d && from && to &&
    d.isAfter(from, 'day') && d.isBefore(to, 'day');

  const canApply  = !!(from && to);

  const handleApply = () => {
    if (!canApply) return;
    onApply(from.format('YYYY-MM-DD'), to.format('YYYY-MM-DD'));
  };

  // Hint text
  const hint = !from
    ? 'Tap to select start date'
    : !to
    ? 'Tap to select end date'
    : `${from.format('DD MMM')} – ${to.format('DD MMM YYYY')}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Icon name="calendar-range" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.headerTitle}>Select Date Range</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* ── Month navigation ── */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => setMonth((m) => m.subtract(1, 'month'))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="chevron-left" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {month.format('MMMM YYYY')}
            </Text>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => setMonth((m) => m.add(1, 'month'))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="chevron-right" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* ── Weekday headers ── */}
          <View style={styles.weekRow}>
            {WEEK_DAYS.map((d) => (
              <Text key={d} style={[styles.weekDay, { width: CELL_W }]}>{d}</Text>
            ))}
          </View>

          {/* ── Days grid ── */}
          <View style={styles.grid}>
            {cells.map((day, i) => {
              const f       = isFrom(day);
              const t       = isTo(day);
              const between = inRange(day);
              const endpoint = f || t;

              // Range bar: spans full width for in-between cells,
              // half-width on endpoints (left half for 'to', right half for 'from')
              const showBarLeft  = t   && !f && to && from && !to.isSame(from, 'day');
              const showBarRight = f   && !t && to && from && !to.isSame(from, 'day');
              const showBarFull  = between;

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.cell, { width: CELL_W }]}
                  onPress={() => handleDay(day)}
                  activeOpacity={day ? 0.7 : 1}
                >
                  {/* Range highlight bar */}
                  {(showBarFull || showBarLeft || showBarRight) && (
                    <View style={[
                      styles.rangeBar,
                      showBarLeft  && { right: CELL_W / 2, left: 0 },
                      showBarRight && { left:  CELL_W / 2, right: 0 },
                      showBarFull  && { left: 0, right: 0 },
                    ]} />
                  )}

                  {/* Day circle */}
                  {day ? (
                    <View style={[
                      styles.dayCircle,
                      endpoint && { backgroundColor: COLORS.primary },
                    ]}>
                      <Text style={[
                        styles.dayText,
                        endpoint  && styles.dayTextEndpoint,
                        between   && styles.dayTextBetween,
                      ]}>
                        {day.date()}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.dayCircle} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Selected range labels ── */}
          <View style={styles.rangeDisplay}>
            <View style={[styles.rangeBox, !from && styles.rangeBoxActive]}>
              <Icon
                name="calendar-start"
                size={13}
                color={from ? COLORS.primary : COLORS.textMuted}
              />
              <View>
                <Text style={styles.rangeBoxLabel}>FROM</Text>
                <Text style={[styles.rangeBoxValue, !from && styles.rangeBoxEmpty]}>
                  {from ? from.format('DD MMM YYYY') : 'Start date'}
                </Text>
              </View>
            </View>

            <Icon name="arrow-right-thin" size={18} color={COLORS.textMuted} />

            <View style={[styles.rangeBox, from && !to && styles.rangeBoxActive]}>
              <Icon
                name="calendar-end"
                size={13}
                color={to ? COLORS.primary : COLORS.textMuted}
              />
              <View>
                <Text style={styles.rangeBoxLabel}>TO</Text>
                <Text style={[styles.rangeBoxValue, !to && styles.rangeBoxEmpty]}>
                  {to ? to.format('DD MMM YYYY') : 'End date'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, !canApply && styles.applyBtnDisabled]}
              onPress={handleApply}
              disabled={!canApply}
            >
              <Icon name="check" size={15} color={COLORS.white} />
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex:             1,
    backgroundColor:  'rgba(0,0,0,0.5)',
    justifyContent:   'center',
    alignItems:       'center',
    paddingHorizontal: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    width:           '100%',
    overflow:        'hidden',
    ...SHADOW.lg,
  },

  // Header
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACING.sm,
    padding:        SPACING.md,
    paddingBottom:  SPACING.sm,
  },
  headerIconWrap: {
    width:           34,
    height:          34,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerTitle: {
    flex:       1,
    fontSize:   FONT_SIZE.md,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
  },
  closeBtn: {
    width:           30,
    height:          30,
    borderRadius:    BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
  divider: {
    height:          1,
    backgroundColor: COLORS.divider,
    marginHorizontal: SPACING.md,
  },

  // Month nav
  monthNav: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
  },
  navBtn: {
    width:          34,
    height:         34,
    borderRadius:   BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    alignItems:     'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize:   FONT_SIZE.md,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
  },

  // Weekday row
  weekRow: {
    flexDirection:     'row',
    paddingHorizontal: SPACING.md,
    marginBottom:      4,
  },
  weekDay: {
    textAlign:  'center',
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.bold,
    color:      COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Grid
  grid: {
    flexDirection:    'row',
    flexWrap:         'wrap',
    paddingHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
  },
  cell: {
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
  },
  rangeBar: {
    position:        'absolute',
    top:             6,
    bottom:          6,
    backgroundColor: COLORS.primary + '20',
  },
  dayCircle: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.medium,
    color:      COLORS.textPrimary,
  },
  dayTextEndpoint: {
    color:      COLORS.white,
    fontFamily: FONTS.bold,
  },
  dayTextBetween: {
    color:      COLORS.primary,
    fontFamily: FONTS.bold,
  },

  // Range display
  rangeDisplay: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
    gap:              SPACING.xs,
  },
  rangeBox: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    backgroundColor: COLORS.background,
    borderRadius:  BORDER_RADIUS.md,
    borderWidth:   1,
    borderColor:   COLORS.border,
    padding:       SPACING.sm,
  },
  rangeBoxActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  rangeBoxLabel: {
    fontSize:   9,
    fontFamily: FONTS.bold,
    color:      COLORS.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rangeBoxValue: {
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
    marginTop:  1,
  },
  rangeBoxEmpty: {
    color:     COLORS.textMuted,
    fontFamily: FONTS.regular,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap:           SPACING.sm,
    padding:       SPACING.md,
    paddingTop:    SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  cancelBtn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius:   BORDER_RADIUS.md,
    borderWidth:    1,
    borderColor:    COLORS.border,
  },
  cancelText: {
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.medium,
    color:      COLORS.textSecondary,
  },
  applyBtn: {
    flex:           2,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    paddingVertical: 11,
    borderRadius:   BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  applyBtnDisabled: {
    backgroundColor: COLORS.divider,
  },
  applyText: {
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.bold,
    color:      COLORS.white,
  },
});
