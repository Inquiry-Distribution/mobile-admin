/**
 * EditInquiryScreen — Superuser only
 *
 * Pre-fills all editable fields from the existing inquiry:
 *   description, mobile, inquiryTime, priority, source
 *
 * Images: existing images are shown read-only; new images can be added.
 * Distribute / assignment is handled from InquiryDetailScreen — not here.
 */
import React, { useState } from 'react';
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
import { SafeAreaView }      from 'react-native-safe-area-context';
import Icon                  from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { Menu, Modal, Portal } from 'react-native-paper';
import Toast                 from 'react-native-toast-message';

import { COLORS, PRIORITY_COLORS }                from '@constants/colors';
import { TYPOGRAPHY }                             from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW, PRIORITY_LABELS } from '@constants/config';

import { inquiryApi }  from '@api/inquiry.api';
import useInquiryStore from '@store/inquiry.store';

// ─── Constants ────────────────────────────────────────────────
const PRIORITIES = [
  { label: 'High',   value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low',    value: 'low' },
];

const MAX_IMAGES     = 8;
const MAX_FILE_MB    = 5;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

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
  const [description, setDescription] = useState(inquiry.description ?? '');
  const [mobile,      setMobile]      = useState(inquiry.mobile ?? '');
  const [inquiryTime, setInquiryTime] = useState(extractTime(inquiry.inquiryTime));
  const [priority,    setPriority]    = useState(inquiry.priority ?? 'medium');
  const [source,      setSource]      = useState(inquiry.source ?? '');

  // New images to upload (local assets)
  const [newImages, setNewImages] = useState([]);

  // UI state
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [timePickerOpen,   setTimePickerOpen]   = useState(false);
  const [isSubmitting,     setIsSubmitting]      = useState(false);

  // Existing server images
  const existingImages = inquiry.images ?? [];
  const totalImages    = existingImages.length + newImages.length;

  // ─── Image picker ────────────────────────────────────────────
  const handlePickImages = async () => {
    if (totalImages >= MAX_IMAGES) {
      Alert.alert('Limit Reached', `This inquiry already has ${totalImages} images (max ${MAX_IMAGES}).`);
      return;
    }
    const result = await launchImageLibrary({
      mediaType:      'photo',
      quality:        0.85,
      selectionLimit: MAX_IMAGES - totalImages,
    });
    if (!result.assets) return;

    const valid   = result.assets.filter((a) => (a.fileSize ?? 0) <= MAX_FILE_BYTES);
    const skipped = result.assets.length - valid.length;
    if (skipped > 0) {
      Alert.alert('File Too Large', `${skipped} image(s) exceed ${MAX_FILE_MB} MB and were skipped.`);
    }
    setNewImages((prev) => [...prev, ...valid].slice(0, MAX_IMAGES - existingImages.length));
  };

  const removeNewImage = (index) =>
    setNewImages((prev) => prev.filter((_, i) => i !== index));

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
    if (!description.trim() && !mobile.trim()) {
      Alert.alert('Required', 'Please enter a description or mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update inquiry fields
      await inquiryApi.update(inquiry.id, {
        description:  description.trim()  || undefined,
        mobile:       mobile.trim()        || undefined,
        inquiryTime:  inquiryTime          || undefined,
        priority,
        source:       source.trim()        || undefined,
      });

      // 2. Upload new images (if any)
      if (newImages.length > 0) {
        await inquiryApi.uploadImages(inquiry.id, newImages);
      }

      // 3. Refresh store
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

          {/* ── Images ──────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>IMAGES</Text>

            {/* Existing images (read-only) */}
            {existingImages.length > 0 && (
              <View style={styles.existingImagesWrap}>
                <Text style={styles.existingLabel}>
                  {existingImages.length} existing image{existingImages.length !== 1 ? 's' : ''}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbRow}
                >
                  {existingImages.map((img, i) => (
                    <View key={img.id ?? i} style={[styles.thumbWrap, styles.existingThumb]}>
                      <Icon name="image-outline" size={24} color={COLORS.primaryMid} />
                      <Text style={styles.existingThumbText} numberOfLines={1}>
                        {img.filename ?? `Photo ${i + 1}`}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* New images */}
            {newImages.length === 0 && totalImages < MAX_IMAGES ? (
              <TouchableOpacity
                style={[styles.uploadEmpty, existingImages.length > 0 && { marginTop: SPACING.sm }]}
                onPress={handlePickImages}
                activeOpacity={0.7}
              >
                <View style={styles.uploadIconBox}>
                  <Icon name="image-plus" size={26} color={COLORS.primary} />
                </View>
                <Text style={styles.uploadText}>Add more photos</Text>
                <Text style={styles.uploadHint}>
                  .jpg, .jpeg, .png · Max {MAX_FILE_MB} MB · Up to {MAX_IMAGES - existingImages.length} more
                </Text>
              </TouchableOpacity>
            ) : newImages.length > 0 ? (
              <View style={{ marginTop: existingImages.length > 0 ? SPACING.sm : 0 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbRow}
                >
                  {newImages.map((img, i) => (
                    <View key={i} style={styles.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        onPress={() => removeNewImage(i)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Icon name="close-circle" size={20} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {totalImages < MAX_IMAGES && (
                    <TouchableOpacity
                      style={styles.thumbAdd}
                      onPress={handlePickImages}
                      activeOpacity={0.7}
                    >
                      <Icon name="plus" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                </ScrollView>
                <Text style={[styles.uploadHint, { marginTop: SPACING.xs }]}>
                  {newImages.length} new · {existingImages.length} existing
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── Inquiry Description ──────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>INQUIRY DESCRIPTION</Text>
            <TextInput
              style={styles.descInput}
              placeholder="Description"
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
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
                    <Text style={styles.dropdownText}>{PRIORITY_LABELS[priority]}</Text>
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
    fontWeight:    '700',
    letterSpacing: 0.6,
    marginBottom:  SPACING.sm,
  },
  fieldLabel: {
    ...TYPOGRAPHY.captionMedium,
    color:         COLORS.textMuted,
    fontWeight:    '700',
    letterSpacing: 0.5,
    marginBottom:  SPACING.xs,
  },

  // Existing images
  existingImagesWrap: { marginBottom: SPACING.xs },
  existingLabel: {
    ...TYPOGRAPHY.caption,
    color:        COLORS.textMuted,
    marginBottom: SPACING.xs,
    fontStyle:    'italic',
  },
  existingThumb: {
    width:           72,
    height:          72,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     SPACING.sm,
    gap:             4,
    padding:         4,
  },
  existingThumbText: {
    fontSize:  9,
    color:     COLORS.textMuted,
    maxWidth:  64,
    textAlign: 'center',
  },

  // Upload
  uploadEmpty: {
    borderWidth:     1.5,
    borderColor:     COLORS.border,
    borderStyle:     'dashed',
    borderRadius:    BORDER_RADIUS.md,
    paddingVertical: SPACING.xl,
    alignItems:      'center',
    gap:             SPACING.xs,
  },
  uploadIconBox: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    SPACING.xs,
  },
  uploadText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textPrimary,
    fontWeight: '600',
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

  // Description
  descInput: {
    borderWidth:  1,
    borderColor:  COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding:      SPACING.sm,
    ...TYPOGRAPHY.body,
    color:        COLORS.textPrimary,
    minHeight:    100,
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
    fontWeight: '700',
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
    fontWeight:   '700',
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
    fontWeight:      '700',
  },
  timeModalColon: {
    ...TYPOGRAPHY.h3,
    color:        COLORS.textSecondary,
    fontWeight:   '700',
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
    fontWeight: '600',
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
    fontWeight: '700',
  },
});
