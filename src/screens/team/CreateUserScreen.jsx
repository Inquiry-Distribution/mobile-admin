/**
 * CreateUserScreen
 *
 * Form to add a new salesperson or admin.
 * - Admin can only create Sales role users
 * - Superuser can create Admin or Sales users
 *
 * Fields: name, email, phone, employeeId, role, password, confirmPassword
 * On success → navigate back to UserList with a toast.
 */

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
import Toast     from 'react-native-toast-message';
import Icon      from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import useUserStore   from '@store/user.store';
import useAuthStore   from '@store/auth.store';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function FormField({
  label, value, onChangeText, placeholder,
  keyboardType = 'default', autoCapitalize = 'sentences',
  secureTextEntry = false, onSubmitEditing, returnKeyType = 'next',
  error, inputRef, editable = true,
}) {
  const [show, setShow] = useState(false);
  const secure = secureTextEntry && !show;

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error && styles.inputError, !editable && styles.inputDisabled]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secure}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          editable={editable}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShow((v) => !v)} style={styles.eyeBtn}>
            <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function RoleChip({ label, value, selected, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CreateUserScreen({ navigation }) {
  const isSuperuser = useAuthStore((s) => s.isSuperuser());
  const { createUser, isMutating } = useUserStore();

  // ── Form state ─────────────────────────────────────────────────
  const [form, setForm] = useState({
    name:       '',
    email:      '',
    phone:      '',
    employeeId: '',
    role:       'sales',   // default: sales
    password:   '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});

  const patch = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  // ── Refs for focus chain ────────────────────────────────────────
  const emailRef    = useRef();
  const phoneRef    = useRef();
  const empRef      = useRef();
  const passRef     = useRef();
  const confPassRef = useRef();

  // ── Validation ─────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.name.trim())   errs.name  = 'Name is required';
    if (!form.email.trim())  errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.password)      errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = {
      name:       form.name.trim(),
      email:      form.email.trim().toLowerCase(),
      role:       form.role,
      password:   form.password,
    };
    if (form.phone.trim())      payload.phone      = form.phone.trim();
    if (form.employeeId.trim()) payload.employeeId = form.employeeId.trim();

    const result = await createUser(payload);

    if (result.success) {
      Toast.show({ type: 'success', text1: 'User created', text2: `${payload.name} added successfully` });
      navigation.goBack();
    } else {
      Toast.show({ type: 'error', text1: 'Failed to create user', text2: result.message });
    }
  };

  // ── Render ─────────────────────────────────────────────────────
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
        {/* ── Basic Info ─────────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle>Basic Info</SectionTitle>

          <FormField
            label="Full Name *"
            value={form.name}
            onChangeText={(v) => patch('name', v)}
            placeholder="e.g. Rahul Sharma"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            error={errors.name}
          />
          <FormField
            inputRef={emailRef}
            label="Email *"
            value={form.email}
            onChangeText={(v) => patch('email', v)}
            placeholder="e.g. rahul@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
            error={errors.email}
          />
          <FormField
            inputRef={phoneRef}
            label="Phone"
            value={form.phone}
            onChangeText={(v) => patch('phone', v)}
            placeholder="e.g. 9876543210"
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => empRef.current?.focus()}
            error={errors.phone}
          />
          <FormField
            inputRef={empRef}
            label="Employee ID"
            value={form.employeeId}
            onChangeText={(v) => patch('employeeId', v)}
            placeholder="e.g. EMP-001"
            autoCapitalize="characters"
            returnKeyType="next"
            onSubmitEditing={() => passRef.current?.focus()}
            error={errors.employeeId}
          />
        </View>

        {/* ── Role ───────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle>Role</SectionTitle>
          <View style={styles.chipRow}>
            <RoleChip
              label="Sales"
              value="sales"
              selected={form.role === 'sales'}
              onPress={() => patch('role', 'sales')}
            />
            <RoleChip
              label="Admin"
              value="admin"
              selected={form.role === 'admin'}
              onPress={() => patch('role', 'admin')}
              disabled={!isSuperuser}
            />
          </View>
          {!isSuperuser && (
            <Text style={styles.roleNote}>
              Admins can only create Sales users.
            </Text>
          )}
        </View>

        {/* ── Password ───────────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle>Set Password</SectionTitle>

          <FormField
            inputRef={passRef}
            label="Password *"
            value={form.password}
            onChangeText={(v) => patch('password', v)}
            placeholder="Min. 6 characters"
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confPassRef.current?.focus()}
            error={errors.password}
          />
          <FormField
            inputRef={confPassRef}
            label="Confirm Password *"
            value={form.confirmPassword}
            onChangeText={(v) => patch('confirmPassword', v)}
            placeholder="Re-enter password"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            error={errors.confirmPassword}
          />
        </View>

        {/* ── Submit ─────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.submitBtn, isMutating && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isMutating}
          activeOpacity={0.8}
        >
          {isMutating
            ? <ActivityIndicator color={COLORS.white} />
            : (
              <View style={styles.submitInner}>
                <Icon name="account-plus-outline" size={20} color={COLORS.white} />
                <Text style={styles.submitText}>Create User</Text>
              </View>
            )
          }
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },

  container: {
    padding: 16,
    gap:     12,
  },

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
    fontWeight:   '700',
    color:        COLORS.primary,
    marginBottom: 10,
  },

  // ── Field ──────────────────────────────────────────────────────
  fieldWrap: { marginBottom: 12 },

  label: {
    ...TYPOGRAPHY.caption,
    color:        COLORS.textSecondary,
    fontWeight:   '600',
    marginBottom: 6,
  },

  inputRow: {
    flexDirection:   'row',
    alignItems:      'center',
    borderWidth:     1.5,
    borderColor:     COLORS.border,
    borderRadius:    10,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
  },
  input: {
    flex:        1,
    height:      44,
    ...TYPOGRAPHY.body,
    color:       COLORS.textPrimary,
  },
  inputError:    { borderColor: COLORS.error },
  inputDisabled: { backgroundColor: COLORS.background, opacity: 0.7 },

  eyeBtn: { padding: 4 },

  errorText: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.error,
    marginTop: 4,
  },

  // ── Role chips ─────────────────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  4,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical:   8,
    borderRadius:      20,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    backgroundColor:   COLORS.background,
    height: 36,
  },
  chipSelected: {
    borderColor:     COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  chipDisabled: { opacity: 0.4 },
  chipText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color:      COLORS.textSecondary,
  },
  chipTextSelected: { color: COLORS.primary },

  roleNote: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },

  // ── Submit ─────────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius:    12,
    height:          50,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  submitText: {
    ...TYPOGRAPHY.body,
    color:      COLORS.white,
    fontWeight: '700',
    fontSize:   16,
  },

  bottomPad: { height: 32 },
});
