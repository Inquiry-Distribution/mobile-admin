/**
 * InquiryActivityScreen — Superuser only
 *
 * Full audit trail for a single inquiry, merged from:
 *  • Inquiry created
 *  • Status changes  (statusHistory)
 *  • Notes added     (notes)
 *  • Files uploaded  (images)
 *  • CRM pushed      (crmPushed / crmPushedAt)
 *
 * All events sorted chronologically (oldest → newest).
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS, STATUS_COLORS } from '@constants/colors';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { TYPOGRAPHY, FONTS, FONT_SIZE } from '@constants/typography';

// ── Activity type config ──────────────────────────────────────
const TYPE_CONFIG = {
  created:    { icon: 'clipboard-plus-outline',      color: '#16A34A' },
  status:     { icon: 'swap-horizontal',             color: COLORS.primary },
  note:       { icon: 'note-text-outline',           color: '#6366f1' },
  file:       { icon: 'paperclip',                   color: '#EA580C' },
  crm:        { icon: 'cloud-upload-outline',        color: '#0EA5E9' },
  assigned:   { icon: 'account-arrow-right-outline', color: '#D97706' },
  reassigned: { icon: 'account-convert-outline',     color: '#9333EA' },
  unassigned: { icon: 'account-remove-outline',      color: '#DC2626' },
  converted:  { icon: 'check-decagram-outline',      color: '#16A34A' },
  viewed:     { icon: 'eye-outline',                 color: '#0EA5E9' },
  call:       { icon: 'phone-outline',               color: '#059669' },
  // Audit log events
  updated:    { icon: 'pencil-outline',              color: '#D97706' },
  deleted:    { icon: 'delete-outline',              color: '#DC2626' },
  restored:   { icon: 'restore',                     color: '#059669' },
};

const STATUS_LABEL = {
  unassigned:    'Unassigned',
  assigned:      'Assigned',
  in_progress:   'In Progress',
  follow_up:     'Follow Up',
  not_interested:'Not Interested',
  converted:     'Converted',
  closed:        'Closed',
};

// ── Build merged timeline from inquiry data ───────────────────
function buildTimeline(inquiry) {
  const events = [];

  const {
    createdAt,
    uploadedBy,
    inqCode,
    statusHistory = [],
    notes = [],
    images = [],
    activityLogs = [],
    auditLogs = [],
    crmPushed,
    crmPushedAt,
    assignedTo,
    isConverted,
    convertedAt,
  } = inquiry;

  // Audit actions already covered by structural data — skip to avoid duplicates
  const AUDIT_SKIP = new Set([
    'INQUIRY_CREATED',
    'INQUIRY_SHARED',
    'INQUIRY_DISTRIBUTED',
    'INQUIRY_REASSIGNED',
    'INQUIRY_UNASSIGNED',
    'INQUIRY_STATUS_CHANGED',
    'INQUIRY_NOTE_ADDED',
    'INQUIRY_CONVERTED',
    'INQUIRY_FILE_UPLOADED',
    'INQUIRY_PERMANENTLY_DELETED',
  ]);

  // Human-readable labels for audit actions shown in timeline
  const AUDIT_LABEL = {
    INQUIRY_UPDATED:  'Inquiry Updated',
    INQUIRY_DELETED:  'Inquiry Deleted',
    INQUIRY_RESTORED: 'Inquiry Restored',
  };

  const AUDIT_TYPE = {
    INQUIRY_UPDATED:  'updated',
    INQUIRY_DELETED:  'deleted',
    INQUIRY_RESTORED: 'restored',
  };

  // Separate assignment events from other status changes
  const assignedEntries  = statusHistory.filter((h) => h.status === 'assigned');
  const otherHistory     = statusHistory.filter((h) => h.status !== 'assigned' && h.status !== 'unassigned');
  const unassignEntries  = statusHistory.filter((h) => h.status === 'unassigned');

  // 1 — Inquiry created
  events.push({
    type:     'created',
    title:    'Inquiry created',
    subtitle: inqCode ? `Code: ${inqCode}` : null,
    person:   uploadedBy?.name ?? null,
    at:       createdAt,
  });

  // 2 — Assignment / reassignment events (separate from generic status changes)
  assignedEntries.forEach((h, idx) => {
    const isFirst = idx === 0;
    const isLast  = idx === assignedEntries.length - 1;
    events.push({
      type:     isFirst ? 'assigned' : 'reassigned',
      title:    isFirst ? 'Inquiry Assigned' : 'Inquiry Reassigned',
      // Show current assignee on the most-recent assignment entry
      subtitle: isLast && assignedTo?.name ? `To: ${assignedTo.name}` : null,
      person:   h.changedBy?.name ?? null,
      at:       h.changedAt,
    });
  });

  // 3 — Unassigned events
  unassignEntries.forEach((h) => {
    events.push({
      type:     'unassigned',
      title:    'Inquiry Unassigned',
      subtitle: null,
      person:   h.changedBy?.name ?? null,
      at:       h.changedAt,
    });
  });

  // 4 — Other status changes (in_progress, follow_up, not_interested, converted, closed)
  otherHistory.forEach((h) => {
    const color = STATUS_COLORS[h.status]?.text ?? COLORS.textMuted;
    events.push({
      type:     'status',
      title:    `Status → ${STATUS_LABEL[h.status] ?? h.status}`,
      subtitle: null,
      person:   h.changedBy?.name ?? null,
      at:       h.changedAt,
      color,
    });
  });

  // 5 — Notes added
  notes.forEach((note) => {
    events.push({
      type:     'note',
      title:    'Note added',
      subtitle: note.text,
      person:   note.addedBy?.name ?? null,
      at:       note.createdAt,
    });
  });

  // 6 — Files / images uploaded
  images.forEach((img) => {
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(
      (img.filename ?? img.url ?? '').split('.').pop().toLowerCase(),
    );
    events.push({
      type:     'file',
      title:    isImage ? 'Photo uploaded' : 'File uploaded',
      subtitle: img.filename ?? null,
      person:   img.uploadedBy?.name ?? null,
      at:       img.createdAt,
    });
  });

  // 7 — Converted via markConverted (does NOT create a statusHistory entry)
  //     Only add if there is no 'converted' entry in statusHistory already
  const convertedInHistory = statusHistory.some((h) => h.status === 'converted');
  if (isConverted && convertedAt && !convertedInHistory) {
    events.push({
      type:     'converted',
      title:    'Marked as Converted',
      subtitle: assignedTo?.name ? `By: ${assignedTo.name}` : null,
      person:   assignedTo?.name ?? null,
      at:       convertedAt,
    });
  }

  // 8 — CRM pushed
  if (crmPushed && crmPushedAt) {
    events.push({
      type:     'crm',
      title:    'Pushed to CRM',
      subtitle: null,
      person:   null,
      at:       crmPushedAt,
    });
  }

  // 9 — Audit log events (admin actions not covered by structural data)
  auditLogs.forEach((log) => {
    if (AUDIT_SKIP.has(log.action)) return;
    const type  = AUDIT_TYPE[log.action]  ?? 'updated';
    const title = AUDIT_LABEL[log.action] ?? log.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    // Build subtitle from meta fields
    const meta = log.meta ?? {};
    const subtitle = meta.changedFields
      ? `Fields: ${meta.changedFields.join(', ')}`
      : null;
    events.push({
      type,
      title,
      subtitle,
      person: log.performedBy?.name ?? null,
      at:     log.createdAt,
    });
  });

  // 10 — Sales user activities (viewed, call initiated)
  activityLogs.forEach((log) => {
    if (log.type === 'inquiry_viewed') {
      events.push({
        type:     'viewed',
        title:    'Inquiry Viewed',
        subtitle: null,
        person:   log.user?.name ?? null,
        at:       log.createdAt,
      });
    } else if (log.type === 'inquiry_call_initiated') {
      events.push({
        type:     'call',
        title:    'Call Initiated',
        subtitle: log.metadata?.phone ?? null,
        person:   log.user?.name ?? null,
        at:       log.createdAt,
      });
    }
  });

  // Sort newest → oldest
  events.sort((a, b) => new Date(b.at) - new Date(a.at));

  return events;
}

// ─── Screen ───────────────────────────────────────────────────
export default function InquiryActivityScreen({ route }) {
  const { inquiry } = route.params;
  const timeline = useMemo(() => buildTimeline(inquiry), [inquiry]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* ── Summary strip ── */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{timeline.length}</Text>
          <Text style={styles.summaryLabel}>Events</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{inquiry.notes?.length ?? 0}</Text>
          <Text style={styles.summaryLabel}>Notes</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {(inquiry.statusHistory?.filter((h) => h.status !== 'assigned' && h.status !== 'unassigned').length) ?? 0}
          </Text>
          <Text style={styles.summaryLabel}>Status Changes</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{inquiry.images?.length ?? 0}</Text>
          <Text style={styles.summaryLabel}>Files</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {timeline.map((event, index) => {
          const cfg   = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.created;
          const color = event.color ?? cfg.color;
          const isLast = index === timeline.length - 1;

          return (
            <View key={index} style={styles.eventRow}>
              {/* ── Left: dot + connector ── */}
              <View style={styles.eventLine}>
                <View style={[styles.eventDot, { backgroundColor: color }]}>
                  <Icon name={cfg.icon} size={13} color={COLORS.white} />
                </View>
                {!isLast && <View style={styles.eventConnector} />}
              </View>

              {/* ── Right: content card ── */}
              <View style={[styles.eventCard, isLast && { marginBottom: 0 }]}>
                {/* Title row */}
                <View style={styles.eventTitleRow}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View style={[styles.eventTypeBadge, { backgroundColor: color + '18' }]}>
                    <Text style={[styles.eventTypeBadgeText, { color }]}>
                      {event.type === 'status'     ? 'Status'
                      : event.type === 'assigned'  ? 'Assigned'
                      : event.type === 'reassigned'? 'Reassigned'
                      : event.type === 'unassigned'? 'Unassigned'
                      : event.type === 'converted' ? 'Converted'
                      : event.type === 'crm'       ? 'CRM'
                      : event.type === 'note'      ? 'Note'
                      : event.type === 'file'      ? 'File'
                      : event.type === 'viewed'    ? 'Viewed'
                      : event.type === 'call'      ? 'Call'
                      : event.type === 'updated'   ? 'Updated'
                      : event.type === 'deleted'   ? 'Deleted'
                      : event.type === 'restored'  ? 'Restored'
                      : event.type === 'created'   ? 'Created'
                      : event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                    </Text>
                  </View>
                </View>

                {/* Subtitle (note text / filename / inqCode) */}
                {event.subtitle ? (
                  <Text style={styles.eventSubtitle} numberOfLines={3}>
                    {event.subtitle}
                  </Text>
                ) : null}

                {/* Footer: person + time */}
                <View style={styles.eventFooter}>
                  {event.person ? (
                    <View style={styles.eventPerson}>
                      <Icon name="account-outline" size={11} color={COLORS.textMuted} />
                      <Text style={styles.eventPersonText}>{event.person}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.eventTime}>
                    {dayjs(event.at).format('DD MMM YYYY · hh:mm A')}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        {timeline.length === 0 && (
          <View style={styles.empty}>
            <Icon name="timeline-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No activity recorded yet.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // ── Summary strip ─────────────────────────────────────────────
  summaryStrip: {
    flexDirection:    'row',
    backgroundColor:  COLORS.surface,
    paddingVertical:  SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOW.sm,
  },
  summaryItem: {
    flex:        1,
    alignItems:  'center',
    gap:         2,
  },
  summaryDivider: {
    width:           1,
    backgroundColor: COLORS.divider,
    marginVertical:  4,
  },
  summaryValue: {
    fontSize:   FONT_SIZE.lg,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
  },
  summaryLabel: {
    fontSize:      FONT_SIZE.xs,
    fontFamily:    FONTS.medium,
    color:         COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ── Timeline scroll ───────────────────────────────────────────
  scroll: {
    paddingHorizontal: SPACING.md,
    paddingTop:        SPACING.md,
    paddingBottom:     SPACING.xxl,
  },

  // ── Event row ─────────────────────────────────────────────────
  eventRow: {
    flexDirection: 'row',
    gap:           SPACING.sm,
  },

  // Left column: dot + vertical line
  eventLine: {
    alignItems:  'center',
    width:       32,
    flexShrink:  0,
  },
  eventDot: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  eventConnector: {
    width:           2,
    flex:            1,
    backgroundColor: COLORS.divider,
    marginVertical:  4,
    minHeight:       24,
    borderRadius:    1,
  },

  // Right column: card
  eventCard: {
    flex:            1,
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.md,
    padding:         SPACING.sm,
    marginBottom:    SPACING.sm,
    borderWidth:     1,
    borderColor:     COLORS.border,
    ...SHADOW.sm,
  },
  eventTitleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            SPACING.xs,
    marginBottom:   3,
  },
  eventTitle: {
    flex:       1,
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
  },
  eventTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      BORDER_RADIUS.full,
    flexShrink:        0,
  },
  eventTypeBadgeText: {
    fontSize:   FONT_SIZE.xs - 1,
    fontFamily: FONTS.bold,
    textTransform: 'capitalize',
  },
  eventSubtitle: {
    fontSize:    FONT_SIZE.xs,
    fontFamily:  FONTS.regular,
    color:       COLORS.textSecondary,
    lineHeight:  18,
    marginBottom: 6,
  },
  eventFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      4,
    gap:            SPACING.xs,
  },
  eventPerson: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
    flex:          1,
  },
  eventPersonText: {
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.medium,
    color:      COLORS.textMuted,
  },
  eventTime: {
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.medium,
    color:      COLORS.textMuted,
    flexShrink: 0,
  },

  // ── Empty state ───────────────────────────────────────────────
  empty: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    gap:            SPACING.sm,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color:     COLORS.textMuted,
    fontStyle: 'italic',
  },
});
