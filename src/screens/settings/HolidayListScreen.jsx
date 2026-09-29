/**
 * HolidayListScreen — Admin & Superuser
 *
 * Manage public / company holidays shown on salesperson attendance calendar.
 * Sunday is always week-off automatically — do not add Sundays here.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import dayjs from 'dayjs';

import { COLORS } from '@constants/colors';
import { TYPOGRAPHY, FONT_SIZE, LINE_HEIGHT, FONTS } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import EmptyState from '@components/common/EmptyState';
import { holidayApi } from '@api/holiday.api';

export default function HolidayListScreen({ navigation }) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [year, setYear] = useState(dayjs().year());

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await holidayApi.getAll({ year, activeOnly: false });
      setHolidays(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to load holidays', text2: e.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggleActive = async (item) => {
    setToggling(item.id);
    try {
      const res = await holidayApi.update(item.id, { isActive: !item.isActive });
      setHolidays((prev) => prev.map((h) => (h.id === item.id ? res.data : h)));
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: e.message });
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete Holiday',
      `Delete "${item.name}" on ${dayjs(item.date).format('DD MMM YYYY')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await holidayApi.remove(item.id);
              setHolidays((prev) => prev.filter((h) => h.id !== item.id));
              Toast.show({ type: 'success', text1: 'Holiday deleted' });
            } catch (e) {
              Alert.alert('Cannot Delete', e.message);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.infoBanner}>
        <Icon name="information-outline" size={15} color={COLORS.primary} />
        <Text style={styles.infoText}>
          Sundays are always week-off automatically. Add other public / company holidays here.
        </Text>
      </View>

      <View style={styles.yearNav}>
        <TouchableOpacity
          style={styles.yearBtn}
          onPress={() => setYear((y) => y - 1)}
        >
          <Icon name="chevron-left" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.yearText}>{year}</Text>
        <TouchableOpacity
          style={styles.yearBtn}
          onPress={() => setYear((y) => y + 1)}
        >
          <Icon name="chevron-right" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={holidays}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        renderItem={({ item }) => (
          <HolidayCard
            holiday={item}
            toggling={toggling === item.id}
            onToggleActive={() => handleToggleActive(item)}
            onEdit={() => navigation.navigate('HolidayForm', { holiday: item })}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <EmptyState
              icon="calendar-remove"
              title="No holidays yet"
              message={`No holidays for ${year}. Tap + to add one.`}
            />
          )
        }
        contentContainerStyle={
          holidays.length === 0 ? styles.emptyContent : styles.listContent
        }
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('HolidayForm', { holiday: null })}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={26} color={COLORS.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function HolidayCard({ holiday, toggling, onToggleActive, onEdit, onDelete }) {
  const d = dayjs(holiday.date);
  return (
    <View style={[styles.card, !holiday.isActive && styles.cardInactive]}>
      <View style={styles.dateBlock}>
        <Text style={styles.dateDay}>{d.format('DD')}</Text>
        <Text style={styles.dateMon}>{d.format('MMM')}</Text>
        <Text style={styles.dateDow}>{d.format('ddd')}</Text>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={2}>{holiday.name}</Text>
        <Text style={styles.cardDate}>{d.format('dddd, DD MMMM YYYY')}</Text>

        <View style={styles.cardFooter}>
          <View style={styles.activeRow}>
            {toggling ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Switch
                value={holiday.isActive}
                onValueChange={onToggleActive}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
                thumbColor={holiday.isActive ? COLORS.primary : COLORS.textMuted}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            )}
            <Text
              style={[
                styles.activeLabel,
                { color: holiday.isActive ? COLORS.success : COLORS.textMuted },
              ]}
            >
              {holiday.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
              <Icon name="pencil-outline" size={17} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={onDelete}
            >
              <Icon name="trash-can-outline" size={17} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingBottom: 100, paddingTop: SPACING.xs },
  emptyContent: { flexGrow: 1 },
  loadingWrap: { paddingTop: 80, alignItems: 'center' },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  infoText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    flex: 1,
    lineHeight: LINE_HEIGHT.sm,
  },

  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  yearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: {
    ...TYPOGRAPHY.h4,
    color: COLORS.textPrimary,
    fontFamily: FONTS.bold,
    minWidth: 64,
    textAlign: 'center',
  },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  cardInactive: { opacity: 0.55 },

  dateBlock: {
    width: 52,
    alignItems: 'center',
    marginRight: SPACING.sm,
    backgroundColor: '#F3E8FF',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  dateDay: { fontSize: FONT_SIZE.xl, fontFamily: FONTS.bold, color: '#7C3AED', lineHeight: 26 },
  dateMon: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bold, color: '#7C3AED' },
  dateDow: { fontSize: 9, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 2 },

  cardContent: { flex: 1 },
  cardName: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    fontFamily: FONTS.bold,
  },
  cardDate: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.medium },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: { backgroundColor: COLORS.error + '12' },

  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.md,
  },
});
