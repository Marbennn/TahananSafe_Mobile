// src/components/HomeScreen/GreetingCard.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  PanResponder,
  Animated,
  useWindowDimensions,
  Platform,
  PixelRatio,
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

// ✅ REAL SVG ratio (your svgs are viewBox="0 0 408 170")
const SVG_RATIO = 170 / 408;

// ✅ Make card a bit shorter than the SVG height (cropped vertically)
const HEIGHT_FACTOR = 0.9;

const CARD_BG = "#0B3A5A";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function GreetingCard({
  greeting,
  dateLine,
  userName = "User",
}: Props) {
  const { width: screenW } = useWindowDimensions();

  const dpr = PixelRatio.get();
  const snapToPx = useCallback((v: number) => Math.round(v * dpr) / dpr, [dpr]);

  const s = useMemo(() => clamp(screenW / 375, 0.9, 1.25), [screenW]);

  const MH = useMemo(() => clamp(Math.round(14 * s), 12, 18), [s]);
  const R = useMemo(() => clamp(Math.round(16 * s), 14, 18), [s]);

  const cardWApprox = useMemo(
    () => Math.max(1, Math.round(screenW - MH * 2)),
    [screenW, MH]
  );

  const CARD_H = useMemo(() => {
    const h = Math.round(cardWApprox * SVG_RATIO * HEIGHT_FACTOR);
    return clamp(h, 118, 175);
  }, [cardWApprox]);

  const SEAM = useMemo(() => 2 / dpr, [dpr]);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);
  const baseXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width: w0, height: h0 } = e.nativeEvent.layout;
      const w = Math.round(w0);
      const h = Math.round(h0);

      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));

      if (w > 0 && h > 0) {
        widthRef.current = w;

        if (!isDraggingRef.current) {
          const base = -activeIndex * w;
          baseXRef.current = base;
          translateX.setValue(base);
        }
      }
    },
    [activeIndex, translateX]
  );

  const panResponder = useMemo(() => {
    const edge = clamp(Math.round(40 * s), 24, 56);

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,

      onMoveShouldSetPanResponderCapture: (_evt, g) => {
        const dx = Math.abs(g.dx);
        const dy = Math.abs(g.dy);
        return dx > 6 && dx > dy;
      },
      onMoveShouldSetPanResponder: (_evt, g) => {
        const dx = Math.abs(g.dx);
        const dy = Math.abs(g.dy);
        return dx > 6 && dx > dy;
      },

      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        translateX.stopAnimation((v: number) => {
          baseXRef.current = v;
        });
      },

      onPanResponderMove: (_evt, g) => {
        const w = widthRef.current;
        if (!w) return;

        const minX = -(SLIDE_COUNT - 1) * w - edge;
        const maxX = edge;

        const next = clamp(baseXRef.current + g.dx, minX, maxX);
        translateX.setValue(snapToPx(next));
      },

      onPanResponderRelease: (_evt, g) => {
        const w = widthRef.current;
        if (!w) {
          isDraggingRef.current = false;
          return;
        }

        const endX = baseXRef.current + g.dx;

        let nextIndex = Math.round(-endX / w);
        nextIndex = clamp(nextIndex, 0, SLIDE_COUNT - 1);

        if (g.vx <= -0.6) nextIndex = clamp(nextIndex + 1, 0, SLIDE_COUNT - 1);
        if (g.vx >= 0.6) nextIndex = clamp(nextIndex - 1, 0, SLIDE_COUNT - 1);

        const toValue = -nextIndex * w;

        Animated.spring(translateX, {
          toValue: snapToPx(toValue),
          useNativeDriver: true,
          bounciness: 0,
          speed: 18,
        }).start(() => {
          baseXRef.current = toValue;
          setActiveIndex(nextIndex);
          isDraggingRef.current = false;
        });
      },

      onPanResponderTerminate: () => {
        const w = widthRef.current;
        const toValue = w ? -activeIndex * w : 0;

        Animated.spring(translateX, {
          toValue: snapToPx(toValue),
          useNativeDriver: true,
          bounciness: 0,
          speed: 18,
        }).start(() => {
          baseXRef.current = toValue;
          isDraggingRef.current = false;
        });
      },
    });
  }, [activeIndex, s, translateX, snapToPx]);

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
        cardOuter: {
          marginHorizontal: MH,
          marginTop: clamp(Math.round(6 * s), 4, 10),
          height: CARD_H,
          borderRadius: R,

          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: 0.06,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
            },
            android: { elevation: 2 },
          }),
        },

        cardClip: {
          flex: 1,
          borderRadius: R,
          overflow: "hidden",
          backgroundColor: CARD_BG,
        },

        bgTrack: {
          position: "absolute",
          left: 0,
          top: 0,
          flexDirection: "row",
          backgroundColor: CARD_BG,
        },

        overlay: {
          ...StyleSheet.absoluteFillObject,
          paddingHorizontal: clamp(Math.round(12 * s), 10, 16),
          paddingTop: clamp(Math.round(12 * s), 10, 16),
          paddingBottom: clamp(Math.round(12 * s), 10, 16),
        },

        left: {
          paddingRight: clamp(Math.round(110 * s), 90, 150),
          marginTop: clamp(Math.round(14 * s), 10, 18),
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
          bottom: clamp(Math.round(12 * s), 10, 16),
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
        },

        dot: {
          width: clamp(Math.round(6 * s), 5, 7),
          height: clamp(Math.round(6 * s), 5, 7),
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.35)",
          marginHorizontal: clamp(Math.round(3 * s), 2, 4),
        },

        dotActive: {
          backgroundColor: "#FFFFFF",
        },
      }),
    [s, CARD_H, MH, R]
  );

  const trackW = size.w * SLIDE_COUNT;

  return (
    <View style={styles.cardOuter} {...panResponder.panHandlers}>
      <View
        style={styles.cardClip}
        onLayout={onLayout}
        renderToHardwareTextureAndroid
        needsOffscreenAlphaCompositing
      >
        {size.w > 0 && size.h > 0 ? (
          <Animated.View
            style={[
              styles.bgTrack,
              {
                width: trackW,
                height: size.h,
                transform: [{ translateX }],
              },
            ]}
          >
            <View style={{ width: size.w, height: size.h, overflow: "hidden" }}>
              <GreetingCardSvg
                width={size.w}
                height={size.h}
                preserveAspectRatio="xMidYMid slice"
              />
            </View>

            <View style={{ width: size.w, height: size.h, overflow: "hidden" }}>
              <Carousel2Svg
                width={size.w}
                height={size.h}
                preserveAspectRatio="xMidYMid slice"
              />
            </View>

            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: size.w - SEAM / 2,
                top: 0,
                width: SEAM,
                height: size.h,
                backgroundColor: CARD_BG,
              }}
            />
          </Animated.View>
        ) : null}

        <View style={styles.overlay} pointerEvents="box-none">
          <Animated.View
            style={[styles.left, { opacity: greetingOpacity }]}
            pointerEvents="none"
          >
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
              return <View key={i} style={[styles.dot, isActive && styles.dotActive]} />;
            })}
          </View>
        </View>
      </View>
    </View>
  );
}
