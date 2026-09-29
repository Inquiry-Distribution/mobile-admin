/**
 * AppNavigator — Admin & Superuser
 *
 * Tab structure (5 tabs):
 * ┌──────────────────────────────────────────────────────────┐
 * │  Dashboard │ Inquiries │ Groups │  Team  │  More          │
 * └──────────────────────────────────────────────────────────┘
 *
 * Inquiries tab  → InquiryNavigator  (List → Detail)
 * Team tab       → TeamNavigator     (UserList → UserDetail → Devices → Attendance)
 * More tab       → MoreNavigator     (Menu → LiveMap → Reports → Audit → Profile)
 *
 * All stacks share the same header style (primary purple background).
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { useNavigation }            from '@react-navigation/native';
import { useSafeAreaInsets }        from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';

import useNotificationStore from '@store/notification.store';
import useGroupStore        from '@store/group.store';
import useAuthStore         from '@store/auth.store';

// ── Screens ───────────────────────────────────────────────────
import DashboardScreen     from '@screens/dashboard/DashboardScreen';
import InquiryListScreen    from '@screens/inquiry/InquiryListScreen';
import InquiryDetailScreen  from '@screens/inquiry/InquiryDetailScreen';
import CreateInquiryScreen  from '@screens/inquiry/CreateInquiryScreen';
import EditInquiryScreen    from '@screens/inquiry/EditInquiryScreen';
import TrashScreen          from '@screens/inquiry/TrashScreen';
import InquiryActivityScreen from '@screens/inquiry/InquiryActivityScreen';
import LiveMapScreen       from '@screens/map/LiveMapScreen';
import UserListScreen      from '@screens/team/UserListScreen';
import UserDetailScreen    from '@screens/team/UserDetailScreen';
import CreateUserScreen          from '@screens/team/CreateUserScreen';
import EditUserScreen            from '@screens/team/EditUserScreen';
import DeviceListScreen          from '@screens/devices/DeviceListScreen';
import AttendanceScreen          from '@screens/attendance/AttendanceScreen';
import AttendanceDayDetailScreen from '@screens/attendance/AttendanceDayDetailScreen';
import AttendanceMonthScreen     from '@screens/attendance/AttendanceMonthScreen';
import SalespersonReportScreen   from '@screens/reports/SalespersonReportScreen';
import CompanyReportScreen       from '@screens/reports/CompanyReportScreen';
import CompanyDrillDownScreen    from '@screens/reports/CompanyDrillDownScreen';
import LocationHistoryScreen     from '@screens/map/LocationHistoryScreen';
import MoreMenuScreen          from '@screens/more/MoreMenuScreen';
import NotificationsScreen     from '@screens/notifications/NotificationsScreen';
import ReportsScreen           from '@screens/reports/ReportsScreen';
import AuditLogScreen      from '@screens/audit/AuditLogScreen';
import ActivityLogScreen  from '@screens/activity/ActivityLogScreen';
import ProfileScreen       from '@screens/profile/ProfileScreen';
import EditProfileScreen   from '@screens/profile/EditProfileScreen';
import GroupListScreen        from '@screens/groups/GroupListScreen';
import GroupChatScreen        from '@screens/groups/GroupChatScreen';
import CreateGroupScreen      from '@screens/groups/CreateGroupScreen';
import GroupMembersScreen     from '@screens/groups/GroupMembersScreen';
import ImageViewerScreen      from '@screens/groups/ImageViewerScreen';
import ComplaintListScreen    from '@screens/complaints/ComplaintListScreen';
import ComplaintDetailScreen  from '@screens/complaints/ComplaintDetailScreen';
import CompanyListScreen           from '@screens/companies/CompanyListScreen';
import CompanyFormScreen           from '@screens/companies/CompanyFormScreen';
import BusinessLocationListScreen  from '@screens/settings/BusinessLocationListScreen';
import BusinessLocationFormScreen  from '@screens/settings/BusinessLocationFormScreen';
import HolidayListScreen           from '@screens/settings/HolidayListScreen';
import HolidayFormScreen           from '@screens/settings/HolidayFormScreen';
import SystemConfigScreen          from '@screens/settings/SystemConfigScreen';

const Tab           = createBottomTabNavigator();
const InquiryStack  = createStackNavigator();
const TeamStack     = createStackNavigator();
const GroupStack    = createStackNavigator();
const MoreStack     = createStackNavigator();
const RootStack     = createStackNavigator();

// ─── Shared header config ─────────────────────────────────────
const HEADER_STYLE = {
  headerStyle:      { backgroundColor: COLORS.primary, elevation: 0, shadowOpacity: 0 },
  headerTintColor:  COLORS.white,
  headerTitleAlign: 'left',
};

// ─── Header Title with icon ───────────────────────────────────
function HeaderTitle({ icon, title }) {
  return (
    <View style={styles.headerTitle}>
      <View style={styles.headerIconBox}>
        <Icon name={icon} size={15} color={COLORS.white} />
      </View>
      <Text style={styles.headerTitleText}>{title}</Text>
    </View>
  );
}

// ─── Back button ──────────────────────────────────────────────
function BackButton() {
  const nav = useNavigation();
  return (
    <TouchableOpacity
      style={styles.backBtn}
      onPress={() => nav.goBack()}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon name="arrow-left" size={22} color={COLORS.white} />
    </TouchableOpacity>
  );
}

// ─── Notification bell button (top-right, goes to Notifications) ─
function NotificationButton({ navigation }) {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  return (
    <TouchableOpacity
      style={styles.notifBtn}
      onPress={() => navigation.navigate('More', { screen: 'Notifications' })}
      activeOpacity={0.8}
    >
      <Icon name="bell-outline" size={20} color={COLORS.white} />
      {unreadCount > 0 && (
        <View style={styles.notifBadge}>
          <Text style={styles.notifBadgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Avatar button (top-right, goes to Profile) ───────────────
function AvatarButton({ navigation }) {
  const user = useAuthStore((s) => s.user);
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AD';

  return (
    <TouchableOpacity
      style={styles.avatarBtn}
      onPress={() => navigation.navigate('Profile')}
      activeOpacity={0.8}
    >
      <Text style={styles.avatarText}>{initials}</Text>
    </TouchableOpacity>
  );
}

// ─── Inquiry stack ────────────────────────────────────────────
function InquiryNavigator() {
  const isSuperuser = useAuthStore((s) => s.isSuperuser());

  return (
    <InquiryStack.Navigator screenOptions={HEADER_STYLE}>
      <InquiryStack.Screen
        name="InquiryList"
        component={InquiryListScreen}
        options={({ navigation: nav }) => ({
          headerTitle: () => <HeaderTitle icon="clipboard-list-outline" title="All Inquiries" />,
          headerLeft:  () => null,
          headerRight: isSuperuser
            ? () => (
                <TouchableOpacity
                  style={styles.trashBtn}
                  onPress={() => nav.navigate('Trash')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Icon name="trash-can-outline" size={22} color={COLORS.white} />
                </TouchableOpacity>
              )
            : undefined,
        })}
      />
      <InquiryStack.Screen
        name="InquiryDetail"
        component={InquiryDetailScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="clipboard-text-outline" title="Inquiry Detail" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <InquiryStack.Screen
        name="CreateInquiry"
        component={CreateInquiryScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="clipboard-plus-outline" title="Add Inquiry" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <InquiryStack.Screen
        name="EditInquiry"
        component={EditInquiryScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="clipboard-edit-outline" title="Edit Inquiry" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      {isSuperuser && (
        <InquiryStack.Screen
          name="Trash"
          component={TrashScreen}
          options={{
            headerTitle: () => <HeaderTitle icon="trash-can-outline" title="Trash" />,
            headerLeft:  () => <BackButton />,
          }}
        />
      )}
      {isSuperuser && (
        <InquiryStack.Screen
          name="InquiryActivity"
          component={InquiryActivityScreen}
          options={{
            headerTitle: () => <HeaderTitle icon="timeline-outline" title="Inquiry Activity" />,
            headerLeft:  () => <BackButton />,
          }}
        />
      )}
    </InquiryStack.Navigator>
  );
}

// ─── Team stack (Salespersons + Devices + Attendance) ─────────
function TeamNavigator() {
  return (
    <TeamStack.Navigator screenOptions={HEADER_STYLE}>
      <TeamStack.Screen
        name="UserList"
        component={UserListScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="account-group-outline" title="Team" />,
          headerLeft:  () => null,
        }}
      />
      <TeamStack.Screen
        name="UserDetail"
        component={UserDetailScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="account-outline" title="Salesperson" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <TeamStack.Screen
        name="CreateUser"
        component={CreateUserScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="account-plus-outline" title="Add User" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <TeamStack.Screen
        name="EditUser"
        component={EditUserScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="account-edit-outline" title="Edit User" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <TeamStack.Screen
        name="DeviceList"
        component={DeviceListScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="cellphone-check" title="Devices" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <TeamStack.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="calendar-check-outline" title="Attendance" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <TeamStack.Screen
        name="AttendanceDayDetail"
        component={AttendanceDayDetailScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="calendar-text-outline" title="Day Detail" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <TeamStack.Screen
        name="AttendanceMonth"
        component={AttendanceMonthScreen}
        options={({ route }) => ({
          headerTitle: () => (
            <HeaderTitle
              icon="calendar-month-outline"
              title={route.params?.name ? `${route.params.name} — Monthly` : 'Monthly Attendance'}
            />
          ),
          headerLeft: () => <BackButton />,
        })}
      />
      <TeamStack.Screen
        name="SalespersonReport"
        component={SalespersonReportScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="chart-bar" title="Performance Report" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <TeamStack.Screen
        name="LocationHistory"
        component={LocationHistoryScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="map-marker-path" title="Location History" />,
          headerLeft:  () => <BackButton />,
        }}
      />
    </TeamStack.Navigator>
  );
}

// ─── Group stack ──────────────────────────────────────────────
function GroupNavigator() {
  return (
    <GroupStack.Navigator screenOptions={HEADER_STYLE}>
      <GroupStack.Screen
        name="GroupList"
        component={GroupListScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="forum-outline" title="Groups" />,
          headerLeft:  () => null,
        }}
      />
      <GroupStack.Screen
        name="GroupChat"
        component={GroupChatScreen}
        options={({ route }) => ({
          headerTitle: () => <HeaderTitle icon="chat-outline" title={route.params?.groupName ?? 'Chat'} />,
          headerLeft:  () => <BackButton />,
        })}
      />
      <GroupStack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="plus-circle-outline" title="New Group" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <GroupStack.Screen
        name="GroupMembers"
        component={GroupMembersScreen}
        options={({ route }) => ({
          headerTitle: () => <HeaderTitle icon="account-multiple-outline" title={route.params?.groupName ?? 'Members'} />,
          headerLeft:  () => <BackButton />,
        })}
      />
    </GroupStack.Navigator>
  );
}

// ─── More stack (Reports → Notifications → Audit → Profile) ───
function MoreNavigator() {
  const isSuperuser = useAuthStore((s) => s.isSuperuser());

  return (
    <MoreStack.Navigator screenOptions={HEADER_STYLE}>
      <MoreStack.Screen
        name="MoreMenu"
        component={MoreMenuScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="dots-horizontal-circle-outline" title="More" />,
          headerLeft:  () => null,
        }}
      />
      <MoreStack.Screen
        name="LiveMap"
        component={LiveMapScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="map-marker-multiple-outline" title="Live Map" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <MoreStack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="chart-bar" title="Reports" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <MoreStack.Screen
        name="CompanyReport"
        component={CompanyReportScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="domain" title="Company Report" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <MoreStack.Screen
        name="CompanyDrillDown"
        component={CompanyDrillDownScreen}
        options={({ route }) => ({
          headerTitle: () => (
            <HeaderTitle icon="domain" title={route.params?.companyName ?? 'Company'} />
          ),
          headerLeft: () => <BackButton />,
        })}
      />
      <MoreStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="bell-outline" title="Notifications" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      {isSuperuser && (
        <MoreStack.Screen
          name="AuditLog"
          component={AuditLogScreen}
          options={{
            headerTitle: () => <HeaderTitle icon="shield-search" title="Audit Logs" />,
            headerLeft:  () => <BackButton />,
          }}
        />
      )}
      <MoreStack.Screen
        name="ActivityLog"
        component={ActivityLogScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="chart-timeline-variant" title="Activity Log" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      {isSuperuser && (
        <MoreStack.Screen
          name="ComplaintList"
          component={ComplaintListScreen}
          options={{
            headerTitle: () => <HeaderTitle icon="message-alert-outline" title="Complaints & Suggestions" />,
            headerLeft:  () => <BackButton />,
          }}
        />
      )}
      {isSuperuser && (
        <MoreStack.Screen
          name="ComplaintDetail"
          component={ComplaintDetailScreen}
          options={{
            headerTitle: () => <HeaderTitle icon="message-text-outline" title="Submission Detail" />,
            headerLeft:  () => <BackButton />,
          }}
        />
      )}
      <MoreStack.Screen
        name="CompanyList"
        component={CompanyListScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="domain" title="Companies" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <MoreStack.Screen
        name="CreateCompany"
        component={CompanyFormScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="domain-plus" title="New Company" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <MoreStack.Screen
        name="EditCompany"
        component={CompanyFormScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="domain" title="Edit Company" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      {isSuperuser && (
        <MoreStack.Screen
          name="SystemConfig"
          component={SystemConfigScreen}
          options={{
            headerTitle: () => <HeaderTitle icon="cog-outline" title="System Config" />,
            headerLeft:  () => <BackButton />,
          }}
        />
      )}
      <MoreStack.Screen
        name="BusinessLocationList"
        component={BusinessLocationListScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="map-marker-radius-outline" title="Office Locations" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <MoreStack.Screen
        name="BusinessLocationForm"
        component={BusinessLocationFormScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="map-marker-plus-outline" title="Location" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <MoreStack.Screen
        name="HolidayList"
        component={HolidayListScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="calendar-star" title="Holidays" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <MoreStack.Screen
        name="HolidayForm"
        component={HolidayFormScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="calendar-plus" title="Holiday" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <MoreStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="account-circle-outline" title="My Profile" />,
          headerLeft:  () => <BackButton />,
        }}
      />
      <MoreStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="account-edit-outline" title="Edit Profile" />,
          headerLeft:  () => <BackButton />,
        }}
      />
    </MoreStack.Navigator>
  );
}

// ─── Bottom Tab Navigator ─────────────────────────────────────
const TAB_ICONS = {
  Dashboard: 'view-dashboard-outline',
  Inquiries: 'clipboard-list-outline',
  Groups:    'forum-outline',
  Team:      'account-group-outline',
  More:      'dots-horizontal-circle-outline',
};

function TabNavigator({ navigation }) {
  const insets           = useSafeAreaInsets();
  const unreadCount      = useNotificationStore((s) => s.unreadCount);
  const groupUnreadTotal = useGroupStore((s) =>
    s.groups.reduce((sum, g) => sum + (g.unreadCount ?? 0), 0)
  );
  const headerRight = () => (
    <View style={styles.headerRightRow}>
      <NotificationButton navigation={navigation} />
      <AvatarButton navigation={navigation} />
    </View>
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...HEADER_STYLE,
        headerRight,
        tabBarActiveTintColor:   COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarStyle:             { paddingBottom: Math.max(insets.bottom, 4), height: 60 + insets.bottom },
        tabBarLabelStyle:        { ...TYPOGRAPHY.caption, marginBottom: 4 },
        tabBarHideOnKeyboard:    true,
        tabBarIcon: ({ color, size }) => (
          <Icon name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
        headerTitle: () => (
          <HeaderTitle icon={TAB_ICONS[route.name]} title={route.name} />
        ),
      })}
    >
      {/* 1 — Dashboard */}
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="view-dashboard-outline" title="Dashboard" />,
        }}
      />

      {/* 2 — Inquiries */}
      <Tab.Screen
        name="Inquiries"
        component={InquiryNavigator}
        options={{ headerShown: false }}
        listeners={({ navigation: nav }) => ({
          tabPress: (e) => {
            e.preventDefault();
            nav.navigate('Inquiries', { screen: 'InquiryList' });
          },
        })}
      />

      {/* 3 — Groups */}
      <Tab.Screen
        name="Groups"
        component={GroupNavigator}
        options={{
          headerShown:      false,
          tabBarBadge:      groupUnreadTotal > 0 ? groupUnreadTotal : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.error },
        }}
        listeners={({ navigation: nav }) => ({
          tabPress: (e) => {
            e.preventDefault();
            nav.navigate('Groups', { screen: 'GroupList' });
          },
        })}
      />

      {/* 4 — Team */}
      <Tab.Screen
        name="Team"
        component={TeamNavigator}
        options={{ headerShown: false }}
        listeners={({ navigation: nav }) => ({
          tabPress: (e) => {
            e.preventDefault();
            nav.navigate('Team', { screen: 'UserList' });
          },
        })}
      />

      {/* 5 — More (LiveMap, Reports, Notifications, Audit, Profile) */}
      <Tab.Screen
        name="More"
        component={MoreNavigator}
        options={{
          headerShown: false,
          tabBarBadge:      unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.error },
        }}
        listeners={({ navigation: nav }) => ({
          tabPress: (e) => {
            e.preventDefault();
            nav.navigate('More', { screen: 'MoreMenu' });
          },
        })}
      />
    </Tab.Navigator>
  );
}

// ─── Root Stack (tabs + full-screen modals) ───────────────────
export default function AppNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Tabs" component={TabNavigator} />

      {/* ── Full-screen image viewer (above tab bar, no modal layering issues) ── */}
      <RootStack.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{
          headerShown:           false,
          cardStyle:             { backgroundColor: '#000' },
          cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
          gestureEnabled:        false, // swipe-back conflicts with pinch zoom
        }}
      />

      {/* Full-screen Profile modal accessible from any tab's avatar button */}
      <RootStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown:  true,
          ...HEADER_STYLE,
          headerTitle:  () => <HeaderTitle icon="account-circle-outline" title="My Profile" />,
          headerLeft:   () => <BackButton />,
        }}
      />
      <RootStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown:  true,
          ...HEADER_STYLE,
          headerTitle:  () => <HeaderTitle icon="account-edit-outline" title="Edit Profile" />,
          headerLeft:   () => <BackButton />,
        }}
      />
    </RootStack.Navigator>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerTitle: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  headerIconBox: {
    width:           28,
    height:          28,
    borderRadius:    8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerTitleText: {
    ...TYPOGRAPHY.h4,
    color:      COLORS.white,
    fontWeight: '700',
  },
  backBtn: {
    marginLeft: Platform.OS === 'ios' ? 8 : 4,
    padding:    4,
  },
  trashBtn: {
    marginRight: 12,
    padding:     4,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginRight:   4,
  },
  notifBtn: {
    width:        34,
    height:       34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems:   'center',
    marginRight:  8,
  },
  notifBadge: {
    position:          'absolute',
    top:               -2,
    right:             -2,
    backgroundColor:   COLORS.error,
    borderRadius:      9,
    minWidth:          16,
    height:            16,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    fontSize:   9,
    fontWeight: '700',
    color:      COLORS.white,
  },
  avatarBtn: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: COLORS.primaryDark,
    justifyContent:  'center',
    alignItems:      'center',
    marginRight:     12,
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.4)',
  },
  avatarText: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.white,
    fontWeight: '700',
    fontSize:   12,
  },
});
