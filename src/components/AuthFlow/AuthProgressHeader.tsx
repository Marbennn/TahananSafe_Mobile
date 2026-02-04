// src/components/AuthFlow/AuthProgressHeader.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { View, Pressable, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  onBack?: () => void;
  progressActiveCount?: 1 | 2 | 3;

  // same responsiveness helpers from screens
  scale: (n: number) => number;
  vscale: (n: number) => number;

  activeColor?: string;
  idleColor?: string;
};

const DEFAULT_ACTIVE = "#1D4ED8";
const DEFAULT_IDLE = "#E5E7EB";

export default function AuthProgressHeader({
  onBack,
  progressActiveCount = 1,
  scale,
  vscale,
  activeColor = DEFAULT_ACTIVE,
  idleColor = DEFAULT_IDLE,
}: Props) {
  const styles = useMemo(() => createStyles(scale, vscale), [scale, vscale]);

  const backIconSize = scale(22);

  // match your old sizes (stable + centered)
  const SEG_W = scale(46);
  const SEG_H = scale(3);
  const GAP = scale(8);

  const STEP = SEG_W + GAP;
  const WRAP_W = SEG_W * 3 + GAP * 2;

  const idx = Math.max(0, Math.min(2, (progressActiveCount ?? 1) - 1));
  const translateX = useRef(new Animated.Value(idx * STEP)).current;

  useEffect(() => {
    const toValue = idx * STEP;
    Animated.timing(translateX, {
      toValue,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [idx, STEP, translateX]);

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        disabled={!onBack}
        hitSlop={12}
        style={({ pressed }) => [
          styles.backBtn,
          !onBack ? { opacity: 0 } : null,
          pressed && onBack ? { opacity: 0.55 } : null,
        ]}
      >
        <Ionicons name="chevron-back" size={backIconSize} color="#111827" />
      </Pressable>

      <View style={styles.progressRow}>
        <View
          style={[
            styles.progressWrap,
            { width: WRAP_W, height: SEG_H, borderRadius: 999 },
          ]}
        >
          <View style={[styles.baseRow, { gap: GAP }]}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  width: SEG_W,
                  height: SEG_H,
                  borderRadius: 999,
                  backgroundColor: idleColor,
                }}
              />
            ))}
          </View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.activePill,
              {
                width: SEG_W,
                height: SEG_H,
                backgroundColor: activeColor,
                transform: [{ translateX }],
              },
            ]}
          />
        </View>
      </View>

      {/* keeps progress perfectly centered always */}
      <View style={styles.headerSpacer} />
    </View>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: scale(18),
      height: vscale(46), // ✅ stable header height (like onboarding)
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "#FFFFFF",
    },

    backBtn: {
      width: scale(36),
      height: scale(36),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: scale(10),
    },

    headerSpacer: { width: scale(36), height: scale(36) },

    progressRow: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    progressWrap: {
      position: "relative",
      justifyContent: "center",
      overflow: "hidden",
    },

    baseRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    activePill: {
      position: "absolute",
      left: 0,
      top: 0,
      borderRadius: 999,
    },
  });
}
