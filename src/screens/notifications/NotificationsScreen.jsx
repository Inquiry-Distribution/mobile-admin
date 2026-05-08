/**
 * NotificationsScreen — admin push notification centre
 *
 * Two tabs:
 *  • Inbox   — own received notifications, mark read, mark all read
 *  • Send    — compose & send to specific salesperson(s) or broadcast to all
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';

import useNotificationStore from '@store/notification.store';
import useUserStore         from '@store/user.store';
import Loader               from '@components/common/Loader';
import EmptyState           from '@components/common/EmptyState';

const TABS = ['Inbox', 'Send'];

export default function NotificationsScreen() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Tabs ─────────────────────────────────────── */}
      <View style={styles.tabs}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 0 ? <InboxTab /> : <SendTab />}
    </SafeAreaView>
  );
}

// ── Inbox tab ─────────────────────────────────────────────────
function InboxTab() {
  const {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    fetchNotifications,
    refreshNotifications,
    markRead,
    markAllRead,
  } = useNotificationStore();

  useEffect(() => { fetchNotifications(); }, []);

  if (isLoading && notifications.length === 0) return <Loader />;

  return (
    <View style={{ flex: 1 }}>
      {/* Mark all read button */}
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
          <Icon name="check-all" size={16} color={COLORS.primary} />
          <Text style={styles.markAllText}>Mark all as read ({unreadCount})</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <NotifRow notif={item} onPress={() => !item.isRead && markRead(item.id)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshNotifications}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="bell-off-outline"
            title="No notifications"
            message="Your notification inbox is empty."
          />
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function NotifRow({ notif, onPress }) {
  const { title, body, type, isRead, createdAt } = notif;
  return (
    <TouchableOpacity
      style={[styles.notifRow, !isRead && styles.notifRowUnread]}
      onPress={onPress}
      activeOpacity={isRead ? 1 : 0.78}
    >
      <View style={[styles.notifIcon, { backgroundColor: isRead ? COLORS.border : COLORS.primaryLight }]}>
        <Icon
          name={
            type === 'inquiry_assigned' ? 'clipboard-arrow-right-outline'
            : type === 'alert'          ? 'alert-outline'
            : 'bell-outline'
          }
          size={18}
          color={isRead ? COLORS.textMuted : COLORS.primary}
        />
      </View>
      <View style={styles.notifBody}>
        <View style={styles.notifTop}>
          <Text style={[styles.notifTitle, !isRead && { color: COLORS.textPrimary }]}
            numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.notifTime}>{dayjs(createdAt).fromNow()}</Text>
        </View>
        <Text style={styles.notifBodyText} numberOfLines={2}>{body}</Text>
      </View>
      {!isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ── Send tab ──────────────────────────────────────────────────
function SendTab() {
  const { send, broadcast, isSending } = useNotificationStore();
  const { salespersons, fetchSalespersons, isLoadingSalespersons } = useUserStore();

  const [mode,       setMode]      = useState('specific'); // 'specific' | 'broadcast'
  const [title,      setTitle]     = useState('');
  const [body,       setBody]      = useState('');
  const [selected,   setSelected]  = useState([]);  // array of salesperson ids

  useEffect(() => {
    if (mode === 'specific') fetchSalespersons();
  }, [mode]);

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSend = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a notification title.');
      return;
    }
    if (!body.trim()) {
      Alert.alert('Missing body', 'Please enter a notification body.');
      return;
    }
    if (mode === 'specific' && selected.length === 0) {
      Alert.alert('No recipients', 'Select at least one salesperson.');
      return;
    }

    let result;
    if (mode === 'broadcast') {
      result = await broadcast({ title: title.trim(), body: body.trim() });
    } else {
      result = await send({ recipientIds: selected, title: title.trim(), body: body.trim() });
    }

    if (result?.success) {
      Alert.alert('Sent', 'Notification sent successfully.');
      setTitle('');
      setBody('');
      setSelected([]);
    } else {
      Alert.alert('Error', result?.message ?? 'Failed to send notification.');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.sendScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'specific' && styles.modeBtnActive]}
          onPress={() => setMode('specific')}
        >
          <Icon name="account-multiple-outline" size={15} color={mode === 'specific' ? COLORS.white : COLORS.textSecondary} />
          <Text style={[styles.modeBtnText, mode === 'specific' && { color: COLORS.white }]}>
            Specific
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'broadcast' && styles.modeBtnActive]}
          onPress={() => { setMode('broadcast'); setSelected([]); }}
        >
          <Icon name="bullhorn-outline" size={15} color={mode === 'broadcast' ? COLORS.white : COLORS.textSecondary} />
          <Text style={[styles.modeBtnText, mode === 'broadcast' && { color: COLORS.white }]}>
            Broadcast
          </Text>
        </TouchableOpacity>
      </View>

      {/* Broadcast banner */}
      {mode === 'broadcast' && (
        <View style={styles.broadcastBanner}>
          <Icon name="bullhorn-outline" size={14} color={COLORS.warning} />
          <Text style={styles.broadcastBannerText}>
            This will send to all active salespersons.
          </Text>
        </View>
      )}

      {/* Recipient picker */}
      {mode === 'specific' && (
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Recipients</Text>
          {isLoadingSalespersons ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.sm }} />
          ) : (
            <View style={styles.spGrid}>
              {salespersons.map((sp) => {
                const sel = selected.includes(sp.id);
                return (
                  <TouchableOpacity
                    key={sp.id}
                    style={[styles.spChip, sel && styles.spChipSelected]}
                    onPress={() => toggleSelect(sp.id)}
                    activeOpacity={0.78}
                  >
                    <Text style={[styles.spChipText, sel && { color: COLORS.white }]}>
                      {sp.name}
                    </Text>
                    {sel && <Icon name="check" size={12} color={COLORS.white} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {selected.length > 0 && (
            <Text style={styles.selectedCount}>
              {selected.length} selected
            </Text>
          )}
        </View>
      )}

      {/* Title */}
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Urgent: new high priority inquiry"
          placeholderTextColor={COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
      </View>

      {/* Body */}
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Message</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Enter notification body…"
          placeholderTextColor={COLORS.textMuted}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={300}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{body.length}/300</Text>
      </View>

      {/* Send button */}
      <TouchableOpacity
        style={[
          styles.sendBtn,
          (!title.trim() || !body.trim() || isSending) && styles.sendBtnDisabled,
        ]}
        onPress={handleSend}
        disabled={!title.trim() || !body.trim() || isSending}
        activeOpacity={0.85}
      >
        {isSending ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <>
            <Icon
              name={mode === 'broadcast' ? 'bullhorn-outline' : 'send-outline'}
              size={18}
              color={COLORS.white}
            />
            <Text style={styles.sendBtnText}>
              {mode === 'broadcast' ? 'Broadcast' : 'Send'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Tabs
  tabs: {
    flexDirection:     'row',
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tab: {
    flex:              1,
    alignItems:        'center',
    paddingVertical:   SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: COLORS.primary },
  tabText:       { ...TYPOGRAPHY.bodyMedium, color: COLORS.textSecondary, fontFamily: FONTS.medium },
  tabTextActive: { color: COLORS.primary },

  // Mark all
  markAllBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    alignSelf:         'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    margin:            SPACING.md,
    marginBottom:      SPACING.xs,
    backgroundColor:   COLORS.primaryLight,
    borderRadius:      BORDER_RADIUS.full,
  },
  markAllText: { ...TYPOGRAPHY.small, color: COLORS.primary, fontFamily: FONTS.bold },

  // Notif row
  notifRow: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    gap:              SPACING.sm,
    backgroundColor:  COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical:  SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  notifRowUnread: { backgroundColor: COLORS.primaryLight + '60' },
  notifIcon: {
    width:          40,
    height:         40,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  notifBody:     { flex: 1 },
  notifTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  notifTitle:    { ...TYPOGRAPHY.bodyMedium, color: COLORS.textSecondary, fontFamily: FONTS.medium, flex: 1 },
  notifTime:     { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginLeft: 4 },
  notifBodyText: { ...TYPOGRAPHY.small, color: COLORS.textSecondary },
  unreadDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6 },

  listContent:  { paddingBottom: SPACING.xxl },
  emptyContent: { flexGrow: 1 },

  // Send tab
  sendScroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  modeRow: {
    flexDirection:   'row',
    gap:             SPACING.sm,
    marginBottom:    SPACING.md,
  },
  modeBtn: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               6,
    paddingVertical:   SPACING.sm,
    borderRadius:      BORDER_RADIUS.lg,
    backgroundColor:   COLORS.surface,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
  },
  modeBtnActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeBtnText:    { ...TYPOGRAPHY.bodyMedium, color: COLORS.textSecondary, fontFamily: FONTS.medium },

  broadcastBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   '#FEF3C7',
    borderRadius:      BORDER_RADIUS.md,
    padding:           SPACING.sm,
    marginBottom:      SPACING.md,
    borderWidth:       1,
    borderColor:       COLORS.warning + '60',
  },
  broadcastBannerText: { ...TYPOGRAPHY.small, color: COLORS.textSecondary, flex: 1 },

  section:      { marginBottom: SPACING.md },
  fieldLabel: {
    ...TYPOGRAPHY.smallMedium,
    color:        COLORS.textSecondary,
    fontFamily:   FONTS.medium,
    marginBottom: 6,
  },

  spGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACING.xs,
  },
  spChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   6,
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   COLORS.surface,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
  },
  spChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  spChipText:     { ...TYPOGRAPHY.small, color: COLORS.textSecondary, fontFamily: FONTS.medium },
  selectedCount:  { ...TYPOGRAPHY.caption, color: COLORS.primary, fontFamily: FONTS.medium, marginTop: 6 },

  input: {
    backgroundColor:   COLORS.surface,
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   SPACING.sm,
    ...TYPOGRAPHY.body,
    color:             COLORS.textPrimary,
  },
  inputMulti:  { minHeight: 100, textAlignVertical: 'top' },
  charCount:   { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'right', marginTop: 4 },

  sendBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: COLORS.primary,
    borderRadius:    BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    ...SHADOW.md,
    marginTop:       SPACING.sm,
  },
  sendBtnDisabled: { backgroundColor: COLORS.border, elevation: 0, shadowOpacity: 0 },
  sendBtnText:     { ...TYPOGRAPHY.bodyMedium, color: COLORS.white, fontFamily: FONTS.bold },
});
