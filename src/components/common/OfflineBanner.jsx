/**
 * OfflineBanner
 * Slides in from the top whenever the device loses internet connectivity.
 * Shows a brief "Back online" confirmation when connectivity is restored,
 * then slides back out automatically.
 *
 * Usage (place above <Toast /> in App.jsx):
 *   <OfflineBanner />
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  StatusBar,
  Platform,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { FONTS, FONT_SIZE } from '@constants/typography';

// ─── Constants ───────────────────────────────────────────────────────────────
const BANNER_HEIGHT   = 36;
const ANIM_DURATION   = 280;       // ms for slide
const ONLINE_LINGER   = 1800;      // ms to show "Back online" before hiding

const COLOR_OFFLINE   = '#DC2626'; // red-600
const COLOR_ONLINE    = '#16A34A'; // green-600

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 20,
  },
  inner: {
    height: BANNER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    opacity: 0.85,
  },
  text: {
    color: '#fff',
    fontSize: FONT_SIZE.sm,
    fontFamily: FONTS.medium,
    letterSpacing: 0.2,
  },
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function OfflineBanner() {
  // true  → currently offline
  // false → currently online (or first render — hide until first state change)
  const [isOffline, setIsOffline]       = useState(false);
  const [isVisible, setIsVisible]       = useState(false);
  const [showingOnline, setShowingOnline] = useState(false);
  const lingerTimer                      = useRef(null);

  // Animated translateY: 0 = fully visible, -BANNER_HEIGHT = hidden above screen
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
  const bgColor    = useRef(new Animated.Value(0)).current; // 0=offline, 1=online

  // ── slide helpers ──────────────────────────────────────────────────────────
  const slideIn = useCallback(() => {
    setIsVisible(true);
    Animated.timing(translateY, {
      toValue: 0,
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const slideOut = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -BANNER_HEIGHT,
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start(() => setIsVisible(false));
  }, [translateY]);

  // ── background colour interpolation ───────────────────────────────────────
  const animatedBg = bgColor.interpolate({
    inputRange: [0, 1],
    outputRange: [COLOR_OFFLINE, COLOR_ONLINE],
  });

  const flashOnlineBg = useCallback(() => {
    Animated.timing(bgColor, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [bgColor]);

  const resetOfflineBg = useCallback(() => {
    Animated.timing(bgColor, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [bgColor]);

  // ── NetInfo subscription ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected && state.isInternetReachable !== false;

      if (!connected) {
        // → offline
        clearTimeout(lingerTimer.current);
        setIsOffline(true);
        setShowingOnline(false);
        resetOfflineBg();
        slideIn();
      } else {
        // → back online
        if (isOffline) {
          // Only flash if we were previously offline
          setIsOffline(false);
          setShowingOnline(true);
          flashOnlineBg();
          slideIn(); // ensure visible if it was animating out

          lingerTimer.current = setTimeout(() => {
            setShowingOnline(false);
            slideOut();
          }, ONLINE_LINGER);
        }
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(lingerTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]);

  if (!isVisible) return null;

  // Extra top padding so banner clears the status bar on Android
  const statusBarHeight =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.inner,
          {
            backgroundColor: animatedBg,
            paddingTop: statusBarHeight,
            height: BANNER_HEIGHT + statusBarHeight,
          },
        ]}
      >
        <View style={styles.dot} />
        <Text style={styles.text}>
          {showingOnline ? 'Back online' : 'No internet connection'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
