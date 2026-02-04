// src/screens/CreatePinScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";

type Props = {
  onContinue: (pin: string) => void;
  onBack?: () => void;
  onSkip?: () => void;
  progressActiveCount?: 1 | 2 | 3;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const BLUE = "#1D4ED8";
const BORDER = "#93C5FD";
const BORDER_IDLE = "#E5E7EB";

export default function CreatePinScreen({
  onContinue,
  onBack,
  onSkip,
  progressActiveCount = 3,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // ✅ same responsiveness pattern as SignupScreen
  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const backIconSize = scale(22);
  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const PIN_LENGTH = 4;
  const [pin, setPin] = useState("");

  const dots = useMemo(() => {
    return Array.from({ length: PIN_LENGTH }).map((_, i) => i < pin.length);
  }, [pin]);

  const canSignup = pin.length === PIN_LENGTH;

  const addDigit = (d: string) => {
    if (pin.length >= PIN_LENGTH) return;
    setPin((p) => (p + d).slice(0, PIN_LENGTH));
  };

  const backspace = () => {
    if (!pin.length) return;
    setPin((p) => p.slice(0, -1));
  };

  const handleSignup = () => {
    if (!canSignup) return;
    onContinue(pin);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ✅ Header EXACT like SignupScreen (back arrow position matches) */}
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={backIconSize} color="#111827" />
        </Pressable>

        <View style={styles.progressRow}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.progressSeg,
                i <= progressActiveCount ? styles.progressActive : null,
              ]}
            />
          ))}
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <View
        style={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, vscale(12)) },
        ]}
      >
        {/* ✅ Title block EXACT like SignupScreen */}
        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Enter Your Pin</Text>
          <Text style={styles.screenSub}>
            Set up an app PIN to protect your access and keep{"\n"}
            your information private.
          </Text>
        </View>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {dots.map((filled, idx) => (
            <View
              key={idx}
              style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
            />
          ))}
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>
          <View style={styles.keypadGrid}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <KeyButton key={d} label={d} onPress={() => addDigit(d)} styles={styles} />
            ))}

            <View style={styles.keySpacer} />

            <KeyButton label="0" onPress={() => addDigit("0")} styles={styles} />

            <Pressable
              onPress={backspace}
              hitSlop={14}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { transform: [{ scale: 0.96 }], opacity: 0.85 },
              ]}
            >
              <Ionicons name="backspace-outline" size={scale(26)} color={BLUE} />
            </Pressable>
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomArea}>
          <Pressable
            onPress={handleSignup}
            disabled={!canSignup}
            hitSlop={10}
            style={({ pressed }) => [
              styles.ctaOuter,
              !canSignup && { opacity: 0.55 },
              pressed && canSignup ? { transform: [{ scale: 0.99 }] } : null,
            ]}
          >
            <View style={styles.ctaInnerClip}>
              <LinearGradient
                colors={Colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                <Text style={styles.ctaText}>Signup</Text>
              </LinearGradient>
            </View>
          </Pressable>

          <Pressable
            onPress={onSkip}
            hitSlop={10}
            style={({ pressed }) => [styles.skipWrap, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function KeyButton({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.keyBtn,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
      ]}
    >
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const dotSize = clamp(scale(18), 16, 26);
  const dotBorder = clamp(Math.round(dotSize * 0.1), 1, 2);
  const dotGap = clamp(scale(14), 12, 18);

  const spaceTitleToDots = clamp(vscale(26), 20, 34);
  const spaceDotsToKeypad = clamp(vscale(26), 18, 34);

  const keypadWidth = clamp(scale(300), 250, 340);
  const keyW = Math.floor((keypadWidth - scale(16) * 2) / 3);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#FFFFFF" },

    // ✅ header EXACT like SignupScreen
    header: {
      paddingHorizontal: scale(18),
      paddingTop: vscale(6),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "#FFFFFF",
    },

    backBtn: {
      width: scale(36),
      height: scale(36),
      alignItems: "flex-start",
      justifyContent: "center",
    },

    headerSpacer: { width: scale(36), height: scale(36) },

    progressRow: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      gap: scale(8),
      marginTop: vscale(2),
    },

    progressSeg: {
      width: scale(46),
      height: scale(3),
      borderRadius: 999,
      backgroundColor: BORDER_IDLE,
    },

    progressActive: { backgroundColor: BLUE },

    container: {
      flex: 1,
      backgroundColor: "#FFFFFF",
      paddingHorizontal: scale(22),
      paddingTop: vscale(6),
    },

    // ✅ title block EXACT like SignupScreen
    titleBlock: {
      marginTop: vscale(18),
      marginBottom: vscale(22),
    },

    screenTitle: {
      fontSize: scale(26),
      fontWeight: "800",
      color: Colors.text,
    },

    screenSub: {
      marginTop: vscale(8),
      fontSize: scale(13),
      lineHeight: scale(18),
      color: Colors.muted,
      maxWidth: scale(360),
    },

    dotsRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: dotGap,
      marginTop: spaceTitleToDots,
      marginBottom: spaceDotsToKeypad,
    },

    dot: {
      width: dotSize,
      height: dotSize,
      borderRadius: 999,
      borderWidth: dotBorder,
    },

    dotEmpty: { borderColor: "#CBD5E1", backgroundColor: "transparent" },
    dotFilled: { borderColor: BLUE, backgroundColor: BLUE },

    keypad: { alignItems: "center" },

    keypadGrid: {
      width: keypadWidth,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: vscale(14),
      paddingHorizontal: scale(16),
    },

    keyBtn: {
      width: keyW,
      height: vscale(54),
      borderRadius: scale(10),
      borderWidth: scale(1.6),
      borderColor: BORDER,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        android: { elevation: 0 },
        ios: { shadowOpacity: 0 },
      }),
    },

    keyText: {
      fontSize: scale(16),
      fontWeight: "800",
      color: BLUE,
    },

    keySpacer: { width: keyW, height: vscale(54) },

    iconBtn: {
      width: keyW,
      height: vscale(54),
      borderRadius: scale(10),
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },

    bottomArea: {
      marginTop: "auto",
      paddingTop: vscale(26),
      paddingBottom: vscale(6),
      alignItems: "center",
      width: "100%",
    },

    ctaOuter: {
      width: "100%",
      marginTop: vscale(4),
      borderRadius: scale(14),
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 7 },
        },
        android: { elevation: 7 },
      }),
    },

    ctaInnerClip: {
      width: "100%",
      borderRadius: scale(14),
      overflow: "hidden",
    },

    ctaGradient: {
      width: "100%",
      height: vscale(52),
      alignItems: "center",
      justifyContent: "center",
    },

    ctaText: {
      color: "#FFFFFF",
      fontSize: scale(14),
      fontWeight: "800",
    },

    skipWrap: { marginTop: vscale(10) },

    skipText: {
      fontSize: scale(12),
      fontWeight: "700",
      color: "#111827",
    },
  });
}
