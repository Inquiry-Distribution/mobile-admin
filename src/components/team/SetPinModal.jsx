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
  Alert,
  Animated,
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

  const [pin,     setLocalPin]    = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPin, setShowPin]     = useState(false);
  const [error,   setError]       = useState('');

  // Shake animation for error
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setLocalPin('');
      setConfirm('');
      setError('');
      setShowPin(false);
    }
  }, [visible]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const validate = () => {
    if (pin.length < PIN_MIN) {
      setError(`PIN must be at least ${PIN_MIN} digits.`);
      shake();
      return false;
    }
    if (pin !== confirm) {
      setError('PINs do not match.');
      shake();
      return false;
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* ── Header ──────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Set PIN</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* ── Body ────────────────────────────────────── */}
        <View style={styles.body}>

          {/* User indicator */}
          <View style={styles.userChip}>
            <Icon name="account-outline" size={16} color={COLORS.primary} />
            <Text style={styles.userChipText} numberOfLines={1}>{userName}</Text>
          </View>

          <Text style={styles.hint}>
            Set a {PIN_MIN}–{PIN_MAX} digit PIN for the salesperson to log in on their mobile device.
          </Text>

          {/* Animated error box */}
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            {error ? (
              <View style={styles.errorBox}>
                <Icon name="alert-circle-outline" size={15} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </Animated.View>

          {/* PIN input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New PIN</Text>
            <View style={styles.inputWrap}>
              <Icon name="lock-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                value={pin}
                onChangeText={(v) => { setLocalPin(v.replace(/\D/g, '').slice(0, PIN_MAX)); setError(''); }}
                placeholder={`Enter ${PIN_MIN}–${PIN_MAX} digit PIN`}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                maxLength={PIN_MAX}
              />
              <TouchableOpacity onPress={() => setShowPin((p) => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name={showPin ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* PIN strength dots */}
            <View style={styles.pinDots}>
              {Array.from({ length: PIN_MAX }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pinDot,
                    i < pin.length && styles.pinDotFilled,
                    i < PIN_MIN && i >= pin.length && { borderColor: COLORS.border },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Confirm PIN */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm PIN</Text>
            <View style={styles.inputWrap}>
              <Icon name="lock-check-outline" size={18} color={COLORS.textMuted} />
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
              {confirm.length > 0 && confirm === pin && (
                <Icon name="check-circle" size={18} color={COLORS.success} />
              )}
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (pin.length < PIN_MIN || !confirm || isMutating) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={pin.length < PIN_MIN || !confirm || isMutating}
            activeOpacity={0.85}
          >
            {isMutating ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Icon name="lock-check-outline" size={18} color={COLORS.white} />
                <Text style={styles.submitBtnText}>Save PIN</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor:   COLORS.surface,
  },
  closeBtn:    { padding: 4 },
  headerTitle: { ...TYPOGRAPHY.h4, color: COLORS.textPrimary, fontWeight: '700' },

  body: {
    flex:              1,
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.xl,
  },

  userChip: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'center',
    gap:               6,
    backgroundColor:   COLORS.primaryLight,
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
    marginBottom:      SPACING.md,
  },
  userChipText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.primary, fontWeight: '700' },

  hint: {
    ...TYPOGRAPHY.small,
    color:        COLORS.textSecondary,
    textAlign:    'center',
    marginBottom: SPACING.lg,
  },

  errorBox: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   '#FEE2E2',
    borderRadius:      BORDER_RADIUS.md,
    padding:           SPACING.sm,
    marginBottom:      SPACING.md,
    borderWidth:       1,
    borderColor:       COLORS.error + '40',
  },
  errorText: { ...TYPOGRAPHY.small, color: COLORS.error, flex: 1 },

  inputGroup: { marginBottom: SPACING.lg },

  inputLabel: {
    ...TYPOGRAPHY.smallMedium,
    color:        COLORS.textSecondary,
    fontWeight:   '600',
    marginBottom: 6,
  },

  inputWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.xs,
    backgroundColor:   COLORS.surface,
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   SPACING.xs,
  },

  input: {
    flex:              1,
    height:            44,
    ...TYPOGRAPHY.body,
    color:             COLORS.textPrimary,
    letterSpacing:     8,
    fontWeight:        '700',
  },

  // PIN strength dots
  pinDots: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    marginTop:      10,
    paddingLeft:    2,
  },
  pinDot: {
    width:        12,
    height:       12,
    borderRadius: 6,
    borderWidth:  2,
    borderColor:  COLORS.primary,
  },
  pinDotFilled: { backgroundColor: COLORS.primary },

  submitBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    backgroundColor:   COLORS.primary,
    borderRadius:      BORDER_RADIUS.lg,
    paddingVertical:   SPACING.md,
    marginTop:         SPACING.sm,
    ...SHADOW.md,
  },
  submitBtnDisabled: { backgroundColor: COLORS.border, elevation: 0, shadowOpacity: 0 },
  submitBtnText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.white, fontWeight: '700' },
});
