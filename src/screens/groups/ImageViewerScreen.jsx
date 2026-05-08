import React, {
  useRef, useState, useCallback, useEffect,
} from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList,
  StyleSheet, StatusBar, Animated, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TapGestureHandler,
  PanGestureHandler, State,
} from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SPACING } from '@constants/config';
import { FONT_SIZE, FONTS } from '@constants/typography';

const { width: SW, height: SH } = Dimensions.get('screen');

const CLOSE_THRESHOLD = 100; // px down before auto-close
const CLOSE_VELOCITY  = 600; // px/s flick speed to auto-close

// ── Single zoomable slide ─────────────────────────────────────
function ZoomableSlide({ uri, focused, onZoomChange }) {
  // JS-side committed state (updated only at gesture end, never during)
  const savedScale = useRef(1);
  const savedTx    = useRef(0);
  const savedTy    = useRef(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Notify parent and update local state together
  const setZoomed = useCallback((v) => {
    setIsZoomed(v);
    onZoomChange?.(v);
  }, [onZoomChange]);

  // Reset zoom when this slide scrolls off-screen
  useEffect(() => {
    if (!focused && savedScale.current > 1) {
      savedScale.current = 1;
      savedTx.current    = 0;
      savedTy.current    = 0;
      baseScale.setValue(1);
      baseTx.setValue(0);
      baseTy.setValue(0);
      panDx.setValue(0);
      panDy.setValue(0);
      setZoomed(false);
    }
  }, [focused]);

  // Animated base values (match savedScale/Tx/Ty at rest)
  const baseScale  = useRef(new Animated.Value(1)).current;
  const baseTx     = useRef(new Animated.Value(0)).current;
  const baseTy     = useRef(new Animated.Value(0)).current;
  const panDx      = useRef(new Animated.Value(0)).current;
  const panDy      = useRef(new Animated.Value(0)).current;

  const panRef       = useRef(null);
  const doubleTapRef = useRef(null);

  const effectiveScale = baseScale;
  const effectiveTx = useRef(Animated.add(baseTx, panDx)).current;
  const effectiveTy = useRef(Animated.add(baseTy, panDy)).current;

  // ── Helpers ───────────────────────────────────────────────────
  const edgeX = (s) => Math.max(0, (s - 1) * SW / 2);
  const edgeY = (s) => Math.max(0, (s - 1) * SH / 2);
  const clamp = (v, limit) => Math.min(Math.max(v, -limit), limit);

  // Commit new base state; optionally spring-animate to it
  const commit = (scale, tx, ty, spring = false) => {
    savedScale.current = scale;
    savedTx.current    = tx;
    savedTy.current    = ty;
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
      setZoomed(false);
      commit(1, 0, 0, true);
    } else {
      const target = 2.5;
      const fx     = e.x ?? SW / 2;
      const fy     = e.y ?? SH / 2;
      const tx     = clamp((fx - SW / 2) * (1 - target), edgeX(target));
      const ty     = clamp((fy - SH / 2) * (1 - target), edgeY(target));
      setZoomed(true);
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
        <PanGestureHandler
          ref={panRef}
          enabled={isZoomed}
          onGestureEvent={onPanEvent}
          onHandlerStateChange={onPanStateChange}
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
    </TapGestureHandler>
  );
}

// ── Main screen ───────────────────────────────────────────────
export default function ImageViewerScreen({ navigation, route }) {
  const {
    images       = [],    // [{ url, time?, fileName? }]
    initialIndex = 0,
  } = route.params ?? {};

  const insets  = useSafeAreaInsets();
  const topPad  = insets.top  + 6;
  const botPad  = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 28);

  const flatRef = useRef(null);
  const [current,   setCurrent]   = useState(initialIndex);
  const [uiVisible, setUiVisible] = useState(true);
  const [isZoomed,  setIsZoomed]  = useState(false);

  // Clear parent zoom flag whenever the active slide changes
  useEffect(() => { setIsZoomed(false); }, [current]);

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
      enabled={!isZoomed}
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
            scrollEnabled={!isZoomed}
            scrollEventThrottle={16}
            renderItem={({ item, index }) => (
              <ZoomableSlide
                uri={item.url}
                focused={index === current}
                onZoomChange={setIsZoomed}
              />
            )}
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
            {images.length > 1 && (
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>{current + 1} / {images.length}</Text>
              </View>
            )}

            <View style={styles.topCenter}>
              {currentImg.fileName ? (
                <Text style={styles.topFileName} numberOfLines={1}>
                  {currentImg.fileName}
                </Text>
              ) : null}
              {currentImg.time ? (
                <Text style={styles.topTime}>
                  {new Date(currentImg.time).toLocaleString()}
                </Text>
              ) : null}
            </View>

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

            <Text style={styles.hint}>
              {images.length > 1
                ? 'Swipe down to close · Swipe left/right · Double-tap to zoom'
                : 'Swipe down to close · Double-tap to zoom'}
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
  topCenter: {
    flex:       1,
    alignItems: 'center',
  },
  topFileName: {
    color:      '#fff',
    fontSize:   FONT_SIZE.sm,
    fontFamily: FONTS.medium,
    maxWidth:   SW - 120,
  },
  topTime: {
    color:     'rgba(255,255,255,0.5)',
    fontSize:  FONT_SIZE.xs,
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
    fontSize:   FONT_SIZE.xs,
    fontFamily: FONTS.bold,
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
  hint: {
    color:    'rgba(255,255,255,0.28)',
    fontSize: FONT_SIZE.xs,
  },
});
