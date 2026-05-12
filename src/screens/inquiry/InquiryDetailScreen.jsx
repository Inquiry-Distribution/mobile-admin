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
import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS, STATUS_COLORS, PRIORITY_COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONTS, FONT_SIZE } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW, CONFIG } from '@constants/config';
import { formatDateTime, getInitials, stripHtml } from '@utils/helpers';
import RichContent from '@components/common/RichContent';

import useAuthStore        from '@store/auth.store';
import useInquiryStore from '@store/inquiry.store';
import { inquiryApi }  from '@api/inquiry.api';

import Loader                from '@components/common/Loader';
import StatusBadge           from '@components/common/StatusBadge';
import PriorityBadge         from '@components/common/PriorityBadge';
import { Menu } from 'react-native-paper';

import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNBlobUtil  from 'react-native-blob-util';
import FileViewer  from 'react-native-file-viewer';
import DistributeModal from '@components/inquiry/DistributeModal';
import ReassignModal   from '@components/inquiry/ReassignModal';

const MIME_TYPES = {
  pdf:  'application/pdf',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt:  'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv:  'text/csv',
  txt:  'text/plain',
};

const TYPE_ICONS = {
  text:       'text-box-outline',
  image:      'image-outline',
  text_image: 'file-image-outline',
};

export default function InquiryDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { isSuperuser } = useAuthStore();

  const { selectedInquiry, selectInquiry, isLoading, isMutating, deleteImage, deleteAudio } = useInquiryStore();

  const [showDistribute,   setShowDistribute]   = useState(false);
  const [showReassign,     setShowReassign]     = useState(false);
  const [deleteLoading,    setDeleteLoading]    = useState(false);
  const [unassignLoading,  setUnassignLoading]  = useState(false);
  const [extendLoading,    setExtendLoading]    = useState(false);
  const [menuVisible,      setMenuVisible]      = useState(false);
  const [isRefreshing,     setIsRefreshing]     = useState(false);

  // ── Audio playback ────────────────────────────────────────────
  const audioPlayer  = useRef(new AudioRecorderPlayer()).current;
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [isPaused,    setIsPaused]    = useState(false);
  const [playPosition, setPlayPosition] = useState('00:00:00');
  const [playDuration, setPlayDuration] = useState('00:00:00');

  // File download state: fileId → 'downloading' | 'error' | null
  const [fileStatus, setFileStatus] = useState({});

  // Stop audio on unmount
  useEffect(() => () => {
    audioPlayer.stopPlayer().catch(() => {});
    audioPlayer.removePlayBackListener();
  }, []);


  useEffect(() => {
    selectInquiry(id);
  }, [id]);

  const refetch = useCallback(() => selectInquiry(id), [id]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await selectInquiry(id);
    setIsRefreshing(false);
  }, [id]);

  const handleDeleteImage = useCallback((imageId, label) => {
    Alert.alert(
      'Delete file',
      `Remove "${label}" from this inquiry? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteImage(id, imageId);
            if (!result.success) {
              Alert.alert('Error', result.message ?? 'Failed to delete file.');
            }
          },
        },
      ],
    );
  }, [id, deleteImage]);

  const handleDeleteAudio = useCallback(() => {
    Alert.alert(
      'Delete Voice Note',
      'Remove the voice note from this inquiry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (isPlaying || isPaused) {
              await audioPlayer.stopPlayer().catch(() => {});
              audioPlayer.removePlayBackListener();
              setIsPlaying(false); setIsPaused(false);
              setPlayPosition('00:00:00');
            }
            const result = await deleteAudio(id);
            if (!result.success) {
              Alert.alert('Error', result.message ?? 'Failed to delete voice note.');
            }
          },
        },
      ],
    );
  }, [id, deleteAudio, isPlaying, isPaused, audioPlayer]);

  const openFile = useCallback(async (fileUrl, filename, fileId) => {
    setFileStatus((prev) => ({ ...prev, [fileId]: 'downloading' }));
    try {
      const ext       = filename.split('.').pop().toLowerCase();
      const localPath = `${RNBlobUtil.fs.dirs.CacheDir}/${fileId}.${ext}`;

      const res = await RNBlobUtil.config({ path: localPath, overwrite: true })
        .fetch('GET', fileUrl);

      const status = res.info().status;
      if (status < 200 || status >= 300) {
        throw new Error(`HTTP ${status}`);
      }

      setFileStatus((prev) => ({ ...prev, [fileId]: null }));

      if (Platform.OS === 'android') {
        // Use RNBlobUtil directly — passes correct MIME type to the Intent
        await RNBlobUtil.android.actionViewIntent(localPath, MIME_TYPES[ext] ?? 'application/octet-stream');
      } else {
        await FileViewer.open(localPath, { showOpenWithDialog: true });
      }
    } catch (err) {
      setFileStatus((prev) => ({ ...prev, [fileId]: 'error' }));
      Alert.alert('Error', `Could not open file.\n${err?.message ?? ''}`);
    }
  }, []);

  const handlePlayAudio = useCallback(async (url) => {
    try {
      if (isPaused) {
        await audioPlayer.resumePlayer();
        setIsPlaying(true); setIsPaused(false);
        return;
      }
      const fullUrl = url.startsWith('http') ? url : `${CONFIG.SOCKET_URL}/${url}`;
      await audioPlayer.startPlayer(fullUrl);
      audioPlayer.addPlayBackListener((e) => {
        setPlayPosition(audioPlayer.mmssss(Math.floor(e.currentPosition)));
        setPlayDuration(audioPlayer.mmssss(Math.floor(e.duration)));
        if (e.currentPosition >= e.duration) {
          audioPlayer.stopPlayer();
          audioPlayer.removePlayBackListener();
          setIsPlaying(false); setIsPaused(false);
          setPlayPosition('00:00:00');
        }
      });
      setIsPlaying(true); setIsPaused(false);
    } catch (err) {
      Alert.alert('Playback Error', err.message ?? 'Could not play audio.');
    }
  }, [isPaused]);

  const handlePauseAudio = useCallback(async () => {
    await audioPlayer.pausePlayer();
    setIsPlaying(false); setIsPaused(true);
  }, []);

  const handleStopAudio = useCallback(async () => {
    await audioPlayer.stopPlayer();
    audioPlayer.removePlayBackListener();
    setIsPlaying(false); setIsPaused(false);
    setPlayPosition('00:00:00');
  }, []);

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

  // ── Extend visibility ────────────────────────────────────────
  const handleExtendVisibility = useCallback(() => {
    if (!selectedInquiry) return;
    Alert.alert(
      'Extend Visibility',
      `How many extra days should this inquiry stay visible to ${selectedInquiry.assignedTo?.name ?? 'the salesperson'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '+1 Day',
          onPress: async () => {
            setExtendLoading(true);
            try {
              await inquiryApi.extendVisibility(selectedInquiry.id, 1);
              refetch();
            } catch (err) {
              Alert.alert('Error', err.message ?? 'Failed to extend visibility.');
            } finally {
              setExtendLoading(false);
            }
          },
        },
        {
          text: '+3 Days',
          onPress: async () => {
            setExtendLoading(true);
            try {
              await inquiryApi.extendVisibility(selectedInquiry.id, 3);
              refetch();
            } catch (err) {
              Alert.alert('Error', err.message ?? 'Failed to extend visibility.');
            } finally {
              setExtendLoading(false);
            }
          },
        },
        {
          text: '+7 Days',
          onPress: async () => {
            setExtendLoading(true);
            try {
              await inquiryApi.extendVisibility(selectedInquiry.id, 7);
              refetch();
            } catch (err) {
              Alert.alert('Error', err.message ?? 'Failed to extend visibility.');
            } finally {
              setExtendLoading(false);
            }
          },
        },
      ],
    );
  }, [selectedInquiry, refetch]);

  // ── Move to Trash (superuser only) ───────────────────────────
  const handleDelete = useCallback(() => {
    if (!selectedInquiry) return;
    Alert.alert(
      'Move to Trash',
      'This inquiry will be moved to trash. You can restore it from the Trash screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Trash',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              await inquiryApi.remove(selectedInquiry.id);
              useInquiryStore.getState().bumpSummaryRefresh();
              useInquiryStore.setState((state) => ({
                inquiries: state.inquiries.filter((i) => i.id !== selectedInquiry.id),
                total:     Math.max(0, state.total - 1),
              }));
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.message ?? 'Failed to move to trash.');
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
            title="Move to Trash"
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
    Linking.openURL(`tel:${number}`).catch(() =>
      Alert.alert(
        'Call Failed',
        'Could not open the dialer. You can manually dial:\n\n' + number,
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
      )
    );
  }, [selectedInquiry?.mobile]);

  if (isLoading || !selectedInquiry) return <Loader message="Loading inquiry…" />;

  const inquiry = selectedInquiry;
  const {
    description, title, mobile, source, type, status, priority,
    createdAt, assignedAt, assignedTo, uploadedBy, assignedBy,
    notes = [], images = [], statusHistory = [],
    isConverted, convertedAt, audioUrl, visibleUntil,
  } = inquiry;

  const priorityColor = PRIORITY_COLORS[priority]?.text ?? COLORS.primary;
  const statusColor   = STATUS_COLORS[status]?.text     ?? COLORS.textMuted;

  const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
  const photoItems = images.filter((img) => IMAGE_EXTS.has((img.filename ?? img.url ?? '').split('.').pop().toLowerCase()));
  const fileItems  = images.filter((img) => !IMAGE_EXTS.has((img.filename ?? img.url ?? '').split('.').pop().toLowerCase()));

  const FILE_ICONS = {
    pdf:  { icon: 'file-pdf-box',          color: '#DC2626' },
    xls:  { icon: 'file-excel-box',        color: '#16A34A' },
    xlsx: { icon: 'file-excel-box',        color: '#16A34A' },
    csv:  { icon: 'file-delimited',        color: '#16A34A' },
    doc:  { icon: 'file-word-box',         color: '#2563EB' },
    docx: { icon: 'file-word-box',         color: '#2563EB' },
    ppt:  { icon: 'file-powerpoint-box',   color: '#EA580C' },
    pptx: { icon: 'file-powerpoint-box',   color: '#EA580C' },
    txt:  { icon: 'file-document-outline', color: '#6B7280' },
  };
  const fileIconConfig = (name) => {
    const ext = (name ?? '').split('.').pop().toLowerCase();
    return FILE_ICONS[ext] ?? { icon: 'file-outline', color: '#6B7280' };
  };

  const canDistribute = status === 'unassigned' || !assignedTo;
  const canReassign   = !!assignedTo && status !== 'closed';
  const canUnassign   = !!assignedTo && status !== 'closed' && status !== 'unassigned';
  const canExtend     = !!assignedTo && status !== 'closed';

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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
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
              <RichContent
                html={description || title}
                textStyle={styles.heroDesc}
                emptyText="No description provided."
              />

              {/* Contact */}
              {mobile ? (
                <>
                  <View style={styles.heroDivider} />
                  <TouchableOpacity
                    style={styles.callCard}
                    onPress={handleCall}
                    activeOpacity={0.78}
                  >
                    <View style={styles.callIcon}>
                      <Icon name="phone" size={18} color={COLORS.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.callNumber}>{mobile}</Text>
                      <Text style={styles.callHint}>Tap to call</Text>
                    </View>
                    <View style={styles.callBtn}>
                      <Icon name="phone-outgoing" size={13} color={COLORS.white} />
                      <Text style={styles.callBtnText}>Call</Text>
                    </View>
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
                    <Icon name="check-circle" size={11} color={COLORS.converted} />
                    <Text style={styles.convertedText}>
                      Converted{convertedAt ? ` · ${dayjs(convertedAt).format('DD MMM')}` : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ── Timeline card ───────────────────────────── */}
          <View style={styles.timelineCard}>

            {/* ── Created row ── */}
            <View style={styles.tlDateRow}>
              <View style={[styles.tlDateIcon, { backgroundColor: COLORS.primaryLight }]}>
                <Icon name="calendar-outline" size={16} color={COLORS.primary} />
              </View>
              <View style={styles.tlDateBody}>
                <Text style={styles.tlDateLabel}>Created</Text>
                <Text style={styles.tlDateValue}>
                  {dayjs(createdAt).format('DD MMM YYYY')}
                </Text>
                <Text style={styles.tlDateTime}>
                  {dayjs(createdAt).format('hh:mm A')}
                </Text>
              </View>
              <View style={styles.tlDateRight}>
                <Text style={styles.tlDateAgo}>
                  {dayjs().diff(dayjs(createdAt), 'day') === 0
                    ? 'Today'
                    : `${dayjs().diff(dayjs(createdAt), 'day')}d ago`}
                </Text>
              </View>
            </View>

            {/* connector */}
            <View style={styles.tlConnectorWrap}>
              <View style={styles.tlConnectorLine} />
            </View>

            {/* ── Distributed row ── */}
            <View style={styles.tlDateRow}>
              <View style={[
                styles.tlDateIcon,
                distributeEntry
                  ? { backgroundColor: COLORS.assigned + '20' }
                  : { backgroundColor: COLORS.background },
              ]}>
                <Icon
                  name="account-arrow-right-outline"
                  size={16}
                  color={distributeEntry ? COLORS.assigned : COLORS.textMuted}
                />
              </View>
              <View style={styles.tlDateBody}>
                <Text style={styles.tlDateLabel}>Distributed</Text>
                {distributeEntry ? (
                  <>
                    <Text style={[styles.tlDateValue, { color: COLORS.assigned }]}>
                      {dayjs(distributeEntry.changedAt).format('DD MMM YYYY')}
                    </Text>
                    <Text style={styles.tlDateTime}>
                      {dayjs(distributeEntry.changedAt).format('hh:mm A')}
                      {distributeEntry.changedBy?.name
                        ? `  ·  ${distributeEntry.changedBy.name}`
                        : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.tlDatePending}>Not yet distributed</Text>
                )}
              </View>
              {distributeEntry && (
                <View style={styles.tlDateRight}>
                  <Text style={[styles.tlDateAgo, { color: COLORS.assigned }]}>
                    {dayjs().diff(dayjs(distributeEntry.changedAt), 'day') === 0
                      ? 'Today'
                      : `${dayjs().diff(dayjs(distributeEntry.changedAt), 'day')}d ago`}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Stats footer ── */}
            <View style={styles.tlStatsRow}>
              <View style={styles.tlStat}>
                <Icon name="note-text-outline" size={13} color={COLORS.primary} />
                <Text style={styles.tlStatValue}>{notes.length}</Text>
                <Text style={styles.tlStatLabel}>Notes</Text>
              </View>
              <View style={styles.tlStatDivider} />
              <View style={styles.tlStat}>
                <Icon name="account-switch-outline" size={13} color={COLORS.warning} />
                <Text style={styles.tlStatValue}>
                  {reassignCount > 0 ? `${reassignCount}×` : '0'}
                </Text>
                <Text style={styles.tlStatLabel}>Reassigned</Text>
              </View>
              <View style={styles.tlStatDivider} />
              <View style={styles.tlStat}>
                <Icon name="image-multiple-outline" size={13} color={COLORS.secondary} />
                <Text style={styles.tlStatValue}>{images.length}</Text>
                <Text style={styles.tlStatLabel}>Attachment</Text>
              </View>
            </View>

          </View>

          {/* ── Admin action buttons ─────────────────────── */}
          {(canDistribute || canReassign || canUnassign || canExtend) && (
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

            {/* Visibility window */}
            {visibleUntil && assignedTo && (
              <View style={[
                styles.visibilityRow,
                dayjs(visibleUntil).isBefore(dayjs())
                  ? styles.visibilityExpired
                  : styles.visibilityActive,
              ]}>
                <Icon
                  name={dayjs(visibleUntil).isBefore(dayjs()) ? 'eye-off-outline' : 'clock-outline'}
                  size={14}
                  color={dayjs(visibleUntil).isBefore(dayjs()) ? COLORS.error : COLORS.info}
                />
                <Text style={[
                  styles.visibilityText,
                  { color: dayjs(visibleUntil).isBefore(dayjs()) ? COLORS.error : COLORS.info },
                ]}>
                  {dayjs(visibleUntil).isBefore(dayjs())
                    ? `Expired · ${dayjs(visibleUntil).format('DD MMM · hh:mm A')}`
                    : `Visible until ${dayjs(visibleUntil).format('DD MMM · hh:mm A')}`}
                </Text>
              </View>
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
              Photos{photoItems.length > 0 ? ` (${photoItems.length})` : ''}
            </Text>
            {photoItems.length === 0 ? (
              <EmptyBox icon="image-off-outline" label="No photos attached" />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {photoItems.map((img, i) => {
                  const fullUrl = `${CONFIG.SOCKET_URL}/uploads/${img.url}`;
                  const label   = img.filename ?? `Photo ${i + 1}`;
                  return (
                    <View key={img.id ?? i} style={styles.photoThumb}>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('ImageViewer', {
                          images:       photoItems.map((m) => ({
                            url:  `${CONFIG.SOCKET_URL}/uploads/${m.url}`,
                            time: m.createdAt,
                          })),
                          initialIndex: i,
                          sender:       uploadedBy?.name ?? title ?? 'Image',
                        })}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: fullUrl }}
                          style={styles.photoImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.photoDeleteBtn}
                        onPress={() => handleDeleteImage(img.id, label)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Icon name="trash-can" size={13} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* ── Files ────────────────────────────────────── */}
          {fileItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Files ({fileItems.length})</Text>
              {fileItems.map((f, i) => {
                const cfg           = fileIconConfig(f.filename);
                const fileUrl       = `${CONFIG.SOCKET_URL}/uploads/${f.url}`;
                const fileId        = f.id ?? String(i);
                const isDownloading = fileStatus[fileId] === 'downloading';
                return (
                  <View key={fileId} style={styles.fileRow}>
                    <TouchableOpacity
                      style={styles.fileRowMain}
                      activeOpacity={0.7}
                      disabled={isDownloading}
                      onPress={() => openFile(fileUrl, f.filename, fileId)}
                    >
                      <Icon name={cfg.icon} size={28} color={cfg.color} />
                      <View style={styles.fileRowInfo}>
                        <Text style={styles.fileRowName} numberOfLines={1}>{f.filename}</Text>
                        {f.size ? (
                          <Text style={styles.fileRowSize}>
                            {f.size < 1024 * 1024
                              ? `${(f.size / 1024).toFixed(1)} KB`
                              : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}
                          </Text>
                        ) : null}
                      </View>
                      {isDownloading
                        ? <ActivityIndicator size="small" color={COLORS.primary} />
                        : <Icon name="open-in-new" size={18} color={COLORS.textMuted} />
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.fileDeleteBtn}
                      onPress={() => handleDeleteImage(f.id, f.filename)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="trash-can-outline" size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Voice Note ──────────────────────────────── */}
          {audioUrl ? (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Voice Note</Text>
                <TouchableOpacity
                  style={styles.audioDeleteBtn}
                  onPress={handleDeleteAudio}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="trash-can-outline" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
              <View style={styles.audioPlayer}>
                <TouchableOpacity
                  style={styles.audioPlayBtn}
                  onPress={isPlaying ? handlePauseAudio : () => handlePlayAudio(audioUrl)}
                  activeOpacity={0.8}
                >
                  <Icon
                    name={isPlaying ? 'pause' : 'play'}
                    size={22}
                    color={COLORS.white}
                  />
                </TouchableOpacity>

                <View style={styles.audioInfo}>
                  <View style={styles.audioTimeRow}>
                    <Text style={styles.audioPosition}>{playPosition}</Text>
                    {playDuration !== '00:00:00' && (
                      <Text style={styles.audioDuration}> / {playDuration}</Text>
                    )}
                  </View>
                  <Text style={styles.audioStateLabel}>
                    {isPlaying ? 'Playing…' : isPaused ? 'Paused' : 'Tap to play'}
                  </Text>
                </View>

                {(isPlaying || isPaused) && (
                  <TouchableOpacity style={styles.audioStopBtn} onPress={handleStopAudio}>
                    <Icon name="stop" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : null}

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

          {/* ── Extend — bottom of scroll ─────────────── */}
          {canExtend && (
            <View style={styles.extendBar}>
              <TouchableOpacity
                style={[styles.extendBarBtn, (extendLoading || isMutating) && { opacity: 0.55 }]}
                onPress={handleExtendVisibility}
                disabled={extendLoading || isMutating}
                activeOpacity={0.82}
              >
                <View style={[styles.secondaryBtnIcon, { backgroundColor: COLORS.info + '18' }]}>
                  {extendLoading
                    ? <ActivityIndicator size="small" color={COLORS.info} />
                    : <Icon name="clock-plus-outline" size={18} color={COLORS.info} />
                  }
                </View>
                <Text style={[styles.secondaryBtnText, { color: COLORS.info }]}>Extend Visibility</Text>
              </TouchableOpacity>
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
  extendBar: {
    paddingHorizontal: SPACING.md,
    paddingTop:        SPACING.sm,
  },
  extendBarBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.xs + 2,
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    paddingVertical: 13,
    borderWidth:     1.5,
    borderColor:     COLORS.info,
    ...SHADOW.sm,
  },

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
  typeText:   { fontSize: FONT_SIZE.xs, fontFamily: FONTS.medium, textTransform: 'capitalize' },
  heroDate:   { ...TYPOGRAPHY.caption, color: COLORS.textMuted, flexShrink: 0 },
  heroDesc:   { fontSize: FONT_SIZE.md, fontFamily: FONTS.medium, color: COLORS.textPrimary, lineHeight: 23 },
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
  callNumber: { fontSize: FONT_SIZE.md, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  callHint:   { fontSize: FONT_SIZE.xs, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 1 },
  callHintDisabled: { color: COLORS.error },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  callBtnText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, color: COLORS.white },
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
  infoChipText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.medium, color: COLORS.primary },

  convertedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.converted + '20',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.converted + '60',
  },
  convertedText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, color: COLORS.converted },

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
    fontFamily: FONTS.bold,
  },
  primaryBtnSub: {
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.regular,
    color:      'rgba(255,255,255,0.7)',
    marginTop:  1,
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
    fontFamily: FONTS.bold,
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
  sectionRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.small,
    fontFamily:     FONTS.bold,
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
  personInitials: { fontSize: FONT_SIZE.sm, fontFamily: FONTS.bold },
  personLabel:    { fontSize: FONT_SIZE.xs, fontFamily: FONTS.medium, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  personName:     { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },

  // Photos
  photoThumb: {
    width: 90, height: 90,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoDeleteBtn: {
    position:        'absolute',
    top:             4,
    right:           4,
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: COLORS.error,
    alignItems:      'center',
    justifyContent:  'center',
  },

  emptyBox:     { alignItems: 'center', paddingVertical: SPACING.lg, gap: SPACING.xs },
  emptyBoxText: { ...TYPOGRAPHY.small, color: COLORS.textMuted, fontStyle: 'italic' },

  // File rows
  fileRow: {
    flexDirection:    'row',
    alignItems:       'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  fileRowMain: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  fileDeleteBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical:   SPACING.sm,
  },
  fileRowInfo: { flex: 1 },
  fileRowName: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, fontWeight: '500' },
  fileRowSize: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 },

  // Notes
  notesList:    { gap: SPACING.sm },
  noteRow:      { flexDirection: 'row', gap: SPACING.sm },
  noteIndex: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  noteIndexText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, color: COLORS.primary },
  noteContent:   { flex: 1 },
  noteText:      { ...TYPOGRAPHY.body, color: COLORS.textPrimary, lineHeight: 20 },
  noteMeta:      { flexDirection: 'row', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' },
  noteBy:        { ...TYPOGRAPHY.caption, color: COLORS.primary, fontFamily: FONTS.medium },
  noteTime:      { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  // Stats strip
  // Timeline card (replaces plain stats strip)
  timelineCard: {
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
    overflow:         'hidden',
    ...SHADOW.sm,
  },
  tlDateRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm + 2,
  },
  tlDateIcon: {
    width:          40,
    height:         40,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  tlDateBody:  { flex: 1 },
  tlDateLabel: {
    fontSize:      FONT_SIZE.xs,
    fontFamily:    FONTS.medium,
    color:         COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom:  2,
  },
  tlDateValue: {
    fontSize:   FONT_SIZE.md,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
    lineHeight: 20,
  },
  tlDateTime: {
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.medium,
    color:      COLORS.textMuted,
    marginTop:  1,
  },
  tlDatePending: {
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.regular,
    color:      COLORS.textMuted,
    fontStyle:  'italic',
    marginTop:  2,
  },
  tlDateRight: {
    alignItems:  'flex-end',
    flexShrink:  0,
  },
  tlDateAgo: {
    fontSize:      FONT_SIZE.xs,
    fontFamily:    FONTS.bold,
    color:         COLORS.textMuted,
    letterSpacing: 0.2,
  },
  tlConnectorWrap: {
    paddingLeft: SPACING.md + 20,   // icon center: md + icon/2
    paddingVertical: 0,
  },
  tlConnectorLine: {
    width:           2,
    height:          18,
    backgroundColor: COLORS.divider,
    borderRadius:    1,
  },
  tlStatsRow: {
    flexDirection:    'row',
    borderTopWidth:   1,
    borderTopColor:   COLORS.divider,
    paddingVertical:  SPACING.sm,
  },
  tlStat: {
    flex:        1,
    alignItems:  'center',
    gap:         3,
  },
  tlStatValue: {
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
  },
  tlStatLabel: {
    fontSize:      FONT_SIZE.xs,
    fontFamily:    FONTS.medium,
    color:         COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tlStatDivider: {
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
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.medium,
  },

  // Visibility window row
  visibilityRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    marginTop:         SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   6,
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1,
    alignSelf:         'flex-start',
  },
  visibilityActive:  { backgroundColor: COLORS.info + '12', borderColor: COLORS.info + '40' },
  visibilityExpired: { backgroundColor: COLORS.error + '10', borderColor: COLORS.error + '35' },
  visibilityText:    { fontSize: FONT_SIZE.xs, fontFamily: FONTS.medium },

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
    fontSize:      FONT_SIZE.xs,
    fontFamily:    FONTS.bold,
    color:         COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timingValue: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.textPrimary,
    fontFamily: FONTS.medium,
    marginTop:  1,
  },
  timingBy: {
    ...TYPOGRAPHY.caption,
    fontFamily: FONTS.bold,
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
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.bold,
    color:      COLORS.warning,
  },

  // Audio player
  audioPlayer: {
    flexDirection: 'row',
    alignItems:    'center',
    backgroundColor: COLORS.background,
    borderRadius:  BORDER_RADIUS.lg,
    padding:       SPACING.md,
    gap:           SPACING.md,
    borderWidth:   1,
    borderColor:   COLORS.border,
  },
  audioPlayBtn: {
    width:          48,
    height:         48,
    borderRadius:   24,
    backgroundColor: COLORS.primary,
    alignItems:     'center',
    justifyContent: 'center',
  },
  audioInfo:    { flex: 1, gap: 4 },
  audioTimeRow: { flexDirection: 'row', alignItems: 'baseline' },
  audioPosition: {
    fontSize:    FONT_SIZE.md,
    fontFamily:  FONTS.bold,
    color:       COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  audioDuration: {
    fontSize:    FONT_SIZE.xs,
    fontFamily:  FONTS.regular,
    color:       COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  audioStateLabel: {
    fontSize:      FONT_SIZE.xs,
    fontFamily:    FONTS.regular,
    color:         COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  audioStopBtn: {
    width:          36,
    height:         36,
    borderRadius:   18,
    backgroundColor: '#fee2e2',
    alignItems:     'center',
    justifyContent: 'center',
  },
  audioDeleteBtn: {
    padding:         4,
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
  tlBadgeText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, textTransform: 'capitalize' },
  tlTime:      { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
});
