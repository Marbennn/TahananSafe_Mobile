// src/screens/OnboardingPagerScreen.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Animated,
  StyleSheet,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Pressable,
  Text,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { Colors } from "../theme/colors";
import OnboardingSlide from "../components/OnBoarding/OnboardingSlide";
import { setOnboardingSeen } from "../auth/session";

import OB1 from "../../assets/OnBoarding/OB1.svg";
import OB2 from "../../assets/OnBoarding/OB2.svg";
import OB3 from "../../assets/OnBoarding/OB3.svg";

type Props = {
  onDone: () => void;
};

type PageIndex = 0 | 1 | 2;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function OnboardingPagerScreen({ onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const s = clamp(width / 375, 0.95, 1.6);
  const vs = clamp(height / 812, 0.95, 1.35);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(
    () => createStyles(scale, vscale, insets.bottom),
    [width, height, insets.bottom]
  );

  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [page, setPage] = useState<PageIndex>(0);

  const slides = useMemo(
    () => [
      {
        Svg: OB1,
        title: "Document incidents safely",
        description:
          "Record and track incidents quickly. Keep details organized to support quick action.",
        primaryLabel: "Continue",
      },
      {
        Svg: OB2,
        title: "Early risk identification",
        description:
          "Spot warning signs early and act fast. Stay informed and reduce potential harm.",
        primaryLabel: "Continue",
      },
      {
        Svg: OB3,
        title: "You stay in control",
        description:
          "Your safety matters. Use tools that help you stay alert, informed, and prepared.",
        primaryLabel: "Get Started",
      },
    ],
    []
  );

  const goTo = (index: PageIndex, animated = true) => {
    setPage(index);
    scrollRef.current?.scrollTo({ x: index * width, y: 0, animated });
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / width);
    const clamped = Math.max(0, Math.min(2, idx)) as PageIndex;
    setPage(clamped);
  };

  useEffect(() => {
    goTo(page, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  // ---------- Indicator sizing ----------
  const DOT_W = scale(18);
  const DOT_H = scale(4);
  const GAP = scale(8);
  const STEP = DOT_W + GAP;

  // ✅ total width of the whole dot group (3 dots + 2 gaps)
  const INDICATOR_W = DOT_W * 3 + GAP * 2;

  const translateX = scrollX.interpolate({
    inputRange: [0, width, width * 2],
    outputRange: [0, STEP, STEP * 2],
    extrapolate: "clamp",
  });

  const handlePrimary = async () => {
    if (page === 2) {
      try {
        await setOnboardingSeen(true);
      } catch {}
      onDone();
      return;
    }

    goTo((page + 1) as PageIndex, true);
  };

  const handleBack = () => {
    if (page === 0) return;
    goTo((page - 1) as PageIndex, true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ✅ FIXED HEADER */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          disabled={page === 0}
          hitSlop={12}
          style={({ pressed }) => [
            styles.backBtn,
            page === 0 ? { opacity: 0 } : null,
            pressed && page !== 0 ? { opacity: 0.55 } : null,
          ]}
        >
          <Ionicons name="chevron-back" size={scale(22)} color={Colors.text} />
        </Pressable>
      </View>

      {/* ✅ SWIPING CONTENT ONLY */}
      <View style={styles.contentArea}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumEnd}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
        >
          {slides.map((s, i) => (
            <View key={i} style={{ width }}>
              <OnboardingSlide
                Svg={s.Svg}
                title={s.title}
                description={s.description}
              />
            </View>
          ))}
        </Animated.ScrollView>

        {/* ✅ FIXED INDICATOR OVERLAY (ALIGNED) */}
        <View
          pointerEvents="none"
          style={[styles.fixedIndicator, { width: INDICATOR_W, height: DOT_H }]}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: DOT_W,
                height: DOT_H,
                borderRadius: 999,
                backgroundColor: "#BFD6EA",
                marginRight: i === 2 ? 0 : GAP,
              }}
            />
          ))}

          <Animated.View
            style={[
              styles.activePill,
              {
                width: DOT_W,
                height: DOT_H,
                transform: [{ translateX }],
              },
            ]}
          />
        </View>
      </View>

      {/* ✅ FIXED FOOTER */}
      <View style={styles.footer}>
        <Pressable
          onPress={handlePrimary}
          hitSlop={10}
          style={({ pressed }) => [
            styles.ctaPressable,
            pressed ? { transform: [{ scale: 0.99 }], opacity: 0.98 } : null,
          ]}
        >
          <LinearGradient
            colors={Colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>{slides[page].primaryLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number,
  bottomInset: number
) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: "#FFFFFF",
      position: "relative",
    },

    header: {
      paddingHorizontal: scale(18),
      paddingTop: vscale(6),
      height: vscale(46),
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
    },

    backBtn: {
      width: scale(36),
      height: scale(36),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: scale(10),
    },

    contentArea: {
      flex: 1,
      backgroundColor: "#FFFFFF",
      position: "relative",
    },

    // ✅ Now this container is ONLY as wide as the dot group.
    // So activePill left:0 aligns with dot #1 perfectly.
    fixedIndicator: {
      position: "absolute",
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",

      bottom: vscale(120),

      zIndex: 50,
      elevation: 50,
    },

    activePill: {
      position: "absolute",
      left: 0,
      top: 0,
      borderRadius: 999,
      backgroundColor: Colors.primary,
    },

    footer: {
      paddingHorizontal: scale(22),
      paddingTop: vscale(10),
      paddingBottom: Math.max(vscale(14), bottomInset + vscale(10)),
      backgroundColor: "#FFFFFF",
    },

    ctaPressable: {
      width: "100%",
      borderRadius: scale(12),
      overflow: "hidden",
    },

    ctaGradient: {
      height: vscale(46),
      alignItems: "center",
      justifyContent: "center",

      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 7 },
        },
        android: {
          elevation: 6,
        },
      }),
    },

    ctaText: {
      color: "#FFFFFF",
      fontSize: scale(13),
      fontWeight: "800",
    },
  });
}
