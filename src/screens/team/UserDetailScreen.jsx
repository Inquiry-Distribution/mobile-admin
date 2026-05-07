/**
 * UserDetailScreen — view & manage a single user
 *
 * Sections:
 *  • Hero card — avatar, name, role badge, active/inactive status
 *  • Action buttons — Toggle Active, View Attendance, View Inquiries
 *  • Superuser: Delete user
 *  • Contact info — email, phone
 *  • Employment info — employeeId, assignedArea, createdAt, createdBy
 *  • PIN section — status + Set/Reset PIN button (opens SetPinModal)
 *  • Device card — platform, lastSeen, isBlocked (if device exists)
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS, ROLE_COLORS, DEVICE_STATUS_COLORS } from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { getInitials, formatDateTime } from '@utils/helpers';

import useUserStore    from '@store/user.store';
import useAuthStore    from '@store/auth.store';
import { deviceApi }  from '@api/device.api';
import Loader                    from '@components/common/Loader';
import SetPinModal               from '@components/team/SetPinModal';
import UpdateAdminPasswordModal  from '@components/team/UpdateAdminPasswordModal';

export default function UserDetailScreen({ navigation, route }) {
  const { id } = route.params;

  const { selectedUser, isLoadingDetail, fetchUser, toggleStatus, removeUser, updateUser } = useUserStore();
  const { isSuperuser } = useAuthStore();

  const [pinModalVisible,      setPinModalVisible]      = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [isRefreshing,       setIsRefreshing]       = useState(false);
  const [deleteError,        setDeleteError]        = useState(null);
  const [isDeviceMutating,   setIsDeviceMutating]   = useState(false);
  const [isRemoteMutating,   setIsRemoteMutating]   = useState(false);

  useEffect(() => {
    fetchUser(id);
  }, [id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUser(id);
    setIsRefreshing(false);
  };

  const handleToggleActive = () => {
    const user = selectedUser;
    if (!user) return;
    const action   = user.isActive ? 'deactivate' : 'activate';
    const actionCap = user.isActive ? 'Deactivate' : 'Activate';

    Alert.alert(
      `${actionCap} User`,
      `Are you sure you want to ${action} ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionCap,
          style: user.isActive ? 'destructive' : 'default',
          onPress: async () => {
            const result = await toggleStatus(user.id);
            if (!result.success) {
              Alert.alert('Error', result.message ?? `Failed to ${action} user.`);
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    setDeleteError(null);
    Alert.alert(
      'Delete User',
      `Permanently delete ${selectedUser.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await removeUser(selectedUser.id);
            if (result.success) {
              navigation.goBack();
            } else {
              setDeleteError(result.message ?? 'Failed to delete user.');
            }
          },
        },
      ],
    );
  };

  const handleBlockDevice = () => {
    const device = selectedUser?.device;
    if (!device) return;
    Alert.alert(
      'Block Device',
      `Block ${selectedUser.name}'s device? They will not be able to log in until unblocked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setIsDeviceMutating(true);
            try {
              await deviceApi.block(device.id);
              await fetchUser(id);
            } catch (e) {
              Alert.alert('Error', e?.message ?? 'Failed to block device.');
            } finally {
              setIsDeviceMutating(false);
            }
          },
        },
      ],
    );
  };

  const handleUnblockDevice = () => {
    const device = selectedUser?.device;
    if (!device) return;
    Alert.alert(
      'Unblock Device',
      `Allow ${selectedUser.name}'s device to log in again?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setIsDeviceMutating(true);
            try {
              await deviceApi.unblock(device.id);
              await fetchUser(id);
            } catch (e) {
              Alert.alert('Error', e?.message ?? 'Failed to unblock device.');
            } finally {
              setIsDeviceMutating(false);
            }
          },
        },
      ],
    );
  };

  const handleResetDevice = () => {
    if (!selectedUser?.device) return;
    Alert.alert(
      'Reset Device',
      `Remove ${selectedUser.name}'s registered device? They will need to log in on a new device to re-register.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsDeviceMutating(true);
            try {
              await deviceApi.resetBySalesperson(selectedUser.id);
              await fetchUser(id);
            } catch (e) {
              Alert.alert('Error', e?.message ?? 'Failed to reset device.');
            } finally {
              setIsDeviceMutating(false);
            }
          },
        },
      ],
    );
  };

  const handleToggleRemote = () => {
    if (!selectedUser) return;
    const enabling = !selectedUser.allowRemote;
    Alert.alert(
      enabling ? 'Allow Remote Attendance' : 'Revoke Remote Attendance',
      enabling
        ? `${selectedUser.name} will be able to check in and out from outside any registered office location.`
        : `${selectedUser.name} will only be able to check in and out from registered office locations.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: enabling ? 'Allow' : 'Revoke',
          style: enabling ? 'default' : 'destructive',
          onPress: async () => {
            setIsRemoteMutating(true);
            const result = await updateUser(selectedUser.id, { allowRemote: enabling });
            setIsRemoteMutating(false);
            if (!result.success) {
              Alert.alert('Error', result.message ?? 'Failed to update remote attendance.');
            }
          },
        },
      ],
    );
  };

  if (isLoadingDetail && !selectedUser) return <Loader />;
  if (!selectedUser) return null;

  const user      = selectedUser;
  const isSales   = user.role === 'sales';
  const isAdmin   = user.role === 'admin';
  const roleColor = ROLE_COLORS[user.role] ?? { bg: COLORS.primaryLight, text: COLORS.primary };
  const device    = user.device;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >

        {/* ── Hero card ─────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={[styles.heroAvatar, { backgroundColor: roleColor.bg }]}>
            <Text style={[styles.heroAvatarText, { color: roleColor.text }]}>
              {getInitials(user.name)}
            </Text>
          </View>

          <Text style={styles.heroName}>{user.name}</Text>

          <View style={styles.heroBadgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
              <Text style={[styles.roleBadgeText, { color: roleColor.text }]}>
                {user.role.toUpperCase()}
              </Text>
            </View>
            <View style={[
              styles.activeBadge,
              { backgroundColor: user.isActive ? '#DCFCE7' : COLORS.border },
            ]}>
              <View style={[
                styles.activeDot,
                { backgroundColor: user.isActive ? COLORS.success : COLORS.textMuted },
              ]} />
              <Text style={[
                styles.activeBadgeText,
                { color: user.isActive ? COLORS.success : COLORS.textMuted },
              ]}>
                {user.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Actions ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionGrid}>
            <ActionTile
              icon="account-edit-outline"
              label="Edit User"
              color={COLORS.primary}
              onPress={() => navigation.navigate('EditUser', { userId: user.id })}
            />
            <ActionTile
              icon={user.isActive ? 'account-cancel-outline' : 'account-check-outline'}
              label={user.isActive ? 'Deactivate' : 'Activate'}
              color={user.isActive ? COLORS.warning : COLORS.success}
              onPress={handleToggleActive}
            />
            {isSales && (
              <>
                <ActionTile
                  icon="chart-bar"
                  label="Report"
                  color={COLORS.info}
                  onPress={() =>
                    navigation.navigate('SalespersonReport', { salespersonId: user.id, name: user.name })
                  }
                />
                <ActionTile
                  icon="map-marker-path"
                  label="Location"
                  color={COLORS.secondary}
                  onPress={() =>
                    navigation.navigate('LocationHistory', { salespersonId: user.id, name: user.name })
                  }
                />
                <ActionTile
                  icon="calendar-clock-outline"
                  label="Attendance"
                  color={COLORS.primary}
                  onPress={() =>
                    navigation.navigate('Attendance', { salespersonId: user.id, name: user.name })
                  }
                />
                <ActionTile
                  icon="calendar-month-outline"
                  label="Monthly"
                  color={'#8B5CF6'}
                  onPress={() =>
                    navigation.navigate('AttendanceMonth', { salespersonId: user.id, name: user.name })
                  }
                />
                <ActionTile
                  icon="clipboard-text-outline"
                  label="Inquiries"
                  color={COLORS.primary}
                  onPress={() =>
                    navigation.navigate('Inquiries', {
                      screen: 'InquiryList',
                      params: { filterAssignedToId: user.id },
                    })
                  }
                />
              </>
            )}
            {isSuperuser() && (
              <ActionTile
                icon="delete-outline"
                label="Delete"
                color={COLORS.error}
                onPress={handleDelete}
              />
            )}
          </View>

          {deleteError ? (
            <View style={styles.deleteErrorBanner}>
              <Icon name="alert-circle-outline" size={16} color={COLORS.error} />
              <Text style={styles.deleteErrorText}>{deleteError}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Contact info ──────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <SectionRows>
            <InfoRow icon="email-outline"   label="Email" value={user.email} />
            {user.phone ? (
              <InfoRow icon="phone-outline" label="Phone" value={user.phone} />
            ) : null}
          </SectionRows>
        </View>

        {/* ── Employment info ───────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employment</Text>
          <SectionRows>
            {user.company ? (
              <InfoRow icon="domain" label="Company" value={user.company.name} />
            ) : null}
            {user.employeeId ? (
              <InfoRow icon="badge-account-outline" label="Employee ID"   value={user.employeeId} />
            ) : null}
            {user.assignedArea ? (
              <InfoRow icon="map-marker-outline"    label="Assigned Area" value={user.assignedArea} />
            ) : null}
            <InfoRow
              icon="calendar-outline"
              label="Joined"
              value={formatDateTime(user.createdAt)}
            />
            {user.createdBy ? (
              <InfoRow icon="account-plus-outline" label="Created by" value={user.createdBy.name} />
            ) : null}
          </SectionRows>
        </View>

        {/* ── Security (admin users, superuser only) ───────── */}
        {isAdmin && isSuperuser() && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Security</Text>
              <TouchableOpacity
                style={styles.setPinBtn}
                onPress={() => setPasswordModalVisible(true)}
              >
                <Icon name="lock-reset" size={14} color={COLORS.primary} />
                <Text style={styles.setPinBtnText}>Update Password</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pinStatus}>
              <Icon name="shield-account-outline" size={20} color={COLORS.textMuted} />
              <Text style={[styles.pinStatusText, { color: COLORS.textMuted }]}>
                Reset this admin's login password.
              </Text>
            </View>
          </View>
        )}

        {/* ── PIN section (sales only) ──────────────────── */}
        {/* ── Remote Attendance (sales only) ────────────── */}
        {isSales && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Remote Attendance</Text>
            <View style={styles.remoteRow}>
              <View style={styles.remoteInfo}>
                <Icon
                  name="map-marker-off-outline"
                  size={18}
                  color={user.allowRemote ? COLORS.success : COLORS.textMuted}
                />
                <View style={styles.remoteTexts}>
                  <Text style={styles.remoteLabel}>
                    {user.allowRemote ? 'Remote check-in allowed' : 'Office location required'}
                  </Text>
                  <Text style={styles.remoteSub}>
                    {user.allowRemote
                      ? 'User can check in/out from anywhere'
                      : 'User must be at a registered office location'}
                  </Text>
                </View>
              </View>
              {isRemoteMutating ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Switch
                  value={!!user.allowRemote}
                  onValueChange={isSuperuser() ? handleToggleRemote : undefined}
                  disabled={!isSuperuser()}
                  trackColor={{ false: COLORS.border, true: COLORS.success + '99' }}
                  thumbColor={user.allowRemote ? COLORS.success : COLORS.textMuted}
                />
              )}
            </View>
            {!isSuperuser() && (
              <Text style={styles.remoteNote}>Only superusers can change this setting.</Text>
            )}
          </View>
        )}

        {isSales && <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>PIN</Text>
            <TouchableOpacity
              style={styles.setPinBtn}
              onPress={() => setPinModalVisible(true)}
            >
              <Icon
                name={user.pin ? 'lock-reset' : 'lock-plus-outline'}
                size={14}
                color={COLORS.primary}
              />
              <Text style={styles.setPinBtnText}>
                {user.pin ? 'Reset PIN' : 'Set PIN'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pinStatus}>
            <Icon
              name={user.pin ? 'lock-check-outline' : 'lock-off-outline'}
              size={20}
              color={user.pin ? COLORS.success : COLORS.textMuted}
            />
            <Text style={[styles.pinStatusText, { color: user.pin ? COLORS.success : COLORS.textMuted }]}>
              {user.pin ? 'PIN configured' : 'No PIN set — user cannot log in to mobile app'}
            </Text>
          </View>
        </View>}

        {/* ── Device card (sales only) ───────────────────── */}
        {isSales && <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registered Device</Text>

          {device ? (
            <View style={styles.deviceCard}>
              {/* ── Info row ── */}
              <View style={styles.deviceRow}>
                <Icon
                  name={device.platform === 'ios' ? 'apple' : 'android'}
                  size={22}
                  color={device.platform === 'ios' ? '#555' : '#3DDC84'}
                />
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceId} numberOfLines={1}>
                    {device.deviceId?.slice(0, 16)}…
                  </Text>
                  {device.mobileNumber ? (
                    <Text style={styles.deviceMobile}>{device.mobileNumber}</Text>
                  ) : null}
                </View>
                <View style={[
                  styles.deviceBadge,
                  {
                    backgroundColor: device.isBlocked
                      ? DEVICE_STATUS_COLORS.blocked.bg
                      : DEVICE_STATUS_COLORS.active.bg,
                  },
                ]}>
                  <Text style={[
                    styles.deviceBadgeText,
                    {
                      color: device.isBlocked
                        ? DEVICE_STATUS_COLORS.blocked.text
                        : DEVICE_STATUS_COLORS.active.text,
                    },
                  ]}>
                    {device.isBlocked ? 'Blocked' : 'Active'}
                  </Text>
                </View>
              </View>

              {device.lastSeen ? (
                <Text style={styles.deviceLastSeen}>
                  Last seen: {formatDateTime(device.lastSeen)}
                </Text>
              ) : null}
              {device.appVersion ? (
                <Text style={styles.deviceAppVer}>v{device.appVersion}</Text>
              ) : null}

              {/* ── Device action buttons ── */}
              <View style={styles.deviceActions}>
                {/* Block / Unblock */}
                {device.isBlocked ? (
                  <TouchableOpacity
                    style={[styles.deviceActionBtn, styles.deviceActionUnblock]}
                    onPress={handleUnblockDevice}
                    disabled={isDeviceMutating}
                    activeOpacity={0.8}
                  >
                    {isDeviceMutating ? (
                      <ActivityIndicator size="small" color={COLORS.success} />
                    ) : (
                      <>
                        <Icon name="lock-open-outline" size={15} color={COLORS.success} />
                        <Text style={[styles.deviceActionText, { color: COLORS.success }]}>
                          Unblock
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.deviceActionBtn, styles.deviceActionBlock]}
                    onPress={handleBlockDevice}
                    disabled={isDeviceMutating}
                    activeOpacity={0.8}
                  >
                    {isDeviceMutating ? (
                      <ActivityIndicator size="small" color={COLORS.warning} />
                    ) : (
                      <>
                        <Icon name="lock-outline" size={15} color={COLORS.warning} />
                        <Text style={[styles.deviceActionText, { color: COLORS.warning }]}>
                          Block
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Reset */}
                <TouchableOpacity
                  style={[styles.deviceActionBtn, styles.deviceActionReset]}
                  onPress={handleResetDevice}
                  disabled={isDeviceMutating}
                  activeOpacity={0.8}
                >
                  {isDeviceMutating ? (
                    <ActivityIndicator size="small" color={COLORS.error} />
                  ) : (
                    <>
                      <Icon name="cellphone-remove" size={15} color={COLORS.error} />
                      <Text style={[styles.deviceActionText, { color: COLORS.error }]}>
                        Reset Device
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.noDevice}>
              <Icon name="cellphone-off" size={20} color={COLORS.textMuted} />
              <Text style={styles.noDeviceText}>No device registered</Text>
            </View>
          )}
        </View>}

      </ScrollView>

      {/* ── SetPinModal (sales only) ──────────────────── */}
      {isSales && <SetPinModal
        visible={pinModalVisible}
        userId={user.id}
        userName={user.name}
        onClose={() => setPinModalVisible(false)}
        onSuccess={() => {
          setPinModalVisible(false);
          fetchUser(id);
        }}
      />}

      {/* ── UpdateAdminPasswordModal (admin users, superuser only) ── */}
      {isAdmin && isSuperuser() && (
        <UpdateAdminPasswordModal
          visible={passwordModalVisible}
          userId={user.id}
          userName={user.name}
          onClose={() => setPasswordModalVisible(false)}
          onSuccess={() => setPasswordModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Section with inset dividers between rows ─────────────────
function SectionRows({ children }) {
  const rows = React.Children.toArray(children);
  return (
    <>
      {rows.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={styles.rowDivider} />}
          {child}
        </React.Fragment>
      ))}
    </>
  );
}

// ── Info row sub-component ────────────────────────────────────
function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={16} color={COLORS.textMuted} style={styles.infoIcon} />
      <View style={styles.infoTexts}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Action tile sub-component (icon grid) ────────────────────
function ActionTile({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.actionTile} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.actionTileIcon, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.actionTileLabel, { color }]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xxl },

  // Hero
  hero: {
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  heroAvatar: {
    width:          80,
    height:         80,
    borderRadius:   40,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   SPACING.sm,
    ...SHADOW.md,
  },
  heroAvatarText: { fontSize: 28, fontWeight: '800' },
  heroName:       { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, fontWeight: '700', marginBottom: SPACING.sm },

  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },

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

  activeBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  activeDot:       { width: 7, height: 7, borderRadius: 3.5 },
  activeBadgeText: { fontSize: 10, fontWeight: '700' },

  // Section
  section: {
    backgroundColor: COLORS.surface,
    marginTop:       SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth:  1,
    borderTopColor:  COLORS.divider,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  sectionRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    color:         COLORS.textMuted,
    fontWeight:    '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom:  SPACING.sm,
  },

  // InfoRow
  infoRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    paddingVertical: 10,
  },
  rowDivider: {
    height:          1,
    backgroundColor: COLORS.divider,
    marginLeft:      SPACING.md + 16 + SPACING.sm, // icon offset
  },
  infoIcon:  { marginRight: SPACING.sm, marginTop: 2 },
  infoTexts: { flex: 1 },
  infoLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: 2 },
  infoValue: { ...TYPOGRAPHY.body,    color: COLORS.textPrimary },

  // PIN
  setPinBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   COLORS.primaryLight,
    borderRadius:      BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   6,
  },
  setPinBtnText: { ...TYPOGRAPHY.small, color: COLORS.primary, fontWeight: '700' },

  pinStatus: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  pinStatusText: { ...TYPOGRAPHY.small, flex: 1 },

  // Device card
  deviceCard: {
    backgroundColor: COLORS.background,
    borderRadius:    BORDER_RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         SPACING.md,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  deviceInfo:    { flex: 1 },
  deviceId:      { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600' },
  deviceMobile:  { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  deviceBadge: {
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  deviceBadgeText: { fontSize: 10, fontWeight: '700' },
  deviceLastSeen:  { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 6 },
  deviceAppVer:    { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  deviceActions: {
    flexDirection:  'row',
    gap:            SPACING.sm,
    marginTop:      SPACING.md,
    paddingTop:     SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  deviceActionBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: SPACING.sm,
    borderRadius:    BORDER_RADIUS.md,
    borderWidth:     1.5,
  },
  deviceActionBlock:   { borderColor: COLORS.warning,  backgroundColor: COLORS.warning  + '10' },
  deviceActionUnblock: { borderColor: COLORS.success,  backgroundColor: COLORS.success  + '10' },
  deviceActionReset:   { borderColor: COLORS.error,    backgroundColor: COLORS.error    + '10' },
  deviceActionText: {
    ...TYPOGRAPHY.small,
    fontWeight: '700',
  },

  deleteErrorBanner: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    gap:              SPACING.xs,
    backgroundColor:  COLORS.error + '12',
    borderRadius:     BORDER_RADIUS.md,
    borderWidth:      1,
    borderColor:      COLORS.error + '40',
    paddingHorizontal: SPACING.sm,
    paddingVertical:  SPACING.sm,
    marginTop:        SPACING.sm,
  },
  deleteErrorText: {
    ...TYPOGRAPHY.small,
    color:     COLORS.error,
    flex:      1,
    lineHeight: 18,
  },

  noDevice: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  noDeviceText: { ...TYPOGRAPHY.small, color: COLORS.textMuted },

  // Action grid
  actionGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACING.sm,
    marginTop:     SPACING.xs,
  },
  actionTile: {
    width:          '30%',
    alignItems:     'center',
    backgroundColor: COLORS.background,
    borderRadius:   BORDER_RADIUS.lg,
    borderWidth:    1,
    borderColor:    COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  actionTileIcon: {
    width:          48,
    height:         48,
    borderRadius:   BORDER_RADIUS.md,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   SPACING.xs,
  },
  actionTileLabel: {
    ...TYPOGRAPHY.small,
    fontWeight:  '600',
    textAlign:   'center',
    lineHeight:  16,
  },

  // ── Remote attendance ─────────────────────────────────────────
  remoteRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  remoteInfo: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           SPACING.sm,
    flex:          1,
    marginRight:   SPACING.sm,
  },
  remoteTexts: { flex: 1 },
  remoteLabel: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color:      COLORS.textPrimary,
  },
  remoteSub: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textMuted,
    marginTop: 2,
  },
  remoteNote: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
});
