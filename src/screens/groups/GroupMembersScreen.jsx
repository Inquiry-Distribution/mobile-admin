import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }                         from '@constants/colors';
import { TYPOGRAPHY }                     from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import useGroupStore from '@store/group.store';
import useUserStore  from '@store/user.store';

export default function GroupMembersScreen({ route, navigation }) {
  const { groupId } = route.params;

  const { selectedGroup, groups, addMembers, removeMember, isMutating } = useGroupStore();
  const { salespersons, fetchSalespersons, isLoadingSalespersons }       = useUserStore();

  const [addVisible, setAddVisible] = useState(false);
  const [search,     setSearch]     = useState('');
  const [selected,   setSelected]   = useState([]);

  // Resolve group from store
  const group = groups.find((g) => g.id === groupId) ?? selectedGroup;
  const members = group?.members ?? [];
  const memberIds = members.map((m) => m.userId);

  useEffect(() => { fetchSalespersons(); }, []);

  // Salespersons NOT yet in the group
  const available = salespersons.filter(
    (sp) => !memberIds.includes(sp.id) &&
      (!search || sp.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAdd = async () => {
    if (selected.length === 0) return;
    const result = await addMembers(groupId, selected);
    if (result.success) {
      setAddVisible(false);
      setSelected([]);
      setSearch('');
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleRemove = (member) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.user.name} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:    'Remove',
          style:   'destructive',
          onPress: () => removeMember(groupId, member.userId),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header count */}
      <View style={styles.header}>
        <Text style={styles.headerCount}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAddVisible(true)}
          activeOpacity={0.85}
        >
          <Icon name="account-plus-outline" size={16} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add Members</Text>
        </TouchableOpacity>
      </View>

      {/* Member list */}
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.user.name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
              </Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.user.name}</Text>
              <Text style={styles.memberEmail}>{item.user.email}</Text>
            </View>
            <TouchableOpacity
              onPress={() => handleRemove(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="account-remove-outline" size={20} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No members yet. Tap "Add Members".</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Add Members Modal */}
      <Modal
        visible={addVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => { setAddVisible(false); setSearch(''); setSelected([]); }}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add Members</Text>
            <TouchableOpacity onPress={() => { setAddVisible(false); setSearch(''); setSelected([]); }}>
              <Icon name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Icon name="magnify" size={16} color={COLORS.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search salesperson…"
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          {isLoadingSalespersons
            ? <ActivityIndicator color={COLORS.primary} style={{ margin: SPACING.xl }} />
            : (
              <FlatList
                data={available}
                keyExtractor={(s) => s.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = selected.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.spRow, isSelected && styles.spRowSelected]}
                      onPress={() => toggleSelect(item.id)}
                    >
                      <View style={[styles.spAvatar, isSelected && styles.spAvatarSelected]}>
                        <Text style={[styles.spAvatarText, isSelected && { color: COLORS.white }]}>
                          {item.name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.spInfo}>
                        <Text style={styles.spName}>{item.name}</Text>
                        <Text style={styles.spEmail}>{item.email}</Text>
                      </View>
                      {isSelected && <Icon name="check-circle" size={20} color={COLORS.primary} />}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyText}>No salespersons available.</Text>
                  </View>
                }
                contentContainerStyle={{ paddingBottom: SPACING.xl }}
              />
            )
          }

          <TouchableOpacity
            style={[styles.confirmBtn, (selected.length === 0 || isMutating) && styles.confirmBtnDisabled]}
            onPress={handleAdd}
            disabled={selected.length === 0 || isMutating}
          >
            {isMutating
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.confirmBtnText}>
                  Add {selected.length > 0 ? `${selected.length} ` : ''}Member{selected.length !== 1 ? 's' : ''}
                </Text>
            }
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },
  listContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },

  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerCount: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textSecondary, fontWeight: '600' },
  addBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical:   8,
    borderRadius:    BORDER_RADIUS.full,
  },
  addBtnText: { ...TYPOGRAPHY.small, color: COLORS.white, fontWeight: '700' },

  memberRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    gap:             SPACING.md,
    ...SHADOW.sm,
  },
  avatar: {
    width:           42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center', justifyContent: 'center',
  },
  avatarText:   { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  memberInfo:   { flex: 1 },
  memberName:   { ...TYPOGRAPHY.bodyMedium, fontWeight: '600', color: COLORS.textPrimary },
  memberEmail:  { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 1 },

  emptyWrap:  { padding: SPACING.xl, alignItems: 'center' },
  emptyText:  { ...TYPOGRAPHY.body, color: COLORS.textMuted },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor:      COLORS.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    maxHeight:            '78%',
    paddingTop:           4,
  },
  sheetHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: { ...TYPOGRAPHY.bodyMedium, fontWeight: '700', color: COLORS.textPrimary },
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    margin:            SPACING.md,
    paddingHorizontal: SPACING.sm,
    height:            40,
    borderRadius:      BORDER_RADIUS.md,
    backgroundColor:   COLORS.background,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  searchInput: { flex: 1, ...TYPOGRAPHY.body, color: COLORS.textPrimary },

  spRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
  },
  spRowSelected:   { backgroundColor: COLORS.primaryLight },
  spAvatar:        { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  spAvatarSelected:{ backgroundColor: COLORS.primary },
  spAvatarText:    { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  spInfo:          { flex: 1 },
  spName:          { ...TYPOGRAPHY.body, fontWeight: '600', color: COLORS.textPrimary },
  spEmail:         { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 1 },

  confirmBtn: {
    margin:          SPACING.md,
    height:          48,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.white, fontWeight: '700' },
});
