/**
 * SystemConfigScreen — superuser only
 *
 * Sections:
 *   • Login Security  — brute-force lock settings
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Switch, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { systemConfigApi } from '@api/systemConfig.api';

// ─────────────────────────────────────────────────────────────
export default function SystemConfigScreen() {
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Login-limit fields
  const [enabled,        setEnabled]        = useState(true);
  const [maxAttempts,    setMaxAttempts]    = useState(5);
  const [lockoutMinutes, setLockoutMinutes] = useState(30);

  // ── Fetch ─────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await systemConfigApi.getLoginLimit();
      const cfg = res.data;
      setEnabled(cfg.enabled);
      setMaxAttempts(cfg.maxAttempts);
      setLockoutMinutes(cfg.lockoutMinutes);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to load config', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (maxAttempts < 1 || maxAttempts > 20) {
      Toast.show({ type: 'error', text1: 'Max attempts must be 1–20.' });
      return;
    }
    if (lockoutMinutes < 1 || lockoutMinutes > 1440) {
      Toast.show({ type: 'error', text1: 'Lockout must be 1–1440 minutes.' });
      return;
    }
    setSaving(true);
    try {
      await systemConfigApi.updateLoginLimit({ enabled, maxAttempts, lockoutMinutes });
      Toast.show({ type: 'success', text1: 'Settings saved' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: e.message });
    } finally {
      setSaving(false);
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

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Icon name="content-save-outline" size={20} color={COLORS.white} />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>

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
    fontWeight:    '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize:      12,
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
    paddingVertical:   SPACING.md,
    gap:               SPACING.sm,
  },
  rowBorder:   { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  rowDisabled: { opacity: 0.4 },
  rowLeft:     { flex: 1 },
  rowLabel: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textPrimary,
    fontWeight: '600',
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
    lineHeight: 17,
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
    fontWeight:  '700',
    minWidth:    52,
    textAlign:   'center',
    paddingHorizontal: 4,
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
    fontSize:   16,
    fontWeight: '700',
    color:      COLORS.white,
  },
});
