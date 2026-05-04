/**
 * BusinessLocationFormScreen — Add / Edit
 *
 * route.params:
 *   { location: null }          → Create mode
 *   { location: <LocationObj> } → Edit mode
 *
 * Fields:
 *   Name · Type (chips) · Latitude · Longitude · Map picker · Radius
 *
 * Tap the map to drop a pin, or drag the pin to fine-tune.
 * Typing lat/lng manually animates the map on field blur.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import Toast from 'react-native-toast-message';
import Icon  from 'react-native-vector-icons/MaterialCommunityIcons';

import { COLORS }     from '@constants/colors';
import { TYPOGRAPHY } from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import { businessLocationApi } from '@api/businessLocation.api';

// ── Location types ────────────────────────────────────────────
const LOCATION_TYPES = [
  { value: 'office',    label: 'Office',    icon: 'office-building-outline' },
  { value: 'factory',   label: 'Factory',   icon: 'factory' },
  { value: 'warehouse', label: 'Warehouse', icon: 'warehouse' },
  { value: 'branch',    label: 'Branch',    icon: 'store-outline' },
];

const DELTA          = { latitudeDelta: 0.004, longitudeDelta: 0.004 };
const DEFAULT_REGION = { latitude: 24.8607, longitude: 67.0011, ...DELTA };

// ── Field component ───────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType = 'default',
                 returnKeyType = 'next', onSubmitEditing, onBlur, inputRef, error, suffix }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error && styles.inputError]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onBlur={onBlur}
          autoCapitalize="none"
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
export default function BusinessLocationFormScreen({ navigation, route }) {
  const existing = route.params?.location ?? null;
  const isEdit   = !!existing;

  // ── Form state ────────────────────────────────────────────
  const [name,   setName]   = useState(existing?.name        ?? '');
  const [type,   setType]   = useState(existing?.type        ?? 'office');
  const [lat,    setLat]    = useState(existing?.lat  != null ? String(Number(existing.lat).toFixed(7))  : '');
  const [lng,    setLng]    = useState(existing?.lng  != null ? String(Number(existing.lng).toFixed(7))  : '');
  const [radius, setRadius] = useState(existing?.radiusMetres != null ? String(existing.radiusMetres) : '200');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const mapRef         = useRef(null);
  const userCoordRef   = useRef(null); // latest user location from MapView
  const latRef         = useRef(null);
  const lngRef         = useRef(null);
  const radiusRef      = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Location' : 'Add Location' });
  }, [isEdit, navigation]);

  // ── Derived coords ────────────────────────────────────────
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const hasValidCoords = (
    !isNaN(parsedLat) && !isNaN(parsedLng) &&
    Math.abs(parsedLat) <= 90 && Math.abs(parsedLng) <= 180
  );

  // ── Animate map when lat/lng typed manually (on field blur) ──
  const animateToCoords = useCallback(() => {
    if (hasValidCoords) {
      mapRef.current?.animateToRegion(
        { latitude: parsedLat, longitude: parsedLng, ...DELTA },
        400,
      );
    }
  }, [hasValidCoords, parsedLat, parsedLng]);

  // ── Map tap → drop pin & fill fields ─────────────────────
  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLat(latitude.toFixed(7));
    setLng(longitude.toFixed(7));
    setErrors((prev) => ({ ...prev, lat: undefined, lng: undefined }));
  };

  // ── Store user location as it updates (blue dot) ─────────
  const handleUserLocationChange = (e) => {
    userCoordRef.current = e.nativeEvent.coordinate;
  };

  // ── My Location button → animate map + fill fields ───────
  const handleGoToMyLocation = () => {
    const coord = userCoordRef.current;
    if (!coord) {
      Toast.show({ type: 'info', text1: 'Location not available yet', text2: 'Make sure GPS is enabled.' });
      return;
    }
    mapRef.current?.animateToRegion({ ...coord, ...DELTA }, 400);
    setLat(coord.latitude.toFixed(7));
    setLng(coord.longitude.toFixed(7));
    setErrors((prev) => ({ ...prev, lat: undefined, lng: undefined }));
  };

  // ── Marker drag end → update fields ──────────────────────
  const handleMarkerDragEnd = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLat(latitude.toFixed(7));
    setLng(longitude.toFixed(7));
  };

  // ── Validation ────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!name.trim())                    e.name   = 'Name is required.';
    if (!lat.trim())                     e.lat    = 'Latitude is required.';
    else if (isNaN(parseFloat(lat)) || Math.abs(parseFloat(lat)) > 90)
                                         e.lat    = 'Enter a valid latitude (−90 to 90).';
    if (!lng.trim())                     e.lng    = 'Longitude is required.';
    else if (isNaN(parseFloat(lng)) || Math.abs(parseFloat(lng)) > 180)
                                         e.lng    = 'Enter a valid longitude (−180 to 180).';
    if (!radius.trim() || isNaN(parseInt(radius)) || parseInt(radius) < 50)
                                         e.radius = 'Minimum radius is 50 metres.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name:         name.trim(),
        type,
        lat:          parseFloat(lat),
        lng:          parseFloat(lng),
        radiusMetres: parseInt(radius),
      };
      if (isEdit) {
        await businessLocationApi.update(existing.id, payload);
        Toast.show({ type: 'success', text1: 'Location updated' });
      } else {
        await businessLocationApi.create(payload);
        Toast.show({ type: 'success', text1: 'Location added' });
      }
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Name ── */}
          <Field
            label="Location Name *"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Head Office, Main Factory"
            returnKeyType="next"
            onSubmitEditing={() => latRef.current?.focus()}
            error={errors.name}
          />

          {/* ── Type chips ── */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Location Type *</Text>
            <View style={styles.chipRow}>
              {LOCATION_TYPES.map((t) => {
                const active = type === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeChip, active && styles.typeChipActive]}
                    onPress={() => setType(t.value)}
                    activeOpacity={0.75}
                  >
                    <Icon
                      name={t.icon}
                      size={14}
                      color={active ? COLORS.white : COLORS.textSecondary}
                    />
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Lat / Lng row ── */}
          <View style={styles.rowFields}>
            <View style={{ flex: 1 }}>
              <Field
                label="Latitude *"
                value={lat}
                onChangeText={setLat}
                placeholder="e.g. 24.8607"
                keyboardType="decimal-pad"
                returnKeyType="next"
                inputRef={latRef}
                onSubmitEditing={() => lngRef.current?.focus()}
                onBlur={animateToCoords}
                error={errors.lat}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Longitude *"
                value={lng}
                onChangeText={setLng}
                placeholder="e.g. 67.0011"
                keyboardType="decimal-pad"
                returnKeyType="next"
                inputRef={lngRef}
                onSubmitEditing={() => { animateToCoords(); radiusRef.current?.focus(); }}
                onBlur={animateToCoords}
                error={errors.lng}
              />
            </View>
          </View>

          {/* ── Map picker ── */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Pin on Map *</Text>
            <View style={[styles.mapWrap, (errors.lat || errors.lng) && styles.mapWrapError]}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={
                  hasValidCoords
                    ? { latitude: parsedLat, longitude: parsedLng, ...DELTA }
                    : DEFAULT_REGION
                }
                onPress={handleMapPress}
                onUserLocationChange={handleUserLocationChange}
                showsUserLocation
                showsMyLocationButton={false}
                toolbarEnabled={false}
                moveOnMarkerPress={false}
              >
                {hasValidCoords && (
                  <Marker
                    coordinate={{ latitude: parsedLat, longitude: parsedLng }}
                    draggable
                    onDragEnd={handleMarkerDragEnd}
                    pinColor={COLORS.primary}
                  />
                )}
              </MapView>

              {/* My Location button — floats over the map */}
              <TouchableOpacity
                style={styles.myLocationBtn}
                onPress={handleGoToMyLocation}
                activeOpacity={0.85}
              >
                <Icon name="crosshairs-gps" size={20} color={COLORS.primary} />
              </TouchableOpacity>

              <View style={styles.mapHintRow}>
                <Icon name="gesture-tap" size={12} color={COLORS.textMuted} />
                <Text style={styles.mapHintText}>
                  Tap to place pin · Drag pin to fine-tune
                </Text>
              </View>
            </View>
          </View>

          {/* ── Radius ── */}
          <Field
            label="Check-in Radius *"
            value={radius}
            onChangeText={setRadius}
            placeholder="200"
            keyboardType="number-pad"
            returnKeyType="done"
            inputRef={radiusRef}
            suffix="metres"
            error={errors.radius}
          />

          <View style={styles.radiusHint}>
            <Icon name="information-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.radiusHintText}>
              Salespersons must be within this distance to check in/out. 100–300 m is typical for most offices.
            </Text>
          </View>

          {/* ── Save button ── */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Icon name={isEdit ? 'content-save-outline' : 'map-marker-plus-outline'} size={20} color={COLORS.white} />
                <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Add Location'}</Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },

  fieldWrap: { marginBottom: SPACING.md },
  label: {
    ...TYPOGRAPHY.caption,
    color:         COLORS.textSecondary,
    fontWeight:    '600',
    marginBottom:  6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACING.sm,
    height:            48,
    ...SHADOW.sm,
  },
  inputError: { borderColor: COLORS.error },
  input: {
    flex:   1,
    height: 48,
    ...TYPOGRAPHY.body,
    color:  COLORS.textPrimary,
  },
  suffix: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.textMuted,
    marginLeft: 4,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.error,
    marginTop: 4,
  },

  // Type chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  typeChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   8,
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  typeChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText:       { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  typeChipTextActive: { color: COLORS.white },

  // Lat/Lng side by side
  rowFields: { flexDirection: 'row', gap: SPACING.sm },

  // Map picker
  mapWrap: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth:  1,
    borderColor:  COLORS.border,
    overflow:     'hidden',
    ...SHADOW.sm,
  },
  mapWrapError: { borderColor: COLORS.error },
  map:          { width: '100%', height: 230 },

  myLocationBtn: {
    position:        'absolute',
    top:             10,
    right:           10,
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: COLORS.surface,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW.md,
  },

  mapHintRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   8,
  },
  mapHintText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  // Radius hint
  radiusHint: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           5,
    marginTop:     -SPACING.xs,
    marginBottom:  SPACING.lg,
  },
  radiusHintText: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.textMuted,
    flex:       1,
    lineHeight: 16,
  },

  // Save button
  saveBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.sm,
    height:          52,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    marginTop:       SPACING.sm,
    ...SHADOW.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontSize:   16,
    fontWeight: '700',
    color:      COLORS.white,
  },
});
