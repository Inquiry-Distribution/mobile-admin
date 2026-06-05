/**
 * SystemConfigScreen — superuser only
 *
 * Sections:
 *   • Attendance Hours — work start/end time, late grace period
 *   • Login Security   — brute-force lock settings
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Switch, TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY, FONTS, FONT_SIZE, LINE_HEIGHT } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { systemConfigApi } from '@api/systemConfig.api';

// ─────────────────────────────────────────────────────────────
export default function SystemConfigScreen() {
  const [loading,      setLoading]      = useState(true);
  const [loginSaving,  setLoginSaving]  = useState(false);
  const [attendSaving, setAttendSaving] = useState(false);

  // Login-limit fields
  const [enabled,        setEnabled]        = useState(true);
  const [maxAttempts,    setMaxAttempts]    = useState(5);
  const [lockoutMinutes, setLockoutMinutes] = useState(30);

  // Attendance hours fields
  const [workStartHour,   setWorkStartHour]   = useState(9);
  const [workStartMinute, setWorkStartMinute] = useState(30);
  const [workEndHour,     setWorkEndHour]     = useState(18);
  const [workEndMinute,   setWorkEndMinute]   = useState(0);
  const [lateGraceMinute, setLateGraceMinute] = useState(15);

  // GitHub token fields
  const [mobileTokenMasked,   setMobileTokenMasked]   = useState('');
  const [adminTokenMasked,    setAdminTokenMasked]     = useState('');
  const [mobileTokenSet,      setMobileTokenSet]       = useState(false);
  const [adminTokenSet,       setAdminTokenSet]        = useState(false);
  const [mobileTokenInput,    setMobileTokenInput]     = useState('');
  const [adminTokenInput,     setAdminTokenInput]      = useState('');
  const [mobileTokenVisible,  setMobileTokenVisible]   = useState(false);
  const [adminTokenVisible,   setAdminTokenVisible]    = useState(false);
  const [tokenSaving,         setTokenSaving]          = useState(null); // 'mobile' | 'mobile-admin' | null

  // ── Fetch ─────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [loginRes, attendRes, tokenRes] = await Promise.all([
        systemConfigApi.getLoginLimit(),
        systemConfigApi.getAttendanceHours(),
        systemConfigApi.getGithubToken(),
      ]);
      const lc = loginRes.data;
      setEnabled(lc.enabled);
      setMaxAttempts(lc.maxAttempts);
      setLockoutMinutes(lc.lockoutMinutes);

      const ac = attendRes.data;
      setWorkStartHour(ac.workStartHour   ?? 9);
      setWorkStartMinute(ac.workStartMinute ?? 30);
      setWorkEndHour(ac.workEndHour     ?? 18);
      setWorkEndMinute(ac.workEndMinute   ?? 0);
      setLateGraceMinute(ac.lateGraceMinute ?? 15);

      const tc = tokenRes.data;
      setMobileTokenSet(tc.mobileTokenSet);
      setMobileTokenMasked(tc.mobileTokenMasked);
      setAdminTokenSet(tc.adminTokenSet);
      setAdminTokenMasked(tc.adminTokenMasked);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to load config', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // ── Save GitHub token ─────────────────────────────────────
  const handleSaveToken = async (app) => {
    const input = app === 'mobile' ? mobileTokenInput : adminTokenInput;
    if (!input.trim()) {
      Toast.show({ type: 'error', text1: 'Token cannot be empty.' });
      return;
    }
    setTokenSaving(app);
    try {
      const res = await systemConfigApi.updateGithubToken({ app, token: input.trim() });
      const tc  = res.data;
      setMobileTokenSet(tc.mobileTokenSet);
      setMobileTokenMasked(tc.mobileTokenMasked);
      setAdminTokenSet(tc.adminTokenSet);
      setAdminTokenMasked(tc.adminTokenMasked);
      if (app === 'mobile')       setMobileTokenInput('');
      if (app === 'mobile-admin') setAdminTokenInput('');
      Toast.show({ type: 'success', text1: `${app} token updated` });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: e.message });
    } finally {
      setTokenSaving(null);
    }
  };

  // ── Save login limit ───────────────────────────────────────
  const handleSaveLogin = async () => {
    if (maxAttempts < 1 || maxAttempts > 20) {
      Toast.show({ type: 'error', text1: 'Max attempts must be 1–20.' });
      return;
    }
    if (lockoutMinutes < 1 || lockoutMinutes > 1440) {
      Toast.show({ type: 'error', text1: 'Lockout must be 1–1440 minutes.' });
      return;
    }
    setLoginSaving(true);
    try {
      await systemConfigApi.updateLoginLimit({ enabled, maxAttempts, lockoutMinutes });
      Toast.show({ type: 'success', text1: 'Login security saved' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: e.message });
    } finally {
      setLoginSaving(false);
    }
  };

  // ── Save attendance hours ──────────────────────────────────
  const handleSaveAttendance = async () => {
    const startTotal = workStartHour * 60 + workStartMinute;
    const endTotal   = workEndHour   * 60 + workEndMinute;
    if (endTotal <= startTotal) {
      Toast.show({ type: 'error', text1: 'End time must be after start time.' });
      return;
    }
    setAttendSaving(true);
    try {
      const pad       = (n) => String(n).padStart(2, '0');
      const workStart = `${pad(workStartHour)}:${pad(workStartMinute)}`;
      const workEnd   = `${pad(workEndHour)}:${pad(workEndMinute)}`;
      const res = await systemConfigApi.updateAttendanceHours({ workStart, workEnd, lateGraceMinute });
      Toast.show({ type: 'success', text1: 'Attendance hours saved' });
      if (res.data?.notice) {
        setTimeout(() => {
          Toast.show({ type: 'info', text1: 'Note', text2: res.data.notice, visibilityTime: 5000 });
        }, 800);
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: e.message });
    } finally {
      setAttendSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Attendance Hours section ── */}
        <SectionHeader icon="clock-time-nine-outline" title="Attendance Hours" color="#0891B2" />

        <View style={styles.card}>

          {/* Work start time */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Work Start Time</Text>
              <Text style={styles.rowSub}>Check-in deadline (HH : MM)</Text>
            </View>
            <TimePicker
              hour={workStartHour}
              minute={workStartMinute}
              onHourChange={setWorkStartHour}
              onMinuteChange={setWorkStartMinute}
            />
          </View>

          {/* Work end time */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Work End Time</Text>
              <Text style={styles.rowSub}>Early-exit threshold & auto-close cap</Text>
            </View>
            <TimePicker
              hour={workEndHour}
              minute={workEndMinute}
              onHourChange={setWorkEndHour}
              onMinuteChange={setWorkEndMinute}
            />
          </View>

          {/* Late grace */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Late Grace Period</Text>
              <Text style={styles.rowSub}>Minutes after start before marked late</Text>
            </View>
            <Stepper value={lateGraceMinute} min={0} max={59} onChange={setLateGraceMinute} suffix="min" />
          </View>

        </View>

        {/* Attendance summary pill */}
        <View style={styles.summaryPill}>
          <Icon name="information-outline" size={13} color="#0891B2" />
          <Text style={[styles.summaryText, { color: '#0891B2' }]}>
            Work hours: {String(workStartHour).padStart(2, '0')}:{String(workStartMinute).padStart(2, '0')} – {String(workEndHour).padStart(2, '0')}:{String(workEndMinute).padStart(2, '0')}.{' '}
            Late after {lateGraceMinute} min grace.{' '}
            Changes apply to future records only.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: '#0891B2' }, attendSaving && styles.saveBtnDisabled]}
          onPress={handleSaveAttendance}
          disabled={attendSaving}
          activeOpacity={0.85}
        >
          {attendSaving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Icon name="content-save-outline" size={20} color={COLORS.white} />
              <Text style={styles.saveBtnText}>Save Attendance Hours</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Login Security section ── */}
        <SectionHeader icon="shield-lock-outline" title="Login Security" color="#DC2626" />

        <View style={styles.card}>

          {/* Enable toggle */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Brute-force Protection</Text>
              <Text style={styles.rowSub}>
                Lock account after repeated failed login attempts
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
              thumbColor={enabled ? COLORS.primary : COLORS.textMuted}
            />
          </View>

          {/* Max attempts stepper */}
          <View style={[styles.row, styles.rowBorder, !enabled && styles.rowDisabled]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Max Attempts</Text>
              <Text style={styles.rowSub}>Failed logins before lockout</Text>
            </View>
            <Stepper
              value={maxAttempts}
              min={1}
              max={20}
              disabled={!enabled}
              onChange={setMaxAttempts}
            />
          </View>

          {/* Lockout duration stepper */}
          <View style={[styles.row, !enabled && styles.rowDisabled]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Lockout Duration</Text>
              <Text style={styles.rowSub}>Minutes account stays locked</Text>
            </View>
            <Stepper
              value={lockoutMinutes}
              min={1}
              max={1440}
              step={5}
              disabled={!enabled}
              onChange={setLockoutMinutes}
              suffix="min"
            />
          </View>

        </View>

        {/* Lockout summary pill */}
        {enabled && (
          <View style={styles.summaryPill}>
            <Icon name="information-outline" size={13} color={COLORS.primary} />
            <Text style={styles.summaryText}>
              After {maxAttempts} failed attempts, the account will be locked for {lockoutMinutes} minute{lockoutMinutes !== 1 ? 's' : ''}.
            </Text>
          </View>
        )}

        {/* ── Save login button ── */}
        <TouchableOpacity
          style={[styles.saveBtn, loginSaving && styles.saveBtnDisabled]}
          onPress={handleSaveLogin}
          disabled={loginSaving}
          activeOpacity={0.85}
        >
          {loginSaving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Icon name="content-save-outline" size={20} color={COLORS.white} />
              <Text style={styles.saveBtnText}>Save Login Security</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── GitHub Token section ── */}
        <SectionHeader icon="github" title="App Update Tokens" color="#1F2328" />

        <View style={styles.card}>

          {/* Mobile token */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Mobile App Token</Text>
              <Text style={styles.rowSub}>
                {mobileTokenSet
                  ? `Current: ${mobileTokenMasked}`
                  : 'Not set — update check will fail'}
              </Text>
            </View>
          </View>
          <View style={[styles.tokenInputRow, styles.rowBorder]}>
            <TextInput
              style={styles.tokenInput}
              value={mobileTokenInput}
              onChangeText={setMobileTokenInput}
              placeholder="Paste new GitHub token…"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!mobileTokenVisible}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.tokenEyeBtn}
              onPress={() => setMobileTokenVisible(v => !v)}
            >
              <Icon
                name={mobileTokenVisible ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tokenSaveBtn, (!mobileTokenInput.trim() || tokenSaving === 'mobile') && styles.tokenSaveBtnDisabled]}
              onPress={() => handleSaveToken('mobile')}
              disabled={!mobileTokenInput.trim() || tokenSaving === 'mobile'}
              activeOpacity={0.8}
            >
              {tokenSaving === 'mobile'
                ? <ActivityIndicator size={14} color={COLORS.white} />
                : <Icon name="content-save-outline" size={16} color={COLORS.white} />
              }
            </TouchableOpacity>
          </View>

          {/* Mobile-admin token */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Admin App Token</Text>
              <Text style={styles.rowSub}>
                {adminTokenSet
                  ? `Current: ${adminTokenMasked}`
                  : 'Not set — update check will fail'}
              </Text>
            </View>
          </View>
          <View style={styles.tokenInputRow}>
            <TextInput
              style={styles.tokenInput}
              value={adminTokenInput}
              onChangeText={setAdminTokenInput}
              placeholder="Paste new GitHub token…"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!adminTokenVisible}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.tokenEyeBtn}
              onPress={() => setAdminTokenVisible(v => !v)}
            >
              <Icon
                name={adminTokenVisible ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tokenSaveBtn, (!adminTokenInput.trim() || tokenSaving === 'mobile-admin') && styles.tokenSaveBtnDisabled]}
              onPress={() => handleSaveToken('mobile-admin')}
              disabled={!adminTokenInput.trim() || tokenSaving === 'mobile-admin'}
              activeOpacity={0.8}
            >
              {tokenSaving === 'mobile-admin'
                ? <ActivityIndicator size={14} color={COLORS.white} />
                : <Icon name="content-save-outline" size={16} color={COLORS.white} />
              }
            </TouchableOpacity>
          </View>

        </View>

        <View style={[styles.summaryPill, { backgroundColor: '#1F232818' }]}>
          <Icon name="information-outline" size={13} color="#1F2328" />
          <Text style={[styles.summaryText, { color: '#1F2328' }]}>
            Tokens are stored securely in the database and masked in the UI.
            Generate a fine-grained token with Contents: Read-only permission on GitHub.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Section header ────────────────────────────────────────────
function SectionHeader({ icon, title, color }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    </View>
  );
}

// ── TimePicker ────────────────────────────────────────────────
function TimePicker({ hour, minute, onHourChange, onMinuteChange }) {
  const decHour = () => onHourChange(hour <= 0  ? 23 : hour   - 1);
  const incHour = () => onHourChange(hour >= 23 ? 0  : hour   + 1);
  const decMin  = () => onMinuteChange(minute === 0  ? 55 : minute - 5);
  const incMin  = () => onMinuteChange(minute === 55 ? 0  : minute + 5);

  return (
    <View style={styles.timePicker}>
      {/* Hour drum */}
      <View style={styles.timeDrum}>
        <TouchableOpacity style={styles.timeChevronBtn} onPress={incHour} activeOpacity={0.6}>
          <Icon name="chevron-up" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={styles.timeValueBox}>
          <Text style={styles.timeValue}>{String(hour ?? 0).padStart(2, '0')}</Text>
        </View>
        <TouchableOpacity style={styles.timeChevronBtn} onPress={decHour} activeOpacity={0.6}>
          <Icon name="chevron-down" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.timeColon}>:</Text>

      {/* Minute drum */}
      <View style={styles.timeDrum}>
        <TouchableOpacity style={styles.timeChevronBtn} onPress={incMin} activeOpacity={0.6}>
          <Icon name="chevron-up" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={styles.timeValueBox}>
          <Text style={styles.timeValue}>{String(minute ?? 0).padStart(2, '0')}</Text>
        </View>
        <TouchableOpacity style={styles.timeChevronBtn} onPress={decMin} activeOpacity={0.6}>
          <Icon name="chevron-down" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Stepper ───────────────────────────────────────────────────
function Stepper({ value, min, max, step = 1, disabled, onChange, suffix }) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));

  return (
    <View style={[styles.stepper, disabled && styles.stepperDisabled]}>
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={dec}
        disabled={disabled || value <= min}
        activeOpacity={0.7}
      >
        <Icon
          name="minus"
          size={14}
          color={disabled || value <= min ? COLORS.border : COLORS.textSecondary}
        />
      </TouchableOpacity>

      <Text style={styles.stepValue}>
        {value}{suffix ? ` ${suffix}` : ''}
      </Text>

      <TouchableOpacity
        style={styles.stepBtn}
        onPress={inc}
        disabled={disabled || value >= max}
        activeOpacity={0.7}
      >
        <Icon
          name="plus"
          size={14}
          color={disabled || value >= max ? COLORS.border : COLORS.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Section header
  sectionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACING.xs,
    marginBottom:   SPACING.sm,
    marginTop:      SPACING.xs,
  },
  sectionIcon: {
    width:          30,
    height:         30,
    borderRadius:   15,
    alignItems:     'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontFamily:    FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize:      FONT_SIZE.xs,
  },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.xl,
    marginBottom:    SPACING.sm,
    overflow:        'hidden',
    ...SHADOW.sm,
  },

  // Row
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    gap:               SPACING.sm,
  },
  rowBorder:   { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  rowDisabled: { opacity: 0.4 },
  rowLeft:     { flex: 1 },
  rowLabel: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textPrimary,
    fontFamily: FONTS.medium,
    marginBottom: 2,
  },
  rowSub: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  // Summary pill
  summaryPill: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               6,
    backgroundColor:   COLORS.primaryLight,
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1,
    borderColor:       COLORS.primary + '30',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    marginBottom:      SPACING.lg,
  },
  summaryText: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.primary,
    flex:       1,
    lineHeight: LINE_HEIGHT.sm,
  },

  // TimePicker
  timePicker: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  timeDrum: {
    alignItems:      'center',
    backgroundColor: COLORS.background,
    borderRadius:    BORDER_RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.border,
    overflow:        'hidden',
    minWidth:        52,
  },
  timeChevronBtn: {
    width:          52,
    height:         32,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  timeValueBox: {
    borderTopWidth:    1,
    borderBottomWidth: 1,
    borderColor:       COLORS.border,
    width:             52,
    paddingVertical:   8,
    alignItems:        'center',
    backgroundColor:   COLORS.background,
  },
  timeValue: {
    fontSize:   FONT_SIZE.lg,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
    letterSpacing: 1,
  },
  timeColon: {
    fontSize:     FONT_SIZE.xl,
    fontFamily:   FONTS.bold,
    color:        COLORS.textSecondary,
    marginBottom: 2,
    paddingHorizontal: 2,
  },

  // Stepper
  stepper: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.background,
    borderRadius:    BORDER_RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    overflow:        'hidden',
  },
  stepperDisabled: { opacity: 0.4 },
  stepBtn: {
    width:          34,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  stepValue: {
    ...TYPOGRAPHY.bodyMedium,
    color:       COLORS.textPrimary,
    fontFamily:  FONTS.bold,
    minWidth:    52,
    textAlign:   'center',
    paddingHorizontal: 4,
  },

  // Token input row
  tokenInputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    gap:               SPACING.xs,
  },
  tokenInput: {
    flex:              1,
    height:            40,
    borderWidth:       1,
    borderColor:       COLORS.border,
    borderRadius:      BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor:   COLORS.background,
    color:             COLORS.textPrimary,
    fontSize:          13,
    fontFamily:        FONTS.regular,
  },
  tokenEyeBtn: {
    width:          36,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
  },
  tokenSaveBtn: {
    width:           40,
    height:          40,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  tokenSaveBtnDisabled: {
    backgroundColor: COLORS.primaryMid || COLORS.border,
  },

  // Save button
  saveBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.sm,
    height:          52,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    marginTop:       SPACING.sm,
    ...SHADOW.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontSize:   FONT_SIZE.md,
    fontFamily: FONTS.bold,
    color:      COLORS.white,
  },
});
