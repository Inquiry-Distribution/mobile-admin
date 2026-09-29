/**
 * CompanyListScreen
 *
 * Lists all companies with name, address, phone and user count.
 * • Superuser: FAB to add, tap row to edit, swipe-delete or delete from edit screen
 * • Admin: read-only list (can browse but not mutate)
 */
import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import useCompanyStore from '@store/company.store';
import useAuthStore    from '@store/auth.store';
import EmptyState      from '@components/common/EmptyState';
import ErrorState      from '@components/common/ErrorState';
import { ListSkeleton } from '@components/common/Skeleton';

export default function CompanyListScreen({ navigation }) {
  const isSuperuser = useAuthStore((s) => s.isSuperuser());
  const {
    companies, isLoading, isRefreshing, isMutating, error,
    fetchCompanies, refreshCompanies, deleteCompany,
  } = useCompanyStore();

  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => { fetchCompanies(); }, [])
  );

  // Client-side filter (list is usually small)
  const filtered = search.trim()
    ? companies.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.address ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : companies;

  const handleDelete = (company) => {
    Alert.alert(
      'Delete Company',
      `Delete "${company.name}"? This cannot be undone.\n\nIf users are assigned to this company, the deletion will fail.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteCompany(company.id);
            if (!result.success) Alert.alert('Cannot Delete', result.message);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Search bar ── */}
      <View style={styles.searchWrap}>
        <Icon name="magnify" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search companies…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CompanyRow
            company={item}
            isSuperuser={isSuperuser}
            onEdit={() => {
              useCompanyStore.getState().setSelected(item);
              navigation.navigate('EditCompany', { companyId: item.id });
            }}
            onDelete={() => handleDelete(item)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshCompanies}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <ListSkeleton count={4} />
          ) : error ? (
            <ErrorState
              compact
              title="Could not load companies"
              message={error}
              onAction={() => fetchCompanies()}
            />
          ) : (
            <EmptyState
              icon="domain-off"
              title="No companies yet"
              message={isSuperuser ? 'Tap + to add the first company.' : 'No companies have been added.'}
              actionLabel={isSuperuser ? 'Add company' : 'Retry'}
              onAction={
                isSuperuser
                  ? () => {
                      useCompanyStore.getState().clearSelected();
                      navigation.navigate('CreateCompany');
                    }
                  : () => fetchCompanies()
              }
            />
          )
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* ── FAB (superuser only) ── */}
      {isSuperuser && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            useCompanyStore.getState().clearSelected();
            navigation.navigate('CreateCompany');
          }}
          activeOpacity={0.85}
        >
          <Icon name="plus" size={26} color={COLORS.white} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ── Company row ───────────────────────────────────────────────
function CompanyRow({ company, isSuperuser, onEdit, onDelete }) {
  const userCount = company._count?.users ?? 0;

  return (
    <View style={styles.row}>
      {/* Icon */}
      <View style={styles.rowIcon}>
        <Icon name="domain" size={22} color={COLORS.primary} />
      </View>

      {/* Info */}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{company.name}</Text>
        {company.address ? (
          <View style={styles.rowMeta}>
            <Icon name="map-marker-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.rowMetaText} numberOfLines={1}>{company.address}</Text>
          </View>
        ) : null}
        {company.phone ? (
          <View style={styles.rowMeta}>
            <Icon name="phone-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.rowMetaText}>{company.phone}</Text>
          </View>
        ) : null}
        <View style={styles.rowMeta}>
          <Icon name="account-multiple-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.rowMetaText}>
            {userCount} user{userCount !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Actions (superuser only) */}
      {isSuperuser && (
        <View style={styles.rowActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={onEdit} activeOpacity={0.7}>
            <Icon name="pencil-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onDelete} activeOpacity={0.7}>
            <Icon name="trash-can-outline" size={18} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  searchWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginVertical:   SPACING.sm,
    borderRadius:    BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    borderWidth:     1,
    borderColor:     COLORS.border,
    height:          44,
    ...SHADOW.sm,
  },
  searchIcon:  { marginRight: 6 },
  searchInput: {
    flex:  1,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyContent:  { flexGrow: 1 },
  listContent:   { paddingBottom: 100, paddingTop: SPACING.xs },

  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:    SPACING.sm,
    padding:         SPACING.md,
    ...SHADOW.sm,
  },
  rowIcon: {
    width:          46,
    height:         46,
    borderRadius:   23,
    backgroundColor: COLORS.primaryLight,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    SPACING.sm,
    flexShrink:     0,
  },
  rowInfo: { flex: 1 },
  rowName: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textPrimary,
    fontFamily: FONTS.bold,
    marginBottom: 3,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     2,
  },
  rowMetaText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    flex:  1,
  },

  rowActions: {
    flexDirection: 'row',
    gap:           4,
    marginLeft:    SPACING.xs,
  },
  actionBtn: {
    width:          36,
    height:         36,
    borderRadius:   18,
    backgroundColor: COLORS.background,
    alignItems:     'center',
    justifyContent: 'center',
  },

  fab: {
    position:        'absolute',
    bottom:          SPACING.xl,
    right:           SPACING.lg,
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW.md,
  },
});
