/**
 * UpdateAdminPasswordModal — superuser sets a new password for an admin user.
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

const MIN_LENGTH = 6;

export default function UpdateAdminPasswordModal({ visible, userId, userName, onClose, onSuccess }) {
  const { updateAdminPassword, isMutating } = useUserStore();

  const [password, setPassword]   = useState('');
  const [confirm,  setConfirm]    = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [error,    setError]      = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const inputRef  = useRef(null);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setConfirm('');
      setError('');
      setShowPass(false);
      setTimeout(() => inputRef.current?.focus(), 300);
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
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      shake(); return false;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      shake(); return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setError('');
    if (!validate()) return;
    const result = await updateAdminPassword(userId, password);
    if (result.success) {
      onSuccess?.();
    } else {
      setError(result.message ?? 'Failed to update password.');
      shake();
    }
  };

  const passwordMatch = confirm.length > 0 && confirm === password;
  const canSubmit     = password.length >= MIN_LENGTH && confirm.length >= MIN_LENGTH && !isMutating;

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
            <Text style={styles.headerTitle}>Update Password</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
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
                <Icon name="lock-reset" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.heroName}>{userName}</Text>
              <Text style={styles.heroSub}>
                Set a new password for this admin. They will need to use it on their next login.
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

            {/* ── Fields ─────────────────────────────────── */}
            <View style={styles.card}>
              {/* New Password */}
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldLabel}>New Password</Text>
                <TouchableOpacity
                  onPress={() => setShowPass((p) => !p)}
                  style={styles.showToggle}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.showToggleText}>{showPass ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrap}>
                <Icon name="lock-outline" size={18} color={COLORS.textMuted} />
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(''); }}
                  placeholder={`Min ${MIN_LENGTH} characters`}
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.divider} />

              {/* Confirm Password */}
              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <View style={[styles.inputWrap, passwordMatch && styles.inputWrapMatch]}>
                <Icon
                  name="lock-check-outline"
                  size={18}
                  color={passwordMatch ? COLORS.success : COLORS.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={(v) => { setConfirm(v); setError(''); }}
                  placeholder="Re-enter password"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {passwordMatch && (
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
                  <Text style={styles.submitBtnText}>Update Password</Text>
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
    color:             COLORS.textSecondary,
    textAlign:         'center',
    lineHeight:        18,
    paddingHorizontal: SPACING.md,
  },

  errorBox: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: '#FEE2E2',
    borderRadius:    BORDER_RADIUS.md,
    padding:         SPACING.sm,
    marginBottom:    SPACING.md,
    borderWidth:     1,
    borderColor:     COLORS.error + '40',
  },
  errorText: { ...TYPOGRAPHY.small, color: COLORS.error, flex: 1 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    padding:         SPACING.md,
    marginBottom:    SPACING.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
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
    color:         COLORS.textSecondary,
    fontWeight:    '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom:  8,
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
    borderColor:     COLORS.success,
    backgroundColor: '#F0FDF4',
  },
  input: {
    flex:      1,
    height:    52,
    ...TYPOGRAPHY.body,
    color:     COLORS.textPrimary,
  },

  divider: {
    height:          1,
    backgroundColor: COLORS.divider,
    marginVertical:  SPACING.md,
  },

  submitBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: COLORS.primary,
    borderRadius:    BORDER_RADIUS.lg,
    height:          52,
    ...SHADOW.md,
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.border,
    elevation:       0,
    shadowOpacity:   0,
  },
  submitBtnText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.white, fontWeight: '700' },
});
