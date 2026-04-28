/**
 * CreateInquiryScreen — Admin & Superuser
 *
 * Fields: images, description, mobile, time, priority, source, distribute
 * Flow:   create → uploadImages (if any) → distribute (if salesperson selected)
 */
import React, { useState, useEffect, useMemo } from 'react';
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
import { SafeAreaView }    from 'react-native-safe-area-context';
import Icon                from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { Menu, Modal, Portal } from 'react-native-paper';
import Toast               from 'react-native-toast-message';

import { COLORS, PRIORITY_COLORS }                from '@constants/colors';
import { TYPOGRAPHY }                             from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW, PRIORITY_LABELS } from '@constants/config';
import { getInitials }                            from '@utils/helpers';

import dayjs from 'dayjs';

import { inquiryApi }   from '@api/inquiry.api';
import { reportApi }    from '@api/report.api';
import useUserStore     from '@store/user.store';
import useInquiryStore  from '@store/inquiry.store';

// ─── Constants ────────────────────────────────────────────────
const PRIORITIES = [
  { label: 'High',   value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low',    value: 'low' },
];

const SOURCE_OPTIONS = [
  { label: 'Walk-in',      icon: 'walk',                        color: '#059669' },
  { label: 'Phone Call',   icon: 'phone-outline',               color: '#2563EB' },
  { label: 'WhatsApp',     icon: 'whatsapp',                    color: '#25D366' },
  { label: 'Website',      icon: 'web',                         color: '#7C3AED' },
  { label: 'Email',        icon: 'email-outline',               color: '#EA580C' },
  { label: 'Referral',     icon: 'account-group-outline',       color: '#D97706' },
  { label: 'Social Media', icon: 'instagram',                   color: '#DB2777' },
  { label: 'Other',        icon: 'dots-horizontal-circle-outline', color: '#6B7280' },
];

const MAX_IMAGES   = 8;
const MAX_FILE_MB  = 5;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const AVATAR_COLORS = [
  '#7C3AED', '#059669', '#EA580C', '#2563EB',
  '#D97706', '#DB2777', '#0891B2', '#65A30D',
  '#9333EA', '#DC2626',
];

// ─── Helpers ──────────────────────────────────────────────────
function avatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Screen ───────────────────────────────────────────────────
export default function CreateInquiryScreen({ navigation }) {
  const { salespersons, isLoadingSalespersons, fetchSalespersons } = useUserStore();
  const { refreshInquiries, fetchUnassigned, bumpSummaryRefresh } = useInquiryStore();

  // Form fields
  const [description, setDescription] = useState('');
  const [mobile,      setMobile]      = useState('');
  const [inquiryTime, setInquiryTime] = useState(currentTime);  // auto-fill current time
  const [priority,    setPriority]    = useState('medium');
  const [source,      setSource]      = useState('');
  const [images,      setImages]      = useState([]);
  const [selectedSp,  setSelectedSp]  = useState(null);
  const [spSearch,    setSpSearch]    = useState('');

  // UI state
  const [priorityMenuOpen,  setPriorityMenuOpen]  = useState(false);
  const [timePickerOpen,    setTimePickerOpen]    = useState(false);
  const [sourcePickerOpen,  setSourcePickerOpen]  = useState(false);
  const [sourceSearch,      setSourceSearch]      = useState('');
  const [isSubmitting,      setIsSubmitting]      = useState(false);

  // Salesperson current-month stats
  const [spStats,        setSpStats]        = useState(null);
  const [spStatsLoading, setSpStatsLoading] = useState(false);

  useEffect(() => {
    fetchSalespersons();
  }, []);

  // Fetch current-month stats whenever a salesperson is selected / deselected
  useEffect(() => {
    if (!selectedSp) {
      setSpStats(null);
      return;
    }
    let cancelled = false;
    const fetchStats = async () => {
      setSpStatsLoading(true);
      try {
        const now  = dayjs();
        const from = now.startOf('month').format('YYYY-MM-DD');
        const to   = now.format('YYYY-MM-DD');
        const res  = await reportApi.getSalesperson(selectedSp.id, { from, to });
        if (!cancelled) setSpStats(res.data ?? res);
      } catch (_) {
        if (!cancelled) setSpStats(null);
      } finally {
        if (!cancelled) setSpStatsLoading(false);
      }
    };
    fetchStats();
    return () => { cancelled = true; };
  }, [selectedSp]);

  // ─── Image picker ────────────────────────────────────────────
  const handlePickImages = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit Reached', `You can upload up to ${MAX_IMAGES} images.`);
      return;
    }
    const result = await launchImageLibrary({
      mediaType:      'photo',
      quality:        0.85,
      selectionLimit: MAX_IMAGES - images.length,
    });
    if (!result.assets) return;

    const valid    = result.assets.filter((a) => (a.fileSize ?? 0) <= MAX_FILE_BYTES);
    const skipped  = result.assets.length - valid.length;
    if (skipped > 0) {
      Alert.alert('File Too Large', `${skipped} image(s) exceed ${MAX_FILE_MB} MB and were skipped.`);
    }
    setImages((prev) => [...prev, ...valid].slice(0, MAX_IMAGES));
  };

  const removeImage = (index) =>
    setImages((prev) => prev.filter((_, i) => i !== index));

  // ─── Time picker (custom modal) ───────────────────────────────
  const [tempHour, setTempHour]     = useState('');
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

  // ─── Source picker ───────────────────────────────────────────
  const openSourcePicker = () => {
    setSourceSearch('');
    setSourcePickerOpen(true);
  };

  const selectSource = (value) => {
    setSource(typeof value === 'string' ? value : value.label);
    setSourcePickerOpen(false);
    setSourceSearch('');
  };

  // Filtered preset options; if typed text is non-empty and not an exact match → show "Use …" row
  const filteredSources = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    if (!q) return SOURCE_OPTIONS;
    return SOURCE_OPTIONS.filter((s) => s.label.toLowerCase().includes(q));
  }, [sourceSearch]);

  const showCustomRow =
    sourceSearch.trim().length > 0 &&
    !SOURCE_OPTIONS.some(
      (s) => s.label.toLowerCase() === sourceSearch.trim().toLowerCase(),
    );

  // Find config for the currently selected source (for trigger chip)
  const selectedSourceConfig = SOURCE_OPTIONS.find((s) => s.label === source) ?? null;

  // ─── Filtered salespersons ───────────────────────────────────
  const filteredSp = salespersons.filter(
    (sp) =>
      !spSearch ||
      sp.name?.toLowerCase().includes(spSearch.toLowerCase()) ||
      sp.employeeId?.toLowerCase().includes(spSearch.toLowerCase()),
  );

  // ─── Reset form ──────────────────────────────────────────────
  const resetForm = () => {
    setDescription('');
    setMobile('');
    setInquiryTime(currentTime());
    setPriority('medium');
    setSource('');
    setImages([]);
    setSelectedSp(null);
    setSpSearch('');
    setSpStats(null);
  };

  // ─── Submit ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!description.trim() && !mobile.trim()) {
      Alert.alert('Required', 'Please enter a description or mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Determine type
      const hasText   = description.trim().length > 0;
      const hasImages = images.length > 0;
      const type = hasImages && hasText ? 'text_image' : hasImages ? 'image' : 'text';

      // 2. Create inquiry
      const res     = await inquiryApi.create({
        description:  description.trim() || undefined,
        mobile:       mobile.trim()       || undefined,
        inquiryTime:  inquiryTime         || undefined,
        priority,
        source:       source.trim()       || undefined,
        type,
      });
      const inquiry   = res.data ?? res;
      const inquiryId = inquiry.id;

      // 3. Upload images
      if (hasImages) {
        await inquiryApi.uploadImages(inquiryId, images);
      }

      // 4. Distribute to salesperson
      if (selectedSp) {
        await inquiryApi.distribute(inquiryId, { salesPersonId: selectedSp.id });
      }

      // 5. Reset form, refresh list & go back
      resetForm();
      refreshInquiries();     // updates InquiryList store
      fetchUnassigned();      // updates Dashboard "Needs Assignment" store
      bumpSummaryRefresh();   // signals Dashboard to re-fetch KPI count cards
      Toast.show({
        type:  'success',
        text1: 'Inquiry Created',
        text2: selectedSp
          ? `Distributed to ${selectedSp.name}`
          : 'Added as unassigned',
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to create inquiry. Please try again.');
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

          {/* ── Upload Images ────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>UPLOAD INQUIRY</Text>
            {images.length === 0 ? (
              <TouchableOpacity
                style={styles.uploadEmpty}
                onPress={handlePickImages}
                activeOpacity={0.7}
              >
                <View style={styles.uploadIconBox}>
                  <Icon name="cloud-upload-outline" size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.uploadText}>Tap to browse photos</Text>
                <Text style={styles.uploadHint}>
                  .jpg, .jpeg, .png · Max {MAX_FILE_MB} MB · Up to {MAX_IMAGES} files
                </Text>
              </TouchableOpacity>
            ) : (
              <View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbRow}
                >
                  {images.map((img, i) => (
                    <View key={i} style={styles.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        onPress={() => removeImage(i)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Icon name="close-circle" size={20} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {images.length < MAX_IMAGES && (
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
                  {images.length}/{MAX_IMAGES} images selected
                </Text>
              </View>
            )}
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
              <TouchableOpacity
                style={[styles.input, styles.dropdownInput, source && styles.sourceInputSelected]}
                onPress={openSourcePicker}
                activeOpacity={0.7}
              >
                {selectedSourceConfig ? (
                  <>
                    <View style={[styles.sourceChipIcon, { backgroundColor: selectedSourceConfig.color + '20' }]}>
                      <Icon name={selectedSourceConfig.icon} size={13} color={selectedSourceConfig.color} />
                    </View>
                    <Text style={[styles.dropdownText, { color: selectedSourceConfig.color, fontWeight: '700' }]} numberOfLines={1}>
                      {source}
                    </Text>
                  </>
                ) : source ? (
                  <>
                    <View style={[styles.sourceChipIcon, { backgroundColor: COLORS.border }]}>
                      <Icon name="pencil-outline" size={13} color={COLORS.textSecondary} />
                    </View>
                    <Text style={styles.dropdownText} numberOfLines={1}>{source}</Text>
                  </>
                ) : (
                  <Text style={[styles.dropdownText, styles.placeholderText]} numberOfLines={1}>
                    Select source…
                  </Text>
                )}
                {source ? (
                  <TouchableOpacity
                    onPress={() => setSource('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : (
                  <Icon name="chevron-down" size={18} color={COLORS.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Distribute Inquiry ───────────────────────── */}
          <View style={styles.card}>
            <View style={styles.distributeHeader}>
              <Text style={styles.distributeTitle}>Distribute Inquiry</Text>
              <View style={styles.spSearchWrap}>
                <Icon name="magnify" size={15} color={COLORS.textMuted} />
                <TextInput
                  style={styles.spSearchInput}
                  placeholder="Search sales person..."
                  placeholderTextColor={COLORS.textMuted}
                  value={spSearch}
                  onChangeText={setSpSearch}
                />
                {spSearch ? (
                  <TouchableOpacity onPress={() => setSpSearch('')}>
                    <Icon name="close-circle" size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {isLoadingSalespersons ? (
              <ActivityIndicator color={COLORS.primary} style={styles.spLoader} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.avatarRow}
              >
                {filteredSp.map((sp, index) => {
                  const isSelected = selectedSp?.id === sp.id;
                  const color      = avatarColor(index);
                  return (
                    <TouchableOpacity
                      key={sp.id}
                      style={styles.avatarItem}
                      onPress={() => setSelectedSp(isSelected ? null : sp)}
                      activeOpacity={0.78}
                    >
                      <View
                        style={[
                          styles.avatar,
                          {
                            backgroundColor: isSelected ? color : `${color}22`,
                            borderColor:     isSelected ? color  : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && (
                          <View style={styles.avatarCheck}>
                            <Icon name="check" size={9} color={COLORS.white} />
                          </View>
                        )}
                        <Text style={[styles.avatarInitials, { color: isSelected ? COLORS.white : color }]}>
                          {getInitials(sp.name)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.avatarName,
                          isSelected && { color: COLORS.primary, fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {sp.name?.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {filteredSp.length === 0 && (
                  <Text style={styles.noSpText}>No salespersons found</Text>
                )}
              </ScrollView>
            )}

            {selectedSp && (
              <View style={styles.selectedBanner}>
                <Icon name="account-check-outline" size={14} color={COLORS.primary} />
                <Text style={styles.selectedBannerText}>
                  Will be distributed to{' '}
                  <Text style={{ fontWeight: '700' }}>{selectedSp.name}</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedSp(null)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Icon name="close" size={14} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* ── Salesperson current-month stats ─────── */}
            {selectedSp && (
              <View style={styles.spStatsCard}>
                <View style={styles.spStatsHeader}>
                  <Icon name="chart-bar" size={13} color={COLORS.textMuted} />
                  <Text style={styles.spStatsTitle}>
                    {dayjs().format('MMMM')} Performance
                  </Text>
                </View>

                {spStatsLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.primary}
                    style={styles.spStatsLoader}
                  />
                ) : spStats ? (
                  <View style={styles.spStatsTiles}>
                    <View style={styles.spStatsTile}>
                      <Text style={styles.spStatsTileValue}>{spStats.total ?? spStats.totalInquiries ?? 0}</Text>
                      <Text style={styles.spStatsTileLabel}>Assigned</Text>
                    </View>
                    <View style={styles.spStatsDivider} />
                    <View style={styles.spStatsTile}>
                      <Text style={styles.spStatsTileValue}>{spStats.inProgress ?? 0}</Text>
                      <Text style={styles.spStatsTileLabel}>In Progress</Text>
                    </View>
                    <View style={styles.spStatsDivider} />
                    <View style={styles.spStatsTile}>
                      <Text style={styles.spStatsTileValue}>{spStats.closed ?? 0}</Text>
                      <Text style={styles.spStatsTileLabel}>Closed</Text>
                    </View>
                    <View style={styles.spStatsDivider} />
                    <View style={styles.spStatsTile}>
                      <Text style={[styles.spStatsTileValue, styles.spStatsTileRate]}>
                        {spStats.conversionRate != null
                          ? `${Math.round(parseFloat(spStats.conversionRate))}%`
                          : '—'}
                      </Text>
                      <Text style={styles.spStatsTileLabel}>Conv. Rate</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.spStatsEmpty}>No data available</Text>
                )}
              </View>
            )}
          </View>

        </ScrollView>

        {/* ── Share Inquiry Button ─────────────────────── */}
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
                <Icon name="share-variant-outline" size={18} color={COLORS.white} />
                <Text style={styles.submitBtnText}>Share Inquiry</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Source Picker Modal ──────────────────────── */}
      <Portal>
        <Modal
          visible={sourcePickerOpen}
          onDismiss={() => setSourcePickerOpen(false)}
          contentContainerStyle={styles.sourceModal}
        >
          {/* ── Header ── */}
          <View style={styles.sourceModalHeader}>
            <View style={styles.sourceModalTitleWrap}>
              <View style={styles.sourceModalIconBox}>
                <Icon name="map-marker-outline" size={16} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.sourceModalTitle}>Inquiry Source</Text>
                <Text style={styles.sourceModalSubtitle}>Where did this inquiry come from?</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.sourceModalClose}
              onPress={() => setSourcePickerOpen(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ── Search ── */}
          <View style={styles.sourceSearchWrap}>
            <Icon name="magnify" size={17} color={COLORS.textMuted} />
            <TextInput
              style={styles.sourceSearchInput}
              placeholder="Search or type a custom source…"
              placeholderTextColor={COLORS.textMuted}
              value={sourceSearch}
              onChangeText={setSourceSearch}
              autoFocus
              autoCapitalize="words"
            />
            {sourceSearch.length > 0 && (
              <TouchableOpacity onPress={() => setSourceSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Icon name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Custom "Use …" row ── */}
          {showCustomRow && (
            <TouchableOpacity
              style={styles.sourceOptionCustom}
              onPress={() => selectSource(sourceSearch.trim())}
              activeOpacity={0.75}
            >
              <View style={styles.sourceCustomIconBox}>
                <Icon name="pencil-outline" size={16} color={COLORS.primary} />
              </View>
              <View style={styles.sourceOptionBody}>
                <Text style={styles.sourceOptionCustomLabel}>Use as custom source</Text>
                <Text style={styles.sourceOptionCustomValue} numberOfLines={1}>
                  "{sourceSearch.trim()}"
                </Text>
              </View>
              <View style={styles.sourceCustomArrow}>
                <Icon name="arrow-right" size={14} color={COLORS.white} />
              </View>
            </TouchableOpacity>
          )}

          {/* ── Scrollable list ── */}
          <ScrollView
            style={styles.sourceList}
            contentContainerStyle={styles.sourceListContent}
            showsVerticalScrollIndicator={true}
            indicatorStyle="black"
            persistentScrollbar={true}
            keyboardShouldPersistTaps="handled"
          >
            {filteredSources.map((opt, index) => {
              const isActive = source === opt.label;
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[
                    styles.sourceListItem,
                    isActive && { backgroundColor: opt.color + '10', borderColor: opt.color },
                    index === filteredSources.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => selectSource(opt)}
                  activeOpacity={0.7}
                >
                  {/* Icon bubble */}
                  <View style={[
                    styles.sourceListIconBubble,
                    { backgroundColor: isActive ? opt.color : opt.color + '18' },
                  ]}>
                    <Icon name={opt.icon} size={20} color={isActive ? COLORS.white : opt.color} />
                  </View>

                  {/* Label */}
                  <Text style={[
                    styles.sourceListLabel,
                    isActive && { color: opt.color, fontWeight: '700' },
                  ]}>
                    {opt.label}
                  </Text>

                  {/* Selected check */}
                  {isActive ? (
                    <View style={[styles.sourceListCheck, { backgroundColor: opt.color }]}>
                      <Icon name="check" size={11} color={COLORS.white} />
                    </View>
                  ) : (
                    <Icon name="chevron-right" size={18} color={COLORS.border} />
                  )}
                </TouchableOpacity>
              );
            })}

            {filteredSources.length === 0 && !showCustomRow && (
              <View style={styles.sourceEmpty}>
                <Icon name="magnify-remove-outline" size={32} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
                <Text style={styles.sourceEmptyText}>No match found</Text>
                <Text style={styles.sourceEmptyHint}>Type above to use a custom source</Text>
              </View>
            )}
          </ScrollView>
        </Modal>
      </Portal>

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
  safe:  { flex: 1, backgroundColor: COLORS.background },
  flex:  { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },

  // Card (each section)
  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    ...SHADOW.sm,
  },
  sectionLabel: {
    ...TYPOGRAPHY.captionMedium,
    color:          COLORS.textMuted,
    fontWeight:     '700',
    letterSpacing:  0.6,
    marginBottom:   SPACING.sm,
  },
  fieldLabel: {
    ...TYPOGRAPHY.captionMedium,
    color:         COLORS.textMuted,
    fontWeight:    '700',
    letterSpacing: 0.5,
    marginBottom:  SPACING.xs,
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
  thumbRow: { paddingVertical: SPACING.xs },
  thumbWrap: {
    position:    'relative',
    marginRight: SPACING.sm,
  },
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
    borderWidth:   1,
    borderColor:   COLORS.border,
    borderRadius:  BORDER_RADIUS.md,
    padding:       SPACING.sm,
    ...TYPOGRAPHY.body,
    color:         COLORS.textPrimary,
    minHeight:     100,
  },

  // Row layout (mobile+time, priority+source)
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           0,
  },
  halfField: { flex: 1 },
  fieldDivider: { width: SPACING.sm },

  // Generic input
  input: {
    borderWidth:     1,
    borderColor:     COLORS.border,
    borderRadius:    BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    height:          44,
    ...TYPOGRAPHY.body,
    color:           COLORS.textPrimary,
    justifyContent:  'center',
  },

  // Time
  timeInput: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  timeText:       { ...TYPOGRAPHY.body, color: COLORS.textPrimary },
  placeholderText: { color: COLORS.textMuted },

  // Priority dropdown
  dropdownInput: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACING.xs,
  },
  dropdownText: {
    ...TYPOGRAPHY.body,
    color:  COLORS.textPrimary,
    flex:   1,
  },
  priorityDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  menuContent: {
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.md,
  },

  // Distribute section
  distributeHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   SPACING.md,
    gap:            SPACING.sm,
  },
  distributeTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textPrimary,
    fontWeight: '700',
  },
  spSearchWrap: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.xs,
    backgroundColor: COLORS.background,
    borderRadius:    BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical:  6,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  spSearchInput: {
    flex:   1,
    height: 24,
    ...TYPOGRAPHY.small,
    color:  COLORS.textPrimary,
    padding: 0,
  },
  spLoader:   { marginVertical: SPACING.lg },
  avatarRow:  { paddingVertical: SPACING.xs, gap: SPACING.md },
  avatarItem: { alignItems: 'center', width: 56 },
  avatar: {
    width:        48,
    height:       48,
    borderRadius: 24,
    alignItems:   'center',
    justifyContent: 'center',
    borderWidth:  2,
    marginBottom: 4,
    position:     'relative',
  },
  avatarInitials: {
    ...TYPOGRAPHY.smallBold,
    fontWeight: '700',
  },
  avatarCheck: {
    position:        'absolute',
    top:             0,
    right:           0,
    width:           16,
    height:          16,
    borderRadius:    8,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     COLORS.white,
  },
  avatarName: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textSecondary,
    textAlign: 'center',
    maxWidth:  52,
  },
  noSpText: {
    ...TYPOGRAPHY.small,
    color:         COLORS.textMuted,
    marginVertical: SPACING.md,
  },
  selectedBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.xs,
    backgroundColor: COLORS.primaryLight,
    borderRadius:    BORDER_RADIUS.md,
    padding:         SPACING.sm,
    marginTop:       SPACING.sm,
    borderWidth:     1,
    borderColor:     COLORS.primaryMid,
  },
  selectedBannerText: {
    flex:       1,
    ...TYPOGRAPHY.small,
    color:      COLORS.primary,
  },

  // Salesperson stats card
  spStatsCard: {
    marginTop:        SPACING.sm,
    borderRadius:     BORDER_RADIUS.md,
    borderWidth:      1,
    borderColor:      COLORS.divider,
    backgroundColor:  COLORS.background,
    overflow:         'hidden',
  },
  spStatsHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   SPACING.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor:   COLORS.surface,
  },
  spStatsTitle: {
    ...TYPOGRAPHY.caption,
    color:       COLORS.textMuted,
    fontWeight:  '600',
    letterSpacing: 0.3,
  },
  spStatsLoader: {
    paddingVertical: SPACING.md,
  },
  spStatsTiles: {
    flexDirection:  'row',
    alignItems:     'stretch',
  },
  spStatsTile: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: 2,
  },
  spStatsDivider: {
    width:           1,
    backgroundColor: COLORS.divider,
    marginVertical:  SPACING.sm,
  },
  spStatsTileValue: {
    ...TYPOGRAPHY.h4,
    color:      COLORS.textPrimary,
    fontWeight: '700',
  },
  spStatsTileRate: {
    color: COLORS.primary,
  },
  spStatsTileLabel: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  spStatsEmpty: {
    ...TYPOGRAPHY.small,
    color:          COLORS.textMuted,
    textAlign:      'center',
    paddingVertical: SPACING.md,
  },

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
  submitBtnDisabled: {
    backgroundColor: COLORS.primaryMid,
    elevation:       0,
    shadowOpacity:   0,
  },
  submitBtnText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.white,
    fontWeight: '700',
  },

  // ── Source trigger chip ───────────────────────────────────────
  sourceInputSelected: {
    borderColor: COLORS.primaryMid,
  },
  sourceChipIcon: {
    width:          22,
    height:         22,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },

  // ── Source picker modal ───────────────────────────────────────
  sourceModal: {
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.xl,
    marginHorizontal: SPACING.md,
    paddingBottom:    SPACING.lg,
    overflow:         'hidden',
    maxHeight:        '78%',
  },
  sourceModalHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop:        SPACING.md,
    paddingBottom:     SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  sourceModalTitleWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  sourceModalIconBox: {
    width:           36,
    height:          36,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sourceModalTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.textPrimary,
    fontWeight: '700',
  },
  sourceModalSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  sourceModalClose: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: COLORS.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sourceSearchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.xs,
    margin:            SPACING.md,
    marginBottom:      SPACING.sm,
    paddingHorizontal: SPACING.sm,
    height:            44,
    borderRadius:      BORDER_RADIUS.md,
    backgroundColor:   COLORS.background,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  sourceSearchInput: {
    flex:    1,
    height:  44,
    ...TYPOGRAPHY.body,
    color:   COLORS.textPrimary,
    padding: 0,
  },

  // Custom "Use …" row
  sourceOptionCustom: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
    padding:          SPACING.sm,
    borderRadius:     BORDER_RADIUS.lg,
    backgroundColor:  COLORS.primaryLight,
    borderWidth:      1.5,
    borderColor:      COLORS.primaryMid,
    borderStyle:      'dashed',
  },
  sourceCustomIconBox: {
    width:           38,
    height:          38,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     COLORS.primaryMid,
  },
  sourceOptionBody:        { flex: 1 },
  sourceOptionCustomLabel: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '700', letterSpacing: 0.3 },
  sourceOptionCustomValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600', marginTop: 1 },
  sourceCustomArrow: {
    width:           26,
    height:          26,
    borderRadius:    13,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Scrollable list
  sourceList: {
    maxHeight: 320,
  },
  sourceListContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom:     SPACING.sm,
  },
  sourceListItem: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.sm,
    paddingVertical: 13,
    paddingHorizontal: SPACING.sm,
    borderRadius:    BORDER_RADIUS.md,
    borderWidth:     1,
    borderColor:     'transparent',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    marginBottom:    2,
  },
  sourceListIconBubble: {
    width:          42,
    height:         42,
    borderRadius:   BORDER_RADIUS.md,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  sourceListLabel: {
    ...TYPOGRAPHY.body,
    color:      COLORS.textPrimary,
    fontWeight: '500',
    flex:       1,
  },
  sourceListCheck: {
    width:          22,
    height:         22,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },

  sourceEmpty: {
    paddingVertical:   SPACING.xl,
    alignItems:        'center',
    paddingHorizontal: SPACING.lg,
  },
  sourceEmptyText: {
    ...TYPOGRAPHY.body,
    color:      COLORS.textSecondary,
    fontWeight: '600',
  },
  sourceEmptyHint: {
    ...TYPOGRAPHY.small,
    color:     COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },

  // Time picker modal
  timeModal: {
    backgroundColor:   COLORS.surface,
    borderRadius:      BORDER_RADIUS.xl,
    marginHorizontal:  SPACING.xl,
    padding:           SPACING.lg,
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
  timeModalActions: {
    flexDirection: 'row',
    gap:           SPACING.sm,
  },
  timeModalCancel: {
    flex:              1,
    paddingVertical:   SPACING.sm,
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1,
    borderColor:       COLORS.border,
    alignItems:        'center',
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
