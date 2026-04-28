/**
 * ComplaintDetailScreen — Superuser only
 *
 * Full view of a single complaint / suggestion.
 * Superuser can add a review note and change status to "reviewed" or "resolved".
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS }    from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { getInitials } from '@utils/helpers';
import Loader from '@components/common/Loader';

import useComplaintStore from '@store/complaint.store';

// ── Config ────────────────────────────────────────────────────
const TYPE_CONFIG = {
  complaint:  { label: 'Complaint',  color: '#DC2626', icon: 'alert-circle-outline' },
  suggestion: { label: 'Suggestion', color: '#7C3AED', icon: 'lightbulb-outline'    },
};
const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: '#D97706', bg: '#FEF3C7' },
  reviewed: { label: 'Reviewed', color: '#2563EB', bg: '#EFF6FF' },
  resolved: { label: 'Resolved', color: '#059669', bg: '#ECFDF5' },
};

export default function ComplaintDetailScreen() {
  const navigation = useNavigation();
  const { selected, reviewComplaint } = useComplaintStore();

  const [reviewNote,  setReviewNote]  = useState(selected?.reviewNote ?? '');
  const [submitting,  setSubmitting]  = useState(false);

  if (!selected) return <Loader message="Loading…" />;

  const type   = TYPE_CONFIG[selected.type]     ?? TYPE_CONFIG.complaint;
  const status = STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.pending;
  const name   = selected.submittedBy?.name     ?? 'Unknown';

  const handleReview = (newStatus) => {
    const label = newStatus === 'resolved' ? 'Resolve' : 'Mark as Reviewed';
    Alert.alert(label, `${label} this submission?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          setSubmitting(true);
          try {
            await reviewComplaint(selected.id, {
              status:     newStatus,
              reviewNote: reviewNote.trim() || null,
            });
            Alert.alert('Done', 'Submission updated successfully.');
          } catch (e) {
            Alert.alert('Error', e.message || 'Failed to update.');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const isAlreadyResolved = selected.status === 'resolved';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Header card ── */}
          <View style={styles.headerCard}>
            {/* Submitter */}
            <View style={styles.submitterRow}>
              <View style={[styles.avatar, { backgroundColor: type.color + '18' }]}>
                <Text style={[styles.avatarText, { color: type.color }]}>{getInitials(name)}</Text>
              </View>
              <View style={styles.submitterInfo}>
                <Text style={styles.submitterName}>{name}</Text>
                {selected.submittedBy?.email ? (
                  <Text style={styles.submitterEmail}>{selected.submittedBy.email}</Text>
                ) : null}
                <Text style={styles.date}>{dayjs(selected.createdAt).format('DD MMM YYYY, hh:mm A')}</Text>
              </View>
            </View>

            {/* Type + Status badges */}
            <View style={styles.badgesRow}>
              <View style={[styles.typeBadge, { backgroundColor: type.color + '18' }]}>
                <Icon name={type.icon} size={12} color={type.color} />
                <Text style={[styles.typeBadgeText, { color: type.color }]}>{type.label}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>

            {/* Subject */}
            <Text style={styles.subject}>{selected.subject}</Text>

            {/* Message */}
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{selected.message}</Text>
            </View>
          </View>

          {/* ── Previous review note (if any) ── */}
          {selected.reviewedBy && (
            <View style={styles.prevReviewCard}>
              <View style={styles.prevReviewHeader}>
                <Icon name="shield-check-outline" size={14} color={COLORS.primary} />
                <Text style={styles.prevReviewTitle}>Previous Review</Text>
                <Text style={styles.prevReviewDate}>
                  {dayjs(selected.reviewedAt).format('DD MMM YYYY')}
                </Text>
              </View>
              <Text style={styles.prevReviewBy}>by {selected.reviewedBy.name}</Text>
              {selected.reviewNote ? (
                <Text style={styles.prevReviewNote}>{selected.reviewNote}</Text>
              ) : (
                <Text style={styles.prevReviewEmpty}>No note added.</Text>
              )}
            </View>
          )}

          {/* ── Review form (hidden when resolved) ── */}
          {!isAlreadyResolved && (
            <View style={styles.reviewCard}>
              <Text style={styles.reviewCardTitle}>Review this Submission</Text>

              <Text style={styles.fieldLabel}>Note (optional)</Text>
              <TextInput
                style={[styles.noteInput, submitting && styles.noteInputDisabled]}
                placeholder="Add a reply or internal note…"
                placeholderTextColor={COLORS.textMuted}
                value={reviewNote}
                onChangeText={setReviewNote}
                multiline
                textAlignVertical="top"
                maxLength={500}
                editable={!submitting}
              />
              <Text style={styles.charCount}>{reviewNote.length}/500</Text>

              {/* Action buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.reviewedBtn, submitting && styles.actionBtnDisabled]}
                  onPress={() => handleReview('reviewed')}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting
                    ? <ActivityIndicator color={COLORS.white} size="small" />
                    : <>
                        <Icon name="eye-check-outline" size={16} color={COLORS.white} />
                        <Text style={styles.actionBtnText}>Mark Reviewed</Text>
                      </>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.resolvedBtn, submitting && styles.actionBtnDisabled]}
                  onPress={() => handleReview('resolved')}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting
                    ? <ActivityIndicator color={COLORS.white} size="small" />
                    : <>
                        <Icon name="check-circle-outline" size={16} color={COLORS.white} />
                        <Text style={styles.actionBtnText}>Resolve</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Already resolved notice ── */}
          {isAlreadyResolved && (
            <View style={styles.resolvedNotice}>
              <Icon name="check-circle-outline" size={20} color="#059669" />
              <Text style={styles.resolvedNoticeText}>This submission has been resolved.</Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  submitterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText:    { fontSize: 16, fontWeight: '800' },
  submitterInfo: { flex: 1 },
  submitterName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '700' },
  submitterEmail:{ ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 2 },
  date:          { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  badgesRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  typeBadgeText:   { fontSize: 11, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  subject: {
    ...TYPOGRAPHY.h4,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  messageBox: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  messageText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },

  // Previous review
  prevReviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    ...SHADOW.sm,
  },
  prevReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  prevReviewTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.primary, fontWeight: '700', flex: 1 },
  prevReviewDate:  { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  prevReviewBy:    { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  prevReviewNote:  { ...TYPOGRAPHY.body, color: COLORS.textPrimary, lineHeight: 20 },
  prevReviewEmpty: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontStyle: 'italic' },

  // Review form
  reviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  reviewCardTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  noteInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    height: 100,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  noteInputDisabled: { opacity: 0.6 },
  charCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: SPACING.md,
  },

  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.white, fontWeight: '700' },
  reviewedBtn:   { backgroundColor: '#2563EB' },
  resolvedBtn:   { backgroundColor: '#059669' },

  // Resolved notice
  resolvedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ECFDF5',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  resolvedNoticeText: { ...TYPOGRAPHY.bodyMedium, color: '#059669', fontWeight: '600' },
});
