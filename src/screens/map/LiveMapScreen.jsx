/**
 * LiveMapScreen — real-time salesperson location tracking
 *
 * Features:
 *  • MapView with a marker per salesperson using lastLat / lastLng
 *  • Socket real-time updates via setLocationListener
 *  • Bottom sheet list of active salespersons with last-seen time
 *  • Tap marker or list row → centre map + show callout
 *  • "Recenter" FAB to fit all markers
 *  • Falls back gracefully when maps aren't available
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
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS } from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { getInitials } from '@utils/helpers';

import { locationApi } from '@api/location.api';
import { setLocationListener } from '@services/socket.service';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.3;

const INIT_REGION = {
  latitude:      20.5937,
  longitude:     78.9629,
  latitudeDelta:  15,
  longitudeDelta: 15,
};

export default function LiveMapScreen() {
  const mapRef = useRef(null);

  const [locations, setLocations] = useState([]);  // { salespersonId, name, lat, lng, lastLocatedAt, isOnline }
  const [isLoading, setIsLoading] = useState(true);
  const [selected,  setSelected]  = useState(null); // selected salespersonId

  // ── Fetch initial live positions ──────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // const res  = await locationApi.getLive();
        // const data = res.data ?? res ?? [];
        // if (mounted) setLocations(normalise(data));
      } catch (_) {
        // silently fail — socket will populate
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    // // ── Socket real-time updates ──────────────────────────
    // setLocationListener((update) => {
    //   // update shape: { salespersonId, name, lat, lng, lastLocatedAt }
    //   setLocations((prev) => {
    //     const idx = prev.findIndex((l) => l.salespersonId === update.salespersonId);
    //     if (idx === -1) return [...prev, normaliseOne(update)];
    //     const next = [...prev];
    //     next[idx] = { ...next[idx], ...normaliseOne(update) };
    //     return next;
    //   });
    // });

    return () => {
      mounted = false;
      // clearLocationListener();
    };
  }, []);

  // ── Fit all markers ───────────────────────────────────────
  const fitAll = useCallback(() => {
    // const valid = locations.filter((l) => l.lat && l.lng);
    // if (!valid.length || !mapRef.current) return;

    // if (valid.length === 1) {
    //   mapRef.current.animateToRegion({
    //     latitude:      valid[0].lat,
    //     longitude:     valid[0].lng,
    //     latitudeDelta:  0.05,
    //     longitudeDelta: 0.05,
    //   }, 400);
    // } else {
    //   mapRef.current.fitToCoordinates(
    //     valid.map((l) => ({ latitude: l.lat, longitude: l.lng })),
    //     { edgePadding: { top: 80, right: 40, bottom: SHEET_HEIGHT + 40, left: 40 }, animated: true },
    //   );
    // }
  }, [locations]);

  // ── Centre on selected ────────────────────────────────────
  const centreOn = (loc) => {
    if (!loc.lat || !loc.lng || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      400,
    );
    setSelected(loc.salespersonId);
  };

  const withLocation = locations.filter((l) => l.lat && l.lng);
  const noLocation   = locations.filter((l) => !l.lat && !l.lng);
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
            coordinate={{ latitude: loc.lat, longitude: loc.lng }}
            onPress={() => setSelected(loc.salespersonId)}
          >
            {/* Custom marker pin — green ring when online, grey when offline */}
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
              {/* Online pulse dot */}
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

      {/* ── Fit all FAB ──────────────────────────────────── */}
      <TouchableOpacity style={styles.fab} onPress={fitAll} activeOpacity={0.85}>
        <Icon name="image-filter-center-focus" size={22} color={COLORS.white} />
      </TouchableOpacity>

      {/* ── Live count badge ─────────────────────────────── */}
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>
          {onlineCount} online · {withLocation.length} tracked
        </Text>
      </View>

      {/* ── Bottom sheet ─────────────────────────────────── */}
      <View style={styles.sheet}>
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
      {/* Avatar with online ring */}
      <View style={styles.locAvatarWrap}>
        <View style={[
          styles.locAvatar,
          isSelected && { backgroundColor: COLORS.primary },
          loc.isOnline && styles.locAvatarOnline,
        ]}>
          <Text style={[styles.locInitials, isSelected && { color: COLORS.white }]}>
            {getInitials(loc.name)}
          </Text>
        </View>
        {/* Online / offline dot */}
        <View style={[
          styles.locStatusDot,
          { backgroundColor: loc.isOnline ? '#22C55E' : '#9CA3AF' },
        ]} />
      </View>

      <Text style={styles.locName} numberOfLines={1}>{loc.name}</Text>

      {hasPos ? (
        <Text style={[
          styles.locTime,
          loc.isOnline && { color: '#22C55E', fontWeight: '600' },
        ]}>
          {loc.isOnline ? '● ' : ''}{dayjs(loc.lastLocatedAt).fromNow()}
        </Text>
      ) : (
        <Text style={[styles.locTime, { color: COLORS.textMuted }]}>No location</Text>
      )}
    </TouchableOpacity>
  );
}

// ── Normalise helpers ─────────────────────────────────────────
function normaliseOne(raw) {
  return {
    salespersonId: raw.salespersonId ?? raw.id,
    name:          raw.salespersonName ?? raw.name ?? raw.salesperson?.name ?? 'Unknown',
    lat:           raw.lat   ?? raw.lastLat  ?? raw.latitude  ?? null,
    lng:           raw.lng   ?? raw.lastLng  ?? raw.longitude ?? null,
    address:       raw.address ?? raw.lastAddress ?? null,
    lastLocatedAt: raw.lastLocatedAt ?? raw.recordedAt ?? raw.updatedAt ?? null,
    // isOnline comes from the DB query (15-min threshold) or from
    // user:online / user:offline socket events and location:update pushes
    isOnline:      raw.isOnline ?? false,
  };
}

function normalise(arr) {
  return arr.map(normaliseOne);
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems:     'center',
    justifyContent: 'center',
  },

  // FAB
  fab: {
    position:        'absolute',
    top:             SPACING.xl,
    right:           SPACING.md,
    width:           46,
    height:          46,
    borderRadius:    23,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW.md,
  },

  // Live badge
  liveBadge: {
    position:          'absolute',
    top:               SPACING.xl,
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

  // Marker wrapper (carries the online ring)
  markerWrap: {
    position:  'relative',
    padding:   2,
    borderRadius: 22,
    borderWidth:  2,
    borderColor:  'transparent',
  },
  markerWrapOnline:   { borderColor: '#22C55E' },
  markerWrapOffline:  { borderColor: '#9CA3AF' },
  markerWrapSelected: { borderColor: COLORS.error },

  // Marker pin
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

  // Green pulse dot on online markers
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
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          SHEET_HEIGHT,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius:  BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingTop:      SPACING.sm,
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

  sheetList: {
    paddingHorizontal: SPACING.md,
    gap:               SPACING.sm,
  },

  noData: {
    alignItems:   'center',
    gap:          SPACING.sm,
    paddingTop:   SPACING.lg,
  },
  noDataText: { ...TYPOGRAPHY.small, color: COLORS.textMuted },

  // Location card (horizontal)
  locCard: {
    width:           110,
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
    borderWidth:  2,
    borderColor:  '#22C55E',
  },
  // Online / offline dot badge on avatar
  locStatusDot: {
    position:     'absolute',
    bottom:       0,
    right:        0,
    width:        10,
    height:       10,
    borderRadius: 5,
    borderWidth:  2,
    borderColor:  COLORS.background,
  },
  locInitials: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  locName:     { ...TYPOGRAPHY.caption, color: COLORS.textPrimary, fontWeight: '600', textAlign: 'center' },
  locTime:     { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2 },
});
