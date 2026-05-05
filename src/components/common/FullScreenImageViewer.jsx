import React, { useRef, useState } from 'react';
import {
  Modal, View, Text, Image, TouchableOpacity,
  StyleSheet, Animated, StatusBar, Dimensions,
  Platform, ScrollView,
} from 'react-native';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';
import { COLORS } from '@constants/colors';
import { BORDER_RADIUS } from '@constants/config';

const { width: W, height: H } = Dimensions.get('screen'); // screen includes status bar + nav bar

// Distinct soft colors for avatars based on first letter
const AVATAR_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];
function avatarColor(name) {
  if (!name) return COLORS.primary;
  const code = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[code];
}

export default function FullScreenImageViewer({ visible, url, senderName, time, onClose }) {
  const insets  = useSafeAreaInsets();
  const initials = senderName
    ? senderName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const avatarBg = avatarColor(senderName);

  // ── Pinch-to-zoom + pan state (Android) ──────────────────────
  const savedScale = useRef(1);
  const savedTx    = useRef(0);
  const savedTy    = useRef(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const baseScale  = useRef(new Animated.Value(1)).current;
  const baseTx     = useRef(new Animated.Value(0)).current;
  const baseTy     = useRef(new Animated.Value(0)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const focalX     = useRef(new Animated.Value(W / 2)).current;
  const focalY     = useRef(new Animated.Value(H / 2)).current;
  const panDx      = useRef(new Animated.Value(0)).current;
  const panDy      = useRef(new Animated.Value(0)).current;
  const pinchRef   = useRef(null);
  const panRef     = useRef(null);

  // Focal-point formula — runs entirely on the native thread
  const combinedScale = useRef(Animated.multiply(baseScale, pinchScale)).current;
  const combinedTx = useRef(Animated.add(
    Animated.add(
      Animated.subtract(focalX, W / 2),
      Animated.multiply(pinchScale, Animated.subtract(Animated.add(baseTx, W / 2), focalX)),
    ),
    panDx,
  )).current;
  const combinedTy = useRef(Animated.add(
    Animated.add(
      Animated.subtract(focalY, H / 2),
      Animated.multiply(pinchScale, Animated.subtract(Animated.add(baseTy, H / 2), focalY)),
    ),
    panDy,
  )).current;

  const edgeX = (s) => Math.max(0, (s - 1) * W / 2);
  const edgeY = (s) => Math.max(0, (s - 1) * H / 2);
  const clamp = (v, limit) => Math.min(Math.max(v, -limit), limit);

  const commit = (scale, tx, ty, spring = false) => {
    savedScale.current = scale;
    savedTx.current    = tx;
    savedTy.current    = ty;
    pinchScale.setValue(1);
    focalX.setValue(W / 2);
    focalY.setValue(H / 2);
    panDx.setValue(0);
    panDy.setValue(0);
    const cfg = { useNativeDriver: true, bounciness: 5, speed: 22 };
    if (spring) {
      Animated.spring(baseScale, { ...cfg, toValue: scale }).start();
      Animated.spring(baseTx,    { ...cfg, toValue: tx    }).start();
      Animated.spring(baseTy,    { ...cfg, toValue: ty    }).start();
    } else {
      baseScale.setValue(scale);
      baseTx.setValue(tx);
      baseTy.setValue(ty);
    }
  };

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale, focalX, focalY } }],
    { useNativeDriver: true },
  );

  const onPinchStateChange = ({ nativeEvent: e }) => {
    if (e.oldState !== State.ACTIVE) return;
    const gs   = e.scale;
    const raw  = savedScale.current * gs;
    const next = Math.min(Math.max(raw, 1), 5);
    const fx   = e.focalX;
    const fy   = e.focalY;

    let tx = (fx - W / 2) * (1 - gs) + savedTx.current * gs;
    let ty = (fy - H / 2) * (1 - gs) + savedTy.current * gs;
    if (next <= 1) { tx = 0; ty = 0; }
    else { tx = clamp(tx, edgeX(next)); ty = clamp(ty, edgeY(next)); }

    setIsZoomed(next > 1);
    commit(next, tx, ty, raw < 1);
  };

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: panDx, translationY: panDy } }],
    { useNativeDriver: true },
  );

  const onPanStateChange = ({ nativeEvent: e }) => {
    if (e.oldState !== State.ACTIVE) return;
    const s    = savedScale.current;
    const rawX = savedTx.current + e.translationX;
    const rawY = savedTy.current + e.translationY;
    const tx   = clamp(rawX, edgeX(s));
    const ty   = clamp(rawY, edgeY(s));

    baseTx.setValue(tx);
    baseTy.setValue(ty);
    panDx.setValue(0);
    panDy.setValue(0);
    savedTx.current = tx;
    savedTy.current = ty;

    if (rawX !== tx || rawY !== ty) {
      const cfg = { useNativeDriver: true, bounciness: 8, speed: 22 };
      Animated.spring(baseTx, { ...cfg, toValue: tx }).start();
      Animated.spring(baseTy, { ...cfg, toValue: ty }).start();
    }
  };

  const resetZoom = () => {
    setIsZoomed(false);
    commit(1, 0, 0, true);
  };

  const handleClose = () => {
    resetZoom();
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/*
        GestureHandlerRootView must wrap content INSIDE the Modal.
        Android's Modal renders in a separate window outside the app's
        GestureHandlerRootView, so PinchGestureHandler gets no events
        unless we provide a new root here.
      */}
      <GestureHandlerRootView style={StyleSheet.absoluteFillObject}>
        <View style={styles.bg}>
        <StatusBar backgroundColor="#000" barStyle="light-content" />

        {/* ── Zoomable image ───────────────────────────────── */}
        {Platform.OS === 'ios' ? (
          <ScrollView
            style={StyleSheet.absoluteFillObject}
            contentContainerStyle={styles.scrollContent}
            maximumZoomScale={5}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bouncesZoom
            centerContent
          >
            {url ? <Image source={{ uri: url }} style={styles.image} resizeMode="contain" /> : null}
          </ScrollView>
        ) : (
          <PinchGestureHandler
            ref={pinchRef}
            onGestureEvent={onPinchEvent}
            onHandlerStateChange={onPinchStateChange}
            simultaneousHandlers={panRef}
          >
            <Animated.View style={styles.imageWrap}>
              <PanGestureHandler
                ref={panRef}
                enabled={isZoomed}
                onGestureEvent={onPanEvent}
                onHandlerStateChange={onPanStateChange}
                simultaneousHandlers={pinchRef}
                minPointers={1}
                maxPointers={1}
              >
                <Animated.View style={StyleSheet.absoluteFill}>
                  {url ? (
                    <Animated.Image
                      source={{ uri: url }}
                      style={[styles.image, { transform: [
                        { translateX: combinedTx },
                        { translateY: combinedTy },
                        { scale: combinedScale },
                      ] }]}
                      resizeMode="contain"
                    />
                  ) : null}
                </Animated.View>
              </PanGestureHandler>
            </Animated.View>
          </PinchGestureHandler>
        )}

        {/* ── Header overlay ───────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
          {/* Left: avatar + sender info */}
          <View style={styles.senderRow}>
            <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.senderInfo}>
              <Text style={styles.senderName} numberOfLines={1}>
                {senderName ?? 'Unknown'}
              </Text>
              {time ? (
                <Text style={styles.timestamp}>
                  {dayjs(time).format('DD MMM YYYY · hh:mm A')}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Right: close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Footer overlay ───────────────────────────────── */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.zoomResetBtn}
            onPress={resetZoom}
            activeOpacity={0.75}
          >
            <Icon name="magnify-minus-outline" size={15} color="rgba(255,255,255,0.75)" />
            <Text style={styles.zoomResetText}>Reset zoom</Text>
          </TouchableOpacity>

          <View style={styles.footerHintRow}>
            <Icon name="gesture-pinch" size={13} color="rgba(255,255,255,0.35)" />
            <Text style={styles.footerHint}>Pinch to zoom</Text>
          </View>
        </View>

        </View>{/* styles.bg */}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex:            1,
    backgroundColor: '#000',
  },
  flex: { flex: 1 },

  // iOS ScrollView content
  scrollContent: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Android gesture wrapper
  imageWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
  },

  image: {
    width:  W,
    height: H,
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    position:         'absolute',
    top:              0,
    left:             0,
    right:            0,
    backgroundColor:  'rgba(0,0,0,0.72)',
    paddingBottom:    14,
    paddingHorizontal: 16,
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
  },
  senderRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    flex:          1,
  },
  avatar: {
    width:          40,
    height:         40,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    2,
    borderColor:    'rgba(255,255,255,0.25)',
    flexShrink:     0,
  },
  avatarText: {
    color:      '#fff',
    fontWeight: '800',
    fontSize:   14,
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    color:      '#fff',
    fontWeight: '700',
    fontSize:   14,
    lineHeight: 18,
  },
  timestamp: {
    color:    'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.2)',
    alignItems:      'center',
    justifyContent:  'center',
    marginLeft:      8,
    flexShrink:      0,
  },

  // ── Footer ──────────────────────────────────────────────────
  footer: {
    position:         'absolute',
    bottom:           0,
    left:             0,
    right:            0,
    backgroundColor:  'rgba(0,0,0,0.60)',
    paddingTop:       12,
    paddingHorizontal: 20,
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
  },
  zoomResetBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius:   BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.15)',
  },
  zoomResetText: {
    color:      'rgba(255,255,255,0.75)',
    fontSize:   12,
    fontWeight: '600',
  },
  footerHintRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  footerHint: {
    color:    'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
});
