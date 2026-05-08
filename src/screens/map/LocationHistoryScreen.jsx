/**
 * LocationHistoryScreen
 *
 * GPS trail for a single salesperson on a chosen date.
 * Navigated from UserDetailScreen with params: { salespersonId, name }
 *
 * Features:
 *  • Date navigator (prev / next, capped at today)
 *  • MapView with Polyline connecting all GPS points
 *  • Start (green) and End (red) markers
 *  • Stats bar — total points, distance, time span
 *  • Scrollable checkpoint list below the map
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS }       from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, FONTS }   from '@constants/typography';
import { locationApi }  from '@api/location.api';
import { formatTime, distanceKm } from '@utils/helpers';

// ─── Constants ────────────────────────────────────────────────────────────────
const TODAY = dayjs().format('YYYY-MM-DD');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalise lat/lng field variations from the API */
function normCoord(pt) {
  const lat = pt.lat ?? pt.latitude  ?? pt.lastLat ?? null;
  const lng = pt.lng ?? pt.longitude ?? pt.lastLng ?? null;
  return lat != null && lng != null ? { latitude: lat, longitude: lng } : null;
}

/** Total polyline distance in km */
function totalDistance(coords) {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    d += distanceKm(a.latitude, a.longitude, b.latitude, b.longitude);
  }
  return d;
}

/** Get map region that fits all coordinates */
function regionFor(coords) {
  if (!coords.length) return null;
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padLat = Math.max((maxLat - minLat) * 0.25, 0.005);
  const padLng = Math.max((maxLng - minLng) * 0.25, 0.005);
  return {
    latitude:       (minLat + maxLat) / 2,
    longitude:      (minLng + maxLng) / 2,
    latitudeDelta:  maxLat - minLat + padLat,
    longitudeDelta: maxLng - minLng + padLng,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ icon, label, value, color = COLORS.primary }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={14} color={color} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function CheckpointRow({ point, index, total }) {
  const isFirst = index === 0;
  const isLast  = index === total - 1;
  const coord   = normCoord(point);

  return (
    <View style={styles.cpRow}>
      {/* Timeline line + dot */}
      <View style={styles.cpTimeline}>
        <View style={[styles.cpLine, { opacity: isFirst ? 0 : 1 }]} />
        <View style={[
          styles.cpDot,
          isFirst ? styles.cpDotStart : isLast ? styles.cpDotEnd : styles.cpDotMid,
        ]} />
        <View style={[styles.cpLine, { opacity: isLast ? 0 : 1 }]} />
      </View>

      {/* Content */}
      <View style={styles.cpContent}>
        <Text style={styles.cpTime}>{formatTime(point.recordedAt ?? point.timestamp)}</Text>
        {coord ? (
          <Text style={styles.cpCoord}>
            {coord.latitude.toFixed(5)}, {coord.longitude.toFixed(5)}
          </Text>
        ) : null}
        {point.address ? (
          <Text style={styles.cpAddress} numberOfLines={1}>{point.address}</Text>
        ) : null}
        {isFirst && <View style={styles.cpBadge}><Text style={styles.cpBadgeText}>START</Text></View>}
        {isLast  && <View style={[styles.cpBadge, styles.cpBadgeEnd]}><Text style={styles.cpBadgeText}>END</Text></View>}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LocationHistoryScreen({ route }) {
  const { salespersonId, name } = route.params ?? {};

  const [date,        setDate]        = useState(TODAY);
  const [points,      setPoints]      = useState([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState(null);

  const mapRef = useRef(null);

  const load = useCallback(async (d) => {
    setIsLoading(true);
    setError(null);
    setPoints([]);
    try {
      const res  = await locationApi.getHistory(salespersonId, { from: d, to: d, limit: 500 });
      const data = Array.isArray(res.data) ? res.data
                 : Array.isArray(res)      ? res
                 : [];
      setPoints(data);
    } catch (err) {
      setError(err.message ?? 'Failed to load location data');
    } finally {
      setIsLoading(false);
    }
  }, [salespersonId]);

  useEffect(() => { load(date); }, [date]);

  // Fit map to all points
  useEffect(() => {
    if (!points.length || !mapRef.current) return;
    const coords = points.map(normCoord).filter(Boolean);
    if (coords.length < 2) return;
    const timeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 40, bottom: 40, left: 40, right: 40 },
        animated: true,
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [points]);

  // Date navigation
  const isToday   = date === TODAY;
  const prevDate  = () => setDate((d) => dayjs(d).subtract(1, 'day').format('YYYY-MM-DD'));
  const nextDate  = () => {
    if (!isToday) setDate((d) => dayjs(d).add(1, 'day').format('YYYY-MM-DD'));
  };
  const goToToday = () => setDate(TODAY);

  // Derived
  const coords    = points.map(normCoord).filter(Boolean);
  const distKm    = coords.length > 1 ? totalDistance(coords).toFixed(2) : '0.00';
  const startTime = points.length ? formatTime(points[0].recordedAt ?? points[0].timestamp) : '—';
  const endTime   = points.length ? formatTime(points[points.length - 1].recordedAt ?? points[points.length - 1].timestamp) : '—';
  const region    = coords.length ? regionFor(coords) : null;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Date bar ──────────────────────────────────────── */}
      <View style={styles.dateBar}>
        <TouchableOpacity style={styles.dateArrow} onPress={prevDate}>
          <Icon name="chevron-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.dateCenter}>
          <Text style={styles.dateText}>
            {date === TODAY ? 'Today' : dayjs(date).format('DD MMM YYYY')}
          </Text>
          <Text style={styles.dateSub}>{dayjs(date).format('dddd')}</Text>
        </View>

        <TouchableOpacity
          style={[styles.dateArrow, isToday && styles.dateArrowDisabled]}
          onPress={nextDate}
          disabled={isToday}
        >
          <Icon name="chevron-right" size={24} color={isToday ? COLORS.textMuted : COLORS.primary} />
        </TouchableOpacity>

        {!isToday && (
          <TouchableOpacity style={styles.todayBtn} onPress={goToToday}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Map ───────────────────────────────────────────── */}
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={region ?? {
            latitude: 28.6139, longitude: 77.2090,
            latitudeDelta: 0.1, longitudeDelta: 0.1,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {coords.length > 1 && (
            <Polyline
              coordinates={coords}
              strokeColor={COLORS.primary}
              strokeWidth={3}
            />
          )}

          {/* Start marker */}
          {coords.length > 0 && (
            <Marker coordinate={coords[0]} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.markerStart}>
                <Icon name="map-marker-check" size={18} color={COLORS.white} />
              </View>
            </Marker>
          )}

          {/* End marker */}
          {coords.length > 1 && (
            <Marker coordinate={coords[coords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.markerEnd}>
                <Icon name="map-marker-radius" size={18} color={COLORS.white} />
              </View>
            </Marker>
          )}
        </MapView>

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.mapOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

        {/* No data overlay */}
        {!isLoading && !error && points.length === 0 && (
          <View style={styles.mapOverlay}>
            <Icon name="map-marker-off-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.noDataText}>No location data for this date</Text>
          </View>
        )}

        {/* FAB — fit all */}
        {coords.length > 1 && (
          <TouchableOpacity
            style={styles.fitFab}
            onPress={() =>
              mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 40, bottom: 40, left: 40, right: 40 },
                animated: true,
              })
            }
          >
            <Icon name="fit-to-screen-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Stats bar ─────────────────────────────────────── */}
      {!isLoading && points.length > 0 && (
        <View style={styles.statsBar}>
          <StatBadge icon="map-marker-multiple-outline" label="Points"   value={points.length} />
          <View style={styles.statDivider} />
          <StatBadge icon="road-variant"                label="Distance" value={`${distKm} km`} />
          <View style={styles.statDivider} />
          <StatBadge icon="clock-start"                 label="Start"    value={startTime} color={COLORS.success} />
          <View style={styles.statDivider} />
          <StatBadge icon="clock-end"                   label="End"      value={endTime}   color={COLORS.error} />
        </View>
      )}

      {/* ── Checkpoint list ───────────────────────────────── */}
      {!isLoading && !error && points.length > 0 && (
        <FlatList
          data={points}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <CheckpointRow point={item} index={index} total={points.length} />
          )}
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              {points.length} checkpoint{points.length !== 1 ? 's' : ''}
            </Text>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* ── Error state ───────────────────────────────────── */}
      {!isLoading && error && (
        <View style={styles.errorBox}>
          <Icon name="alert-circle-outline" size={36} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(date)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { backgroundColor: COLORS.background },

  // ── Date bar ───────────────────────────────────────────────────
  dateBar: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical:   6,
  },
  dateArrow:         { padding: 8 },
  dateArrowDisabled: { opacity: 0.3 },
  dateCenter:        { flex: 1, alignItems: 'center' },
  dateText: {
    ...TYPOGRAPHY.body,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
  },
  dateSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    backgroundColor:   COLORS.primaryLight,
    borderRadius:      8,
    marginLeft:        4,
  },
  todayBtnText: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.primary,
    fontFamily: FONTS.bold,
  },

  // ── Map ────────────────────────────────────────────────────────
  mapWrap: {
    height:           280,
    backgroundColor:  COLORS.border,
    position:         'relative',
  },
  map:    { flex: 1 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
  },
  noDataText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },

  // ── Markers ────────────────────────────────────────────────────
  markerStart: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: COLORS.success,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     COLORS.white,
    elevation:       4,
  },
  markerEnd: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: COLORS.error,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     COLORS.white,
    elevation:       4,
  },

  // ── Fit FAB ────────────────────────────────────────────────────
  fitFab: {
    position:        'absolute',
    bottom:          12,
    right:           12,
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: COLORS.white,
    alignItems:      'center',
    justifyContent:  'center',
    elevation:       4,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.15,
    shadowRadius:    4,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },

  // ── Stats bar ──────────────────────────────────────────────────
  statsBar: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    justifyContent:  'space-around',
  },
  stat: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  statValue: { ...TYPOGRAPHY.body, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  statLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  statDivider: {
    width:           1,
    height:          28,
    backgroundColor: COLORS.border,
  },

  // ── Checkpoint list ────────────────────────────────────────────
  listContent: { padding: 16, paddingTop: 8 },
  listHeader: {
    ...TYPOGRAPHY.caption,
    color:        COLORS.textMuted,
    fontFamily:   FONTS.medium,
    marginBottom: 8,
  },

  cpRow: {
    flexDirection: 'row',
    minHeight:     56,
  },

  // Timeline
  cpTimeline: {
    width:       24,
    alignItems:  'center',
    marginRight: 12,
  },
  cpLine: {
    flex:             1,
    width:            2,
    backgroundColor:  COLORS.border,
  },
  cpDot: {
    width:        12,
    height:       12,
    borderRadius: 6,
    borderWidth:  2,
  },
  cpDotStart: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  cpDotEnd:   { backgroundColor: COLORS.error,   borderColor: COLORS.error   },
  cpDotMid:   { backgroundColor: COLORS.white,   borderColor: COLORS.primary },

  // Content
  cpContent: {
    flex:          1,
    paddingBottom: 12,
    gap:           2,
  },
  cpTime: {
    ...TYPOGRAPHY.body,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
  },
  cpCoord: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cpAddress: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  cpBadge: {
    alignSelf:       'flex-start',
    backgroundColor: COLORS.success + '20',
    borderRadius:    4,
    paddingHorizontal: 6,
    paddingVertical:   2,
    marginTop:       4,
  },
  cpBadgeEnd:  { backgroundColor: COLORS.error + '20' },
  cpBadgeText: {
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.bold,
    color:      COLORS.success,
    letterSpacing: 0.5,
  },

  // ── Error ──────────────────────────────────────────────────────
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical:   10,
    backgroundColor:   COLORS.primary,
    borderRadius:      8,
  },
  retryText: { ...TYPOGRAPHY.body, color: COLORS.white, fontFamily: FONTS.bold },
});
