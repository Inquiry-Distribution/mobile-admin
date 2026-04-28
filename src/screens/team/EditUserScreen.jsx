/**
 * EditUserScreen
 *
 * Edit an existing user's profile.
 * Route params: { userId }  — fetches from selectedUser in store (already loaded by UserDetail).
 *
 * Fields: name, email, phone, employeeId, assignedArea, isActive
 * Password is NOT changed here — use SetPinModal on UserDetailScreen.
 * On success → navigate back with a toast.
 */

import React, { useState, useRef, useEffect } from 'react';
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
  Switch,
} from 'react-native';
import Toast     from 'react-native-toast-message';
import Icon      from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import useUserStore    from '@store/user.store';
import useAuthStore    from '@store/auth.store';
import useCompanyStore from '@store/company.store';
import CompanyPickerModal from '@components/team/CompanyPickerModal';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function FormField({
  label, value, onChangeText, placeholder,
  keyboardType = 'default', autoCapitalize = 'sentences',
  onSubmitEditing, returnKeyType = 'next',
  error, inputRef, editable = true, multiline = false,
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[
        styles.inputRow,
        error && styles.inputError,
        !editable && styles.inputDisabled,
        multiline && styles.inputMultiline,
      ]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, multiline && styles.inputMultilineText]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          editable={editable}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function ToggleRow({ label, subtitle, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {subtitle ? <Text style={styles.toggleSub}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.border, true: COLORS.primaryMid }}
        thumbColor={value ? COLORS.primary : COLORS.textMuted}
      />
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function EditUserScreen({ navigation, route }) {
  const { userId } = route.params ?? {};
  const isSuperuser = useAuthStore((s) => s.isSuperuser());

  const { selectedUser, updateUser, isMutating } = useUserStore();

  // Initialise form from selectedUser (already fetched by UserDetailScreen)
  const user = selectedUser;

  const [form, setForm] = useState({
    name:         user?.name                  ?? '',
    email:        user?.email                 ?? '',
    phone:        user?.phone                 ?? '',
    employeeId:   user?.employeeId            ?? '',
    assignedArea: user?.assignedArea          ?? '',
    isActive:     user?.isActive              ?? true,
    companyId:    user?.company?.id           ?? null,
    companyName:  user?.company?.name         ?? '',
  });
  const [errors, setErrors]       = useState({});
  const [pickerVisible, setPickerVisible] = useState(false);

  // If selectedUser changes (e.g. hot reload), re-sync
  useEffect(() => {
    if (user) {
      setForm({
        name:         user.name                ?? '',
        email:        user.email               ?? '',
        phone:        user.phone               ?? '',
        employeeId:   user.employeeId          ?? '',
        assignedArea: user.assignedArea        ?? '',
        isActive:     user.isActive            ?? true,
        companyId:    user.company?.id         ?? null,
        companyName:  user.company?.name       ?? '',
      });
    }
  }, [user?.id]);

  const patch = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  // ── Refs ────────────────────────────────────────────────────────
  const emailRef  = useRef();
  const phoneRef  = useRef();
  const empRef    = useRef();
  const areaRef   = useRef();

  // ── Validation ─────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.name.trim())  errs.name  = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;

    const id = userId ?? user?.id;
    if (!id) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'User ID missing' });
      return;
    }

    const payload = {
      name:     form.name.trim(),
      email:    form.email.trim().toLowerCase(),
      isActive: form.isActive,
    };
    if (form.phone.trim())        payload.phone        = form.phone.trim();
    if (form.employeeId.trim())   payload.employeeId   = form.employeeId.trim();
    if (form.assignedArea.trim()) payload.assignedArea = form.assignedArea.trim();
    payload.companyId = form.companyId ?? null;  // null = clear company

    const result = await updateUser(id, payload);

    if (result.success) {
      Toast.show({ type: 'success', text1: 'User updated', text2: `${payload.name} updated successfully` });
      navigation.goBack();
    } else {
      Toast.show({ type: 'error', text1: 'Update failed', text2: result.message });
    }
  };

  // ── Role badge (read-only — role change is a superuser admin action) ────────
  const roleBadgeColor = {
    sales:     { bg: '#DBEAFE', text: '#2563EB' },
    admin:     { bg: '#EDE9FE', text: '#7C3AED' },
    superuser: { bg: '#FEF3C7', text: '#D97706' },
  }[user?.role ?? 'sales'] ?? { bg: COLORS.background, text: COLORS.textSecondary };

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
        {/* ── Role (read-only) ───────────────────────────── */}
        {user?.role && (
          <View style={styles.roleCard}>
            <Icon name="shield-account-outline" size={18} color={roleBadgeColor.text} />
            <Text style={[styles.roleText, { color: roleBadgeColor.text }]}>
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </Text>
            <Text style={styles.roleNote}>Role cannot be changed here</Text>
          </View>
        )}

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
        </View>

        {/* ── Employment ─────────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle>Employment</SectionTitle>

          <FormField
            inputRef={empRef}
            label="Employee ID"
            value={form.employeeId}
            onChangeText={(v) => patch('employeeId', v)}
            placeholder="e.g. EMP-001"
            autoCapitalize="characters"
            returnKeyType="next"
            onSubmitEditing={() => areaRef.current?.focus()}
            error={errors.employeeId}
          />
          <FormField
            inputRef={areaRef}
            label="Assigned Area"
            value={form.assignedArea}
            onChangeText={(v) => patch('assignedArea', v)}
            placeholder="e.g. North Delhi"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            error={errors.assignedArea}
          />
        </View>

        {/* ── Company ────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle>Company</SectionTitle>
          <TouchableOpacity
            style={styles.pickerField}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.75}
          >
            <Icon name="domain" size={18} color={form.companyId ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.pickerText, !form.companyId && styles.pickerPlaceholder]} numberOfLines={1}>
              {form.companyName || 'Select company (optional)'}
            </Text>
            <Icon name="chevron-down" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Status ─────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle>Account Status</SectionTitle>
          <ToggleRow
            label={form.isActive ? 'Active' : 'Inactive'}
            subtitle={form.isActive
              ? 'User can log in and use the app'
              : 'User is blocked from logging in'}
            value={form.isActive}
            onValueChange={(v) => patch('isActive', v)}
          />
        </View>

        {/* ── Info note ──────────────────────────────────── */}
        <View style={styles.infoBox}>
          <Icon name="information-outline" size={16} color={COLORS.info} />
          <Text style={styles.infoText}>
            To change the user's PIN, use the "Set PIN" button on the User Detail screen.
          </Text>
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
                <Icon name="content-save-outline" size={20} color={COLORS.white} />
                <Text style={styles.submitText}>Save Changes</Text>
              </View>
            )
          }
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>

      <CompanyPickerModal
        visible={pickerVisible}
        selectedId={form.companyId}
        onSelect={(co) => {
          patch('companyId',   co.id);
          patch('companyName', co.name);
          setPickerVisible(false);
        }}
        onClear={() => {
          patch('companyId',   null);
          patch('companyName', '');
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
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

  // ── Role badge ─────────────────────────────────────────────────
  roleCard: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    backgroundColor: COLORS.surface,
    borderRadius:   10,
    padding:        12,
    borderWidth:    1,
    borderColor:    COLORS.border,
  },
  roleText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
  },
  roleNote: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.textMuted,
    marginLeft: 'auto',
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
  inputError:         { borderColor: COLORS.error },
  inputDisabled:      { backgroundColor: COLORS.background, opacity: 0.7 },
  inputMultiline:     { alignItems: 'flex-start', paddingVertical: 8 },
  inputMultilineText: { height: 72, textAlignVertical: 'top' },

  errorText: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.error,
    marginTop: 4,
  },

  // ── Company picker ─────────────────────────────────────────────
  pickerField: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    borderRadius:      10,
    backgroundColor:   COLORS.white,
    paddingHorizontal: 12,
    height:            44,
    marginBottom:      4,
  },
  pickerText:        { ...TYPOGRAPHY.body, color: COLORS.textPrimary, flex: 1 },
  pickerPlaceholder: { color: COLORS.textMuted },

  // ── Toggle ─────────────────────────────────────────────────────
  toggleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleInfo:  { flex: 1, paddingRight: 12 },
  toggleLabel: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color:      COLORS.textPrimary,
  },
  toggleSub: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textMuted,
    marginTop: 2,
  },

  // ── Info note ──────────────────────────────────────────────────
  infoBox: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             8,
    backgroundColor: '#EFF6FF',
    borderRadius:    10,
    padding:         12,
    borderWidth:     1,
    borderColor:     '#BFDBFE',
  },
  infoText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.info,
    flex:  1,
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
