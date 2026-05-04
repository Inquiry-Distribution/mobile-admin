/**
 * BusinessLocationListScreen
 *
 * Shows all registered office / factory locations used for attendance
 * geofencing. Admin can add, edit, toggle active, and delete locations.
 *
 * Each card shows:
 *   • Name + type badge
 *   • Lat / Lng
 *   • Radius (metres)
 *   • Active / Inactive status
 *   • Edit + Delete action buttons
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import EmptyState from '@components/common/EmptyState';
import { businessLocationApi } from '@api/businessLocation.api';

// ── Type icon map ─────────────────────────────────────────────
const TYPE_META = {
  office:    { icon: 'office-building-outline', color: '#2563EB' },
  factory:   { icon: 'factory',                 color: '#D97706' },
  warehouse: { icon: 'warehouse',               color: '#7C3AED' },
  branch:    { icon: 'store-outline',           color: '#059669' },
};
const typeOf = (t) => TYPE_META[t] ?? { icon: 'map-marker-outline', color: COLORS.textMuted };

// ─────────────────────────────────────────────────────────────
export default function BusinessLocationListScreen({ navigation }) {
  const [locations,   setLocations]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [toggling,    setToggling]    = useState(null); // id of row being toggled

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await businessLocationApi.getAll();
      setLocations(res.data ?? []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to load locations', text2: e.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRefresh = () => { setRefreshing(true); load(true); };

  const handleToggleActive = async (loc) => {
    setToggling(loc.id);
    try {
      const res = await businessLocationApi.update(loc.id, { isActive: !loc.isActive });
      setLocations((prev) => prev.map((l) => l.id === loc.id ? res.data : l));
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: e.message });
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = (loc) => {
    Alert.alert(
      'Delete Location',
      `Delete "${loc.name}"? Salespersons will no longer be required to check in from this location.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await businessLocationApi.remove(loc.id);
              setLocations((prev) => prev.filter((l) => l.id !== loc.id));
              Toast.show({ type: 'success', text1: 'Location deleted' });
            } catch (e) {
              Alert.alert('Cannot Delete', e.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Info banner ── */}
      <View style={styles.infoBanner}>
        <Icon name="information-outline" size={15} color={COLORS.primary} />
        <Text style={styles.infoText}>
          Salespersons must check in/out from within the radius of an active location.
        </Text>
      </View>

      <FlatList
        data={locations}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        renderItem={({ item }) => (
          <LocationCard
            location={item}
            toggling={toggling === item.id}
            onToggleActive={() => handleToggleActive(item)}
            onEdit={() => navigation.navigate('BusinessLocationForm', { location: item })}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <EmptyState
              icon="map-marker-off-outline"
              title="No locations yet"
              message="Tap + to add your first office or factory location."
            />
          )
        }
        contentContainerStyle={locations.length === 0 ? styles.emptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('BusinessLocationForm', { location: null })}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={26} color={COLORS.white} />
      </TouchableOpacity>

    </SafeAreaView>
  );
}

// ── Location card ─────────────────────────────────────────────
function LocationCard({ location, toggling, onToggleActive, onEdit, onDelete }) {
  const meta = typeOf(location.type);

  return (
    <View style={[styles.card, !location.isActive && styles.cardInactive]}>

      {/* Left icon */}
      <View style={[styles.locIcon, { backgroundColor: meta.color + '18' }]}>
        <Icon name={meta.icon} size={22} color={meta.color} />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={1}>{location.name}</Text>
          <View style={[styles.typeBadge, { backgroundColor: meta.color + '18' }]}>
            <Text style={[styles.typeBadgeText, { color: meta.color }]}>
              {location.type}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <Icon name="crosshairs-gps" size={11} color={COLORS.textMuted} />
          <Text style={styles.cardMetaText}>
            {Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}
          </Text>
        </View>

        <View style={styles.cardMeta}>
          <Icon name="radius-outline" size={11} color={COLORS.textMuted} />
          <Text style={styles.cardMetaText}>{location.radiusMetres} m radius</Text>
        </View>

        {/* Active toggle + actions */}
        <View style={styles.cardFooter}>
          <View style={styles.activeRow}>
            {toggling ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Switch
                value={location.isActive}
                onValueChange={onToggleActive}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
                thumbColor={location.isActive ? COLORS.primary : COLORS.textMuted}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            )}
            <Text style={[styles.activeLabel, { color: location.isActive ? COLORS.success : COLORS.textMuted }]}>
              {location.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={onEdit} activeOpacity={0.7}>
              <Icon name="pencil-outline" size={17} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={onDelete} activeOpacity={0.7}>
              <Icon name="trash-can-outline" size={17} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.background },
  listContent:  { paddingBottom: 100, paddingTop: SPACING.xs },
  emptyContent: { flexGrow: 1 },
  loadingWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  infoBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   COLORS.primaryLight,
    marginHorizontal:  SPACING.md,
    marginTop:         SPACING.sm,
    marginBottom:      SPACING.xs,
    borderRadius:      BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    borderWidth:       1,
    borderColor:       COLORS.primary + '30',
  },
  infoText: {
    ...TYPOGRAPHY.caption,
    color:   COLORS.primary,
    flex:    1,
    lineHeight: 17,
  },

  card: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
    padding:          SPACING.md,
    ...SHADOW.sm,
  },
  cardInactive: { opacity: 0.6 },

  locIcon: {
    width:          46,
    height:         46,
    borderRadius:   23,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    SPACING.sm,
    flexShrink:     0,
  },
  cardContent:  { flex: 1 },
  cardTitleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACING.xs,
    marginBottom:   4,
    flexWrap:       'wrap',
  },
  cardName: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textPrimary,
    fontWeight: '700',
    flex:       1,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      BORDER_RADIUS.full,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  cardMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     3,
  },
  cardMetaText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  cardFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      SPACING.sm,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  activeLabel: { fontSize: 12, fontWeight: '600' },

  cardActions: {
    flexDirection: 'row',
    gap:           6,
  },
  actionBtn: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: COLORS.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
  deleteBtn: { backgroundColor: COLORS.error + '12' },

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
