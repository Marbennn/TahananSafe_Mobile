// src/components/HomeScreen/GreetingCard.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { useColors } from "../../theme/colors";
import GreetingCardSvg from "../../../assets/HomeScreen/GreetingCard.svg";
import Carousel2Svg from "../../../assets/HomeScreen/Carousel2.svg";

type Props = {
  greeting: string;
  dateLine: string;
  userName?: string;
  onGridPress?: () => void;
};

const SLIDE_COUNT = 2;

// ✅ REAL SVG ratio (viewBox="0 0 408 170")
const SVG_RATIO = 170 / 408;

// ✅ Make card a bit shorter than the SVG height (cropped vertically)
const HEIGHT_FACTOR = 0.9;

const CARD_BG = "#0B3A5A";

// ✅ Auto slide interval
const AUTO_SLIDE_MS = 4500;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function makeScale(width: number) {
  const baseW = 375;
  // small phones benefit from slightly smaller scale
  const s = clamp((width / baseW) * 1.03, 0.88, 1.26);
  const fs = clamp(s * 1.06, 0.92, 1.32);
  return { s, fs };
}

export default function GreetingCard({ greeting, dateLine, userName = "User" }: Props) {
  const TC = useColors();
  const { width: screenW } = useWindowDimensions();
  const { s, fs } = useMemo(() => makeScale(screenW), [screenW]);

  const dpr = PixelRatio.get();
  const snapToPx = useCallback((v: number) => Math.round(v * dpr) / dpr, [dpr]);

  const MH = useMemo(() => clamp(Math.round(14 * s), 12, 18), [s]);
  const R = useMemo(() => clamp(Math.round(16 * s), 14, 18), [s]);

  const cardWApprox = useMemo(() => {
    // also cap max width to keep nice on tablets
    const raw = Math.round(screenW - MH * 2);
    return clamp(raw, 1, 560);
  }, [screenW, MH]);

  const CARD_H = useMemo(() => {
    const h = Math.round(cardWApprox * SVG_RATIO * HEIGHT_FACTOR);
    return clamp(h, 112, 180);
  }, [cardWApprox]);

  const SEAM = useMemo(() => 2 / dpr, [dpr]);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);
  const baseXRef = useRef(0);
  const isDraggingRef = useRef(false);

  // ✅ keep refs for auto-slide
  const activeIndexRef = useRef(0);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const goToIndex = useCallback(
    (nextIndex: number) => {
      const w = widthRef.current;
      if (!w) return;

      const idx = clamp(nextIndex, 0, SLIDE_COUNT - 1);
      const toValue = -idx * w;

      translateX.stopAnimation((v: number) => {
        baseXRef.current = v;
      });

      Animated.spring(translateX, {
        toValue: snapToPx(toValue),
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }).start(() => {
        baseXRef.current = toValue;
        setActiveIndex(idx);
      });
    },
    [translateX, snapToPx]
  );

  // ✅ AUTO SLIDE (pauses while dragging; waits for layout)
  useEffect(() => {
    if (size.w <= 0 || size.h <= 0) return;

    const id = setInterval(() => {
      if (isDraggingRef.current) return;
      const cur = activeIndexRef.current;
      const next = (cur + 1) % SLIDE_COUNT;
      goToIndex(next);
    }, AUTO_SLIDE_MS);

    return () => clearInterval(id);
  }, [size.w, size.h, goToIndex]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width: w0, height: h0 } = e.nativeEvent.layout;
      const w = Math.round(w0);
      const h = Math.round(h0);

      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));

      if (w > 0 && h > 0) {
        widthRef.current = w;

        if (!isDraggingRef.current) {
          const base = -activeIndexRef.current * w;
          baseXRef.current = base;
          translateX.setValue(base);
        }
      }
    },
    [translateX]
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
        const toValue = w ? -activeIndexRef.current * w : 0;

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
  }, [s, translateX, snapToPx]);

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

  const rightCropPad = useMemo(() => {
    const pct = 0.34; // ~34% reserved for right art area
    const px = Math.round(cardWApprox * pct);
    return clamp(px, Math.round(86 * s), Math.round(150 * s));
  }, [cardWApprox, s]);

  const indicatorDotSize = useMemo(() => clamp(Math.round(6 * s), 5, 7), [s]);
  const indicatorPillW = useMemo(() => clamp(Math.round(14 * s), 12, 17), [s]);
  const indicatorGap = useMemo(() => clamp(Math.round(4 * s), 3, 6), [s]);
  const indicatorStep = indicatorPillW / 2 + indicatorGap + indicatorDotSize / 2;
  const indicatorRailW = indicatorPillW + indicatorStep * (SLIDE_COUNT - 1);

  const indicatorTranslateX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-(SLIDE_COUNT - 1) * w, 0],
        outputRange: [indicatorStep * (SLIDE_COUNT - 1), 0],
        extrapolate: "clamp",
      }),
    [indicatorStep, translateX, w]
  );

  const indicatorScaleX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-w, -w * 0.5, 0],
        outputRange: [1, 0.72, 1],
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
              shadowColor: "transparent",
              shadowOpacity: 0,
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
            },
            android: { elevation: 0 },
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
          paddingRight: rightCropPad,
          marginTop: clamp(Math.round(14 * s), 10, 18),
        },

        title: {
          color: "#fff",
          fontSize: clamp(Math.round(16 * fs), 14, 19),
          fontWeight: "900",
          marginBottom: clamp(Math.round(4 * s), 3, 6),
          lineHeight: clamp(Math.round(20 * fs), 18, 24),
        },

        sub: {
          color: "rgba(255,255,255,0.85)",
          fontSize: clamp(Math.round(11 * fs), 10, 13),
          fontWeight: "700",
          lineHeight: clamp(Math.round(14 * fs), 12, 17),
        },

        indicatorRow: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: clamp(Math.round(12 * s), 10, 16),
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
        },

        indicatorRail: {
          width: indicatorRailW,
          height: indicatorDotSize,
          position: "relative",
        },
        indicatorDotsRow: {
          ...StyleSheet.absoluteFillObject,
        },
        indicatorDotSlot: {
          position: "absolute",
          top: 0,
          width: indicatorDotSize,
          height: indicatorDotSize,
          alignItems: "center",
          justifyContent: "center",
        },
        indicatorDot: {
          width: indicatorDotSize,
          height: indicatorDotSize,
          borderRadius: indicatorDotSize / 2,
          backgroundColor: "rgba(255,255,255,0.82)",
        },
        indicatorThumb: {
          position: "absolute",
          left: 0,
          top: 0,
          width: indicatorPillW,
          height: indicatorDotSize,
          borderRadius: 999,
          backgroundColor: "#FFFFFF",
        },
      }),
    [
      s,
      fs,
      CARD_H,
      MH,
      R,
      rightCropPad,
      indicatorRailW,
      indicatorDotSize,
      indicatorStep,
      indicatorPillW,
    ]
  );

  const trackW = size.w * SLIDE_COUNT;

  return (
    <View style={styles.cardOuter} {...panResponder.panHandlers}>
      <View style={styles.cardClip} onLayout={onLayout} renderToHardwareTextureAndroid needsOffscreenAlphaCompositing>
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
              <GreetingCardSvg width={size.w} height={size.h} preserveAspectRatio="xMidYMid slice" />
            </View>

            <View style={{ width: size.w, height: size.h, overflow: "hidden" }}>
              <Carousel2Svg width={size.w} height={size.h} preserveAspectRatio="xMidYMid slice" />
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
          <Animated.View style={[styles.left, { opacity: greetingOpacity }]} pointerEvents="none">
            <Text style={styles.title} numberOfLines={1} allowFontScaling={false}>
              {greeting}, {userName}!
            </Text>
            <Text style={styles.sub} numberOfLines={1} allowFontScaling={false}>
              {dateLine}
            </Text>
          </Animated.View>

          <View style={styles.indicatorRow} pointerEvents="none">
            <View style={styles.indicatorRail}>
              <View style={styles.indicatorDotsRow}>
                {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.indicatorDotSlot,
                      { left: indicatorPillW / 2 + i * indicatorStep - indicatorDotSize / 2 },
                    ]}
                  >
                    <View style={styles.indicatorDot} />
                  </View>
                ))}
              </View>
              <Animated.View
                style={[
                  styles.indicatorThumb,
                  {
                    transform: [{ translateX: indicatorTranslateX }, { scaleX: indicatorScaleX }],
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
