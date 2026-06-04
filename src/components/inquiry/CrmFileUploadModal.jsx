/**
 * CrmFileUploadModal
 *
 * Shows after a successful CRM push.
 * Lists inquiry images/files (no audio); user selects which to upload.
 *
 * Props:
 *   visible      bool
 *   onClose      fn()                  — skip / cancel
 *   onUploaded   fn(uploaded: number)  — called after success
 *   inquiryId    string
 *   inqCode      string
 *   images       InquiryImage[]        — from inquiry.images (no audio)
 *   apiUpload    fn(id, fileIds)       — inquiryApi.uploadFilesToCrm
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList,
  Image, ActivityIndicator, StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS }        from '@constants/colors';
import { SPACING, BORDER_RADIUS, SHADOW, CONFIG } from '@constants/config';
import { FONTS, FONT_SIZE, TYPOGRAPHY }   from '@constants/typography';

// ── Helpers ────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const AUDIO_EXTS = new Set(['mp3', 'm4a', 'aac', 'wav', 'opus']);
const ALLOWED_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'webp',
  'pdf',
  'doc', 'docx',
  'xls', 'xlsx', 'csv',
  'ppt', 'pptx',
  'txt',
]);

const FILE_ICONS = {
  pdf:  { icon: 'file-pdf-box',  color: '#DC2626' },
  doc:  { icon: 'file-word-box', color: '#2563EB' },
  docx: { icon: 'file-word-box', color: '#2563EB' },
  xls:  { icon: 'file-excel-box', color: '#16A34A' },
  xlsx: { icon: 'file-excel-box', color: '#16A34A' },
};

function getExt(img) {
  return ((img.filename || img.url || '').split('.').pop() || '').toLowerCase();
}

function isImage(img)   { return IMAGE_EXTS.has(getExt(img)); }
function isAllowed(img) { return ALLOWED_EXTS.has(getExt(img)); }
function isAudio(img)   { return AUDIO_EXTS.has(getExt(img)); }

function fileIcon(img) {
  const ext = getExt(img);
  return FILE_ICONS[ext] ?? { icon: 'file-outline', color: '#6B7280' };
}

function formatBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ──────────────────────────────────────────────────

export default function CrmFileUploadModal({
  visible,
  onClose,
  onUploaded,
  inquiryId,
  inqCode,
  images = [],
  apiUpload,
}) {
  // Filter out audio, keep only allowed CRM types
  const eligible = useMemo(
    () => images.filter(img => !isAudio(img) && isAllowed(img)),
    [images],
  );

  const [selected, setSelected] = useState(() => new Set(eligible.map(i => i.id)));
  const [loading,  setLoading]  = useState(false);

  const toggleAll = useCallback(() => {
    setSelected(prev =>
      prev.size === eligible.length
        ? new Set()
        : new Set(eligible.map(i => i.id))
    );
  }, [eligible]);

  const toggleItem = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const fileIds = [...selected];
      const res     = await apiUpload(inquiryId, fileIds);
      const data    = res?.data ?? res;
      onUploaded(data?.uploaded ?? fileIds.length);
    } catch (err) {
      // re-throw so InquiryDetailScreen can show Alert
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selected, inquiryId, apiUpload, onUploaded]);

  const allSelected  = selected.size === eligible.length && eligible.length > 0;
  const noneSelected = selected.size === 0;

  const renderItem = ({ item }) => {
    const checked = selected.has(item.id);
    const img     = isImage(item);
    const { icon, color } = fileIcon(item);
    const thumbUri = img
      ? `${CONFIG.SOCKET_URL}/uploads/${item.url}`
      : null;

    return (
      <TouchableOpacity
        style={[styles.item, checked && styles.itemChecked]}
        onPress={() => toggleItem(item.id)}
        activeOpacity={0.75}
      >
        {/* Thumbnail / Icon */}
        <View style={styles.itemThumb}>
          {img && thumbUri ? (
            <Image source={{ uri: thumbUri }} style={styles.thumbImg} />
          ) : (
            <View style={[styles.thumbIcon, { backgroundColor: color + '18' }]}>
              <Icon name={icon} size={24} color={color} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.filename || item.url?.split('/').pop()}
          </Text>
          {item.size ? (
            <Text style={styles.itemSize}>{formatBytes(item.size)}</Text>
          ) : null}
          {!isAllowed(item) && (
            <Text style={styles.itemNotAllowed}>Not supported by CRM</Text>
          )}
        </View>

        {/* Checkbox */}
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Icon name="check" size={13} color={COLORS.white} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Icon name="cloud-upload-outline" size={18} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Upload to CRM</Text>
                <Text style={styles.headerSub}>{inqCode}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Select all toggle */}
          {eligible.length > 0 && (
            <TouchableOpacity style={styles.selectAllRow} onPress={toggleAll} activeOpacity={0.7}>
              <View style={[styles.checkbox, allSelected && styles.checkboxChecked]}>
                {allSelected && <Icon name="check" size={13} color={COLORS.white} />}
              </View>
              <Text style={styles.selectAllText}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </Text>
              <Text style={styles.selectCount}>
                {selected.size}/{eligible.length} selected
              </Text>
            </TouchableOpacity>
          )}

          {/* File list */}
          {eligible.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="file-remove-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No uploadable files</Text>
              <Text style={styles.emptyHint}>Only JPEG, PNG, WebP and PDF are supported</Text>
            </View>
          ) : (
            <FlatList
              data={eligible}
              keyExtractor={i => i.id}
              renderItem={renderItem}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.uploadBtn,
                (noneSelected || loading) && styles.uploadBtnDisabled,
              ]}
              onPress={handleUpload}
              disabled={noneSelected || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Icon name="cloud-upload-outline" size={16} color={COLORS.white} />
                  <Text style={styles.uploadText}>
                    Upload{selected.size > 0 ? ` (${selected.size})` : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius:  BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingBottom:   SPACING.xl,
    maxHeight:       '80%',
  },

  // Header
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  headerIcon: {
    width:           36,
    height:          36,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textPrimary,
    fontFamily: FONTS.bold,
  },
  headerSub: {
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.medium,
    color:      COLORS.primary,
    marginTop:  1,
  },

  // Select all
  selectAllRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  selectAllText: {
    flex:       1,
    ...TYPOGRAPHY.body,
    color:      COLORS.textPrimary,
    fontFamily: FONTS.medium,
  },
  selectCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },

  // List
  list:        { flexShrink: 1 },
  listContent: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },

  // Item
  item: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius:    BORDER_RADIUS.md,
    marginBottom:    SPACING.xs,
    borderWidth:     1,
    borderColor:     'transparent',
    backgroundColor: COLORS.background,
  },
  itemChecked: {
    borderColor:     COLORS.primaryMid,
    backgroundColor: COLORS.primaryLight,
  },
  itemThumb: {
    width:  52,
    height: 52,
    flexShrink: 0,
  },
  thumbImg: {
    width:        52,
    height:       52,
    borderRadius: BORDER_RADIUS.sm,
  },
  thumbIcon: {
    width:          52,
    height:         52,
    borderRadius:   BORDER_RADIUS.sm,
    alignItems:     'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: {
    ...TYPOGRAPHY.body,
    color:      COLORS.textPrimary,
    fontFamily: FONTS.medium,
  },
  itemSize: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textMuted,
    marginTop: 2,
  },
  itemNotAllowed: {
    fontSize:   FONT_SIZE.xs,
    color:      COLORS.error,
    marginTop:  2,
    fontFamily: FONTS.medium,
  },

  // Checkbox
  checkbox: {
    width:          22,
    height:         22,
    borderRadius:   6,
    borderWidth:    1.5,
    borderColor:    COLORS.border,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },

  // Empty state
  empty: {
    alignItems:    'center',
    paddingVertical: SPACING.xxl,
    gap:           SPACING.xs,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color:      COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  emptyHint: {
    ...TYPOGRAPHY.small,
    color:     COLORS.textMuted,
    textAlign: 'center',
  },

  // Footer
  footer: {
    flexDirection:   'row',
    gap:             SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop:      SPACING.sm,
    borderTopWidth:  1,
    borderTopColor:  COLORS.divider,
  },
  skipBtn: {
    flex:            1,
    paddingVertical: SPACING.sm,
    borderRadius:    BORDER_RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    alignItems:      'center',
  },
  skipText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  uploadBtn: {
    flex:            2,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    ...SHADOW.sm,
  },
  uploadBtnDisabled: {
    backgroundColor: COLORS.primaryMid,
    elevation:       0,
    shadowOpacity:   0,
  },
  uploadText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.white,
    fontFamily: FONTS.bold,
  },
});
