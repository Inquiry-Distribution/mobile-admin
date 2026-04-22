import { Platform } from 'react-native';

// ─── Font families ────────────────────────────────────────────
export const FONTS = {
  regular: Platform.OS === 'ios' ? 'System' : 'Roboto-Regular',
  medium:  Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  bold:    Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
};

// ─── Scale ────────────────────────────────────────────────────
export const FONT_SIZE = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  xxxl: 30,
};

export const LINE_HEIGHT = {
  xs:  16,
  sm:  18,
  md:  22,
  lg:  24,
  xl:  28,
  xxl: 32,
};

// ─── Pre-built text styles ────────────────────────────────────
export const TYPOGRAPHY = {
  // Headings
  h1: {
    fontSize:   FONT_SIZE.xxxl,
    fontFamily: FONTS.bold,
    lineHeight: LINE_HEIGHT.xxl,
  },
  h2: {
    fontSize:   FONT_SIZE.xxl,
    fontFamily: FONTS.bold,
    lineHeight: LINE_HEIGHT.xl,
  },
  h3: {
    fontSize:   FONT_SIZE.xl,
    fontFamily: FONTS.bold,
    lineHeight: LINE_HEIGHT.lg,
  },
  h4: {
    fontSize:   FONT_SIZE.lg,
    fontFamily: FONTS.medium,
    lineHeight: LINE_HEIGHT.lg,
  },

  // Body
  body: {
    fontSize:   FONT_SIZE.md,
    fontFamily: FONTS.regular,
    lineHeight: LINE_HEIGHT.md,
  },
  bodyMedium: {
    fontSize:   FONT_SIZE.md,
    fontFamily: FONTS.medium,
    lineHeight: LINE_HEIGHT.md,
  },
  bodyBold: {
    fontSize:   FONT_SIZE.md,
    fontFamily: FONTS.bold,
    lineHeight: LINE_HEIGHT.md,
  },

  // Small
  small: {
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.regular,
    lineHeight: LINE_HEIGHT.sm,
  },
  smallMedium: {
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.medium,
    lineHeight: LINE_HEIGHT.sm,
  },
  smallBold: {
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.bold,
    lineHeight: LINE_HEIGHT.sm,
  },

  // Caption / label
  caption: {
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.regular,
    lineHeight: LINE_HEIGHT.xs,
  },
  captionMedium: {
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.medium,
    lineHeight: LINE_HEIGHT.xs,
  },
};
