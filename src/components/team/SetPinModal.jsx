/**
 * SetPinModal — set or reset a 4-6 digit PIN for a salesperson.
 *
 * Props:
 *  visible    boolean
 *  userId     string
 *  userName   string
 *  onClose    () => void
 *  onSuccess  () => void
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';

import useUserStore from '@store/user.store';

const PIN_MIN = 4;
const PIN_MAX = 6;

export default function SetPinModal({ visible, userId, userName, onClose, onSuccess }) {
  const { setPin, isMutating } = useUserStore();

  const [pin,     setLocalPin] = useState('');
  const [confirm, setConfirm]  = useState('');
  const [showPin, setShowPin]  = useState(false);
  const [error,   setError]    = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pinRef    = useRef(null);

  useEffect(() => {
    if (visible) {
      setLocalPin('');
      setConfirm('');
      setError('');
      setShowPin(false);
      setTimeout(() => pinRef.current?.focus(), 300);
    }
  }, [visible]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const validate = () => {
    if (pin.length < PIN_MIN) {
      setError(`PIN must be at least ${PIN_MIN} digits.`);
      shake(); return false;
    }
    if (pin !== confirm) {
      setError('PINs do not match.');
      shake(); return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setError('');
    if (!validate()) return;
    const result = await setPin(userId, pin);
    if (result.success) {
      onSuccess?.();
    } else {
      setError(result.message ?? 'Failed to set PIN.');
      shake();
    }
  };

  const pinMatch = confirm.length > 0 && confirm === pin;
  const canSubmit = pin.length >= PIN_MIN && confirm.length >= PIN_MIN && !isMutating;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ── Header ─────────────────────────────────── */}
          <View style={styles.header}>
            <View style={{ width: 36 }} />
            <Text style={styles.headerTitle}>Set PIN</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Hero ───────────────────────────────────── */}
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Icon name="lock-outline" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.heroName}>{userName}</Text>
              <Text style={styles.heroSub}>
                Set a {PIN_MIN}–{PIN_MAX} digit PIN for this salesperson to log in to the mobile app.
              </Text>
            </View>

            {/* ── Error ──────────────────────────────────── */}
            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              {error ? (
                <View style={styles.errorBox}>
                  <Icon name="alert-circle-outline" size={15} color={COLORS.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </Animated.View>

            {/* ── PIN input ──────────────────────────────── */}
            <View style={styles.card}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldLabel}>New PIN</Text>
                <TouchableOpacity
                  onPress={() => setShowPin((p) => !p)}
                  style={styles.showToggle}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name={showPin ? 'eye-off-outline' : 'eye-outline'} size={16} color={COLORS.primary} />
                  <Text style={styles.showToggleText}>{showPin ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrap}>
                <Icon name="lock-outline" size={18} color={COLORS.textMuted} />
                <TextInput
                  ref={pinRef}
                  style={styles.input}
                  value={pin}
                  onChangeText={(v) => { setLocalPin(v.replace(/\D/g, '').slice(0, PIN_MAX)); setError(''); }}
                  placeholder={`${PIN_MIN}–${PIN_MAX} digits`}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  secureTextEntry={!showPin}
                  maxLength={PIN_MAX}
                />
              </View>

              {/* PIN progress dots */}
              <View style={styles.dotsRow}>
                {Array.from({ length: PIN_MAX }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i < pin.length ? styles.dotFilled : null,
                      i === PIN_MIN - 1 ? styles.dotMinMark : null,
                    ]}
                  />
                ))}
                <Text style={styles.dotMinLabel}>min {PIN_MIN}</Text>
              </View>

              <View style={styles.divider} />

              {/* ── Confirm PIN ──────────────────────────── */}
              <Text style={styles.fieldLabel}>Confirm PIN</Text>
              <View style={[styles.inputWrap, pinMatch && styles.inputWrapMatch]}>
                <Icon
                  name="lock-check-outline"
                  size={18}
                  color={pinMatch ? COLORS.success : COLORS.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={(v) => { setConfirm(v.replace(/\D/g, '').slice(0, PIN_MAX)); setError(''); }}
                  placeholder="Re-enter PIN"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  secureTextEntry={!showPin}
                  maxLength={PIN_MAX}
                />
                {pinMatch && (
                  <Icon name="check-circle" size={18} color={COLORS.success} />
                )}
              </View>
            </View>

            {/* ── Submit ─────────────────────────────────── */}
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {isMutating ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Icon name="shield-lock-outline" size={18} color={COLORS.white} />
                  <Text style={styles.submitBtnText}>Save PIN</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  kav:  { flex: 1 },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitle: { ...TYPOGRAPHY.h4, color: COLORS.textPrimary, fontWeight: '700' },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: COLORS.background,
    alignItems:      'center',
    justifyContent:  'center',
  },

  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },

  // Hero
  hero: { alignItems: 'center', marginBottom: SPACING.lg },
  heroIcon: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    SPACING.sm,
    borderWidth:     2,
    borderColor:     COLORS.primaryMid,
  },
  heroName: {
    ...TYPOGRAPHY.h3,
    color:        COLORS.textPrimary,
    fontWeight:   '700',
    marginBottom: 6,
  },
  heroSub: {
    ...TYPOGRAPHY.small,
    color:     COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACING.md,
  },

  // Error
  errorBox: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    backgroundColor: '#FEE2E2',
    borderRadius:   BORDER_RADIUS.md,
    padding:        SPACING.sm,
    marginBottom:   SPACING.md,
    borderWidth:    1,
    borderColor:    COLORS.error + '40',
  },
  errorText: { ...TYPOGRAPHY.small, color: COLORS.error, flex: 1 },

  // Card
  card: {
    backgroundColor:   COLORS.surface,
    borderRadius:      BORDER_RADIUS.lg,
    padding:           SPACING.md,
    marginBottom:      SPACING.md,
    borderWidth:       1,
    borderColor:       COLORS.border,
    ...SHADOW.sm,
  },

  fieldHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  fieldLabel: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  showToggle: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  showToggleText: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.primary,
    fontWeight: '600',
  },

  inputWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    backgroundColor:   COLORS.background,
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACING.sm,
    height:            52,
  },
  inputWrapMatch: {
    borderColor: COLORS.success,
    backgroundColor: '#F0FDF4',
  },
  input: {
    flex:          1,
    height:        52,
    ...TYPOGRAPHY.h4,
    color:         COLORS.textPrimary,
    letterSpacing: 10,
    fontWeight:    '800',
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginTop:     12,
    marginBottom:  4,
  },
  dot: {
    width:        14,
    height:       14,
    borderRadius: 7,
    borderWidth:  2,
    borderColor:  COLORS.border,
    backgroundColor: COLORS.background,
  },
  dotFilled: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  dotMinMark: {
    borderColor: COLORS.primaryMid,
  },
  dotMinLabel: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.textMuted,
    marginLeft: 4,
    fontSize:   10,
  },

  divider: {
    height:          1,
    backgroundColor: COLORS.divider,
    marginVertical:  SPACING.md,
  },

  // Submit
  submitBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    backgroundColor: COLORS.primary,
    borderRadius:   BORDER_RADIUS.lg,
    height:         52,
    ...SHADOW.md,
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.border,
    elevation:       0,
    shadowOpacity:   0,
  },
  submitBtnText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.white, fontWeight: '700' },
});
