import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, FONTS } from '@constants/typography';
import useAuthStore   from '@store/auth.store';

// ─── Shared sub-components ────────────────────────────────────

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function FormField({
  label, value, onChangeText, placeholder,
  keyboardType = 'default', autoCapitalize = 'sentences',
  secureTextEntry = false, onSubmitEditing, returnKeyType = 'next',
  error, inputRef, rightIcon,
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error && styles.inputError]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
        />
        {rightIcon}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function SubmitButton({ label, icon, loading, onPress, color }) {
  return (
    <TouchableOpacity
      style={[styles.submitBtn, { backgroundColor: color ?? COLORS.primary }, loading && styles.submitBtnDisabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={COLORS.white} />
        : (
          <View style={styles.submitInner}>
            <Icon name={icon} size={20} color={COLORS.white} />
            <Text style={styles.submitText}>{label}</Text>
          </View>
        )
      }
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function EditProfileScreen({ navigation }) {
  const { user, updateProfile, changePassword } = useAuthStore();

  // ── Profile form ─────────────────────────────────────────────
  const [profile, setProfile]         = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [profileErrors, setProfileErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const phoneRef = useRef();

  const patchProfile = (key, val) => {
    setProfile((f) => ({ ...f, [key]: val }));
    if (profileErrors[key]) setProfileErrors((e) => ({ ...e, [key]: '' }));
  };

  const validateProfile = () => {
    const errs = {};
    if (!profile.name.trim()) errs.name = 'Name is required';
    setProfileErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) return;
    setSavingProfile(true);
    const payload = { name: profile.name.trim() };
    if (profile.phone.trim()) payload.phone = profile.phone.trim();
    const result = await updateProfile(payload);
    setSavingProfile(false);
    if (result.success) {
      Toast.show({ type: 'success', text1: 'Profile updated' });
      navigation.goBack();
    } else {
      Toast.show({ type: 'error', text1: 'Update failed', text2: result.message });
    }
  };

  // ── Password form ─────────────────────────────────────────────
  const [pw, setPw]                   = useState({ oldPassword: '', password: '', confirm: '' });
  const [pwErrors, setPwErrors]       = useState({});
  const [savingPw, setSavingPw]       = useState(false);
  const [showOldPw, setShowOldPw]     = useState(false);
  const [showPw, setShowPw]           = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const newPwRef  = useRef();
  const confirmRef = useRef();

  const patchPw = (key, val) => {
    setPw((f) => ({ ...f, [key]: val }));
    if (pwErrors[key]) setPwErrors((e) => ({ ...e, [key]: '' }));
  };

  const validatePw = () => {
    const errs = {};
    if (!pw.oldPassword)                  errs.oldPassword = 'Current password is required';
    if (!pw.password)                     errs.password    = 'New password is required';
    else if (pw.password.length < 6)      errs.password    = 'Minimum 6 characters';
    else if (pw.password === pw.oldPassword) errs.password = 'New password must differ from current';
    if (!pw.confirm)                      errs.confirm     = 'Please confirm the password';
    else if (pw.confirm !== pw.password)  errs.confirm     = 'Passwords do not match';
    setPwErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validatePw()) return;
    setSavingPw(true);
    const result = await changePassword(pw.password, pw.oldPassword);
    setSavingPw(false);
    if (result.success) {
      Toast.show({ type: 'success', text1: 'Password updated' });
      setPw({ oldPassword: '', password: '', confirm: '' });
    } else {
      Toast.show({ type: 'error', text1: 'Failed', text2: result.message });
    }
  };

  // ─────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Edit Profile ──────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle>Edit Profile</SectionTitle>

          <FormField
            label="Full Name *"
            value={profile.name}
            onChangeText={(v) => patchProfile('name', v)}
            placeholder="Your full name"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
            error={profileErrors.name}
          />
          <FormField
            inputRef={phoneRef}
            label="Phone"
            value={profile.phone}
            onChangeText={(v) => patchProfile('phone', v)}
            placeholder="e.g. 9876543210"
            keyboardType="phone-pad"
            returnKeyType="done"
            onSubmitEditing={handleSaveProfile}
            error={profileErrors.phone}
          />

          <SubmitButton
            label="Save Profile"
            icon="content-save-outline"
            loading={savingProfile}
            onPress={handleSaveProfile}
          />
        </View>

        {/* ── Change Password ───────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle>Change Password</SectionTitle>

          <FormField
            label="Current Password *"
            value={pw.oldPassword}
            onChangeText={(v) => patchPw('oldPassword', v)}
            placeholder="Enter current password"
            autoCapitalize="none"
            secureTextEntry={!showOldPw}
            returnKeyType="next"
            onSubmitEditing={() => newPwRef.current?.focus()}
            error={pwErrors.oldPassword}
            rightIcon={
              <TouchableOpacity onPress={() => setShowOldPw((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name={showOldPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            }
          />
          <FormField
            inputRef={newPwRef}
            label="New Password *"
            value={pw.password}
            onChangeText={(v) => patchPw('password', v)}
            placeholder="Minimum 6 characters"
            autoCapitalize="none"
            secureTextEntry={!showPw}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            error={pwErrors.password}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            }
          />
          <FormField
            inputRef={confirmRef}
            label="Confirm Password *"
            value={pw.confirm}
            onChangeText={(v) => patchPw('confirm', v)}
            placeholder="Re-enter new password"
            autoCapitalize="none"
            secureTextEntry={!showConfirm}
            returnKeyType="done"
            onSubmitEditing={handleChangePassword}
            error={pwErrors.confirm}
            rightIcon={
              <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            }
          />

          <SubmitButton
            label="Update Password"
            icon="lock-reset"
            loading={savingPw}
            onPress={handleChangePassword}
            color={COLORS.primaryDark ?? COLORS.primary}
          />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  container: { padding: 16, gap: 12 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    12,
    padding:         16,
    gap:             4,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },

  sectionTitle: {
    ...TYPOGRAPHY.body,
    fontFamily:   FONTS.bold,
    color:        COLORS.primary,
    marginBottom: 10,
  },

  fieldWrap:  { marginBottom: 12 },
  label: {
    ...TYPOGRAPHY.caption,
    color:        COLORS.textSecondary,
    fontFamily:   FONTS.medium,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    borderRadius:      10,
    backgroundColor:   COLORS.white,
    paddingHorizontal: 12,
  },
  input: {
    flex:   1,
    height: 44,
    ...TYPOGRAPHY.body,
    color:  COLORS.textPrimary,
  },
  inputError: { borderColor: COLORS.error },
  errorText: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.error,
    marginTop: 4,
  },

  submitBtn: {
    borderRadius:    12,
    height:          50,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitText: {
    ...TYPOGRAPHY.body,
    color:      COLORS.white,
    fontFamily: FONTS.bold,
    fontSize:   FONT_SIZE.md,
  },

  bottomPad: { height: 32 },
});
