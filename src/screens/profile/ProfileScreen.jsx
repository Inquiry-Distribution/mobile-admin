/**
 * ProfileScreen — admin / superuser account details
 *
 * Sections:
 *  • Hero — avatar, name, role badge
 *  • Account info — email, phone, employeeId, joined date
 *  • App info — version, API
 *  • Session — Logout
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS, ROLE_COLORS }               from '@constants/colors';
import { TYPOGRAPHY, FONTS, FONT_SIZE }        from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW, CONFIG } from '@constants/config';
import { getInitials, formatDateTime }        from '@utils/helpers';
import DeviceInfo  from 'react-native-device-info';
import useAuthStore from '@store/auth.store';

export default function ProfileScreen({ navigation }) {
  const { user, logout, isSuperuser } = useAuthStore();

  const [updateStatus, setUpdateStatus]     = useState('idle'); // idle | checking | upToDate | available | downloading
  const [latestRelease, setLatestRelease]   = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const checkForUpdate = async () => {
    setUpdateStatus('checking');
    try {
      const res  = await fetch(`${CONFIG.API_BASE_URL}/system-config/app-version?app=mobile-admin`);
      const json = await res.json();
      const data = json.data;
      const latestCode  = data.versionCode;
      const currentCode = parseInt(DeviceInfo.getVersion().split('.')[0], 10);
      if (latestCode > currentCode) {
        setLatestRelease(data);
        setUpdateStatus('available');
      } else {
        setUpdateStatus('upToDate');
      }
    } catch (_) {
      setUpdateStatus('idle');
      Alert.alert('Error', 'Could not check for updates. Try again later.');
    }
  };

  const startUpdate = async () => {
    if (!latestRelease) return;
    const url = latestRelease.apkUrl;
    if (!url) return;

    setUpdateStatus('downloading');
    setDownloadProgress(0);
    try {
      const destPath = `${RNBlobUtil.fs.dirs.DownloadDir}/inquiry-admin-update-${latestRelease.version}.apk`;
      const res = await RNBlobUtil.config({
        fileCache: true,
        path:      destPath,
        indicator: true,
        overwrite: true,
      })
        .fetch('GET', url)
        .progress((received, total) => {
          setDownloadProgress(Math.round((received / total) * 100));
        });

      await RNBlobUtil.android.actionViewIntent(
        res.path(),
        'application/vnd.android.package-archive',
      );
      setUpdateStatus('available');
      setDownloadProgress(0);
    } catch (_) {
      setUpdateStatus('available');
      setDownloadProgress(0);
      Alert.alert('Error', 'Download failed. Please try again.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:    'Sign Out',
          style:   'destructive',
          onPress: () => logout(),
        },
      ],
    );
  };

  if (!user) return null;

  const isSU       = isSuperuser();
  const roleColor  = ROLE_COLORS[user.role] ?? { bg: COLORS.primaryLight, text: COLORS.primary };

  return (
    // edges=['bottom'] only — navigator header already handles the top safe area
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* ── Hero ────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={[styles.avatar, { backgroundColor: roleColor.bg }]}>
            <Text style={[styles.avatarText, { color: roleColor.text }]}>
              {getInitials(user.name)}
            </Text>
          </View>

          <Text style={styles.heroName}>{user.name}</Text>

          {/* Single badge — crown icon for superuser, plain for admin */}
          <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
            {isSU && (
              <Icon name="crown" size={11} color={roleColor.text} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.roleBadgeText, { color: roleColor.text }]}>
              {user.role.toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.75}
          >
            <Icon name="pencil-outline" size={15} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* ── Account ───────────────────────────────── */}
        <SectionCard title="Account">
          <ProfileRow icon="email-outline"          label="Email"       value={user.email} />
          {user.phone && (
            <ProfileRow icon="phone-outline"        label="Phone"       value={user.phone} />
          )}
          {user.employeeId && (
            <ProfileRow icon="badge-account-outline" label="Employee ID" value={user.employeeId} />
          )}
          {user.assignedArea && (
            <ProfileRow icon="map-marker-outline"   label="Area"        value={user.assignedArea} />
          )}
          <ProfileRow
            icon="calendar-outline"
            label="Joined"
            value={formatDateTime(user.createdAt)}
          />
        </SectionCard>

        {/* ── App ───────────────────────────────────── */}
        <SectionCard title="App">
          <View style={styles.profileRow}>
            <View style={styles.profileRowIconWrap}>
              <Icon name="information-outline" size={18} color={COLORS.textMuted} />
            </View>
            <View style={styles.profileRowTexts}>
              <Text style={styles.profileRowLabel}>Version</Text>
              <Text style={styles.profileRowValue}>{`v${DeviceInfo.getVersion()}`}</Text>
            </View>

            {updateStatus === 'available' && (
              <TouchableOpacity style={styles.updateBtn} onPress={startUpdate} activeOpacity={0.8}>
                <Icon name="download-outline" size={13} color={COLORS.white} />
                <Text style={styles.updateBtnText}>{latestRelease?.version} — Install</Text>
              </TouchableOpacity>
            )}

            {updateStatus === 'downloading' && (
              <View style={styles.progressWrap}>
                <View style={[styles.progressBar, { width: `${downloadProgress}%` }]} />
                <Text style={styles.progressText}>{downloadProgress}%</Text>
              </View>
            )}

            {(updateStatus === 'idle' || updateStatus === 'checking' || updateStatus === 'upToDate') && (
              <TouchableOpacity
                style={[styles.checkBtn, updateStatus === 'upToDate' && styles.checkBtnSuccess]}
                onPress={updateStatus === 'upToDate' ? null : checkForUpdate}
                activeOpacity={0.8}
                disabled={updateStatus === 'checking'}
              >
                {updateStatus === 'checking' ? (
                  <ActivityIndicator size={11} color={COLORS.primary} />
                ) : (
                  <Icon
                    name={updateStatus === 'upToDate' ? 'check-circle-outline' : 'refresh'}
                    size={13}
                    color={updateStatus === 'upToDate' ? COLORS.success : COLORS.primary}
                  />
                )}
                <Text style={[styles.checkBtnText, updateStatus === 'upToDate' && { color: COLORS.success }]}>
                  {updateStatus === 'checking' ? 'Checking…'
                    : updateStatus === 'upToDate' ? 'Up to date'
                    : 'Update?'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </SectionCard>

        {/* ── Session ───────────────────────────────── */}
        <SectionCard title="Session">
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.75}
          >
            <View style={styles.logoutIconWrap}>
              <Icon name="logout" size={18} color={COLORS.error} />
            </View>
            <Text style={styles.logoutText}>Sign Out</Text>
            <Icon name="chevron-right" size={18} color={COLORS.error} />
          </TouchableOpacity>
        </SectionCard>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Section card ──────────────────────────────────────────────
function SectionCard({ title, children }) {
  // Filter out falsy children (conditional renders)
  const childArray = React.Children.toArray(children);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>
        {childArray.map((child, i) => (
          <React.Fragment key={i}>
            {/* Divider between rows — not before first, not after last */}
            {i > 0 && <View style={styles.rowDivider} />}
            {child}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ── Profile row ───────────────────────────────────────────────
function ProfileRow({ icon, label, value }) {
  return (
    <View style={styles.profileRow}>
      <View style={styles.profileRowIconWrap}>
        <Icon name={icon} size={18} color={COLORS.textMuted} />
      </View>
      <View style={styles.profileRowTexts}>
        <Text style={styles.profileRowLabel}>{label}</Text>
        <Text style={styles.profileRowValue} numberOfLines={2}>{value ?? '—'}</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xxl },

  // ── Hero ──────────────────────────────────────────────────
  hero: {
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.xl,
    paddingBottom:   SPACING.lg,
    marginBottom:    SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
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
  avatarText: { fontSize: FONT_SIZE.xl, fontFamily: FONTS.bold },
  heroName: {
    ...TYPOGRAPHY.h3,
    color:        COLORS.textPrimary,
    fontFamily:   FONTS.bold,
    marginBottom: SPACING.sm,
  },

  roleBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical:   5,
  },
  roleBadgeText: {
    fontSize:      FONT_SIZE.xs,
    fontFamily:    FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  editBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    marginTop:         12,
    paddingHorizontal: 16,
    paddingVertical:   7,
    borderRadius:      20,
    borderWidth:       1.5,
    borderColor:       COLORS.primary,
    backgroundColor:   COLORS.primaryLight ?? '#EDE9FE',
  },
  editBtnText: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.primary,
    fontFamily: FONTS.bold,
  },

  // ── Section ───────────────────────────────────────────────
  section: {
    backgroundColor:   COLORS.surface,
    borderTopWidth:    1,
    borderTopColor:    COLORS.divider,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    marginBottom:      SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    color:             COLORS.textMuted,
    fontFamily:        FONTS.bold,
    textTransform:     'uppercase',
    letterSpacing:     0.6,
    paddingHorizontal: SPACING.md,
    paddingTop:        SPACING.sm,
    paddingBottom:     SPACING.xs,
  },
  sectionBody: {},

  // Divider between rows (not full-width — inset to align with text)
  rowDivider: {
    height:           1,
    backgroundColor:  COLORS.divider,
    marginLeft:       SPACING.md + 18 + SPACING.sm, // icon width offset
  },

  // ── Profile row ───────────────────────────────────────────
  profileRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   13,
  },
  profileRowIconWrap: {
    width:          18,
    alignItems:     'center',
    marginRight:    SPACING.sm,
  },
  profileRowTexts: { flex: 1 },
  profileRowLabel: {
    ...TYPOGRAPHY.caption,
    color:        COLORS.textMuted,
    marginBottom: 2,
  },
  profileRowValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },

  // ── Update ────────────────────────────────────────────────
  progressWrap: {
    height:          20,
    flex:            1,
    backgroundColor: COLORS.border,
    borderRadius:    BORDER_RADIUS.full,
    overflow:        'hidden',
    justifyContent:  'center',
  },
  progressBar: {
    position:        'absolute',
    left:            0,
    top:             0,
    bottom:          0,
    backgroundColor: COLORS.primary,
    borderRadius:    BORDER_RADIUS.full,
  },
  progressText: {
    fontSize:   10,
    color:      COLORS.white,
    fontFamily: FONTS.bold,
    textAlign:  'center',
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
  },
  updateBtnText: {
    fontSize: 11,
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
  },
  checkBtnSuccess: {
    borderColor: COLORS.success,
  },
  checkBtnText: {
    fontSize: 11,
    color: COLORS.primary,
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },

  // ── Logout ────────────────────────────────────────────────
  logoutBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical:   14,
  },
  logoutIconWrap: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: '#FEE2E2',
    alignItems:      'center',
    justifyContent:  'center',
  },
  logoutText: {
    ...TYPOGRAPHY.body,
    color:      COLORS.error,
    fontFamily: FONTS.bold,
    flex:       1,
  },
});
