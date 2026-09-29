import React, { useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS }                         from '@constants/colors';
import { TYPOGRAPHY, FONTS, FONT_SIZE }   from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import EmptyState from '@components/common/EmptyState';
import ErrorState from '@components/common/ErrorState';
import { ListSkeleton } from '@components/common/Skeleton';
import useGroupStore from '@store/group.store';
import useAuthStore  from '@store/auth.store';

export default function GroupListScreen({ navigation }) {
  const { groups, isLoading, error, fetchGroups } = useGroupStore();
  const isSuperuser = useAuthStore((s) => s.isSuperuser?.() ?? false);

  useEffect(() => { fetchGroups(); }, []);

  if (isLoading && groups.length === 0 && !error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ListSkeleton count={4} />
      </SafeAreaView>
    );
  }

  if (error && groups.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ErrorState
          title="Could not load groups"
          message={error}
          onAction={() => fetchGroups()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* FAB — Create group (superuser only) */}
      {isSuperuser && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateGroup')}
          activeOpacity={0.85}
        >
          <Icon name="plus" size={26} color={COLORS.white} />
        </TouchableOpacity>
      )}

      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        refreshing={isLoading}
        onRefresh={fetchGroups}
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            onPress={() => navigation.navigate('GroupChat', {
              groupId:   item.id,
              groupName: item.name,
            })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="forum-outline"
            title="No groups yet"
            message={isSuperuser ? 'Tap + to create a group.' : 'No groups assigned yet.'}
            actionLabel={isSuperuser ? 'Create group' : 'Retry'}
            onAction={
              isSuperuser
                ? () => navigation.navigate('CreateGroup')
                : () => fetchGroups()
            }
          />
        }
        contentContainerStyle={groups.length === 0 ? styles.emptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function GroupCard({ group, onPress }) {
  const lastMsg    = group.lastMessage;
  const unread     = group.unreadCount ?? 0;
  const memberCount = group.members?.length ?? 0;

  const preview = lastMsg
    ? lastMsg.isPrivate
      ? '🔒 Private message'
      : lastMsg.text?.slice(0, 60)
    : group.description || 'No messages yet';

  const timeStr = lastMsg
    ? dayjs(lastMsg.createdAt).format('hh:mm A')
    : '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.78}>
      <View style={styles.cardAvatar}>
        <Icon name="forum-outline" size={22} color={COLORS.primary} />
        {unread > 0 && (
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarBadgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardName, unread > 0 && styles.cardNameUnread]} numberOfLines={1}>
            {group.name}
          </Text>
          {timeStr ? (
            <Text style={[styles.cardTime, unread > 0 && styles.cardTimeUnread]}>{timeStr}</Text>
          ) : null}
        </View>

        <View style={styles.cardBottom}>
          <Text style={[styles.cardPreview, unread > 0 && styles.cardPreviewUnread]} numberOfLines={1}>
            {preview}
          </Text>
          {unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : (
            <View style={styles.cardMeta}>
              <Icon name="account-multiple-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.cardMetaText}>{memberCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  listContent:  { paddingVertical: SPACING.sm, paddingBottom: SPACING.xxl + 64 },
  emptyContent: { flexGrow: 1 },

  card: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  COLORS.surface,
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
    borderRadius:     BORDER_RADIUS.lg,
    padding:          SPACING.md,
    gap:              SPACING.md,
    ...SHADOW.sm,
  },
  cardAvatar: {
    width:           46,
    height:          46,
    borderRadius:    23,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    position:        'relative',
  },
  cardBody: { flex: 1 },
  cardTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   3,
    gap:            8,
  },
  cardName: {
    ...TYPOGRAPHY.bodyMedium,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
    flex:       1,
  },
  cardTime: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  cardBottom: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  cardPreview: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, flex: 1 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 8 },
  cardMetaText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  // Unread state
  cardNameUnread:    { fontFamily: FONTS.bold },
  cardTimeUnread:    { color: COLORS.primary, fontFamily: FONTS.bold },
  cardPreviewUnread: { color: COLORS.textSecondary, fontFamily: FONTS.medium },

  avatarBadge: {
    position:        'absolute',
    top:             -3,
    right:           -3,
    minWidth:        16,
    height:          16,
    borderRadius:    8,
    backgroundColor: COLORS.error,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
    borderWidth:     1.5,
    borderColor:     COLORS.surface,
  },
  avatarBadgeText: { fontSize: FONT_SIZE.xs, color: COLORS.white, fontFamily: FONTS.bold },

  unreadBadge: {
    minWidth:          20,
    height:            20,
    borderRadius:      10,
    backgroundColor:   COLORS.primary,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 5,
    marginLeft:        8,
  },
  unreadBadgeText: { fontSize: FONT_SIZE.xs, color: COLORS.white, fontFamily: FONTS.bold },

  fab: {
    position:        'absolute',
    bottom:          SPACING.xl,
    right:           SPACING.md,
    width:           54,
    height:          54,
    borderRadius:    27,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          10,
    shadowColor:     COLORS.primary,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    8,
    elevation:       8,
  },
});
