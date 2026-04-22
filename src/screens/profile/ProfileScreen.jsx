/**
 * ProfileScreen — admin / superuser account details
 *
 * Sections:
 *  • Hero — avatar, name, role badge
 *  • Account info — email, phone, employeeId, joined date
 *  • App info — version, socket status indicator
 *  • Danger zone — Logout
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS, ROLE_COLORS } from '@constants/colors';
import { TYPOGRAPHY }          from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { getInitials, formatDateTime }    from '@utils/helpers';

import useAuthStore from '@store/auth.store';

const APP_VERSION = '1.0.0'; // update with BuildConfig / DeviceInfo in production

export default function ProfileScreen({ navigation }) {
  const { user, logout, isSuperuser } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            await logout();
            // navigation reset is handled by RootNavigator watching auth state
          },
        },
      ],
    );
  };

  if (!user) return null;

  const roleColor = ROLE_COLORS[user.role] ?? { bg: COLORS.primaryLight, text: COLORS.primary };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Hero ────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={[styles.avatar, { backgroundColor: roleColor.bg }]}>
            <Text style={[styles.avatarText, { color: roleColor.text }]}>
              {getInitials(user.name)}
            </Text>
          </View>
          <Text style={styles.heroName}>{user.name}</Text>

          <View style={styles.heroBadges}>
            <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
              <Text style={[styles.roleBadgeText, { color: roleColor.text }]}>
                {user.role.toUpperCase()}
              </Text>
            </View>
            {isSuperuser() && (
              <View style={styles.superBadge}>
                <Icon name="crown" size={11} color='#D97706' />
                <Text style={styles.superBadgeText}>Superuser</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Account info ──────────────────────────── */}
        <SectionCard title="Account">
          <ProfileRow icon="email-outline"       label="Email"       value={user.email} />
          {user.phone ? (
            <ProfileRow icon="phone-outline"     label="Phone"       value={user.phone} />
          ) : null}
          {user.employeeId ? (
            <ProfileRow icon="badge-account-outline" label="Employee ID" value={user.employeeId} />
          ) : null}
          {user.assignedArea ? (
            <ProfileRow icon="map-marker-outline" label="Area"       value={user.assignedArea} />
          ) : null}
          <ProfileRow
            icon="calendar-outline"
            label="Joined"
            value={formatDateTime(user.createdAt)}
          />
        </SectionCard>

        {/* ── App info ──────────────────────────────── */}
        <SectionCard title="App">
          <ProfileRow icon="information-outline" label="Version" value={`v${APP_VERSION}`} />
          <ProfileRow icon="server-outline"      label="API"     value="Inquiry Desk API" />
        </SectionCard>

        {/* ── Danger zone ───────────────────────────── */}
        <SectionCard title="Session">
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <View style={styles.logoutIcon}>
              <Icon name="logout" size={18} color={COLORS.error} />
            </View>
            <Text style={styles.logoutText}>Sign Out</Text>
            <Icon name="chevron-right" size={18} color={COLORS.error} />
          </TouchableOpacity>
        </SectionCard>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Section card ──────────────────────────────────────────────
function SectionCard({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

// ── Profile row ───────────────────────────────────────────────
function ProfileRow({ icon, label, value }) {
  return (
    <View style={styles.profileRow}>
      <Icon name={icon} size={18} color={COLORS.textMuted} style={styles.profileRowIcon} />
      <View style={styles.profileRowTexts}>
        <Text style={styles.profileRowLabel}>{label}</Text>
        <Text style={styles.profileRowValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xxl },

  // Hero
  hero: {
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    paddingVertical:   SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    marginBottom:      SPACING.sm,
  },
  avatar: {
    width:          80,
    height:         80,
    borderRadius:   40,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   SPACING.sm,
    ...SHADOW.md,
  },
  avatarText: { fontSize: 28, fontWeight: '800' },
  heroName:   { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, fontWeight: '700', marginBottom: SPACING.sm },

  heroBadges: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },

  roleBadge: {
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  roleBadgeText: {
    fontSize:      10,
    fontWeight:    '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  superBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   '#FEF3C7',
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  superBadgeText: { fontSize: 10, fontWeight: '800', color: '#D97706' },

  // Section
  section: {
    marginTop:       SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth:  1,
    borderTopColor:  COLORS.divider,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    color:             COLORS.textMuted,
    fontWeight:        '700',
    textTransform:     'uppercase',
    letterSpacing:     0.5,
    paddingHorizontal: SPACING.md,
    paddingTop:        SPACING.md,
    paddingBottom:     SPACING.xs,
  },
  sectionBody: {},

  // Profile row
  profileRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  profileRowIcon:   { marginRight: SPACING.sm, marginTop: 2 },
  profileRowTexts:  { flex: 1 },
  profileRowLabel:  { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: 2 },
  profileRowValue:  { ...TYPOGRAPHY.body, color: COLORS.textPrimary },

  // Logout
  logoutBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical:   14,
  },
  logoutIcon: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: '#FEE2E2',
    alignItems:      'center',
    justifyContent:  'center',
  },
  logoutText: { ...TYPOGRAPHY.body, color: COLORS.error, fontWeight: '700', flex: 1 },
});
