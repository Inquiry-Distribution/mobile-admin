/**
 * HolidayFormScreen — Add / Edit holiday
 *
 * Android: system date picker when RNCDatePicker is in the native binary.
 * Otherwise: JS calendar (no crash). Rebuild APK once to get native picker.
 *
 * Fields: date (YYYY-MM-DD), name — Sundays blocked (auto week-off).
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  NativeModules,
  TurboModuleRegistry,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { holidayApi } from '@api/holiday.api';
import DatePickerModal from '@components/common/DatePickerModal';

/** Use .get (not getEnforcing) so missing native module does not crash. */
function hasNativeDatePicker() {
  try {
    if (NativeModules.RNCDatePicker) return true;
    if (typeof TurboModuleRegistry?.get === 'function') {
      return !!TurboModuleRegistry.get('RNCDatePicker');
    }
  } catch (_) {
    // ignore
  }
  return false;
}

export default function HolidayFormScreen({ navigation, route }) {
  const existing = route.params?.holiday ?? null;
  const isEdit = !!existing;
  const nativePickerAvailable = useMemo(() => hasNativeDatePicker(), []);

  const [dateStr, setDateStr] = useState(
    existing?.date ?? dayjs().format('YYYY-MM-DD'),
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [showJsPicker, setShowJsPicker] = useState(false);

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
  const pickerValue = isValidDate ? parsed.toDate() : new Date();

  const applyDate = (next) => {
    setDateStr(next);
    if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
  };

  const openAndroidNativePicker = () => {
    DateTimePickerAndroid.open({
      value: pickerValue,
      mode: 'date',
      display: 'default',
      onChange: (event, selectedDate) => {
        if (event.type === 'dismissed') return;
        if (!selectedDate) return;
        applyDate(dayjs(selectedDate).format('YYYY-MM-DD'));
      },
    });
  };

  const onIosDateChange = (event, selectedDate) => {
    if (event?.type === 'dismissed') {
      setShowIosPicker(false);
      return;
    }
    if (!selectedDate) return;
    applyDate(dayjs(selectedDate).format('YYYY-MM-DD'));
  };

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      if (nativePickerAvailable) {
        openAndroidNativePicker();
      } else {
        setShowJsPicker(true);
      }
      return;
    }
    if (nativePickerAvailable) {
      setShowIosPicker(true);
    } else {
      setShowJsPicker(true);
    }
  };

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (!dateStr.trim()) e.date = 'Date is required.';
    else if (!isValidDate) e.date = 'Pick a valid date.';
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
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={[styles.dateBtn, errors.date && styles.inputError]}
            onPress={openDatePicker}
            activeOpacity={0.75}
          >
            <Icon name="calendar" size={20} color={COLORS.primary} />
            <View style={styles.dateBtnTextWrap}>
              <Text style={styles.dateBtnValue}>{dateStr || 'Select date'}</Text>
              {isValidDate && !isSunday ? (
                <Text style={styles.dateBtnHint}>
                  {parsed.format('dddd, DD MMMM YYYY')}
                </Text>
              ) : null}
            </View>
            <Icon name="chevron-down" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          {errors.date ? <Text style={styles.errorText}>{errors.date}</Text> : null}

          {!nativePickerAvailable ? (
            <Text style={styles.rebuildHint}>
              Using in-app calendar until you rebuild the app (native Android picker).
            </Text>
          ) : null}

          {Platform.OS === 'ios' && nativePickerAvailable && showIosPicker ? (
            <>
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display="spinner"
                onChange={onIosDateChange}
              />
              <TouchableOpacity
                style={styles.iosDoneBtn}
                onPress={() => setShowIosPicker(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.iosDoneText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : null}

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

      {!nativePickerAvailable ? (
        <DatePickerModal
          visible={showJsPicker}
          value={dateStr}
          onClose={() => setShowJsPicker(false)}
          onSelect={(next) => {
            applyDate(next);
            setShowJsPicker(false);
          }}
        />
      ) : null}
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
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  dateBtnTextWrap: { flex: 1 },
  dateBtnValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontFamily: FONTS.medium,
  },
  dateBtnHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    marginTop: 2,
    fontFamily: FONTS.medium,
  },
  rebuildHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  iosDoneBtn: {
    alignSelf: 'flex-end',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  iosDoneText: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.sm,
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
