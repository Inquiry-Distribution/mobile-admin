/**
 * CompanyReportScreen — Admin & Superuser
 *
 * Shows inquiry performance aggregated by company.
 *
 * Layout:
 *   • Date preset chips  (7d / 30d / This Month / All time)
 *   • Summary strip      (Total companies · Grand total · Closed · Overall rate)
 *   • FlatList of company cards — one per company + a "No Company" card at bottom
 *   • Tap a card → CompanyDrillDown screen (salesperson breakdown for that company)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { reportApi } from '@api/report.api';
import EmptyState from '@components/common/EmptyState';

// ── Date presets ──────────────────────────────────────────────
const PRESETS = [
  { label: '7d',    days: 7 },
  { label: '30d',   days: 30 },
  { label: 'Month', month: true },
  { label: 'All',   days: null },
];

function getRange(preset) {
  if (!preset.days && !preset.month) return {};
  const to = dayjs().format('YYYY-MM-DD');
  if (preset.month) return { from: dayjs().startOf('month').format('YYYY-MM-DD'), to };
  return { from: dayjs().subtract(preset.days, 'day').format('YYYY-MM-DD'), to };
}

// Company avatar colours — cycle through these per index
const COMPANY_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// ── Screen ────────────────────────────────────────────────────
export default function CompanyReportScreen({ navigation }) {
  const [presetIdx,    setPresetIdx]    = useState(1); // default 30d
  const [data,         setData]         = useState(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState(null);

  const load = useCallback(async (idx, refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else            setIsLoading(true);
    setError(null);
    try {
      const range = getRange(PRESETS[idx]);
      const res   = await reportApi.getCompanyReport(range);
      setData(res.data ?? res);
    } catch (e) {
      setError(e.message ?? 'Failed to load report');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { load(presetIdx); }, [presetIdx]);

  const companies  = data?.companies  ?? [];
  const noCompany  = data?.noCompany  ?? null;
  const summary    = data?.summary    ?? null;
  const range      = getRange(PRESETS[presetIdx]);

  // Build FlatList data: company cards + noCompany card at the end
  const listData = [
    ...companies.map((c, i) => ({ type: 'company', data: c, colorIdx: i })),
    ...(noCompany && noCompany.total > 0
      ? [{ type: 'noCompany', data: noCompany }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Preset chips ─────────────────────────────────────── */}
      <View style={styles.presetBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScroll}
        >
          {PRESETS.map((p, i) => (
            <TouchableOpacity
              key={p.label}
              style={[styles.preset, presetIdx === i && styles.presetActive]}
              onPress={() => setPresetIdx(i)}
            >
              <Text style={[styles.presetText, presetIdx === i && styles.presetTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Content ──────────────────────────────────────────── */}
      {isLoading && !data ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading company report…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorCenter}>
          <Icon name="alert-circle-outline" size={44} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(presetIdx)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, idx) =>
            item.type === 'company' ? item.data.company.id : 'no-company'
          }
          renderItem={({ item }) =>
            item.type === 'company' ? (
              <CompanyCard
                stat={item.data}
                color={COMPANY_COLORS[item.colorIdx % COMPANY_COLORS.length]}
                onPress={() =>
                  navigation.navigate('CompanyDrillDown', {
                    companyId:   item.data.company.id,
                    companyName: item.data.company.name,
                    from:        range.from,
                    to:          range.to,
                  })
                }
              />
            ) : (
              <NoCompanyCard stat={item.data} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => load(presetIdx, true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={
            summary ? (
              <SummaryStrip summary={summary} />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="domain"
              title="No company data"
              message="No inquiries found for any company in this period."
            />
          }
          contentContainerStyle={
            listData.length === 0 ? styles.emptyContent : styles.listContent
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ── Summary strip ─────────────────────────────────────────────
function SummaryStrip({ summary }) {
  const overallRateNum = parseFloat(summary.overallRate) || 0;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryCells}>
        <SummaryCell
          icon="domain"
          label="Companies"
          value={summary.totalCompanies}
          color={COLORS.primary}
        />
        <View style={styles.cellDivider} />
        <SummaryCell
          icon="clipboard-list-outline"
          label="Total"
          value={summary.grandTotal}
          color={COLORS.textSecondary}
        />
        <View style={styles.cellDivider} />
        <SummaryCell
          icon="check-circle-outline"
          label="Closed"
          value={summary.grandClosed}
          color={COLORS.success}
        />
        <View style={styles.cellDivider} />
        <SummaryCell
          icon="trending-up"
          label="Conv. Rate"
          value={summary.overallRate}
          color="#8B5CF6"
        />
      </View>
      {/* Overall conversion bar */}
      <View style={styles.summaryBarWrap}>
        <View style={styles.summaryBarTrack}>
          <View
            style={[
              styles.summaryBarFill,
              { width: `${Math.min(100, overallRateNum)}%` },
            ]}
          />
        </View>
        <Text style={styles.summaryBarLabel}>Overall Conversion</Text>
      </View>
    </View>
  );
}

function SummaryCell({ icon, label, value, color }) {
  return (
    <View style={styles.summaryCell}>
      <Icon name={icon} size={14} color={color} style={{ marginBottom: 2 }} />
      <Text style={[styles.summaryCellValue, { color }]}>{value}</Text>
      <Text style={styles.summaryCellLabel}>{label}</Text>
    </View>
  );
}

// ── Company card ──────────────────────────────────────────────
function CompanyCard({ stat, color, onPress }) {
  const { company, salespersonCount, total, closed, inProgress, followUp, converted, conversionRate } = stat;
  const rateNum  = parseFloat(conversionRate) || 0;
  const assigned = Math.max(0, total - closed - inProgress - followUp);

  return (
    <TouchableOpacity style={styles.companyCard} onPress={onPress} activeOpacity={0.75}>
      {/* Left colour strip */}
      <View style={[styles.cardStrip, { backgroundColor: color }]} />

      <View style={styles.cardBody}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={[styles.companyIconBox, { backgroundColor: color + '18' }]}>
            <Icon name="domain" size={18} color={color} />
          </View>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardTitle} numberOfLines={1}>{company.name}</Text>
            <View style={styles.cardMeta}>
              <Icon name="account-group-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.cardMetaText}>
                {salespersonCount} salesperson{salespersonCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size={18} color={COLORS.border} />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill label="Total"       value={total}      color={COLORS.textSecondary} />
          <StatPill label="In Progress" value={inProgress} color={COLORS.warning} />
          <StatPill label="Closed"      value={closed}     color={COLORS.success} />
          <StatPill label="Converted"   value={converted}  color={color} />
        </View>

        {/* Conversion bar */}
        <View style={styles.rateRow}>
          <View style={styles.rateBarTrack}>
            <View
              style={[
                styles.rateBarFill,
                { width: `${Math.min(100, rateNum)}%`, backgroundColor: color },
              ]}
            />
          </View>
          <Text style={[styles.rateLabel, { color }]}>{conversionRate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── No-Company card ───────────────────────────────────────────
function NoCompanyCard({ stat }) {
  const { total, closed, inProgress, followUp, converted, conversionRate } = stat;
  const rateNum = parseFloat(conversionRate) || 0;

  return (
    <View style={[styles.companyCard, styles.noCompanyCard]}>
      <View style={[styles.cardStrip, { backgroundColor: COLORS.textMuted }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={[styles.companyIconBox, { backgroundColor: COLORS.border }]}>
            <Icon name="account-off-outline" size={18} color={COLORS.textMuted} />
          </View>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardTitle} numberOfLines={1}>No Company</Text>
            <Text style={styles.cardMetaText}>Salespersons without a company</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatPill label="Total"       value={total}      color={COLORS.textSecondary} />
          <StatPill label="In Progress" value={inProgress} color={COLORS.warning} />
          <StatPill label="Closed"      value={closed}     color={COLORS.success} />
          <StatPill label="Converted"   value={converted}  color={COLORS.textMuted} />
        </View>

        <View style={styles.rateRow}>
          <View style={styles.rateBarTrack}>
            <View
              style={[
                styles.rateBarFill,
                { width: `${Math.min(100, rateNum)}%`, backgroundColor: COLORS.textMuted },
              ]}
            />
          </View>
          <Text style={[styles.rateLabel, { color: COLORS.textMuted }]}>{conversionRate}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Stat pill ─────────────────────────────────────────────────
function StatPill({ label, value, color }) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statPillValue, { color }]}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Presets
  presetBar: {
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  presetScroll: {
    flexDirection:     'row',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    gap:               SPACING.xs,
  },
  preset: {
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   COLORS.background,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  presetActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetText:       { ...TYPOGRAPHY.small, color: COLORS.textSecondary, fontWeight: '600' },
  presetTextActive: { color: COLORS.white },

  // Loading / error
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  loadingText:   { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  errorCenter:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.lg },
  errorText:     { ...TYPOGRAPHY.body, color: COLORS.textSecondary, textAlign: 'center' },
  retryBtn: {
    backgroundColor:   COLORS.primary,
    borderRadius:      BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
    marginTop:         SPACING.xs,
  },
  retryText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.white, fontWeight: '700' },

  // Summary card
  summaryCard: {
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.xl,
    marginHorizontal: SPACING.md,
    marginTop:        SPACING.md,
    marginBottom:     SPACING.sm,
    padding:          SPACING.md,
    ...SHADOW.md,
  },
  summaryCells: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  SPACING.md,
  },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryCellValue: {
    fontSize:   18,
    fontWeight: '800',
    lineHeight: 22,
  },
  summaryCellLabel: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textMuted,
    marginTop: 1,
    textAlign: 'center',
  },
  cellDivider: {
    width:           1,
    height:          40,
    backgroundColor: COLORS.divider,
    marginHorizontal: 4,
  },
  summaryBarWrap: { gap: 4 },
  summaryBarTrack: {
    height:          8,
    backgroundColor: COLORS.primaryLight,
    borderRadius:    4,
    overflow:        'hidden',
  },
  summaryBarFill: {
    height:          8,
    backgroundColor: COLORS.primary,
    borderRadius:    4,
  },
  summaryBarLabel: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.textMuted,
    textAlign: 'right',
  },

  // Company card
  companyCard: {
    flexDirection:    'row',
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
    overflow:         'hidden',
    ...SHADOW.sm,
  },
  noCompanyCard: { opacity: 0.85 },
  cardStrip: { width: 5 },
  cardBody:  { flex: 1, padding: SPACING.md },

  cardHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
    marginBottom:  SPACING.sm,
  },
  companyIconBox: {
    width:          40,
    height:         40,
    borderRadius:   BORDER_RADIUS.md,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  cardTitleBlock: { flex: 1 },
  cardTitle:    { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '700' },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  cardMetaText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  // Stats row
  statsRow: {
    flexDirection:    'row',
    gap:              SPACING.xs,
    marginBottom:     SPACING.sm,
  },
  statPill: {
    flex:             1,
    alignItems:       'center',
    backgroundColor:  COLORS.background,
    borderRadius:     BORDER_RADIUS.md,
    paddingVertical:  6,
  },
  statPillValue: { fontSize: 15, fontWeight: '800', lineHeight: 18 },
  statPillLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 1, textAlign: 'center' },

  // Rate bar
  rateRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  rateBarTrack: {
    flex:            1,
    height:          6,
    backgroundColor: COLORS.background,
    borderRadius:    3,
    overflow:        'hidden',
  },
  rateBarFill:  { height: '100%', borderRadius: 3 },
  rateLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    minWidth:   42,
    textAlign:  'right',
  },

  listContent:  { paddingTop: SPACING.xs, paddingBottom: SPACING.xxl },
  emptyContent: { flexGrow: 1 },
});
