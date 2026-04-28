/**
 * InquiryDetailScreen — Admin & Superuser
 *
 * Admin-specific actions (not available to sales):
 *  • Distribute (unassigned → salesperson)
 *  • Reassign   (assigned  → different salesperson)
 *  • Delete     (superuser only)
 *
 * Read-only sections:
 *  • Status + priority + meta info
 *  • Assignment info
 *  • Photos
 *  • Notes (read-only — sales adds notes)
 *  • Status timeline
 */
import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS, STATUS_COLORS, PRIORITY_COLORS } from '@constants/colors';
import { TYPOGRAPHY }    from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { formatDateTime, getInitials } from '@utils/helpers';

import useAuthStore    from '@store/auth.store';
import useInquiryStore from '@store/inquiry.store';
import { inquiryApi }  from '@api/inquiry.api';

import Loader          from '@components/common/Loader';
import StatusBadge     from '@components/common/StatusBadge';
import PriorityBadge   from '@components/common/PriorityBadge';
import { Menu } from 'react-native-paper';

import DistributeModal from '@components/inquiry/DistributeModal';
import ReassignModal   from '@components/inquiry/ReassignModal';

const TYPE_ICONS = {
  text:       'text-box-outline',
  image:      'image-outline',
  text_image: 'file-image-outline',
};

export default function InquiryDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { isSuperuser } = useAuthStore();

  const { selectedInquiry, selectInquiry, isLoading, isMutating } = useInquiryStore();

  const [showDistribute,  setShowDistribute]  = useState(false);
  const [showReassign,    setShowReassign]    = useState(false);
  const [deleteLoading,   setDeleteLoading]   = useState(false);
  const [unassignLoading, setUnassignLoading] = useState(false);
  const [menuVisible,     setMenuVisible]     = useState(false);
  const [callSupported,   setCallSupported]   = useState(true);

  // Check once whether this device can make phone calls
  useEffect(() => {
    Linking.canOpenURL('tel:0').then(setCallSupported).catch(() => setCallSupported(false));
  }, []);

  useEffect(() => {
    selectInquiry(id);
  }, [id]);

  const refetch = useCallback(() => selectInquiry(id), [id]);

  // ── Unassign ──────────────────────────────────────────────────
  const handleUnassign = useCallback(() => {
    if (!selectedInquiry) return;
    Alert.alert(
      'Unassign Inquiry',
      `Remove assignment from ${selectedInquiry.assignedTo?.name ?? 'this salesperson'} and reset to Unassigned?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: async () => {
            setUnassignLoading(true);
            try {
              await inquiryApi.unassign(selectedInquiry.id);
              refetch();
            } catch (err) {
              Alert.alert('Error', err.message ?? 'Failed to unassign inquiry.');
            } finally {
              setUnassignLoading(false);
            }
          },
        },
      ],
    );
  }, [selectedInquiry, refetch]);

  // ── Delete (superuser only) ───────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!selectedInquiry) return;
    Alert.alert(
      'Delete Inquiry',
      'This action is permanent and cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              await inquiryApi.remove(selectedInquiry.id);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.message ?? 'Failed to delete.');
            }
            setDeleteLoading(false);
          },
        },
      ],
    );
  }, [selectedInquiry, navigation]);

  // ── Header right: three-dot overflow menu (superuser only) ───
  useLayoutEffect(() => {
    if (!selectedInquiry || !isSuperuser()) return;
    navigation.setOptions({
      headerRight: () => (
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          contentStyle={styles.menuContent}
          anchor={
            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              style={styles.headerActionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="dots-vertical" size={22} color={COLORS.white} />
            </TouchableOpacity>
          }
        >
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate('EditInquiry', { inquiry: selectedInquiry });
            }}
            title="Edit Inquiry"
            leadingIcon="pencil-outline"
          />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              handleDelete();
            }}
            title="Delete Inquiry"
            leadingIcon="trash-can-outline"
            titleStyle={{ color: COLORS.error }}
          />
        </Menu>
      ),
    });
  }, [selectedInquiry, handleDelete, menuVisible]);

  // ── Call — must be above the early return (hook rule) ────────
  const handleCall = useCallback(() => {
    const number = selectedInquiry?.mobile;
    if (!number) return;
    const url = `tel:${number}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url).catch(() =>
            Alert.alert('Call Failed', 'Could not open the dialer. Please try again.')
          );
        } else {
          Alert.alert(
            'Cannot Make Calls',
            'Your device does not support phone calls. You can manually dial:\n\n' + number,
            [
              {
                text: 'Copy Number',
                onPress: () => {
                  Clipboard.setString(number);
                  Alert.alert('Copied', 'Phone number copied to clipboard.');
                },
              },
              { text: 'OK', style: 'cancel' },
            ]
          );
        }
      })
      .catch(() =>
        Alert.alert('Call Failed', 'Could not initiate the call. Please try again.')
      );
  }, [selectedInquiry?.mobile]);

  if (isLoading || !selectedInquiry) return <Loader message="Loading inquiry…" />;

  const inquiry = selectedInquiry;
  const {
    description, title, mobile, source, type, status, priority,
    createdAt, assignedAt, assignedTo, uploadedBy, assignedBy,
    notes = [], images = [], statusHistory = [],
    isConverted, convertedAt,
  } = inquiry;

  const priorityColor = PRIORITY_COLORS[priority]?.text ?? COLORS.primary;
  const statusColor   = STATUS_COLORS[status]?.text     ?? COLORS.textMuted;

  const canDistribute = status === 'unassigned' || !assignedTo;
  const canReassign   = !!assignedTo && status !== 'closed';
  const canUnassign   = !!assignedTo && status !== 'closed' && status !== 'unassigned';

  // ── Distribute / reassign analytics ──────────────────────────
  // statusHistory is ASC — index 0 is the original event, last is the most recent
  const assignedHistory  = statusHistory.filter((h) => h.status === 'assigned');
  const distributeEntry  = assignedHistory[0]  ?? null;   // first assignment = distribute
  const lastReassignEntry= assignedHistory.length > 1
    ? assignedHistory[assignedHistory.length - 1]
    : null;                                                // only exists if reassigned ≥ 1x
  const reassignCount    = Math.max(0, assignedHistory.length - 1);

  return (
    <>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* ── Hero card ───────────────────────────────── */}
          <View style={styles.hero}>
            <View style={[styles.heroAccent, { backgroundColor: priorityColor }]} />

            <View style={styles.heroBody}>
              {/* Top row */}
              <View style={styles.heroTop}>
                <View style={styles.heroTopLeft}>
                  <PriorityBadge priority={priority} />
                  <View style={[styles.typeTag, { backgroundColor: priorityColor + '18' }]}>
                    <Icon name={TYPE_ICONS[type] || 'help-circle-outline'} size={11} color={priorityColor} />
                    <Text style={[styles.typeText, { color: priorityColor }]}>
                      {type?.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.heroDate}>
                  {dayjs(createdAt).format('DD MMM · hh:mm A')}
                </Text>
              </View>

              {/* Description */}
              <Text style={styles.heroDesc}>
                {description || title || 'No description provided.'}
              </Text>

              {/* Contact */}
              {mobile ? (
                <>
                  <View style={styles.heroDivider} />
                  <TouchableOpacity
                    style={[styles.callCard, !callSupported && styles.callCardDisabled]}
                    onPress={handleCall}
                    activeOpacity={0.78}
                  >
                    <View style={[styles.callIcon, !callSupported && styles.callIconDisabled]}>
                      <Icon name={callSupported ? 'phone' : 'phone-off'} size={18} color={COLORS.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.callNumber}>{mobile}</Text>
                      <Text style={[styles.callHint, !callSupported && styles.callHintDisabled]}>
                        {callSupported ? 'Tap to call' : 'Device cannot make calls'}
                      </Text>
                    </View>
                    {callSupported ? (
                      <View style={styles.callBtn}>
                        <Icon name="phone-outgoing" size={13} color={COLORS.white} />
                        <Text style={styles.callBtnText}>Call</Text>
                      </View>
                    ) : (
                      <View style={styles.callBtnDisabled}>
                        <Icon name="phone-off" size={13} color={COLORS.textMuted} />
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              ) : null}

              {/* Source */}
              {source ? (
                <View style={styles.infoChip}>
                  <Icon name="map-marker-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.infoChipText}>{source}</Text>
                </View>
              ) : null}

              {/* Footer: status + converted */}
              <View style={styles.heroDivider} />
              <View style={styles.heroFooter}>
                <StatusBadge status={status} />
                {isConverted && (
                  <View style={styles.convertedBadge}>
                    <Icon name="check-circle" size={11} color="#16a34a" />
                    <Text style={styles.convertedText}>
                      Converted{convertedAt ? ` · ${dayjs(convertedAt).format('DD MMM')}` : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ── Inquiry stats strip ─────────────────────── */}
          <View style={styles.statsStrip}>
            <StatCell
              icon="clock-outline"
              label="Created"
              value={dayjs(createdAt).format('DD MMM, hh:mm A')}
            />
            <View style={styles.statsDivider} />
            <StatCell
              icon="send-check-outline"
              label="Distributed"
              value={distributeEntry
                ? dayjs(distributeEntry.changedAt).format('DD MMM, hh:mm A')
                : '—'}
            />
            <View style={styles.statsDivider} />
            <StatCell
              icon="note-text-outline"
              label="Notes"
              value={String(notes.length)}
            />
            <View style={styles.statsDivider} />
            <StatCell
              icon="account-convert-outline"
              label="Reassigned"
              value={reassignCount > 0 ? `${reassignCount}×` : '—'}
            />
          </View>

          {/* ── Admin action buttons ─────────────────────── */}
          {(canDistribute || canReassign || canUnassign) && (
            <View style={styles.actionSection}>

              {/* Primary — Distribute (full width) */}
              {canDistribute && (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => setShowDistribute(true)}
                  disabled={isMutating}
                  activeOpacity={0.85}
                >
                  <View style={styles.primaryBtnIconWrap}>
                    <Icon name="send-outline" size={20} color={COLORS.white} />
                  </View>
                  <View style={styles.primaryBtnBody}>
                    <Text style={styles.primaryBtnText}>Distribute Inquiry</Text>
                    <Text style={styles.primaryBtnSub}>Assign to a salesperson</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={COLORS.white} style={{ opacity: 0.6 }} />
                </TouchableOpacity>
              )}

              {/* Secondary row — Reassign + Unassign */}
              {(canReassign || canUnassign) && (
                <View style={styles.secondaryRow}>
                  {canReassign && (
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => setShowReassign(true)}
                      disabled={isMutating}
                      activeOpacity={0.82}
                    >
                      <View style={[styles.secondaryBtnIcon, { backgroundColor: COLORS.primary + '18' }]}>
                        <Icon name="account-switch-outline" size={18} color={COLORS.primary} />
                      </View>
                      <Text style={[styles.secondaryBtnText, { color: COLORS.primary }]}>Reassign</Text>
                    </TouchableOpacity>
                  )}

                  {canUnassign && (
                    <TouchableOpacity
                      style={[styles.secondaryBtn, styles.secondaryBtnDanger]}
                      onPress={handleUnassign}
                      disabled={unassignLoading || isMutating}
                      activeOpacity={0.82}
                    >
                      <View style={[styles.secondaryBtnIcon, { backgroundColor: COLORS.error + '15' }]}>
                        <Icon name="account-remove-outline" size={18} color={COLORS.error} />
                      </View>
                      <Text style={[styles.secondaryBtnText, { color: COLORS.error }]}>Unassign</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

            </View>
          )}

          {/* ── Assignment info ──────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assignment</Text>

            <View style={styles.assignRow}>
              {uploadedBy && (
                <PersonChip label="Uploaded by" person={uploadedBy} color={COLORS.primary} />
              )}
              {assignedTo && (
                <PersonChip
                  label="Assigned to"
                  person={assignedTo}
                  color={COLORS.secondary}
                  subtitle={assignedTo.company?.name}
                />
              )}
              {assignedBy && (
                <PersonChip label="Assigned by" person={assignedBy} color={COLORS.warning} />
              )}
            </View>

            {!uploadedBy && !assignedTo && (
              <Text style={styles.noData}>Not yet assigned to anyone.</Text>
            )}

            {/* ── Timing rows ─────────────────────── */}
            {(distributeEntry || lastReassignEntry) && (
              <View style={styles.timingBlock}>
                {distributeEntry && (
                  <TimingRow
                    icon="send-outline"
                    label="Distributed"
                    by={distributeEntry.changedBy?.name}
                    at={distributeEntry.changedAt}
                    color={COLORS.secondary}
                  />
                )}
                {lastReassignEntry && (
                  <TimingRow
                    icon="account-switch-outline"
                    label="Last reassigned"
                    by={lastReassignEntry.changedBy?.name}
                    at={lastReassignEntry.changedAt}
                    color={COLORS.warning}
                  />
                )}
                {reassignCount > 1 && (
                  <View style={styles.reassignBadge}>
                    <Icon name="refresh" size={10} color={COLORS.warning} />
                    <Text style={styles.reassignBadgeText}>
                      Reassigned {reassignCount} time{reassignCount !== 1 ? 's' : ''} total
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Photos ───────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Photos{images.length > 0 ? ` (${images.length})` : ''}
            </Text>
            {images.length === 0 ? (
              <EmptyBox icon="image-off-outline" label="No photos attached" />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {images.map((img, i) => (
                  <View key={img.id ?? i} style={styles.photoThumb}>
                    <Icon name="image-outline" size={28} color={COLORS.primaryMid} />
                    <Text style={styles.photoLabel} numberOfLines={1}>
                      {img.filename ?? `Photo ${i + 1}`}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── Notes (read-only for admin) ───────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes ({notes.length})</Text>
            {notes.length === 0 ? (
              <EmptyBox icon="note-off-outline" label="No notes yet" />
            ) : (
              <View style={styles.notesList}>
                {notes.map((note, i) => (
                  <View key={note.id ?? i} style={styles.noteRow}>
                    <View style={styles.noteIndex}>
                      <Text style={styles.noteIndexText}>{notes.length - i}</Text>
                    </View>
                    <View style={styles.noteContent}>
                      <Text style={styles.noteText}>{note.text}</Text>
                      <View style={styles.noteMeta}>
                        {note.addedBy?.name ? (
                          <Text style={styles.noteBy}>{note.addedBy.name}</Text>
                        ) : null}
                        <Text style={styles.noteTime}>
                          {dayjs(note.createdAt).format('MMM D, hh:mm A')}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Timeline ─────────────────────────────────── */}
          {statusHistory.length > 0 && (
            <View style={[styles.section, { marginBottom: SPACING.md }]}>
              <Text style={styles.sectionTitle}>Status Timeline</Text>
              {statusHistory.map((h, i) => {
                const color  = STATUS_COLORS[h.status]?.text ?? COLORS.textMuted;
                const isLast = i === statusHistory.length - 1;
                return (
                  <View key={h.id ?? i} style={styles.tlItem}>
                    <View style={styles.tlLine}>
                      <View style={[styles.tlDot, { backgroundColor: color }]} />
                      {!isLast && <View style={styles.tlConnector} />}
                    </View>
                    <View style={[styles.tlContent, isLast && { paddingBottom: 0 }]}>
                      <View style={[styles.tlBadge, { backgroundColor: color + '22' }]}>
                        <Text style={[styles.tlBadgeText, { color }]}>
                          {STATUS_COLORS[h.status] ? h.status.replace('_', ' ') : h.status}
                        </Text>
                      </View>
                      <Text style={styles.tlTime}>
                        {h.changedBy?.name ? `${h.changedBy.name} · ` : ''}
                        {dayjs(h.changedAt).format('MMM D, hh:mm A')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── Modals ────────────────────────────────────── */}
      <DistributeModal
        visible={showDistribute}
        inquiry={inquiry}
        onClose={() => setShowDistribute(false)}
        onSuccess={refetch}
      />
      <ReassignModal
        visible={showReassign}
        inquiry={inquiry}
        onClose={() => setShowReassign(false)}
        onSuccess={refetch}
      />
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────
function PersonChip({ label, person, color, subtitle }) {
  return (
    <View style={styles.personChip}>
      <View style={[styles.personAvatar, { backgroundColor: color + '22' }]}>
        <Text style={[styles.personInitials, { color }]}>{getInitials(person.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.personLabel}>{label}</Text>
        <Text style={styles.personName} numberOfLines={1}>{person.name}</Text>
        {subtitle ? (
          <View style={styles.personCompany}>
            <Icon name="domain" size={10} color={color} />
            <Text style={[styles.personCompanyText, { color }]} numberOfLines={1}>{subtitle}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StatCell({ icon, label, value }) {
  return (
    <View style={styles.statCell}>
      <Icon name={icon} size={14} color={COLORS.primary} />
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TimingRow({ icon, label, by, at, color }) {
  return (
    <View style={styles.timingRow}>
      <View style={[styles.timingIconWrap, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={12} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.timingLabel}>{label}</Text>
        <Text style={styles.timingValue}>
          {dayjs(at).format('DD MMM YYYY · hh:mm A')}
        </Text>
        {by ? (
          <Text style={[styles.timingBy, { color }]}>by {by}</Text>
        ) : null}
      </View>
    </View>
  );
}

function EmptyBox({ icon, label }) {
  return (
    <View style={styles.emptyBox}>
      <Icon name={icon} size={26} color={COLORS.textMuted} />
      <Text style={styles.emptyBoxText}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xxl },

  // Hero
  hero: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginTop:       SPACING.md,
    marginBottom:    SPACING.sm,
    overflow:        'hidden',
    ...SHADOW.md,
  },
  heroAccent: { height: 4, width: '100%' },
  heroBody:   { padding: SPACING.md },

  heroTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   10,
  },
  heroTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  typeTag: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:  BORDER_RADIUS.full,
  },
  typeText:   { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  heroDate:   { ...TYPOGRAPHY.caption, color: COLORS.textMuted, flexShrink: 0 },
  heroDesc:   { fontSize: 15, fontWeight: '500', color: COLORS.textPrimary, lineHeight: 23 },
  heroDivider:{ height: 1, backgroundColor: COLORS.divider, marginVertical: SPACING.sm },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  // Call card
  callCard: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    backgroundColor: COLORS.primaryLight,
    borderRadius:  BORDER_RADIUS.md,
    borderWidth:   1,
    borderColor:   COLORS.primaryMid,
    padding:       10,
    marginBottom:  SPACING.xs,
  },
  callIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  callNumber: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  callHint:   { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  callHintDisabled: { color: COLORS.error },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  callBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  callBtnDisabled: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  callCardDisabled: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    opacity: 0.85,
  },
  callIconDisabled: { backgroundColor: COLORS.textMuted },

  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
    marginTop: SPACING.xs,
  },
  infoChipText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  convertedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#dcfce7',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#86efac',
  },
  convertedText: { fontSize: 10, fontWeight: '800', color: '#16a34a' },

  // Action buttons
  actionSection: {
    paddingHorizontal: SPACING.md,
    marginBottom:      SPACING.sm,
    gap:               SPACING.xs + 2,
  },

  // Primary (Distribute) — full-width solid card
  primaryBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius:    BORDER_RADIUS.lg,
    paddingVertical:   14,
    paddingHorizontal: SPACING.md,
    ...SHADOW.md,
  },
  primaryBtnIconWrap: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryBtnBody:  { flex: 1 },
  primaryBtnText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.white,
    fontWeight: '700',
  },
  primaryBtnSub: {
    fontSize:  11,
    color:     'rgba(255,255,255,0.7)',
    marginTop: 1,
  },

  // Secondary row (Reassign / Unassign)
  secondaryRow: {
    flexDirection: 'row',
    gap:           SPACING.xs + 2,
  },
  secondaryBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.xs + 2,
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    paddingVertical: 13,
    borderWidth:     1.5,
    borderColor:     COLORS.primary,
    ...SHADOW.sm,
  },
  secondaryBtnDanger: {
    borderColor: COLORS.error,
  },
  secondaryBtnIcon: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '700',
  },
  // Header three-dot button
  headerActionBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     8,
  },
  menuContent: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.md,
  },

  // Sections
  section: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:    SPACING.sm,
    padding:         SPACING.md,
    ...SHADOW.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.small,
    fontWeight:     '700',
    color:          COLORS.textSecondary,
    textTransform:  'uppercase',
    letterSpacing:  0.6,
    marginBottom:   SPACING.sm,
  },
  noData: { ...TYPOGRAPHY.small, color: COLORS.textMuted, fontStyle: 'italic' },

  // Assignment
  assignRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  personChip: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1, minWidth: 120 },
  personAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  personInitials: { fontSize: 14, fontWeight: '700' },
  personLabel:    { fontSize: 10, color: COLORS.textMuted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3 },
  personName:     { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },

  // Photos
  photoThumb: {
    width: 80, height: 80,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.sm,
    gap: 4,
  },
  photoLabel: { fontSize: 9, color: COLORS.textMuted, maxWidth: 72, textAlign: 'center' },

  emptyBox:     { alignItems: 'center', paddingVertical: SPACING.lg, gap: SPACING.xs },
  emptyBoxText: { ...TYPOGRAPHY.small, color: COLORS.textMuted, fontStyle: 'italic' },

  // Notes
  notesList:    { gap: SPACING.sm },
  noteRow:      { flexDirection: 'row', gap: SPACING.sm },
  noteIndex: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  noteIndexText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  noteContent:   { flex: 1 },
  noteText:      { ...TYPOGRAPHY.body, color: COLORS.textPrimary, lineHeight: 20 },
  noteMeta:      { flexDirection: 'row', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' },
  noteBy:        { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '600' },
  noteTime:      { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  // Stats strip
  statsStrip: {
    flexDirection:   'row',
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:    SPACING.sm,
    paddingVertical: SPACING.md,
    ...SHADOW.sm,
  },
  statCell: {
    flex:           1,
    alignItems:     'center',
    gap:            3,
  },
  statValue: {
    ...TYPOGRAPHY.caption,
    fontWeight:  '700',
    color:       COLORS.textPrimary,
    fontSize:    12,
    textAlign:   'center',
  },
  statLabel: {
    fontSize:   9,
    fontWeight: '600',
    color:      COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statsDivider: {
    width:           1,
    backgroundColor: COLORS.divider,
    marginVertical:  4,
  },

  // PersonChip company line
  personCompany: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
    marginTop:     2,
  },
  personCompanyText: {
    fontSize:   10,
    fontWeight: '600',
  },

  // Timing block (inside Assignment section)
  timingBlock: {
    marginTop:    SPACING.sm,
    gap:          SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop:   SPACING.sm,
  },
  timingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  timingIconWrap: {
    width:          28,
    height:         28,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  timingLabel: {
    fontSize:   10,
    fontWeight: '700',
    color:      COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timingValue: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.textPrimary,
    fontWeight: '500',
    marginTop:  1,
  },
  timingBy: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    marginTop:  1,
  },
  reassignBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    alignSelf:         'flex-start',
    backgroundColor:   COLORS.warning + '15',
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   3,
    marginTop:         SPACING.xs,
  },
  reassignBadgeText: {
    fontSize:   10,
    fontWeight: '700',
    color:      COLORS.warning,
  },

  // Timeline
  tlItem:      { flexDirection: 'row', gap: SPACING.sm },
  tlLine:      { alignItems: 'center', width: 14 },
  tlDot:       { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  tlConnector: { width: 2, flex: 1, backgroundColor: COLORS.divider, marginVertical: 3, minHeight: 14 },
  tlContent:   { flex: 1, paddingBottom: SPACING.sm },
  tlBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: 3,
    textTransform: 'capitalize',
  },
  tlBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  tlTime:      { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
});
