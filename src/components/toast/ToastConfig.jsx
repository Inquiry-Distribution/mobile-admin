/**
 * ToastConfig — custom react-native-toast-message renderer (Admin App)
 *
 * Usage (unchanged everywhere in the app):
 *   Toast.show({ type: 'success', text1: 'Done',      text2: 'Item saved.'           })
 *   Toast.show({ type: 'error',   text1: 'Oops',      text2: 'Something went wrong.' })
 *   Toast.show({ type: 'info',    text1: 'Note',      text2: 'Check your inbox.'     })
 *   Toast.show({ type: 'warning', text1: 'Heads up',  text2: 'Low storage.'          })
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SPACING, BORDER_RADIUS } from '@constants/config';
import { FONTS, FONT_SIZE, LINE_HEIGHT } from '@constants/typography';

const SCREEN_W = Dimensions.get('window').width;

// ─── Per-type config ──────────────────────────────────────────
const TYPE = {
  success: {
    icon:    'check-circle',
    color:   '#16A34A',          // forest green
    bgLight: 'rgba(22,163,74,0.10)',
  },
  error: {
    icon:    'alert-circle',
    color:   '#DC2626',          // clear red
    bgLight: 'rgba(220,38,38,0.10)',
  },
  info: {
    icon:    'information',
    color:   '#7C3AED',          // admin violet brand colour
    bgLight: 'rgba(124,58,237,0.10)',
  },
  warning: {
    icon:    'alert',
    color:   '#D97706',          // warm amber
    bgLight: 'rgba(217,119,6,0.10)',
  },
};

// ─── Toast card ───────────────────────────────────────────────
function ToastCard({ type = 'info', text1, text2, onPress, hide }) {
  const cfg       = TYPE[type] ?? TYPE.info;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue:         1,
        useNativeDriver: true,
        damping:         16,
        stiffness:       220,
        mass:            0.75,
      }),
      Animated.timing(opacAnim, {
        toValue:         1,
        duration:        160,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity:     opacAnim,
          transform:   [{ scale: scaleAnim }],
          shadowColor: cfg.color,
        },
      ]}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: cfg.color }]} />

      {/* Main row */}
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.85}
        onPress={onPress}
      >
        {/* Coloured icon badge */}
        <View style={[styles.iconBadge, { backgroundColor: cfg.bgLight }]}>
          <Icon name={cfg.icon} size={22} color={cfg.color} />
        </View>

        {/* Text */}
        <View style={styles.textBlock}>
          {!!text1 && (
            <Text style={styles.title} numberOfLines={1}>{text1}</Text>
          )}
          {!!text2 && (
            <Text style={styles.body} numberOfLines={2}>{text2}</Text>
          )}
        </View>

        {/* Dismiss */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={hide}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="close" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Hairline bottom accent */}
      <View style={[styles.bottomLine, { backgroundColor: cfg.color }]} />
    </Animated.View>
  );
}

// ─── Exports ──────────────────────────────────────────────────
export const toastConfig = {
  success: (props) => <ToastCard {...props} type="success" />,
  error:   (props) => <ToastCard {...props} type="error"   />,
  info:    (props) => <ToastCard {...props} type="info"    />,
  warning: (props) => <ToastCard {...props} type="warning" />,
};

// ─── Styles ───────────────────────────────────────────────────
const CARD_W = Math.min(SCREEN_W - SPACING.md * 2, 420);

const styles = StyleSheet.create({
  card: {
    width:           CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius:    BORDER_RADIUS.xl,
    overflow:        'hidden',
    // Border
    borderWidth:     1,
    borderColor:     'rgba(0,0,0,0.07)',
    // Shadow
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.14,
    shadowRadius:    18,
    elevation:       8,
  },

  accentBar: {
    position:               'absolute',
    top:                    0,
    left:                   0,
    bottom:                 0,
    width:                  4,
    zIndex:                 2,
    borderTopLeftRadius:    BORDER_RADIUS.xl,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
  },

  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: SPACING.sm + 4,
    paddingLeft:     SPACING.md + 4,
    paddingRight:    SPACING.sm + 2,
    gap:             SPACING.sm + 2,
  },

  iconBadge: {
    width:          40,
    height:         40,
    borderRadius:   BORDER_RADIUS.lg,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },

  textBlock: {
    flex: 1,
    gap:  3,
  },

  title: {
    fontFamily:    FONTS.bold,
    fontSize:      FONT_SIZE.sm + 1,
    lineHeight:    LINE_HEIGHT.sm + 2,
    color:         '#111827',
    letterSpacing: 0.1,
  },

  body: {
    fontFamily: FONTS.regular,
    fontSize:   FONT_SIZE.sm - 1,
    lineHeight: LINE_HEIGHT.sm,
    color:      '#6B7280',
  },

  closeBtn: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: '#F3F4F6',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  bottomLine: {
    height:           2.5,
    opacity:          0.35,
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.xs,
    borderRadius:     BORDER_RADIUS.full,
  },
});
