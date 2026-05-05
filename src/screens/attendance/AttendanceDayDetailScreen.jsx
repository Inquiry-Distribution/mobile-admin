/**
 * AttendanceDayDetailScreen — Admin & Superuser
 *
 * Shows the full session breakdown for one salesperson on one day.
 * Navigated to from AttendanceScreen by tapping a row.
 * route.params: { record }  — full Attendance with sessions[] and salesperson
 */
import React, { useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS, ATTENDANCE_STATUS_COLORS } from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { getInitials, formatDuration } from '@utils/helpers';

// ── Helpers ───────────────────────────────────────────────────
function formatMinutes(mins) {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function sessionDur(session) {
  if (!session.checkOutTime) return null;
  if (session.durationMinutes != null) return formatMinutes(session.durationMinutes);
  return formatDuration(session.checkInTime, session.checkOutTime);
}

function parseCoord(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function getMapRegion(inLat, inLng, outLat, outLng) {
  const hasIn  = inLat  != null && inLng  != null;
  const hasOut = outLat != null && outLng != null;

  if (hasIn && hasOut) {
    const minLat = Math.min(inLat, outLat);
    const maxLat = Math.max(inLat, outLat);
    const minLng = Math.min(inLng, outLng);
    const maxLng = Math.max(inLng, outLng);
    return {
      latitude:      (minLat + maxLat) / 2,
      longitude:     (minLng + maxLng) / 2,
      latitudeDelta:  Math.max((maxLat - minLat) * 2.5, 0.005),
      longitudeDelta: Math.max((maxLng - minLng) * 2.5, 0.005),
    };
  }

  const lat = hasIn ? inLat : outLat;
  const lng = hasIn ? inLng : outLng;
  return { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 };
}

// ─────────────────────────────────────────────────────────────
export default function AttendanceDayDetailScreen({ route }) {
  const { record }  = route.params;
  const scrollRef   = useRef(null);

  const sessions      = record.sessions ?? [];
  const totalWorked   = formatMinutes(record.totalMinutes);
  const completedSess = record.sessionsCount ?? sessions.filter((s) => !!s.checkOutTime).length;
  const openSession   = sessions.find((s) => !s.checkOutTime);
  const name          = record.salesperson?.name  ?? 'Unknown';
  const email         = record.salesperson?.email ?? '';

  const isCheckedIn = !!openSession || !!record.isCheckedIn;

  const effectiveStatus = isCheckedIn ? 'present' : record.status;
  const statusColor = ATTENDANCE_STATUS_COLORS[effectiveStatus] ?? { bg: COLORS.border, text: COLORS.textMuted };

  const statusLabel = effectiveStatus === 'present'
    ? 'Present'
    : effectiveStatus === 'half_day'
      ? 'Half Day'
      : (effectiveStatus?.charAt(0).toUpperCase() + effectiveStatus?.slice(1)) ?? '—';

  const dateLabel = dayjs(record.date).format('dddd, DD MMMM YYYY');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Salesperson + day header card ── */}
        <View style={styles.headerCard}>
          {/* Avatar + name */}
          <View style={styles.personRow}>
            <View style={[styles.avatar, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.avatarText, { color: statusColor.text }]}>
                {getInitials(name)}
              </Text>
            </View>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>{name}</Text>
              {email ? <Text style={styles.personEmail}>{email}</Text> : null}
              <View style={styles.dateRow}>
                <Icon name="calendar-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.dateText}>{dateLabel}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatBox
              icon="clock-outline"
              label="Total Worked"
              value={totalWorked ?? '—'}
              color={COLORS.primary}
            />
            <View style={styles.statDivider} />
            <StatBox
              icon="calendar-check-outline"
              label="Sessions"
              value={String(completedSess)}
              color={COLORS.success}
            />
            {openSession && (
              <>
                <View style={styles.statDivider} />
                <StatBox
                  icon="radioactive"
                  label="Active"
                  value="1"
                  color={COLORS.warning}
                />
              </>
            )}
          </View>

          {/* Day-level flags */}
          {(record.dayIsLate || record.dayIsEarlyExit) && (
            <View style={styles.dayFlagsRow}>
              {record.dayIsLate && (
                <View style={[styles.flagChip, { backgroundColor: COLORS.warning + '22' }]}>
                  <Text style={[styles.flagChipText, { color: COLORS.warning }]}>Late</Text>
                </View>
              )}
              {record.dayIsEarlyExit && (
                <View style={[styles.flagChip, { backgroundColor: COLORS.error + '22' }]}>
                  <Text style={[styles.flagChipText, { color: COLORS.error }]}>Early Exit</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Session breakdown ── */}
        <Text style={styles.sectionTitle}>
          {sessions.length === 0
            ? 'No sessions recorded'
            : `${sessions.length} session${sessions.length > 1 ? 's' : ''}`}
        </Text>

        {sessions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="calendar-blank-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>
              No sessions were recorded for this day.
            </Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {sessions.map((session, idx) => (
              <SessionCard
                key={session.id}
                session={session}
                index={idx}
                isLast={idx === sessions.length - 1}
                scrollRef={scrollRef}
              />
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Stat box ──────────────────────────────────────────────────
function StatBox({ icon, label, value, color }) {
  return (
    <View style={styles.statBox}>
      <Icon name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Session card ──────────────────────────────────────────────
function SessionCard({ session, index, isLast, scrollRef }) {
  const dur    = sessionDur(session);
  const isOpen = !session.checkOutTime;

  const inLat  = parseCoord(session.checkInLat);
  const inLng  = parseCoord(session.checkInLng);
  const outLat = parseCoord(session.checkOutLat);
  const outLng = parseCoord(session.checkOutLng);
  const hasMap = (inLat != null && inLng != null) || (outLat != null && outLng != null);

  const region      = hasMap ? getMapRegion(inLat, inLng, outLat, outLng) : null;
  const polyPoints  = (inLat != null && inLng != null && outLat != null && outLng != null)
    ? [{ latitude: inLat, longitude: inLng }, { latitude: outLat, longitude: outLng }]
    : null;

  return (
    <View style={styles.timelineRow}>
      {/* Spine */}
      <View style={styles.spine}>
        <View style={[styles.spineNode, { backgroundColor: isOpen ? COLORS.warning : '#059669' }]} />
        {!isLast && <View style={styles.spineLine} />}
      </View>

      {/* Card */}
      <View style={[styles.sessionCard, isOpen && styles.sessionCardActive]}>

        {/* Header row */}
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionIndex}>Session {index + 1}</Text>
          {isOpen ? (
            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activePillText}>Active</Text>
            </View>
          ) : dur ? (
            <View style={styles.durPill}>
              <Icon name="timer-outline" size={11} color={COLORS.primary} />
              <Text style={styles.durPillText}>{dur}</Text>
            </View>
          ) : null}
        </View>

        {/* Times */}
        <View style={styles.timesRow}>
          {/* Check In */}
          <View style={styles.timeBlock}>
            <View style={[styles.timeIconBox, { backgroundColor: '#05966918' }]}>
              <Icon name="login" size={16} color="#059669" />
            </View>
            <View>
              <Text style={styles.timeLabel}>Check In</Text>
              <Text style={[styles.timeValue, { color: '#059669' }]}>
                {dayjs(session.checkInTime).format('hh:mm A')}
              </Text>
            </View>
          </View>

          <Icon name="arrow-right" size={14} color={COLORS.border} />

          {/* Check Out */}
          <View style={styles.timeBlock}>
            <View style={[styles.timeIconBox, { backgroundColor: isOpen ? '#D9770618' : '#DC262618' }]}>
              <Icon name="logout" size={16} color={isOpen ? '#D97706' : '#DC2626'} />
            </View>
            <View>
              <Text style={styles.timeLabel}>Check Out</Text>
              <Text style={[styles.timeValue, { color: isOpen ? '#D97706' : '#DC2626' }]}>
                {session.checkOutTime
                  ? dayjs(session.checkOutTime).format('hh:mm A')
                  : 'Pending…'}
              </Text>
            </View>
          </View>
        </View>

        {/* Location rows */}
        {(session.checkInAddress || session.checkOutAddress) && (
          <View style={styles.locationsBox}>
            {session.checkInAddress ? (
              <View style={styles.locationRow}>
                <Icon name="map-marker-outline" size={12} color="#059669" />
                <Text style={styles.locationLabel}>In:</Text>
                <Text style={styles.locationText} numberOfLines={1}>
                  {session.checkInAddress}
                </Text>
              </View>
            ) : null}
            {session.checkOutAddress ? (
              <View style={styles.locationRow}>
                <Icon name="map-marker-outline" size={12} color="#DC2626" />
                <Text style={styles.locationLabel}>Out:</Text>
                <Text style={styles.locationText} numberOfLines={1}>
                  {session.checkOutAddress}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Embedded map */}
        {hasMap && (
          <View style={styles.mapSection}>
            <View
              style={styles.mapWrap}
              onTouchStart={() => scrollRef?.current?.setNativeProps({ scrollEnabled: false })}
              onTouchEnd={() => scrollRef?.current?.setNativeProps({ scrollEnabled: true })}
              onTouchCancel={() => scrollRef?.current?.setNativeProps({ scrollEnabled: true })}
            >
              <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                region={region}
                scrollEnabled
                zoomEnabled
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsScale={false}
              >
                {polyPoints && (
                  <Polyline
                    coordinates={polyPoints}
                    strokeColor={COLORS.primary}
                    strokeWidth={2}
                    lineDashPattern={[6, 4]}
                  />
                )}

                {inLat != null && inLng != null && (
                  <Marker
                    coordinate={{ latitude: inLat, longitude: inLng }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.pinIn}>
                      <Icon name="login" size={10} color={COLORS.white} />
                    </View>
                  </Marker>
                )}

                {outLat != null && outLng != null && (
                  <Marker
                    coordinate={{ latitude: outLat, longitude: outLng }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.pinOut}>
                      <Icon name="logout" size={10} color={COLORS.white} />
                    </View>
                  </Marker>
                )}
              </MapView>

              {/* Legend */}
              <View style={styles.mapLegend}>
                {inLat != null && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
                    <Text style={styles.legendText}>Check In</Text>
                  </View>
                )}
                {outLat != null && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                    <Text style={styles.legendText}>Check Out</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },

  // Header card
  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOW.md,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText:   { fontSize: 17, fontWeight: '800' },
  personInfo:   { flex: 1 },
  personName:   { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '700' },
  personEmail:  { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 3 },
  dateRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText:     { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: 'flex-start',
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  dayFlagsRow: { flexDirection: 'row', gap: 6, marginTop: SPACING.sm, flexWrap: 'wrap' },
  flagChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
  flagChipText: { fontSize: 10, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: COLORS.border,
  },
  statValue: { ...TYPOGRAPHY.h3, fontWeight: '800' },
  statLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center' },

  sectionTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },

  emptyBox: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOW.sm,
  },
  emptyText: { ...TYPOGRAPHY.small, color: COLORS.textMuted, textAlign: 'center' },

  // Timeline
  timeline: {},
  timelineRow: { flexDirection: 'row' },
  spine: {
    alignItems: 'center',
    width: 24,
    marginRight: SPACING.sm,
    paddingTop: SPACING.md,
  },
  spineNode: { width: 12, height: 12, borderRadius: 6 },
  spineLine: {
    flex: 1,
    width: 2,
    backgroundColor: COLORS.border,
    marginTop: 4,
  },

  sessionCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  sessionCardActive: {
    borderWidth: 1.5,
    borderColor: '#D9770640',
  },

  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sessionIndex: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D9770618',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D97706' },
  activePillText: { fontSize: 10, fontWeight: '700', color: '#D97706' },

  durPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  durPillText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },

  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  timeLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  timeValue: { ...TYPOGRAPHY.bodyMedium, fontWeight: '700' },

  locationsBox: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontWeight: '700', width: 22 },
  locationText:  { ...TYPOGRAPHY.caption, color: COLORS.textMuted, flex: 1 },

  // Map section
  mapSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  mapWrap: {
    marginTop:    SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    overflow:     'hidden',
    ...SHADOW.sm,
  },
  map: {
    height: 160,
  },
  pinIn: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: '#059669',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     COLORS.white,
  },
  pinOut: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: '#DC2626',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     COLORS.white,
  },
  mapLegend: {
    flexDirection:     'row',
    gap:               SPACING.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   6,
    backgroundColor:   COLORS.surface,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  legendDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  legendText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
});
