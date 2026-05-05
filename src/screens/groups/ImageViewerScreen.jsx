import React, {
  useRef, useState, useCallback, useEffect,
} from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList,
  StyleSheet, StatusBar, Animated, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PinchGestureHandler, TapGestureHandler,
  PanGestureHandler, State,
} from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';
import { SPACING } from '@constants/config';

const { width: SW, height: SH } = Dimensions.get('screen');

const CLOSE_THRESHOLD = 100; // px down before auto-close
const CLOSE_VELOCITY  = 600; // px/s flick speed to auto-close

// ── Single zoomable slide ─────────────────────────────────────
function ZoomableSlide({ uri }) {
  // JS-side committed state (updated only at gesture end, never during)
  const savedScale = useRef(1);
  const savedTx    = useRef(0);
  const savedTy    = useRef(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Animated base values (match savedScale/Tx/Ty at rest)
  const baseScale  = useRef(new Animated.Value(1)).current;
  const baseTx     = useRef(new Animated.Value(0)).current;
  const baseTy     = useRef(new Animated.Value(0)).current;

  // Live gesture deltas — reset to identity after every gesture
  const pinchScale = useRef(new Animated.Value(1)).current;
  const focalX     = useRef(new Animated.Value(SW / 2)).current;
  const focalY     = useRef(new Animated.Value(SH / 2)).current;
  const panDx      = useRef(new Animated.Value(0)).current;
  const panDy      = useRef(new Animated.Value(0)).current;

  const pinchRef     = useRef(null);
  const panRef       = useRef(null);
  const doubleTapRef = useRef(null);

  // ── Native-thread derived transforms ─────────────────────────
  // Focal-point formula keeps the pinch midpoint fixed on screen:
  //   tx = (focalX - SW/2) + pinchScale*(baseTx + SW/2 - focalX) + panDx
  const effectiveScale = useRef(Animated.multiply(baseScale, pinchScale)).current;
  const effectiveTx = useRef(Animated.add(
    Animated.add(
      Animated.subtract(focalX, SW / 2),
      Animated.multiply(pinchScale, Animated.subtract(Animated.add(baseTx, SW / 2), focalX)),
    ),
    panDx,
  )).current;
  const effectiveTy = useRef(Animated.add(
    Animated.add(
      Animated.subtract(focalY, SH / 2),
      Animated.multiply(pinchScale, Animated.subtract(Animated.add(baseTy, SH / 2), focalY)),
    ),
    panDy,
  )).current;

  // ── Helpers ───────────────────────────────────────────────────
  const edgeX = (s) => Math.max(0, (s - 1) * SW / 2);
  const edgeY = (s) => Math.max(0, (s - 1) * SH / 2);
  const clamp = (v, limit) => Math.min(Math.max(v, -limit), limit);

  // Commit new base state; optionally spring-animate to it
  const commit = (scale, tx, ty, spring = false) => {
    savedScale.current = scale;
    savedTx.current    = tx;
    savedTy.current    = ty;
    pinchScale.setValue(1);
    focalX.setValue(SW / 2);
    focalY.setValue(SH / 2);
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

  // ── Pinch gesture ─────────────────────────────────────────────
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

    let tx = (fx - SW / 2) * (1 - gs) + savedTx.current * gs;
    let ty = (fy - SH / 2) * (1 - gs) + savedTy.current * gs;
    if (next <= 1) { tx = 0; ty = 0; }
    else { tx = clamp(tx, edgeX(next)); ty = clamp(ty, edgeY(next)); }

    setIsZoomed(next > 1);
    commit(next, tx, ty, raw < 1); // spring back only if user over-pinched out
  };

  // ── Pan gesture (1-finger drag, only enabled when zoomed) ─────
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

    // Spring back to boundary if the user dragged past the edge
    if (rawX !== tx || rawY !== ty) {
      const cfg = { useNativeDriver: true, bounciness: 8, speed: 22 };
      Animated.spring(baseTx, { ...cfg, toValue: tx }).start();
      Animated.spring(baseTy, { ...cfg, toValue: ty }).start();
    }
  };

  // ── Double-tap: zoom 2.5× at tap point, or reset ──────────────
  const onDoubleTap = ({ nativeEvent: e }) => {
    if (e.state !== State.ACTIVE) return;
    if (savedScale.current > 1) {
      setIsZoomed(false);
      commit(1, 0, 0, true);
    } else {
      const target = 2.5;
      const fx     = e.x ?? SW / 2;
      const fy     = e.y ?? SH / 2;
      const tx     = clamp((fx - SW / 2) * (1 - target), edgeX(target));
      const ty     = clamp((fy - SH / 2) * (1 - target), edgeY(target));
      setIsZoomed(true);
      commit(target, tx, ty, true);
    }
  };

  return (
    <TapGestureHandler
      ref={doubleTapRef}
      onHandlerStateChange={onDoubleTap}
      numberOfTaps={2}
    >
      <Animated.View style={styles.slide}>
        <PinchGestureHandler
          ref={pinchRef}
          onGestureEvent={onPinchEvent}
          onHandlerStateChange={onPinchStateChange}
          simultaneousHandlers={panRef}
        >
          <Animated.View style={styles.slide}>
            <PanGestureHandler
              ref={panRef}
              enabled={isZoomed}
              onGestureEvent={onPanEvent}
              onHandlerStateChange={onPanStateChange}
              simultaneousHandlers={pinchRef}
              minPointers={1}
              maxPointers={1}
            >
              <Animated.View style={[styles.slideInner, {
                transform: [
                  { translateX: effectiveTx },
                  { translateY: effectiveTy },
                  { scale: effectiveScale },
                ],
              }]}>
                <Image source={{ uri }} style={styles.img} resizeMode="contain" />
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </PinchGestureHandler>
      </Animated.View>
    </TapGestureHandler>
  );
}

// ── Main screen ───────────────────────────────────────────────
export default function ImageViewerScreen({ navigation, route }) {
  const {
    images       = [],    // [{ url, time?, fileName? }]
    initialIndex = 0,
    sender,
  } = route.params ?? {};

  const insets  = useSafeAreaInsets();
  const topPad  = insets.top  + 6;
  const botPad  = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 28);

  const flatRef = useRef(null);
  const [current,   setCurrent]   = useState(initialIndex);
  const [uiVisible, setUiVisible] = useState(true);

  const currentImg = images[current] ?? {};

  // ── Swipe-down-to-close ───────────────────────────────────────
  const translateY = useRef(new Animated.Value(0)).current;
  const bgOpacity  = translateY.interpolate({
    inputRange:  [0, 200],
    outputRange: [1, 0.25],
    extrapolate: 'clamp',
  });

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true },
  );

  const onPanStateChange = useCallback(({ nativeEvent: e }) => {
    if (e.oldState !== State.ACTIVE) return;

    const shouldClose =
      e.translationY > CLOSE_THRESHOLD || e.velocityY > CLOSE_VELOCITY;

    if (shouldClose) {
      Animated.timing(translateY, {
        toValue:         SH,
        duration:        220,
        useNativeDriver: true,
      }).start(() => navigation.goBack());
    } else {
      Animated.spring(translateY, {
        toValue:         0,
        useNativeDriver: true,
        bounciness:      8,
      }).start();
    }
  }, [navigation, translateY]);

  // ── Scroll to initial index after mount ───────────────────────
  useEffect(() => {
    if (initialIndex > 0) {
      flatRef.current?.scrollToOffset({
        offset:   SW * initialIndex,
        animated: false,
      });
    }
  }, []);

  const onViewableChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) setCurrent(viewableItems[0].index ?? 0);
  }, []);

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const goTo = useCallback((i) => {
    if (i < 0 || i >= images.length) return;
    flatRef.current?.scrollToOffset({ offset: SW * i, animated: true });
    setCurrent(i);
  }, [images.length]);

  const close    = useCallback(() => navigation.goBack(), [navigation]);
  const toggleUI = useCallback(() => setUiVisible((v) => !v), []);

  return (
    // PanGestureHandler detects vertical drags for swipe-down-to-close.
    // activeOffsetY — only activates after 10 px vertical movement.
    // failOffsetX   — hands off to FlatList if finger moves horizontally first.
    <PanGestureHandler
      onGestureEvent={onPanEvent}
      onHandlerStateChange={onPanStateChange}
      activeOffsetY={10}
      failOffsetX={[-15, 15]}
    >
      <Animated.View
        style={[
          styles.root,
          { opacity: bgOpacity, transform: [{ translateY }] },
        ]}
      >
        <StatusBar hidden />

        {/* ── Swipeable slides ── */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={toggleUI}
        >
          <FlatList
            ref={flatRef}
            data={images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
            scrollEventThrottle={16}
            renderItem={({ item }) => <ZoomableSlide uri={item.url} />}
          />
        </TouchableOpacity>

        {/* ── Left / Right arrows ── */}
        {images.length > 1 && uiVisible && (
          <>
            {current > 0 && (
              <TouchableOpacity
                style={[styles.navBtn, styles.navLeft]}
                onPress={() => goTo(current - 1)}
                activeOpacity={0.75}
              >
                <Icon name="chevron-left" size={28} color="#fff" />
              </TouchableOpacity>
            )}
            {current < images.length - 1 && (
              <TouchableOpacity
                style={[styles.navBtn, styles.navRight]}
                onPress={() => goTo(current + 1)}
                activeOpacity={0.75}
              >
                <Icon name="chevron-right" size={28} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Top bar ── */}
        {uiVisible && (
          <View style={[styles.topBar, { paddingTop: topPad }]}>
            <View style={styles.senderAvatar}>
              <Text style={styles.senderInitial}>
                {(sender ?? '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.senderInfo}>
              <Text style={styles.senderName} numberOfLines={1}>
                {sender ?? ''}
              </Text>
              {currentImg.time ? (
                <Text style={styles.timeText}>
                  {dayjs(currentImg.time).format('DD MMM YYYY · hh:mm A')}
                </Text>
              ) : null}
            </View>

            {images.length > 1 && (
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>{current + 1} / {images.length}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={close}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Bottom bar ── */}
        {uiVisible && (
          <View style={[styles.bottomBar, { paddingBottom: botPad }]}>
            {images.length > 1 && (
              <View style={styles.dotsRow}>
                {images.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => goTo(i)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <View style={[styles.dot, i === current && styles.dotActive]} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {currentImg.fileName ? (
              <View style={styles.fileRow}>
                <Icon name="image-outline" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.fileName} numberOfLines={1}>
                  {currentImg.fileName}
                </Text>
              </View>
            ) : null}

            <Text style={styles.hint}>
              {images.length > 1
                ? 'Swipe down to close · Swipe left/right · Pinch to zoom'
                : 'Swipe down to close · Pinch to zoom · Double-tap to reset'}
            </Text>
          </View>
        )}
      </Animated.View>
    </PanGestureHandler>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#000',
  },

  // ── Slide
  slide: {
    width:           SW,
    height:          SH,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#000',
  },
  slideInner: {
    width:           SW,
    height:          SH,
    alignItems:      'center',
    justifyContent:  'center',
  },
  img: {
    width:           SW,
    height:          SH,
    backgroundColor: '#000',
  },

  // ── Nav arrows
  navBtn: {
    position:        'absolute',
    top:             '50%',
    marginTop:       -24,
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          30,
  },
  navLeft:  { left:  SPACING.sm },
  navRight: { right: SPACING.sm },

  // ── Top bar
  topBar: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    zIndex:            20,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom:     SPACING.md,
    backgroundColor:   'rgba(0,0,0,0.65)',
  },
  senderAvatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  senderInitial: {
    color:      '#fff',
    fontSize:   14,
    fontWeight: '800',
  },
  senderInfo: { flex: 1 },
  senderName: {
    color:      '#fff',
    fontSize:   14,
    fontWeight: '700',
    lineHeight: 18,
  },
  timeText: {
    color:     'rgba(255,255,255,0.55)',
    fontSize:  11,
    marginTop: 2,
  },
  counterBadge: {
    backgroundColor:   'rgba(255,255,255,0.15)',
    borderRadius:      12,
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.2)',
    flexShrink:        0,
  },
  counterText: {
    color:      '#fff',
    fontSize:   12,
    fontWeight: '700',
  },
  closeBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  // ── Bottom bar
  bottomBar: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    zIndex:            20,
    alignItems:        'center',
    paddingTop:        SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor:   'rgba(0,0,0,0.65)',
    gap:               6,
  },
  dotsRow: {
    flexDirection: 'row',
    gap:           6,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  dotActive: {
    width:           18,
    backgroundColor: '#fff',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  fileName: {
    color:      'rgba(255,255,255,0.55)',
    fontSize:   11,
    fontWeight: '500',
    maxWidth:   SW - 60,
  },
  hint: {
    color:    'rgba(255,255,255,0.28)',
    fontSize: 10,
  },
});
