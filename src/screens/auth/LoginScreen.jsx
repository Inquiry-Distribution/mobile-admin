/**
 * LoginScreen — Admin & Superuser
 *
 * Credentials: email + password (web-panel login).
 * Role guard: rejects any account that isn't admin or superuser.
 * UX: shake animation on wrong password, per-field error routing.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }              from '@constants/colors';
import { TYPOGRAPHY, FONTS, FONT_SIZE, LINE_HEIGHT } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import useAuthStore   from '@store/auth.store';

export default function LoginScreen() {
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [emailError,    setEmailError]    = useState('');
  const [passwordError, setPasswordError] = useState('');

  const passwordRef = useRef(null);
  const shakeAnim   = useRef(new Animated.Value(0)).current;

  // ── Route backend errors to the right field ─────────────────
  useEffect(() => {
    if (!error) return;

    const emailMessages = [
      'not found', 'No account', 'inactive', 'Access denied',
      'email', 'user',
    ];
    const isEmailError = emailMessages.some((m) =>
      error.toLowerCase().includes(m.toLowerCase()),
    );

    if (isEmailError) {
      setEmailError(error);
    } else {
      setPasswordError(error);
      shake();
      setPassword('');
    }
    clearError();
  }, [error]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7,   duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // ── Validation ───────────────────────────────────────────────
  const validate = () => {
    let ok = true;
    if (!email.trim()) {
      setEmailError('Email is required.');
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Enter a valid email address.');
      ok = false;
    }
    if (!password) {
      setPasswordError('Password is required.');
      shake();
      ok = false;
    }
    return ok;
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!validate()) return;
    passwordRef.current?.blur();
    await login(email.trim().toLowerCase(), password);
  };

  const canLogin = email.trim().length > 0 && password.length > 0 && !isLoading;

  return (
    <SafeAreaView style={styles.safe}>
      {/* <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      > */}
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo / branding ─────────────────────────────── */}
          <View style={styles.header}>
            {/* Outer glow ring */}
            <View style={styles.logoRing}>
              <View style={styles.logoBox}>
                <Icon name="shield-account" size={28} color={COLORS.white} />
              </View>
            </View>
            <Text style={styles.appName}>Inquiry Desk</Text>
            <Text style={styles.appSub}>Admin Portal</Text>

            {/* Role badge strip */}
            <View style={styles.roleBadgeRow}>
              <View style={styles.roleBadge}>
                <Icon name="crown" size={10} color={COLORS.superuser} />
                <Text style={styles.roleBadgeText}>Superuser</Text>
              </View>
              <View style={styles.roleDivider} />
              <View style={[styles.roleBadge, { backgroundColor: COLORS.primaryLight }]}>
                <Icon name="shield-star-outline" size={10} color={COLORS.primary} />
                <Text style={[styles.roleBadgeText, { color: COLORS.primary }]}>Admin</Text>
              </View>
            </View>
          </View>

          {/* ── Login card ──────────────────────────────────── */}
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSub}>Enter your admin credentials to continue.</Text>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputWrap, emailError && styles.inputError]}>
                <Icon
                  name="email-outline"
                  size={18}
                  color={emailError ? COLORS.error : COLORS.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="admin@company.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setEmailError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  editable={!isLoading}
                />
                {email.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { setEmail(''); setEmailError(''); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              {emailError ? (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle-outline" size={12} color={COLORS.error} />
                  <Text style={styles.errorText}>{emailError}</Text>
                </View>
              ) : (
                <View style={styles.errorPH} />
              )}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrap, passwordError && styles.inputError]}>
                <Icon
                  name="lock-outline"
                  size={18}
                  color={passwordError ? COLORS.error : COLORS.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setPasswordError(''); }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((p) => !p)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {passwordError ? (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle-outline" size={12} color={COLORS.error} />
                  <Text style={styles.errorText}>{passwordError}</Text>
                </View>
              ) : (
                <View style={styles.errorPH} />
              )}
            </View>

            {/* Submit button */}
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>Signing in…</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.loginBtn, !canLogin && styles.loginBtnDisabled]}
                onPress={handleLogin}
                activeOpacity={0.85}
                disabled={!canLogin}
              >
                <Icon name="login-variant" size={18} color={COLORS.white} />
                <Text style={styles.loginBtnText}>Sign In</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* ── Footer note ─────────────────────────────────── */}
          <Text style={styles.footer}>
            This portal is restricted to Admin and Superuser accounts.{'\n'}
            Contact your system administrator for access.
          </Text>
        </ScrollView>
      {/* </KeyboardAvoidingView> */}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    justifyContent: 'center',
  },

  // ── Header ────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoRing: {
    width:           84,
    height:          84,
    borderRadius:    42,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    SPACING.sm,
    borderWidth:     2,
    borderColor:     COLORS.primaryMid,
  },
  logoBox: {
    width:           60,
    height:          60,
    borderRadius:    30,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW.md,
  },
  appName: {
    ...TYPOGRAPHY.h3,
    color:      COLORS.textPrimary,
    fontFamily: FONTS.bold,
    marginTop:  SPACING.xs,
  },
  appSub: {
    ...TYPOGRAPHY.small,
    color:      COLORS.textSecondary,
    marginTop:  2,
    marginBottom: SPACING.sm,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginTop:     4,
  },
  roleBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: COLORS.superuserLight,
    borderRadius:    BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  roleBadgeText: {
    fontSize:    FONT_SIZE.xs,
    fontFamily:  FONTS.bold,
    color:       COLORS.superuser,
  },
  roleDivider: {
    width:  1,
    height: 14,
    backgroundColor: COLORS.border,
  },

  // ── Card ──────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.xl,
    padding:         SPACING.lg,
    marginBottom:    SPACING.lg,
    ...SHADOW.md,
  },
  cardTitle: {
    ...TYPOGRAPHY.h3,
    color:        COLORS.textPrimary,
    fontFamily:   FONTS.bold,
    marginBottom: 4,
  },
  cardSub: {
    ...TYPOGRAPHY.small,
    color:        COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },

  // ── Field ─────────────────────────────────────────────────────
  fieldGroup:  { marginBottom: SPACING.xs },
  label: {
    ...TYPOGRAPHY.smallMedium,
    color:        COLORS.textSecondary,
    fontFamily:   FONTS.medium,
    marginBottom: SPACING.xs,
  },
  inputWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    borderWidth:     1.5,
    borderColor:     COLORS.border,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
  },
  inputError: {
    borderColor:     COLORS.error,
    backgroundColor: '#FFF5F5',
  },
  inputIcon: { marginRight: SPACING.xs },
  input: {
    flex:            1,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.body,
    color:           COLORS.textPrimary,
  },

  // ── Error rows ────────────────────────────────────────────────
  errorRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     5,
  },
  errorText: { ...TYPOGRAPHY.caption, color: COLORS.error },
  errorPH:   { height: 18 },

  // ── Button ────────────────────────────────────────────────────
  loginBtn: {
    marginTop:       SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius:    BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.xs,
    ...SHADOW.md,
  },
  loginBtnDisabled: {
    backgroundColor: COLORS.border,
    elevation: 0, shadowOpacity: 0,
  },
  loginBtnText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.white,
    fontFamily: FONTS.bold,
  },

  // ── Loading ───────────────────────────────────────────────────
  loadingRow: {
    marginTop:      SPACING.sm,
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  loadingText: { ...TYPOGRAPHY.body, color: COLORS.primary },

  // ── Footer ────────────────────────────────────────────────────
  footer: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textMuted,
    textAlign: 'center',
    lineHeight: LINE_HEIGHT.sm,
    paddingHorizontal: SPACING.md,
  },
});
