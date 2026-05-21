/**
 * EditInquiryScreen — Superuser only
 *
 * Pre-fills all editable fields from the existing inquiry:
 *   description, mobile, inquiryTime, priority, source
 *
 * Images: existing images are shown read-only; new images can be added.
 * Distribute / assignment is handled from InquiryDetailScreen — not here.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import RichTextEditor from '@components/common/RichTextEditor';
import { SafeAreaView }      from 'react-native-safe-area-context';
import Icon                  from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker        from 'react-native-document-picker';
import { Menu, Modal, Portal } from 'react-native-paper';
import Toast                 from 'react-native-toast-message';
import AudioRecorderPlayer   from 'react-native-audio-recorder-player';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

import { COLORS, PRIORITY_COLORS }                from '@constants/colors';
import { TYPOGRAPHY, FONTS, FONT_SIZE }            from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW, CONFIG } from '@constants/config';
import { PRIORITY_LABEL, stripHtml }    from '@utils/helpers';

import { inquiryApi }  from '@api/inquiry.api';
import useInquiryStore from '@store/inquiry.store';

// ─── Constants ────────────────────────────────────────────────
const PRIORITIES = [
  { label: 'High',   value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low',    value: 'low' },
];

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

function isImageAsset(asset) {
  const name = asset.fileName || asset.name || '';
  return IMAGE_EXTS.has(name.split('.').pop().toLowerCase());
}

function isImageByFilename(filename) {
  return IMAGE_EXTS.has((filename ?? '').split('.').pop().toLowerCase());
}

const FILE_ICONS = {
  pdf:  { icon: 'file-pdf-box',           color: '#DC2626' },
  xls:  { icon: 'file-excel-box',         color: '#16A34A' },
  xlsx: { icon: 'file-excel-box',         color: '#16A34A' },
  csv:  { icon: 'file-delimited',         color: '#16A34A' },
  doc:  { icon: 'file-word-box',          color: '#2563EB' },
  docx: { icon: 'file-word-box',          color: '#2563EB' },
  ppt:  { icon: 'file-powerpoint-box',    color: '#EA580C' },
  pptx: { icon: 'file-powerpoint-box',    color: '#EA580C' },
  txt:  { icon: 'file-document-outline',  color: '#6B7280' },
};

function fileIconConfig(name) {
  const ext = (name ?? '').split('.').pop().toLowerCase();
  return FILE_ICONS[ext] ?? { icon: 'file-outline', color: '#6B7280' };
}

// ─── Helpers ──────────────────────────────────────────────────
function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Extract HH:MM from whatever format the server returns
function extractTime(val) {
  if (!val) return '';
  if (typeof val === 'string' && val.includes('T')) {
    const d = new Date(val);
    if (!isNaN(d)) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  // Already "HH:MM"
  return String(val).slice(0, 5);
}

// ─── Screen ───────────────────────────────────────────────────
export default function EditInquiryScreen({ route, navigation }) {
  const { inquiry } = route.params;
  const { refreshInquiries, selectInquiry } = useInquiryStore();

  // Pre-fill from existing inquiry
  const [title,       setTitle]       = useState(inquiry.title ?? '');
  const [description, setDescription] = useState(inquiry.description ?? '');
  const [mobile,      setMobile]      = useState(inquiry.mobile ?? '');
  const [inquiryTime, setInquiryTime] = useState(extractTime(inquiry.inquiryTime));
  const [priority,    setPriority]    = useState(inquiry.priority ?? 'medium');
  const [source,      setSource]      = useState(inquiry.source ?? '');

  const editorRef = useRef(null);

  // New attachments (photos + doc files, unified)
  const [newAttachments, setNewAttachments] = useState([]);

  // Audio recording
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;
  const [recordingState,  setRecordingState]  = useState('idle'); // 'idle' | 'recording' | 'recorded'
  const [audioPath,       setAudioPath]       = useState(null);
  const [recordDuration,  setRecordDuration]  = useState('00:00');
  const [isPlaying,       setIsPlaying]       = useState(false);
  const [playPosition,    setPlayPosition]    = useState('00:00');

  useEffect(() => {
    return () => {
      audioRecorderPlayer.stopRecorder().catch(() => {});
      audioRecorderPlayer.stopPlayer().catch(() => {});
    };
  }, []);

  const startRecording = async () => {
    const permission = await request(
      Platform.OS === 'android'
        ? PERMISSIONS.ANDROID.RECORD_AUDIO
        : PERMISSIONS.IOS.MICROPHONE,
    );
    if (permission !== RESULTS.GRANTED) {
      Alert.alert('Permission Required', 'Allow microphone access to record a voice note.');
      return;
    }
    try {
      const path = await audioRecorderPlayer.startRecorder();
      audioRecorderPlayer.addRecordBackListener((e) => {
        const secs = Math.floor(e.currentPosition / 1000);
        const mm   = String(Math.floor(secs / 60)).padStart(2, '0');
        const ss   = String(secs % 60).padStart(2, '0');
        setRecordDuration(`${mm}:${ss}`);
      });
      setAudioPath(path);
      setRecordingState('recording');
    } catch {
      Alert.alert('Error', 'Could not start recording. Check microphone access.');
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setRecordingState('recorded');
    } catch {
      setRecordingState('idle');
    }
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      await audioRecorderPlayer.pausePlayer();
      setIsPlaying(false);
    } else {
      await audioRecorderPlayer.startPlayer(audioPath);
      audioRecorderPlayer.addPlayBackListener((e) => {
        if (e.currentPosition >= e.duration) {
          audioRecorderPlayer.stopPlayer();
          audioRecorderPlayer.removePlayBackListener();
          setIsPlaying(false);
          setPlayPosition('00:00');
          return;
        }
        const secs = Math.floor(e.currentPosition / 1000);
        const mm   = String(Math.floor(secs / 60)).padStart(2, '0');
        const ss   = String(secs % 60).padStart(2, '0');
        setPlayPosition(`${mm}:${ss}`);
      });
      setIsPlaying(true);
    }
  };

  const deleteRecording = async () => {
    if (isPlaying) {
      await audioRecorderPlayer.stopPlayer();
      audioRecorderPlayer.removePlayBackListener();
      setIsPlaying(false);
    }
    setAudioPath(null);
    setRecordingState('idle');
    setRecordDuration('00:00');
    setPlayPosition('00:00');
  };

  // UI state
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [timePickerOpen,   setTimePickerOpen]   = useState(false);
  const [isSubmitting,     setIsSubmitting]      = useState(false);

  // Existing server records — split by filename extension
  const existingImages = (inquiry.images ?? []).filter((img) => isImageByFilename(img.filename));
  const existingDocs   = (inquiry.images ?? []).filter((img) => !isImageByFilename(img.filename));


  // ─── Image picker ────────────────────────────────────────────
  const handlePickImages = async () => {
    const result = await launchImageLibrary({
      mediaType:      'photo',
      quality:        0.85,
      selectionLimit: 0,
    });
    if (!result.assets) return;
    const valid   = result.assets.filter((a) => (a.fileSize ?? 0) <= MAX_FILE_BYTES);
    const skipped = result.assets.length - valid.length;
    if (skipped > 0) Alert.alert('File Too Large', `${skipped} photo(s) exceed 20 MB and were skipped.`);
    setNewAttachments((prev) => [...prev, ...valid]);
  };

  // ─── File picker ─────────────────────────────────────────────
  const handlePickFiles = async () => {
    try {
      const results = await DocumentPicker.pick({
        type: [
          DocumentPicker.types.pdf,
          DocumentPicker.types.xls,
          DocumentPicker.types.xlsx,
          DocumentPicker.types.doc,
          DocumentPicker.types.docx,
          DocumentPicker.types.ppt,
          DocumentPicker.types.pptx,
          DocumentPicker.types.plainText,
          DocumentPicker.types.csv,
        ],
        allowMultiSelection: true,
      });
      const valid   = results.filter((f) => (f.size ?? 0) <= MAX_FILE_BYTES);
      const skipped = results.length - valid.length;
      if (skipped > 0) Alert.alert('File Too Large', `${skipped} file(s) exceed 20 MB and were skipped.`);
      setNewAttachments((prev) => [...prev, ...valid]);
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) Alert.alert('Error', 'Could not open file picker.');
    }
  };

  const removeNewAttachment = (index) =>
    setNewAttachments((prev) => prev.filter((_, i) => i !== index));

  // ─── Time picker ─────────────────────────────────────────────
  const [tempHour,   setTempHour]   = useState('');
  const [tempMinute, setTempMinute] = useState('');

  const openTimePicker = () => {
    const [h = '', m = ''] = inquiryTime ? inquiryTime.split(':') : [];
    setTempHour(h);
    setTempMinute(m);
    setTimePickerOpen(true);
  };

  const confirmTime = () => {
    const h = Math.min(23, Math.max(0, parseInt(tempHour) || 0));
    const m = Math.min(59, Math.max(0, parseInt(tempMinute) || 0));
    setInquiryTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    setTimePickerOpen(false);
  };

  // ─── Submit ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!title.trim() && !mobile.trim()) {
      Alert.alert('Required', 'Please enter a title or mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update inquiry fields
      await inquiryApi.update(inquiry.id, {
        title:        title.trim()         || undefined,
        description:  stripHtml(description).trim() ? description.trim() : undefined,
        mobile:       mobile.trim()        || undefined,
        inquiryTime:  inquiryTime          || undefined,
        priority,
        source:       source.trim()        || undefined,
      });

      // 2. Upload new photos + files (single call, same endpoint)
      if (newAttachments.length > 0) {
        await inquiryApi.uploadImages(inquiry.id, newAttachments);
      }

      // 3. Upload voice note
      if (audioPath) {
        await inquiryApi.uploadAudio(inquiry.id, audioPath);
      }

      // 4. Refresh store
      refreshInquiries();
      selectInquiry(inquiry.id);

      Toast.show({
        type:  'success',
        text1: 'Inquiry Updated',
        text2: 'Changes saved successfully.',
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to update inquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Title ───────────────────────────────────── */}
          <View style={styles.card}>
            <TextInput
              style={[styles.input, styles.titleInput]}
              placeholder="Enter inquiry title (optional)"
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
              maxLength={150}
            />
          </View>

          {/* ── Photos + Files ───────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ATTACHMENTS</Text>

            {/* Existing photos (read-only thumbnails) */}
            {existingImages.length > 0 && (
              <View style={styles.existingImagesWrap}>
                <Text style={styles.existingLabel}>
                  {existingImages.length} existing photo{existingImages.length !== 1 ? 's' : ''}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
                  {existingImages.map((img, i) => (
                    <View key={img.id ?? i} style={styles.thumbWrap}>
                      <Image
                        source={{ uri: `${CONFIG.SOCKET_URL}/uploads/${img.url}` }}
                        style={styles.thumb}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Existing doc files (read-only rows) */}
            {existingDocs.length > 0 && (
              <View style={{ marginBottom: SPACING.xs }}>
                <Text style={[styles.existingLabel, existingImages.length > 0 && { marginTop: SPACING.xs }]}>
                  {existingDocs.length} existing file{existingDocs.length !== 1 ? 's' : ''}
                </Text>
                {existingDocs.map((f, i) => {
                  const cfg = fileIconConfig(f.filename);
                  return (
                    <View key={f.id ?? i} style={styles.fileRow}>
                      <Icon name={cfg.icon} size={22} color={cfg.color} />
                      <Text style={styles.fileRowName} numberOfLines={1}>{f.filename}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* New photos to upload */}
            {newAttachments.filter(isImageAsset).length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.thumbRow, { marginTop: SPACING.xs }]}
              >
                {newAttachments.map((a, i) =>
                  isImageAsset(a) ? (
                    <View key={i} style={styles.thumbWrap}>
                      <Image source={{ uri: a.uri }} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        onPress={() => removeNewAttachment(i)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Icon name="close-circle" size={20} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ) : null
                )}
              </ScrollView>
            )}

            {/* New doc files to upload */}
            {newAttachments.map((a, i) =>
              !isImageAsset(a) ? (
                <View key={i} style={styles.fileRow}>
                  <Icon name={fileIconConfig(a.name).icon} size={22} color={fileIconConfig(a.name).color} />
                  <Text style={styles.fileRowName} numberOfLines={1}>{a.name}</Text>
                  <TouchableOpacity onPress={() => removeNewAttachment(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Icon name="close-circle" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ) : null
            )}

            {/* Add buttons */}
            <View style={[styles.addBtnRow, { marginTop: SPACING.sm }]}>
              <TouchableOpacity style={styles.addHalfBtn} onPress={handlePickImages} activeOpacity={0.7}>
                <Icon name="image-plus" size={18} color={COLORS.primary} />
                <Text style={styles.addBtnText}>Add Photos</Text>
              </TouchableOpacity>
              <View style={styles.addBtnDivider} />
              <TouchableOpacity style={styles.addHalfBtn} onPress={handlePickFiles} activeOpacity={0.7}>
                <Icon name="paperclip" size={18} color={COLORS.primary} />
                <Text style={styles.addBtnText}>Attach Files</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Voice Note ───────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>VOICE NOTE</Text>

            {recordingState === 'idle' && (
              <TouchableOpacity
                style={styles.audioIdle}
                onPress={startRecording}
                activeOpacity={0.75}
              >
                <View style={styles.audioMicBox}>
                  <Icon name="microphone" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.audioIdleBody}>
                  <Text style={styles.audioIdleText}>Record voice note</Text>
                  <Text style={styles.audioIdleHint}>Optional · stored with inquiry</Text>
                </View>
                <Icon name="chevron-right" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}

            {recordingState === 'recording' && (
              <View style={styles.audioRecording}>
                <View style={styles.audioRecordingLeft}>
                  <View style={styles.audioRecordDot} />
                  <Text style={styles.audioTimer}>{recordDuration}</Text>
                  <Text style={styles.audioRecordingLabel}>Recording…</Text>
                </View>
                <TouchableOpacity
                  style={styles.audioStopBtn}
                  onPress={stopRecording}
                  activeOpacity={0.8}
                >
                  <Icon name="stop" size={18} color={COLORS.white} />
                  <Text style={styles.audioStopText}>Stop</Text>
                </TouchableOpacity>
              </View>
            )}

            {recordingState === 'recorded' && (
              <View style={styles.audioRecorded}>
                <TouchableOpacity
                  style={styles.audioPlayBtn}
                  onPress={togglePlayback}
                  activeOpacity={0.8}
                >
                  <Icon name={isPlaying ? 'pause' : 'play'} size={16} color={COLORS.white} />
                </TouchableOpacity>
                <View style={styles.audioInfo}>
                  <Text style={styles.audioInfoLabel}>Voice note recorded</Text>
                  <Text style={styles.audioInfoTime}>
                    {isPlaying ? playPosition : recordDuration}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.audioDeleteBtn}
                  onPress={deleteRecording}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="delete-outline" size={20} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Inquiry Description ──────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>INQUIRY DESCRIPTION</Text>
            <RichTextEditor
              ref={editorRef}
              initialHTML={description}
              onChange={setDescription}
              placeholder="Description"
              minHeight={140}
              editorBg={COLORS.surface}
            />
          </View>

          {/* ── Mobile & Time ────────────────────────────── */}
          <View style={[styles.card, styles.row]}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>MOBILE</Text>
              <TextInput
                style={styles.input}
                placeholder="9876543210"
                placeholderTextColor={COLORS.textMuted}
                value={mobile}
                onChangeText={setMobile}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>

            <View style={styles.fieldDivider} />

            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>TIME</Text>
              <TouchableOpacity
                style={[styles.input, styles.timeInput]}
                onPress={openTimePicker}
                activeOpacity={0.7}
              >
                <Text style={[styles.timeText, !inquiryTime && styles.placeholderText]}>
                  {inquiryTime ? formatTime12(inquiryTime) : '--:-- --'}
                </Text>
                <Icon name="clock-outline" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Priority & Source ────────────────────────── */}
          <View style={[styles.card, styles.row]}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>PRIORITY</Text>
              <Menu
                visible={priorityMenuOpen}
                onDismiss={() => setPriorityMenuOpen(false)}
                contentStyle={styles.menuContent}
                anchor={
                  <TouchableOpacity
                    style={[styles.input, styles.dropdownInput]}
                    onPress={() => setPriorityMenuOpen(true)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.priorityDot,
                        { backgroundColor: PRIORITY_COLORS[priority]?.text ?? COLORS.textMuted },
                      ]}
                    />
                    <Text style={styles.dropdownText}>{PRIORITY_LABEL[priority]}</Text>
                    <Icon name="chevron-down" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                }
              >
                {PRIORITIES.map((p) => (
                  <Menu.Item
                    key={p.value}
                    onPress={() => { setPriority(p.value); setPriorityMenuOpen(false); }}
                    title={p.label}
                    leadingIcon={() => (
                      <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[p.value]?.text, marginTop: 2 }]} />
                    )}
                  />
                ))}
              </Menu>
            </View>

            <View style={styles.fieldDivider} />

            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>SOURCE</Text>
              <TextInput
                style={styles.input}
                placeholder="Walk-in, Phone, Website..."
                placeholderTextColor={COLORS.textMuted}
                value={source}
                onChangeText={setSource}
              />
            </View>
          </View>

        </ScrollView>

        {/* ── Save Button ──────────────────────────────── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Icon name="content-save-outline" size={18} color={COLORS.white} />
                <Text style={styles.submitBtnText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Custom Time Picker Modal ─────────────────── */}
      <Portal>
        <Modal
          visible={timePickerOpen}
          onDismiss={() => setTimePickerOpen(false)}
          contentContainerStyle={styles.timeModal}
        >
          <Text style={styles.timeModalTitle}>Select Time</Text>
          <View style={styles.timeModalRow}>
            <View style={styles.timeModalField}>
              <Text style={styles.timeModalLabel}>Hour (0–23)</Text>
              <TextInput
                style={styles.timeModalInput}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="HH"
                placeholderTextColor={COLORS.textMuted}
                value={tempHour}
                onChangeText={setTempHour}
              />
            </View>
            <Text style={styles.timeModalColon}>:</Text>
            <View style={styles.timeModalField}>
              <Text style={styles.timeModalLabel}>Minute (0–59)</Text>
              <TextInput
                style={styles.timeModalInput}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="MM"
                placeholderTextColor={COLORS.textMuted}
                value={tempMinute}
                onChangeText={setTempMinute}
              />
            </View>
          </View>
          <View style={styles.timeModalActions}>
            <TouchableOpacity
              style={styles.timeModalCancel}
              onPress={() => setTimePickerOpen(false)}
            >
              <Text style={styles.timeModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.timeModalConfirm} onPress={confirmTime}>
              <Text style={styles.timeModalConfirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  flex:   { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    ...SHADOW.sm,
  },
  sectionLabel: {
    ...TYPOGRAPHY.captionMedium,
    color:         COLORS.textMuted,
    fontFamily:    FONTS.bold,
    letterSpacing: 0.6,
    marginBottom:  SPACING.sm,
  },
  fieldLabel: {
    ...TYPOGRAPHY.captionMedium,
    color:         COLORS.textMuted,
    fontFamily:    FONTS.bold,
    letterSpacing: 0.5,
    marginBottom:  SPACING.xs,
  },

  // Existing items
  existingImagesWrap: { marginBottom: SPACING.xs },
  existingLabel: {
    ...TYPOGRAPHY.caption,
    color:        COLORS.textMuted,
    marginBottom: SPACING.xs,
    fontStyle:    'italic',
  },
  fileRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    paddingVertical:   SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  fileRowName: {
    flex:  1,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  addBtnRow: {
    flexDirection: 'row',
    borderWidth:   1.5,
    borderColor:   COLORS.border,
    borderStyle:   'dashed',
    borderRadius:  BORDER_RADIUS.md,
    overflow:      'hidden',
  },
  addHalfBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.xs,
    paddingVertical: SPACING.md,
  },
  addBtnText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.primary,
    fontFamily: FONTS.medium,
  },
  addBtnDivider: {
    width:           1,
    backgroundColor: COLORS.border,
  },

  uploadHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  thumbRow:  { paddingVertical: SPACING.xs },
  thumbWrap: { position: 'relative', marginRight: SPACING.sm },
  thumb: {
    width:        72,
    height:       72,
    borderRadius: BORDER_RADIUS.md,
  },
  thumbRemove: {
    position:        'absolute',
    top:             -6,
    right:           -6,
    backgroundColor: COLORS.white,
    borderRadius:    10,
  },
  thumbAdd: {
    width:           72,
    height:          72,
    borderRadius:    BORDER_RADIUS.md,
    borderWidth:     1.5,
    borderStyle:     'dashed',
    borderColor:     COLORS.primaryMid,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: COLORS.primaryLight,
  },

  // ── Voice note ────────────────────────────────────────────────
  audioIdle: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    borderWidth:       1,
    borderColor:       COLORS.border,
    borderStyle:       'dashed',
    borderRadius:      BORDER_RADIUS.md,
    paddingVertical:   SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  audioMicBox: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  audioIdleBody: { flex: 1 },
  audioIdleText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textPrimary,
    fontFamily: FONTS.medium,
    fontSize:   FONT_SIZE.sm,
  },
  audioIdleHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  audioRecording: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   '#FEF2F2',
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1,
    borderColor:       '#FECACA',
    paddingVertical:   SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  audioRecordingLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  audioRecordDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: COLORS.error,
  },
  audioTimer: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.error,
    fontFamily: FONTS.bold,
    fontSize:   FONT_SIZE.sm,
  },
  audioRecordingLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.error,
  },
  audioStopBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   COLORS.error,
    borderRadius:      BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   SPACING.xs + 1,
  },
  audioStopText: {
    ...TYPOGRAPHY.small,
    color:      COLORS.white,
    fontFamily: FONTS.bold,
  },
  audioRecorded: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    backgroundColor:   COLORS.primaryLight,
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1,
    borderColor:       COLORS.primaryMid,
    paddingVertical:   SPACING.xs + 2,
    paddingHorizontal: SPACING.sm,
  },
  audioPlayBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  audioInfo: { flex: 1 },
  audioInfoLabel: {
    ...TYPOGRAPHY.small,
    color:      COLORS.primary,
    fontFamily: FONTS.medium,
  },
  audioInfoTime: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.primary,
    fontFamily: FONTS.bold,
    marginTop:  1,
  },
  audioDeleteBtn: {
    padding:    SPACING.xs,
    flexShrink: 0,
  },

  // Row layout
  row:         { flexDirection: 'row', alignItems: 'flex-start', gap: 0 },
  halfField:   { flex: 1 },
  fieldDivider: { width: SPACING.sm },

  // Generic input
  input: {
    borderWidth:       1,
    borderColor:       COLORS.border,
    borderRadius:      BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    height:            44,
    ...TYPOGRAPHY.body,
    color:             COLORS.textPrimary,
    justifyContent:    'center',
  },

  // Title input — overrides body fontFamily+fontWeight so placeholder
  // renders correctly with the custom font on Android
  titleInput: {
    fontFamily:  FONTS.medium,
    fontWeight:  undefined,
  },

  // Time
  timeInput: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  timeText:        { ...TYPOGRAPHY.body, color: COLORS.textPrimary },
  placeholderText: { color: COLORS.textMuted },

  // Priority dropdown
  dropdownInput: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  dropdownText:  { ...TYPOGRAPHY.body, color: COLORS.textPrimary, flex: 1 },
  priorityDot:   { width: 8, height: 8, borderRadius: 4 },
  menuContent:   { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md },

  // Footer
  footer: {
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    paddingBottom:     Platform.OS === 'ios' ? SPACING.sm : SPACING.md,
    backgroundColor:   COLORS.surface,
    borderTopWidth:    1,
    borderTopColor:    COLORS.divider,
  },
  submitBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius:    BORDER_RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    ...SHADOW.md,
  },
  submitBtnDisabled: { backgroundColor: COLORS.primaryMid, elevation: 0, shadowOpacity: 0 },
  submitBtnText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.white,
    fontFamily: FONTS.bold,
  },

  // Time picker modal
  timeModal: {
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.xl,
    marginHorizontal: SPACING.xl,
    padding:          SPACING.lg,
  },
  timeModalTitle: {
    ...TYPOGRAPHY.h4,
    color:        COLORS.textPrimary,
    fontFamily:   FONTS.bold,
    marginBottom: SPACING.lg,
    textAlign:    'center',
  },
  timeModalRow: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'center',
    gap:            SPACING.sm,
    marginBottom:   SPACING.lg,
  },
  timeModalField:  { alignItems: 'center', flex: 1 },
  timeModalLabel: {
    ...TYPOGRAPHY.caption,
    color:        COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  timeModalInput: {
    borderWidth:     1.5,
    borderColor:     COLORS.border,
    borderRadius:    BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    textAlign:       'center',
    width:           '100%',
    ...TYPOGRAPHY.h3,
    color:           COLORS.textPrimary,
    fontFamily:      FONTS.bold,
  },
  timeModalColon: {
    ...TYPOGRAPHY.h3,
    color:        COLORS.textSecondary,
    fontFamily:   FONTS.bold,
    paddingBottom: SPACING.sm,
  },
  timeModalActions: { flexDirection: 'row', gap: SPACING.sm },
  timeModalCancel: {
    flex:            1,
    paddingVertical: SPACING.sm,
    borderRadius:    BORDER_RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    alignItems:      'center',
  },
  timeModalCancelText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  timeModalConfirm: {
    flex:            1,
    paddingVertical: SPACING.sm,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
  },
  timeModalConfirmText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.white,
    fontFamily: FONTS.bold,
  },
});
