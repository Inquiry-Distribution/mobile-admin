/**
 * LiveMapScreen — real-time salesperson location tracking
 *
 * Data flow:
 *  1. On mount → useLocationStore.fetchIfStale(true) hits GET /locations/live
 *  2. Socket service writes location:update / user:online / user:offline
 *     directly into useLocationStore — no wiring needed here
 *  3. Component subscribes to the store and re-renders automatically
 *
 * Features:
 *  • MapView with a marker per salesperson
 *  • Real-time updates via Zustand store (fed by socket service)
 *  • Bottom sheet list of salespersons with last-seen time
 *  • Tap marker or card → centre map + show callout
 *  • Recenter FAB → fitToCoordinates for all tracked markers
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS }                         from '@constants/colors';
import { TYPOGRAPHY }                     from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { getInitials }                    from '@utils/helpers';

import useLocationStore     from '@store/location.store';
import { CONFIG }           from '@constants/config';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.3;

const INIT_REGION = {
  latitude:       CONFIG.MAP_DEFAULT_LATITUDE  ?? 20.5937,
  longitude:      CONFIG.MAP_DEFAULT_LONGITUDE ?? 78.9629,
  latitudeDelta:  15,
  longitudeDelta: 15,
};

export default function LiveMapScreen() {
  const mapRef      = useRef(null);
  const markerRefs  = useRef({});          // salespersonId → Marker ref
  const insets      = useSafeAreaInsets();

  const { locations, isLoading, fetchIfStale } = useLocationStore();
  const [selected, setSelected] = useState(null); // salespersonId

  // ── Initial fetch + periodic refresh ─────────────────────────
  useEffect(() => {
    fetchIfStale(true); // force on mount

    // Poll every MAP_LIVE_REFRESH_MS (15 s) as a fallback for when
    // the socket connection drops or the device is in the background.
    const interval = setInterval(
      () => fetchIfStale(),
      CONFIG.MAP_LIVE_REFRESH_MS ?? 15000,
    );
    return () => clearInterval(interval);
  }, []);

  // ── Fit all markers in view ───────────────────────────────────
  const fitAll = useCallback(() => {
    const valid = locations.filter((l) => l.lat && l.lng);
    if (!valid.length || !mapRef.current) return;

    if (valid.length === 1) {
      mapRef.current.animateToRegion(
        { latitude: valid[0].lat, longitude: valid[0].lng, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        400,
      );
    } else {
      mapRef.current.fitToCoordinates(
        valid.map((l) => ({ latitude: l.lat, longitude: l.lng })),
        { edgePadding: { top: 80, right: 40, bottom: SHEET_HEIGHT + 40, left: 40 }, animated: true },
      );
    }
  }, [locations]);

  // ── Centre map on a single salesperson ───────────────────────
  const centreOn = useCallback((loc) => {
    if (!loc.lat || !loc.lng || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      400,
    );
    setSelected(loc.salespersonId);
    // Show the callout after the animation settles
    setTimeout(() => {
      markerRefs.current[loc.salespersonId]?.showCallout?.();
    }, 450);
  }, []);

  const withLocation = locations.filter((l) => l.lat && l.lng);
  const onlineCount  = locations.filter((l) => l.isOnline).length;

  return (
    <View style={styles.container}>

      {/* ── Map ─────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={INIT_REGION}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass
        showsScale
      >
        {withLocation.map((loc) => (
          <Marker
            key={loc.salespersonId}
            ref={(r) => { markerRefs.current[loc.salespersonId] = r; }}
            coordinate={{ latitude: loc.lat, longitude: loc.lng }}
            onPress={() => setSelected(loc.salespersonId)}
          >
            {/* Custom marker pin */}
            <View style={[
              styles.markerWrap,
              loc.isOnline ? styles.markerWrapOnline : styles.markerWrapOffline,
              selected === loc.salespersonId && styles.markerWrapSelected,
            ]}>
              <View style={[
                styles.markerPin,
                !loc.isOnline && styles.markerPinOffline,
                selected === loc.salespersonId && styles.markerPinSelected,
              ]}>
                <Text style={styles.markerInitials}>{getInitials(loc.name)}</Text>
              </View>
              {loc.isOnline && <View style={styles.markerOnlineDot} />}
            </View>

            <Callout tooltip>
              <View style={styles.callout}>
                <View style={styles.calloutHeader}>
                  <Text style={styles.calloutName}>{loc.name}</Text>
                  <View style={[
                    styles.calloutStatusDot,
                    { backgroundColor: loc.isOnline ? '#22C55E' : COLORS.textMuted },
                  ]} />
                </View>
                {loc.lastLocatedAt ? (
                  <Text style={[
                    styles.calloutTime,
                    { color: loc.isOnline ? '#22C55E' : COLORS.textMuted },
                  ]}>
                    {loc.isOnline ? 'Online · ' : 'Last seen · '}
                    {dayjs(loc.lastLocatedAt).fromNow()}
                  </Text>
                ) : null}
                {loc.address ? (
                  <Text style={styles.calloutAddress} numberOfLines={2}>{loc.address}</Text>
                ) : null}
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* ── Loading overlay ──────────────────────────────── */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      )}

      {/* ── Recenter FAB ─────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.fab, { top: SPACING.md + insets.top }, withLocation.length === 0 && styles.fabDisabled]}
        onPress={fitAll}
        activeOpacity={0.85}
        disabled={withLocation.length === 0}
      >
        <Icon name="image-filter-center-focus" size={22} color={COLORS.white} />
      </TouchableOpacity>

      {/* ── Live count badge ─────────────────────────────── */}
      <View style={[styles.liveBadge, { top: SPACING.md + insets.top }]}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>
          {onlineCount} online · {withLocation.length} tracked
        </Text>
      </View>

      {/* ── Bottom sheet ─────────────────────────────────── */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom || SPACING.sm }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>
          Salespersons ({locations.length})
        </Text>

        {locations.length === 0 && !isLoading ? (
          <View style={styles.noData}>
            <Icon name="map-marker-off-outline" size={24} color={COLORS.textMuted} />
            <Text style={styles.noDataText}>No location data available</Text>
          </View>
        ) : (
          <FlatList
            data={locations}
            keyExtractor={(item) => item.salespersonId}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.sheetFlatList}
            contentContainerStyle={styles.sheetList}
            renderItem={({ item }) => (
              <LocationCard
                loc={item}
                isSelected={selected === item.salespersonId}
                onPress={() => item.lat ? centreOn(item) : null}
              />
            )}
          />
        )}
      </View>
    </View>
  );
}

// ── Location card ─────────────────────────────────────────────
function LocationCard({ loc, isSelected, onPress }) {
  const hasPos = !!(loc.lat && loc.lng);
  return (
    <TouchableOpacity
      style={[styles.locCard, isSelected && styles.locCardSelected]}
      onPress={onPress}
      activeOpacity={hasPos ? 0.78 : 1}
    >
      <View style={styles.locAvatarWrap}>
        <View style={[
          styles.locAvatar,
          isSelected      && { backgroundColor: COLORS.primary },
          loc.isOnline    && styles.locAvatarOnline,
        ]}>
          <Text style={[styles.locInitials, isSelected && { color: COLORS.white }]}>
            {getInitials(loc.name)}
          </Text>
        </View>
        <View style={[
          styles.locStatusDot,
          { backgroundColor: loc.isOnline ? '#22C55E' : '#9CA3AF' },
        ]} />
      </View>

      <Text style={styles.locName} numberOfLines={1}>{loc.name}</Text>

      {hasPos ? (
        <Text style={[styles.locTime, loc.isOnline && styles.locTimeOnline]}>
          {loc.isOnline ? '● ' : ''}{dayjs(loc.lastLocatedAt).fromNow()}
        </Text>
      ) : (
        <Text style={[styles.locTime, styles.locTimeNoPos]}>No location</Text>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
  },

  // FAB
  fab: {
    position:        'absolute',
    // top is set inline with safe-area inset
    right:           SPACING.md,
    width:           46,
    height:          46,
    borderRadius:    23,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW.md,
  },
  fabDisabled: {
    backgroundColor: COLORS.textMuted,
    elevation:       0,
    shadowOpacity:   0,
  },

  // Live badge
  liveBadge: {
    position:          'absolute',
    // top is set inline with safe-area inset
    left:              SPACING.md,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   'rgba(0,0,0,0.6)',
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
  },
  liveDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  liveText: { ...TYPOGRAPHY.caption, color: COLORS.white, fontWeight: '700' },

  // Marker
  markerWrap: {
    position:     'relative',
    padding:      2,
    borderRadius: 22,
    borderWidth:  2,
    borderColor:  'transparent',
  },
  markerWrapOnline:   { borderColor: '#22C55E' },
  markerWrapOffline:  { borderColor: '#9CA3AF' },
  markerWrapSelected: { borderColor: COLORS.error },

  markerPin: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW.md,
  },
  markerPinOffline:  { backgroundColor: '#9CA3AF' },
  markerPinSelected: { backgroundColor: COLORS.error },
  markerInitials:    { fontSize: 12, fontWeight: '800', color: COLORS.white },

  markerOnlineDot: {
    position:        'absolute',
    bottom:          0,
    right:           0,
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: '#22C55E',
    borderWidth:     2,
    borderColor:     COLORS.white,
  },

  // Callout
  callout: {
    backgroundColor: COLORS.white,
    borderRadius:    BORDER_RADIUS.lg,
    padding:         SPACING.sm,
    minWidth:        160,
    ...SHADOW.md,
  },
  calloutHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   2,
  },
  calloutStatusDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    marginLeft:   6,
  },
  calloutName:    { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '700' },
  calloutTime:    { ...TYPOGRAPHY.caption, color: COLORS.primary },
  calloutAddress: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 },

  // Bottom sheet
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    height:               SHEET_HEIGHT,
    backgroundColor:      COLORS.surface,
    borderTopLeftRadius:  BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingTop:           SPACING.sm,
    ...SHADOW.lg,
  },
  sheetHandle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: COLORS.border,
    alignSelf:       'center',
    marginBottom:    SPACING.sm,
  },
  sheetTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color:             COLORS.textPrimary,
    fontWeight:        '700',
    paddingHorizontal: SPACING.md,
    marginBottom:      SPACING.sm,
  },
  sheetFlatList: {
    flexGrow:  0,      // prevents the list from stretching to fill the sheet
    flexShrink: 1,
  },
  sheetList: {
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    gap:               SPACING.sm,
    alignItems:        'flex-start', // cards size to their own content, not the row height
  },
  noData: {
    alignItems: 'center',
    gap:        SPACING.sm,
    paddingTop: SPACING.lg,
  },
  noDataText: { ...TYPOGRAPHY.small, color: COLORS.textMuted },

  // Location card
  locCard: {
    width:           130,
    alignItems:      'center',
    backgroundColor: COLORS.background,
    borderRadius:    BORDER_RADIUS.lg,
    padding:         SPACING.sm,
    borderWidth:     1.5,
    borderColor:     'transparent',
    ...SHADOW.sm,
  },
  locCardSelected: {
    borderColor:     COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  locAvatarWrap: {
    position:     'relative',
    marginBottom: 4,
  },
  locAvatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  locAvatarOnline: {
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  locStatusDot: {
    position:     'absolute',
    bottom:       0,
    right:        0,
    width:        10,
    height:       10,
    borderRadius: 5,
    // No border — avoids background-colour mismatch on selected cards
  },
  locInitials:    { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  locName:        { ...TYPOGRAPHY.caption, color: COLORS.textPrimary, fontWeight: '600', textAlign: 'center' },
  locTime:        { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2 },
  locTimeOnline:  { color: '#22C55E', fontWeight: '600' },
  locTimeNoPos:   { color: COLORS.textMuted },
});
