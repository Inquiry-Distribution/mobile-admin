/**
 * HolidayFormScreen — Add / Edit holiday
 *
 * route.params:
 *   { holiday: null }   → create
 *   { holiday: {...} }  → edit
 *
 * Fields: date (YYYY-MM-DD), name
 * Sundays are blocked — they are auto week-off.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { holidayApi } from '@api/holiday.api';

export default function HolidayFormScreen({ navigation, route }) {
  const existing = route.params?.holiday ?? null;
  const isEdit = !!existing;

  const [dateStr, setDateStr] = useState(
    existing?.date ?? dayjs().format('YYYY-MM-DD'),
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: isEdit ? 'Edit Holiday' : 'Add Holiday',
    });
  }, [isEdit, navigation]);

  const parsed = dayjs(dateStr);
  const isValidDate =
    /^\d{4}-\d{2}-\d{2}$/.test(dateStr) &&
    parsed.isValid() &&
    parsed.format('YYYY-MM-DD') === dateStr;
  const isSunday = isValidDate && parsed.day() === 0;

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (!dateStr.trim()) e.date = 'Date is required.';
    else if (!isValidDate) e.date = 'Use YYYY-MM-DD format.';
    else if (isSunday) e.date = 'Sunday is already week-off. Pick another day.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { date: dateStr.trim(), name: name.trim() };
      if (isEdit) {
        await holidayApi.update(existing.id, payload);
        Toast.show({ type: 'success', text1: 'Holiday updated' });
      } else {
        await holidayApi.create(payload);
        Toast.show({ type: 'success', text1: 'Holiday added' });
      }
      navigation.goBack();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2: err.message || 'Please try again',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={[styles.input, errors.date && styles.inputError]}
            value={dateStr}
            onChangeText={(t) => {
              setDateStr(t.trim());
              if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
            }}
            placeholder="2026-10-02"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
          {isValidDate && !isSunday ? (
            <Text style={styles.hint}>{parsed.format('dddd, DD MMMM YYYY')}</Text>
          ) : null}
          {errors.date ? <Text style={styles.errorText}>{errors.date}</Text> : null}

          {isSunday ? (
            <View style={styles.warnBox}>
              <Icon name="alert-circle-outline" size={16} color={COLORS.warning} />
              <Text style={styles.warnText}>
                Sundays are automatic week-off. Choose a weekday holiday instead.
              </Text>
            </View>
          ) : null}

          <Text style={[styles.label, { marginTop: SPACING.md }]}>Holiday name</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="e.g. Diwali, Independence Day"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="words"
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (saving || isSunday) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || isSunday}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Icon name="check" size={20} color={COLORS.white} />
              <Text style={styles.saveBtnText}>
                {isEdit ? 'Update Holiday' : 'Add Holiday'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  label: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontFamily: FONTS.bold,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  inputError: { borderColor: COLORS.error },
  hint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    marginTop: 4,
    fontFamily: FONTS.medium,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    marginTop: 4,
  },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.warning + '18',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  warnText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    flex: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 14,
    marginTop: SPACING.lg,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontSize: FONT_SIZE.md,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
});
