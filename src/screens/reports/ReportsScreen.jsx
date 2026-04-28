/**
 * ReportsScreen — system-wide analytics & salesperson performance
 *
 * Tabs:
 *  • Overview  — inquiry funnel KPIs, conversion rate
 *  • Team      — per-salesperson table (assigned / closed / conversion)
 *
 * Date filter: "Last 7 days" / "Last 30 days" / "This month" / "All time"
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';

import { COLORS } from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { formatPercent, getInitials } from '@utils/helpers';
import { reportApi } from '@api/report.api';

// ── Date range presets ────────────────────────────────────────
const DATE_PRESETS = [
  { label: '7d',   days: 7 },
  { label: '30d',  days: 30 },
  { label: 'Month', month: true },
  { label: 'All',  days: null },
];

function getDateRange(preset) {
  if (!preset.days && !preset.month) return {};
  if (preset.month) {
    return {
      from: dayjs().startOf('month').format('YYYY-MM-DD'),
      to:   dayjs().format('YYYY-MM-DD'),
    };
  }
  return {
    from: dayjs().subtract(preset.days, 'day').format('YYYY-MM-DD'),
    to:   dayjs().format('YYYY-MM-DD'),
  };
}

const TABS = ['Overview', 'Team', 'Companies'];

export default function ReportsScreen({ navigation }) {
  const [activeTab,     setActiveTab]     = useState(0);
  const [presetIndex,   setPresetIndex]   = useState(1); // default 30d

  const [summary,       setSummary]       = useState(null);
  const [inquiryReport, setInquiryReport] = useState(null);
  const [teamReport,    setTeamReport]    = useState([]);
  const [companyReport, setCompanyReport] = useState(null);

  const [isLoading,     setIsLoading]     = useState(true);
  const [isRefreshing,  setIsRefreshing]  = useState(false);

  const load = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else            setIsLoading(true);

    try {
      const range = getDateRange(DATE_PRESETS[presetIndex]);
      const [sumRes, iqRes, teamRes, companyRes] = await Promise.all([
        reportApi.getSummary(),
        reportApi.getInquiryReport(range),
        reportApi.getAllSalespersons(range),
        reportApi.getCompanyReport(range),
      ]);

      setSummary(sumRes.data ?? sumRes);
      setInquiryReport(iqRes.data ?? iqRes);
      setTeamReport(teamRes.data?.salespersons ?? teamRes.data ?? []);
      setCompanyReport(companyRes.data ?? companyRes);
    } catch (_) {
      // keep stale data on error
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [presetIndex]);

  useEffect(() => { load(); }, [load]);

  if (isLoading && !summary) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Date presets ──────────────────────────────── */}
      <View style={styles.presetRow}>
        {DATE_PRESETS.map((p, i) => (
          <TouchableOpacity
            key={p.label}
            style={[styles.preset, presetIndex === i && styles.presetActive]}
            onPress={() => setPresetIndex(i)}
          >
            <Text style={[styles.presetText, presetIndex === i && styles.presetTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tabs ──────────────────────────────────────── */}
      <View style={styles.tabs}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content ───────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load(true)}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {activeTab === 0
          ? <OverviewTab summary={summary} report={inquiryReport} />
          : activeTab === 1
          ? <TeamTab team={teamReport} />
          : <CompaniesTab
              companyReport={companyReport}
              range={getDateRange(DATE_PRESETS[presetIndex])}
              navigation={navigation}
            />
        }
        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Overview tab ──────────────────────────────────────────────
function OverviewTab({ summary, report }) {
  if (!summary) return null;

  const total      = summary.totalInquiries  ?? 0;
  const unassigned = summary.unassigned      ?? 0;
  const assigned   = summary.assigned        ?? 0;
  const inProgress = summary.inProgress      ?? 0;
  const closed     = summary.closed          ?? 0;
  // conversionRate from API is a ratio (0–1); fallback computes the same
  const conversion = summary.conversionRate  ?? (total ? closed / total : 0);

  return (
    <View>
      {/* Funnel KPIs */}
      <SectionTitle title="Inquiry Funnel" />
      <View style={styles.kpiGrid}>
        <KpiCard label="Total"       value={total}      icon="clipboard-text-outline"     color={COLORS.primary} />
        <KpiCard label="Unassigned"  value={unassigned} icon="clock-alert-outline"        color={COLORS.error} />
        <KpiCard label="In Progress" value={inProgress} icon="progress-clock"             color={COLORS.warning} />
        <KpiCard label="Closed"      value={closed}     icon="check-circle-outline"       color={COLORS.success} />
      </View>

      {/* Conversion rate bar */}
      <SectionTitle title="Conversion Rate" />
      <View style={styles.convCard}>
        <View style={styles.convTop}>
          <Text style={styles.convRate}>{formatPercent(conversion)}</Text>
          <Text style={styles.convSub}>{closed} closed / {total} total</Text>
        </View>
        <View style={styles.convTrack}>
          <View style={[styles.convFill, { width: `${Math.min(100, conversion * 100)}%` }]} />
        </View>
      </View>

      {/* Team snapshot */}
      <SectionTitle title="Team Snapshot" />
      <View style={styles.kpiGrid}>
        <KpiCard
          label="Salespersons"
          value={summary.totalSalespersons ?? '—'}
          icon="account-group-outline"
          color={COLORS.primary}
        />
        <KpiCard
          label="Present Today"
          value={summary.presentToday ?? '—'}
          icon="calendar-check-outline"
          color={COLORS.success}
        />
      </View>
    </View>
  );
}

// ── Team tab ──────────────────────────────────────────────────
function TeamTab({ team }) {
  if (!team.length) {
    return (
      <View style={styles.emptyTeam}>
        <Icon name="account-group-outline" size={40} color={COLORS.border} />
        <Text style={styles.emptyTeamText}>No team data available</Text>
      </View>
    );
  }

  // Sort by closed desc — data is nested under row.inquiries
  const sorted = [...team].sort((a, b) => (b.inquiries?.closed ?? 0) - (a.inquiries?.closed ?? 0));

  return (
    <View>
      <SectionTitle title="Salesperson Performance" />
      {/* Header row */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableCell, { flex: 2 }]}>Name</Text>
        <Text style={styles.tableCell}>Assigned</Text>
        <Text style={styles.tableCell}>Closed</Text>
        <Text style={styles.tableCell}>Rate</Text>
      </View>

      {sorted.map((row, i) => {
        const inq      = row.inquiries ?? {};
        const assigned = inq.total  ?? 0;
        const closed   = inq.closed ?? 0;
        const rate     = assigned > 0 ? closed / assigned : 0;
        return (
          <View key={row.id ?? i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}>
            <View style={[styles.tableCellView, { flex: 2 }]}>
              <View style={styles.teamAvatar}>
                <Text style={styles.teamAvatarText}>{getInitials(row.name)}</Text>
              </View>
              <Text style={styles.teamName} numberOfLines={1}>{row.name}</Text>
            </View>
            <Text style={styles.tableCell}>{assigned}</Text>
            <Text style={styles.tableCell}>{closed}</Text>
            <Text style={[styles.tableCell, { color: rate >= 0.5 ? COLORS.success : COLORS.textMuted }]}>
              {formatPercent(rate)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Companies tab ─────────────────────────────────────────────
const COMPANY_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function CompaniesTab({ companyReport, range, navigation }) {
  const companies = companyReport?.companies ?? [];
  const summary   = companyReport?.summary   ?? null;
  const noCompany = companyReport?.noCompany ?? null;

  if (!companyReport) {
    return (
      <View style={styles.emptyTeam}>
        <Icon name="domain" size={40} color={COLORS.border} />
        <Text style={styles.emptyTeamText}>No company data available</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Summary row */}
      {summary && (
        <View style={styles.companySummaryRow}>
          <CompanySummaryChip label="Companies" value={summary.totalCompanies} color={COLORS.primary} />
          <CompanySummaryChip label="Total"     value={summary.grandTotal}     color={COLORS.textSecondary} />
          <CompanySummaryChip label="Closed"    value={summary.grandClosed}    color={COLORS.success} />
          <CompanySummaryChip label="Rate"      value={summary.overallRate}    color="#8B5CF6" />
        </View>
      )}

      <SectionTitle title="By Company" />

      {companies.map((stat, idx) => {
        const color    = COMPANY_COLORS[idx % COMPANY_COLORS.length];
        const rateNum  = parseFloat(stat.conversionRate) || 0;
        return (
          <TouchableOpacity
            key={stat.company.id}
            style={styles.companyRow}
            activeOpacity={0.78}
            onPress={() =>
              navigation.navigate('CompanyDrillDown', {
                companyId:   stat.company.id,
                companyName: stat.company.name,
                from:        range.from,
                to:          range.to,
              })
            }
          >
            {/* Color indicator */}
            <View style={[styles.companyDot, { backgroundColor: color }]} />

            {/* Name + meta */}
            <View style={styles.companyInfo}>
              <View style={styles.companyNameRow}>
                <Text style={styles.companyName} numberOfLines={1}>{stat.company.name}</Text>
                <Text style={styles.companySpCount}>
                  {stat.salespersonCount} SP
                </Text>
              </View>
              {/* Mini bar */}
              <View style={styles.miniBarTrack}>
                <View
                  style={[
                    styles.miniBarFill,
                    { width: `${Math.min(100, rateNum)}%`, backgroundColor: color },
                  ]}
                />
              </View>
            </View>

            {/* Counts */}
            <View style={styles.companyCounts}>
              <Text style={styles.companyCountMain}>{stat.total}</Text>
              <Text style={styles.companyCountSub}>{stat.closed} closed</Text>
            </View>
            <View style={[styles.companyRate, { backgroundColor: color + '18' }]}>
              <Text style={[styles.companyRateText, { color }]}>{stat.conversionRate}</Text>
            </View>
            <Icon name="chevron-right" size={14} color={COLORS.border} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        );
      })}

      {/* No-company row */}
      {noCompany && noCompany.total > 0 && (
        <>
          <SectionTitle title="No Company" />
          <View style={[styles.companyRow, { opacity: 0.7 }]}>
            <View style={[styles.companyDot, { backgroundColor: COLORS.textMuted }]} />
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>Unaffiliated Salespersons</Text>
              <View style={styles.miniBarTrack}>
                <View
                  style={[
                    styles.miniBarFill,
                    {
                      width: `${Math.min(100, parseFloat(noCompany.conversionRate) || 0)}%`,
                      backgroundColor: COLORS.textMuted,
                    },
                  ]}
                />
              </View>
            </View>
            <View style={styles.companyCounts}>
              <Text style={styles.companyCountMain}>{noCompany.total}</Text>
              <Text style={styles.companyCountSub}>{noCompany.closed} closed</Text>
            </View>
            <View style={[styles.companyRate, { backgroundColor: COLORS.border }]}>
              <Text style={[styles.companyRateText, { color: COLORS.textMuted }]}>{noCompany.conversionRate}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function CompanySummaryChip({ label, value, color }) {
  return (
    <View style={styles.companySummaryChip}>
      <Text style={[styles.companySummaryValue, { color }]}>{value}</Text>
      <Text style={styles.companySummaryLabel}>{label}</Text>
    </View>
  );
}

// ── Section title ─────────────────────────────────────────────
function SectionTitle({ title }) {
  return (
    <Text style={styles.sectionTitle}>{title}</Text>
  );
}

// ── KPI card ──────────────────────────────────────────────────
function KpiCard({ label, value, icon, color }) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Presets
  presetRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
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

  // Tabs
  tabs: {
    flexDirection:     'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor:   COLORS.surface,
  },
  tab: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: COLORS.primary },
  tabText:       { ...TYPOGRAPHY.bodyMedium, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },

  scroll: { paddingBottom: SPACING.xxl },

  sectionTitle: {
    ...TYPOGRAPHY.caption,
    color:             COLORS.textMuted,
    fontWeight:        '700',
    textTransform:     'uppercase',
    letterSpacing:     0.5,
    paddingHorizontal: SPACING.md,
    marginTop:         SPACING.lg,
    marginBottom:      SPACING.sm,
  },

  // KPI grid
  kpiGrid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    gap:               SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  kpiCard: {
    flex:            1,
    minWidth:        '44%',
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.lg,
    padding:         SPACING.md,
    alignItems:      'center',
    ...SHADOW.sm,
  },
  kpiIcon: {
    width:          44,
    height:         44,
    borderRadius:   22,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   SPACING.xs,
  },
  kpiValue: { ...TYPOGRAPHY.h2, fontWeight: '800', marginBottom: 2 },
  kpiLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center' },

  // Conversion rate
  convCard: {
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    padding:          SPACING.md,
    ...SHADOW.sm,
  },
  convTop: {
    flexDirection:  'row',
    alignItems:     'baseline',
    justifyContent: 'space-between',
    marginBottom:   SPACING.sm,
  },
  convRate: { ...TYPOGRAPHY.h1, color: COLORS.primary, fontWeight: '900' },
  convSub:  { ...TYPOGRAPHY.small, color: COLORS.textMuted },
  convTrack: {
    height:          10,
    backgroundColor: COLORS.primaryLight,
    borderRadius:    5,
    overflow:        'hidden',
  },
  convFill: {
    height:          10,
    backgroundColor: COLORS.primary,
    borderRadius:    5,
  },

  // Team table
  tableHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    backgroundColor:   COLORS.primaryLight,
  },
  tableRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tableRowEven:   { backgroundColor: COLORS.surface },
  tableCell: {
    flex:       1,
    ...TYPOGRAPHY.small,
    color:      COLORS.textSecondary,
    fontWeight: '600',
    textAlign:  'center',
  },
  tableCellView: {
    flex:          2,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.xs,
  },
  teamAvatar: {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: COLORS.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  teamAvatarText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  teamName:       { ...TYPOGRAPHY.small, color: COLORS.textPrimary, fontWeight: '600', flex: 1 },

  emptyTeam: {
    alignItems:   'center',
    gap:          SPACING.sm,
    paddingTop:   SPACING.xxl,
  },
  emptyTeamText: { ...TYPOGRAPHY.small, color: COLORS.textMuted },

  // Companies tab
  companySummaryRow: {
    flexDirection:     'row',
    marginHorizontal:  SPACING.md,
    marginTop:         SPACING.md,
    backgroundColor:   COLORS.surface,
    borderRadius:      BORDER_RADIUS.lg,
    paddingVertical:   SPACING.md,
    overflow:          'hidden',
  },
  companySummaryChip:  { flex: 1, alignItems: 'center' },
  companySummaryValue: { fontSize: 18, fontWeight: '800' },
  companySummaryLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 1 },

  companyRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap:               SPACING.sm,
    backgroundColor:   COLORS.surface,
  },
  companyDot: {
    width: 10, height: 10, borderRadius: 5, flexShrink: 0,
  },
  companyInfo:   { flex: 1, minWidth: 0 },
  companyNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.xs,
    marginBottom:  3,
  },
  companyName:    { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '600', flex: 1 },
  companySpCount: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, flexShrink: 0 },
  miniBarTrack: {
    height:          4,
    backgroundColor: COLORS.background,
    borderRadius:    2,
    overflow:        'hidden',
  },
  miniBarFill: { height: '100%', borderRadius: 2 },

  companyCounts:    { alignItems: 'flex-end', flexShrink: 0 },
  companyCountMain: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, fontWeight: '700' },
  companyCountSub:  { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  companyRate: {
    borderRadius:      BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical:   3,
    flexShrink:        0,
  },
  companyRateText: { fontSize: 11, fontWeight: '700' },
});
