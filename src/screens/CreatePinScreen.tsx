// src/screens/CreatePinScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";

import { getAccessToken, setHasPin, setLoggedIn } from "../auth/session";
import { setPinApi } from "../api/pin";

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
const TAG = "[CreatePinScreen]";

export default function CreatePinScreen({ onContinue, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const PIN_LENGTH = 4;
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const dots = useMemo(
    () => Array.from({ length: PIN_LENGTH }).map((_, i) => i < pin.length),
    [pin]
  );

  const canSignup = pin.length === PIN_LENGTH && !loading;

  const addDigit = (d: string) => {
    if (loading) return;
    if (pin.length >= PIN_LENGTH) return;
    setPin((p) => (p + d).slice(0, PIN_LENGTH));
  };

  const backspace = () => {
    if (loading) return;
    if (!pin.length) return;
    setPin((p) => p.slice(0, -1));
  };

  const handleSignup = async () => {
    console.log(`${TAG} Signup pressed. pin length:`, pin.length);

    if (loading) return;
    if (pin.length !== PIN_LENGTH) return;

    try {
      setLoading(true);

      const accessToken = await getAccessToken();
      console.log(`${TAG} accessToken exists?`, Boolean(accessToken));

      if (!accessToken) {
        throw new Error("Session missing. Please login again.");
      }

      await setPinApi({ accessToken, pin: String(pin) });
      console.log(`${TAG} setPinApi success`);

      // ✅ Persist flags (for future launches)
      await setHasPin(true);
      await setLoggedIn(true);

      // ✅ IMPORTANT: App.tsx will route you straight to Home/Main
      onContinue(pin);
    } catch (err: any) {
      console.log(`${TAG} ERROR:`, err?.message || err);
      Alert.alert("PIN Setup Failed", err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (loading) return;
    try {
      await setHasPin(false);
      await setLoggedIn(true);
    } catch {}
    onSkip?.();
  };

  return (
    <View style={styles.safe}>
      <View
        style={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, vscale(12)) },
        ]}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Enter Your Pin</Text>
          <Text style={styles.screenSub}>
            Set up an app PIN to protect your access and keep{"\n"}
            your information private.
          </Text>
        </View>

        <View style={styles.dotsRow}>
          {dots.map((filled, idx) => (
            <View
              key={idx}
              style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
            />
          ))}
        </View>

        <View style={styles.keypad}>
          <View style={styles.keypadGrid}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <KeyButton
                key={d}
                label={d}
                onPress={() => addDigit(d)}
                styles={styles}
                disabled={loading}
              />
            ))}

            <View style={styles.keySpacer} />

            <KeyButton
              label="0"
              onPress={() => addDigit("0")}
              styles={styles}
              disabled={loading}
            />

            <Pressable
              onPress={backspace}
              disabled={loading}
              hitSlop={14}
              style={({ pressed }) => [
                styles.iconBtn,
                loading && { opacity: 0.45 },
                pressed && !loading
                  ? { transform: [{ scale: 0.96 }], opacity: 0.85 }
                  : null,
              ]}
            >
              <Ionicons name="backspace-outline" size={scale(26)} color={BLUE} />
            </Pressable>
          </View>
        </View>

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
                {loading ? <ActivityIndicator /> : <Text style={styles.ctaText}>Continue</Text>}
              </LinearGradient>
            </View>
          </Pressable>

          <Pressable
            onPress={handleSkip}
            disabled={loading}
            hitSlop={10}
            style={({ pressed }) => [
              styles.skipWrap,
              loading && { opacity: 0.45 },
              pressed && !loading ? { opacity: 0.7 } : null,
            ]}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function KeyButton({
  label,
  onPress,
  styles,
  disabled,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [
        styles.keyBtn,
        disabled && { opacity: 0.45 },
        pressed && !disabled ? { transform: [{ scale: 0.98 }], opacity: 0.95 } : null,
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
    container: {
      flex: 1,
      backgroundColor: "#FFFFFF",
      paddingHorizontal: scale(22),
      paddingTop: vscale(6),
    },
    titleBlock: { marginTop: vscale(18), marginBottom: vscale(22) },
    screenTitle: { fontSize: scale(26), fontWeight: "800", color: Colors.text },
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
    keyText: { fontSize: scale(16), fontWeight: "800", color: BLUE },
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
    ctaInnerClip: { width: "100%", borderRadius: scale(14), overflow: "hidden" },
    ctaGradient: {
      width: "100%",
      height: vscale(52),
      alignItems: "center",
      justifyContent: "center",
    },
    ctaText: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "800" },
    skipWrap: { marginTop: vscale(10) },
    skipText: { fontSize: scale(12), fontWeight: "700", color: "#111827" },
  });
}
