/**
 * MoreMenuScreen — landing page for the "More" tab
 *
 * Menu items:
 *  • Live Map       → LiveMapScreen
 *  • Reports        → ReportsScreen
 *  • Notifications  → NotificationsScreen  (with unread badge)
 *  • Audit Log      → AuditLogScreen       (superuser only)
 *  • Profile        → ProfileScreen        (full-screen modal)
 *
 * Also shows a mini profile card at the top.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS, ROLE_COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { getInitials } from '@utils/helpers';

import useAuthStore from '@store/auth.store';

export default function MoreMenuScreen({ navigation }) {
  const { user, isSuperuser } = useAuthStore();

  const roleColor = ROLE_COLORS[user?.role] ?? { bg: COLORS.primaryLight, text: COLORS.primary };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Mini profile card ──────────────────────── */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.85}
        >
          <View style={[styles.profileAvatar, { backgroundColor: roleColor.bg }]}>
            <Text style={[styles.profileAvatarText, { color: roleColor.text }]}>
              {getInitials(user?.name ?? '')}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>{user?.name}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{user?.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
              <Text style={[styles.roleBadgeText, { color: roleColor.text }]}>
                {user?.role?.toUpperCase()}
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size={20} color={COLORS.border} />
        </TouchableOpacity>

        {/* ── Menu items ────────────────────────────── */}
        <View style={styles.menu}>

          <MenuItem
            icon="map-marker-multiple-outline"
            label="Live Map"
            subtitle="Salesperson locations in real-time"
            color="#059669"
            onPress={() => navigation.navigate('LiveMap')}
          />

          <MenuItem
            icon="chart-bar"
            label="Reports"
            subtitle="Inquiry & team analytics"
            color="#7C3AED"
            onPress={() => navigation.navigate('Reports')}
          />


          {isSuperuser() && (
            <MenuItem
              icon="shield-lock-outline"
              label="Audit Log"
              subtitle="Full system action history"
              color="#D97706"
              onPress={() => navigation.navigate('AuditLog')}
            />
          )}

          <MenuItem
            icon="chart-timeline-variant"
            label="Activity Log"
            subtitle="Salesperson interaction history"
            color="#7C3AED"
            onPress={() => navigation.navigate('ActivityLog')}
          />

          {isSuperuser() && (
            <MenuItem
              icon="message-alert-outline"
              label="Complaints & Suggestions"
              subtitle="Review feedback from salespersons"
              color="#DC2626"
              onPress={() => navigation.navigate('ComplaintList')}
            />
          )}

          <MenuItem
            icon="domain"
            label="Companies"
            subtitle="Manage company list"
            color="#0891B2"
            onPress={() => navigation.navigate('CompanyList')}
          />

          <MenuItem
            icon="map-marker-radius-outline"
            label="Office Locations"
            subtitle="Manage attendance geofence locations"
            color="#059669"
            onPress={() => navigation.navigate('BusinessLocationList')}
          />

          {isSuperuser() && (
            <MenuItem
              icon="cog-outline"
              label="System Config"
              subtitle="Login security & platform settings"
              color="#64748B"
              onPress={() => navigation.navigate('SystemConfig')}
            />
          )}

        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Menu item ─────────────────────────────────────────────────
function MenuItem({ icon, label, subtitle, color, badge, onPress }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.78}>
      <View style={[styles.menuIcon, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={22} color={color} />
      </View>

      <View style={styles.menuTexts}>
        <Text style={styles.menuLabel}>{label}</Text>
        {subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
      </View>

      {badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}

      <Icon name="chevron-right" size={18} color={COLORS.border} />
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xxl },

  // Profile card
  profileCard: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    backgroundColor:   COLORS.surface,
    margin:            SPACING.md,
    borderRadius:      BORDER_RADIUS.xl,
    padding:           SPACING.md,
    ...SHADOW.md,
  },
  profileAvatar: {
    width:          56,
    height:         56,
    borderRadius:   28,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  profileAvatarText: { fontSize: FONT_SIZE.xl, fontFamily: FONTS.bold },
  profileInfo:       { flex: 1 },
  profileName:       { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontFamily: FONTS.bold },
  profileEmail:      { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 4 },

  roleBadge: {
    alignSelf:         'flex-start',
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  roleBadgeText: {
    fontSize:      FONT_SIZE.xs,
    fontFamily:    FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Menu
  menu: {
    backgroundColor:   COLORS.surface,
    borderRadius:      BORDER_RADIUS.xl,
    marginHorizontal:  SPACING.md,
    overflow:          'hidden',
    ...SHADOW.sm,
  },

  menuItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  menuIcon: {
    width:          46,
    height:         46,
    borderRadius:   23,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },

  menuTexts: { flex: 1 },
  menuLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontFamily: FONTS.medium },
  menuSub:   { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 },

  badge: {
    minWidth:          20,
    height:            20,
    borderRadius:      10,
    backgroundColor:   COLORS.error,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: FONT_SIZE.xs, color: COLORS.white, fontFamily: FONTS.bold },
});
