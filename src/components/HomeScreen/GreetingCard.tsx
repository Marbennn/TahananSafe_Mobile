import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  PanResponder,
  Animated,
  useWindowDimensions,
} from "react-native";

import GreetingCardSvg from "../../../assets/HomeScreen/GreetingCard.svg";
import Carousel2Svg from "../../../assets/HomeScreen/Carousel2.svg";

type Props = {
  greeting: string;
  dateLine: string;
  userName?: string;
  onGridPress?: () => void;
};

const SLIDE_COUNT = 2;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function GreetingCard({
  greeting,
  dateLine,
  userName = "User",
}: Props) {
  const { width } = useWindowDimensions();

  // ✅ scale based on common mobile width (375)
  const s = useMemo(() => clamp(width / 375, 0.9, 1.25), [width]);

  const CARD_H = useMemo(
    () => clamp(Math.round(142 * s), 130, 180),
    [s]
  );
  const MH = useMemo(() => clamp(Math.round(14 * s), 12, 18), [s]);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);
  const baseXRef = useRef(0);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;

  const clampX = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width: w0, height: h0 } = e.nativeEvent.layout;

      const w = Math.round(w0);
      const h = Math.round(h0);

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

          translateX.setValue(clampX(baseXRef.current + g.dx, minX, maxX));
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          marginHorizontal: MH,
          marginTop: clamp(Math.round(6 * s), 4, 10),
          height: CARD_H,
          borderRadius: clamp(Math.round(16 * s), 14, 18),
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
          paddingHorizontal: clamp(Math.round(14 * s), 12, 18),
          paddingTop: clamp(Math.round(14 * s), 12, 18),
          paddingBottom: clamp(Math.round(16 * s), 12, 18),
        },

        left: {
          paddingRight: clamp(Math.round(110 * s), 90, 140),
          marginTop: clamp(Math.round(18 * s), 12, 22),
        },

        title: {
          color: "#fff",
          fontSize: clamp(Math.round(16 * s), 14, 18),
          fontWeight: "900",
          marginBottom: clamp(Math.round(4 * s), 3, 6),
          lineHeight: clamp(Math.round(20 * s), 18, 22),
        },

        sub: {
          color: "rgba(255,255,255,0.85)",
          fontSize: clamp(Math.round(11 * s), 10, 13),
          fontWeight: "700",
          lineHeight: clamp(Math.round(14 * s), 12, 16),
        },

        dotsRow: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: clamp(Math.round(18 * s), 14, 20),
          flexDirection: "row",
          justifyContent: "center",
          gap: clamp(Math.round(6 * s), 5, 8),
          alignItems: "center",
        },

        dot: {
          width: clamp(Math.round(6 * s), 5, 7),
          height: clamp(Math.round(6 * s), 5, 7),
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.35)",
        },

        dotActive: {
          backgroundColor: "#FFFFFF",
        },
      }),
    [s, CARD_H, MH]
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
          <View style={{ width: size.w, height: size.h }}>
            <GreetingCardSvg
              width={size.w}
              height={size.h}
              preserveAspectRatio="xMidYMid slice"
            />
          </View>

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
