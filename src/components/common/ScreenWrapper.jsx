/**
 * ScreenWrapper — drop-in replacement for SafeAreaView on any screen
 * that has text inputs / forms. Handles keyboard avoidance on both
 * iOS and Android so you don't have to repeat KeyboardAvoidingView
 * boilerplate on every screen.
 *
 * Usage:
 *   import ScreenWrapper from '@components/common/ScreenWrapper';
 *   <ScreenWrapper>  ...content...  </ScreenWrapper>
 *
 * Props:
 *   scroll={true}   → wraps children in a ScrollView (for long forms)
 *   edges           → SafeAreaView edges (default: ['top'])
 *   style           → override outer SafeAreaView style
 *   contentStyle    → passed to ScrollView's contentContainerStyle
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@constants/colors';

export default function ScreenWrapper({
  children,
  scroll = false,
  edges = ['top'],
  style,
  contentStyle,
}) {
  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={contentStyle}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
});
