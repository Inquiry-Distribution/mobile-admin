/**
 * AppNavigator — Admin & Superuser
 *
 * Tab structure (5 tabs):
 * ┌──────────────────────────────────────────────────────────┐
 * │  Dashboard │ Inquiries │  Map  │  Team  │  More          │
 * └──────────────────────────────────────────────────────────┘
 *
 * Inquiries tab  → InquiryNavigator  (List → Detail)
 * Team tab       → TeamNavigator     (UserList → UserDetail → Devices → Attendance)
 * More tab       → MoreNavigator     (Menu → Reports → Notifications → Audit → Profile)
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
import { createStackNavigator }     from '@react-navigation/stack';
import { useNavigation }            from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';

import useNotificationStore from '@store/notification.store';
import useAuthStore         from '@store/auth.store';

// ── Screens ───────────────────────────────────────────────────
import DashboardScreen     from '@screens/dashboard/DashboardScreen';
import InquiryListScreen   from '@screens/inquiry/InquiryListScreen';
import InquiryDetailScreen from '@screens/inquiry/InquiryDetailScreen';
import LiveMapScreen       from '@screens/map/LiveMapScreen';
import UserListScreen      from '@screens/team/UserListScreen';
import UserDetailScreen    from '@screens/team/UserDetailScreen';
import CreateUserScreen          from '@screens/team/CreateUserScreen';
import EditUserScreen            from '@screens/team/EditUserScreen';
import DeviceListScreen          from '@screens/devices/DeviceListScreen';
import AttendanceScreen          from '@screens/attendance/AttendanceScreen';
import SalespersonReportScreen   from '@screens/reports/SalespersonReportScreen';
import LocationHistoryScreen     from '@screens/map/LocationHistoryScreen';
import MoreMenuScreen      from '@screens/more/MoreMenuScreen';
import ReportsScreen       from '@screens/reports/ReportsScreen';
import NotificationsScreen from '@screens/notifications/NotificationsScreen';
import AuditLogScreen      from '@screens/audit/AuditLogScreen';
import ProfileScreen       from '@screens/profile/ProfileScreen';

const Tab           = createBottomTabNavigator();
const InquiryStack  = createStackNavigator();
const TeamStack     = createStackNavigator();
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
  return (
    <InquiryStack.Navigator screenOptions={HEADER_STYLE}>
      <InquiryStack.Screen
        name="InquiryList"
        component={InquiryListScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="clipboard-list-outline" title="All Inquiries" />,
          headerLeft:  () => null,
        }}
      />
      <InquiryStack.Screen
        name="InquiryDetail"
        component={InquiryDetailScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="clipboard-text-outline" title="Inquiry Detail" />,
          headerLeft:  () => <BackButton />,
        }}
      />
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
        name="Reports"
        component={ReportsScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="chart-bar" title="Reports" />,
          headerLeft:  () => <BackButton />,
        }}
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
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="account-circle-outline" title="My Profile" />,
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
  Map:       'map-marker-multiple-outline',
  Team:      'account-group-outline',
  More:      'dots-horizontal-circle-outline',
};

function TabNavigator({ navigation }) {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const headerRight = () => <AvatarButton navigation={navigation} />;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...HEADER_STYLE,
        headerRight,
        tabBarActiveTintColor:   COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarStyle:             { paddingBottom: 4, height: 60 },
        tabBarLabelStyle:        { ...TYPOGRAPHY.caption, marginBottom: 4 },
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
          tabPress: () =>
            nav.reset({ index: 0, routes: [{ name: 'Inquiries', state: { routes: [{ name: 'InquiryList' }] } }] }),
        })}
      />

      {/* 3 — Live Map */}
      <Tab.Screen
        name="Map"
        component={LiveMapScreen}
        options={{
          headerTitle: () => <HeaderTitle icon="map-marker-multiple-outline" title="Live Map" />,
        }}
      />

      {/* 4 — Team */}
      <Tab.Screen
        name="Team"
        component={TeamNavigator}
        options={{ headerShown: false }}
        listeners={({ navigation: nav }) => ({
          tabPress: () =>
            nav.reset({ index: 0, routes: [{ name: 'Team', state: { routes: [{ name: 'UserList' }] } }] }),
        })}
      />

      {/* 5 — More (Reports, Notifications, Audit, Profile) */}
      <Tab.Screen
        name="More"
        component={MoreNavigator}
        options={{
          headerShown: false,
          tabBarBadge:      unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.error },
        }}
        listeners={({ navigation: nav }) => ({
          tabPress: () =>
            nav.reset({ index: 0, routes: [{ name: 'More', state: { routes: [{ name: 'MoreMenu' }] } }] }),
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
