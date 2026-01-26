import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  PanResponder,
  Animated,
} from "react-native";

import GreetingCardSvg from "../../../assets/HomeScreen/GreetingCard.svg";
import Carousel2Svg from "../../../assets/HomeScreen/Carousel2.svg";

type Props = {
  greeting: string;
  dateLine: string;
  userName?: string;
  onGridPress?: () => void; // kept for compatibility (not used now)
};

const SLIDE_COUNT = 2;

export default function GreetingCard({
  greeting,
  dateLine,
  userName = "User",
}: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);
  const baseXRef = useRef(0);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;

      const w = Math.round(width);
      const h = Math.round(height);

      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));

      if (w > 0 && h > 0) {
        widthRef.current = w;

        const base = -activeIndexRef.current * w;
        baseXRef.current = base;
        translateX.setValue(base);
      }
    },
    [translateX]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, g) => {
          const dx = Math.abs(g.dx);
          const dy = Math.abs(g.dy);
          return dx > 8 && dx > dy;
        },
        onPanResponderGrant: () => {
          translateX.stopAnimation();
        },
        onPanResponderMove: (_evt, g) => {
          const w = widthRef.current;
          if (!w) return;

          const minX = -(SLIDE_COUNT - 1) * w - 40;
          const maxX = 40;

          translateX.setValue(clamp(baseXRef.current + g.dx, minX, maxX));
        },
        onPanResponderRelease: (_evt, g) => {
          const w = widthRef.current;
          if (!w) return;

          const threshold = w * 0.25;
          let nextIndex = activeIndexRef.current;

          if (g.dx < -threshold && nextIndex < SLIDE_COUNT - 1) nextIndex += 1;
          if (g.dx > threshold && nextIndex > 0) nextIndex -= 1;

          const toValue = -nextIndex * w;

          Animated.spring(translateX, {
            toValue,
            useNativeDriver: true,
            bounciness: 0,
            speed: 18,
          }).start(() => {
            baseXRef.current = toValue;
            setActiveIndex(nextIndex);
          });
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: baseXRef.current,
            useNativeDriver: true,
            bounciness: 0,
            speed: 18,
          }).start();
        },
      }),
    [translateX]
  );

  // Fade greeting texts when swiping to slide 2 (avoid overlap)
  const w = Math.max(size.w, 1);
  const greetingOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-w, -w * 0.6, -w * 0.4, 0],
        outputRange: [0, 0, 1, 1],
        extrapolate: "clamp",
      }),
    [translateX, w]
  );

  return (
    <View style={styles.card} onLayout={onLayout} {...panResponder.panHandlers}>
      {size.w > 0 && size.h > 0 ? (
        <Animated.View
          style={[
            styles.bgTrack,
            {
              width: size.w * SLIDE_COUNT,
              height: size.h,
              transform: [{ translateX }],
            },
          ]}
        >
          {/* Slide 1 */}
          <View style={{ width: size.w, height: size.h }}>
            <GreetingCardSvg
              width={size.w}
              height={size.h}
              preserveAspectRatio="xMidYMid slice"
            />
          </View>

          {/* Slide 2 */}
          <View style={{ width: size.w, height: size.h }}>
            <Carousel2Svg
              width={size.w}
              height={size.h}
              preserveAspectRatio="xMidYMid slice"
            />
          </View>
        </Animated.View>
      ) : (
        <View style={styles.fallbackBg} />
      )}

      {/* Foreground content */}
      <View style={styles.overlay}>
        <Animated.View style={[styles.left, { opacity: greetingOpacity }]}>
          <Text style={styles.title} numberOfLines={1}>
            {greeting}, {userName}!
          </Text>

          <Text style={styles.sub} numberOfLines={1}>
            {dateLine}
          </Text>
        </Animated.View>

        <View style={styles.dotsRow} pointerEvents="none">
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => {
            const isActive = i === activeIndex;
            return (
              <View key={i} style={[styles.dot, isActive && styles.dotActive]} />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginTop: 6,
    height: 142,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#0B3A5A",
  },

  bgTrack: {
    position: "absolute",
    left: 0,
    top: 0,
    flexDirection: "row",
  },

  fallbackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0B3A5A",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },

  left: {
    paddingRight: 110,
    marginTop: 18,
  },

  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
    lineHeight: 20,
  },

  sub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },

  dotsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    alignItems: "center",
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  dotActive: {
    backgroundColor: "#FFFFFF",
  },
});
