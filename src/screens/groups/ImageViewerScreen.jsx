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
  const scale        = useRef(new Animated.Value(1)).current;
  const lastScale    = useRef(1);
  const doubleTapRef = useRef(null);

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale } }],
    { useNativeDriver: true },
  );

  const onPinchStateChange = ({ nativeEvent: e }) => {
    if (e.oldState === State.ACTIVE) {
      const next = Math.min(Math.max(lastScale.current * e.scale, 1), 5);
      lastScale.current = next;
      scale.setValue(next);
    }
  };

  const onDoubleTap = ({ nativeEvent: e }) => {
    if (e.state === State.ACTIVE) {
      lastScale.current = 1;
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
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
          onGestureEvent={onPinchEvent}
          onHandlerStateChange={onPinchStateChange}
        >
          <Animated.View style={[styles.slideInner, { transform: [{ scale }] }]}>
            <Image source={{ uri }} style={styles.img} resizeMode="contain" />
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
