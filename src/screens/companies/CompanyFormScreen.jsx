/**
 * CompanyFormScreen — Create & Edit
 *
 * route.params:
 *   • (none)              → Create mode
 *   • { companyId }       → Edit mode  (selected already set in store)
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS } from '@constants/config';
import useCompanyStore from '@store/company.store';

// ── Sub-components ────────────────────────────────────────────
function FormField({
  label, value, onChangeText, placeholder,
  keyboardType = 'default', returnKeyType = 'next',
  onSubmitEditing, inputRef, error,
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
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoCapitalize="sentences"
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────
export default function CompanyFormScreen({ navigation, route }) {
  const { companyId } = route.params ?? {};
  const isEdit = !!companyId;

  const { selected, createCompany, updateCompany, deleteCompany, isMutating } = useCompanyStore();

  const [form, setForm] = useState({
    name:    isEdit ? (selected?.name    ?? '') : '',
    address: isEdit ? (selected?.address ?? '') : '',
    phone:   isEdit ? (selected?.phone   ?? '') : '',
  });
  const [errors, setErrors] = useState({});

  // Re-sync if selected changes (e.g. hot reload)
  useEffect(() => {
    if (isEdit && selected) {
      setForm({
        name:    selected.name    ?? '',
        address: selected.address ?? '',
        phone:   selected.phone   ?? '',
      });
    }
  }, [selected?.id]);

  const patch = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const addressRef = useRef();
  const phoneRef   = useRef();

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Company name is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = { name: form.name.trim() };
    if (form.address.trim()) payload.address = form.address.trim();
    if (form.phone.trim())   payload.phone   = form.phone.trim();
    // Send empty string to clear optional fields when editing
    if (isEdit) {
      payload.address = form.address.trim() || null;
      payload.phone   = form.phone.trim()   || null;
    }

    const result = isEdit
      ? await updateCompany(companyId, payload)
      : await createCompany(payload);

    if (result.success) {
      Toast.show({
        type:  'success',
        text1: isEdit ? 'Company updated' : 'Company created',
        text2: result.data?.name,
      });
      navigation.goBack();
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: result.message });
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Company',
      `Delete "${selected?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteCompany(companyId);
            if (result.success) {
              Toast.show({ type: 'success', text1: 'Company deleted' });
              navigation.goBack();
            } else {
              Alert.alert('Cannot Delete', result.message);
            }
          },
        },
      ]
    );
  };

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
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Company Details</Text>

          <FormField
            label="Company Name *"
            value={form.name}
            onChangeText={(v) => patch('name', v)}
            placeholder="e.g. Acme Pvt. Ltd."
            returnKeyType="next"
            onSubmitEditing={() => addressRef.current?.focus()}
            error={errors.name}
          />
          <FormField
            inputRef={addressRef}
            label="Address"
            value={form.address}
            onChangeText={(v) => patch('address', v)}
            placeholder="e.g. 123 MG Road, Mumbai"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />
          <FormField
            inputRef={phoneRef}
            label="Phone"
            value={form.phone}
            onChangeText={(v) => patch('phone', v)}
            placeholder="e.g. 022-12345678"
            keyboardType="phone-pad"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.submitBtn, isMutating && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={isMutating}
          activeOpacity={0.85}
        >
          {isMutating
            ? <ActivityIndicator color={COLORS.white} />
            : (
              <View style={styles.btnInner}>
                <Icon name={isEdit ? 'content-save-outline' : 'domain-plus'} size={20} color={COLORS.white} />
                <Text style={styles.btnText}>{isEdit ? 'Save Changes' : 'Create Company'}</Text>
              </View>
            )
          }
        </TouchableOpacity>

        {/* ── Delete (edit mode only) ── */}
        {isEdit && (
          <TouchableOpacity
            style={[styles.deleteBtn, isMutating && styles.btnDisabled]}
            onPress={handleDelete}
            disabled={isMutating}
            activeOpacity={0.85}
          >
            <View style={styles.btnInner}>
              <Icon name="trash-can-outline" size={20} color={COLORS.error} />
              <Text style={[styles.btnText, { color: COLORS.error }]}>Delete Company</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: COLORS.background },
  scroll:    { flex: 1 },
  container: { padding: SPACING.md, gap: SPACING.sm },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    padding:         SPACING.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  sectionTitle: {
    ...TYPOGRAPHY.body,
    fontWeight:   '700',
    color:        COLORS.primary,
    marginBottom: SPACING.sm,
  },

  fieldWrap:  { marginBottom: SPACING.sm },
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
    paddingHorizontal: SPACING.sm,
    height:            44,
  },
  input: {
    flex:   1,
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
    backgroundColor: COLORS.primary,
    borderRadius:    BORDER_RADIUS.lg,
    height:          50,
    alignItems:      'center',
    justifyContent:  'center',
  },
  deleteBtn: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    height:          50,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     COLORS.error + '60',
  },
  btnDisabled: { opacity: 0.6 },
  btnInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  btnText: {
    ...TYPOGRAPHY.body,
    color:      COLORS.white,
    fontWeight: '700',
    fontSize:   16,
  },
});
