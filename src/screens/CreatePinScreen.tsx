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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";

import {
  getAccessToken,
  setHasPin,
  setLoggedIn,
  setPinUnlockedThisRun,
  setPinSkippedForUser,
} from "../auth/session";

import { setPinApi, getMeApi } from "../api/pin";

type Props = {
  onContinue: (pin: string) => void;
  onBack?: () => void;
  onSkip?: () => void;
  progressActiveCount?: 1 | 2 | 3;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const TAG = "[CreatePinScreen]";

export default function CreatePinScreen({ onContinue, onSkip }: Props) {
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(
    () => createStyles(scale, vscale, width, height),
    [width, height]
  );

  const PIN_LENGTH = 4;
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const dots = useMemo(
    () => Array.from({ length: PIN_LENGTH }).map((_, i) => i < pin.length),
    [pin]
  );

  const canSubmit = pin.length === PIN_LENGTH && !loading;

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

  const handleSubmit = async () => {
    console.log(`${TAG} Continue pressed. pin length:`, pin.length);
    if (loading) return;
    if (pin.length !== PIN_LENGTH) return;

    try {
      setLoading(true);

      const accessToken = await getAccessToken();
      console.log(`${TAG} accessToken exists?`, Boolean(accessToken));
      if (!accessToken) throw new Error("Session missing. Please login again.");

      await setPinApi({ accessToken, pin: String(pin) });
      console.log(`${TAG} setPinApi success`);

      await setHasPin(true);

      try {
        const me = await getMeApi({ accessToken });
        const userId = String(me.user._id);
        await setPinSkippedForUser(userId, false);
      } catch {
        // ignore
      }

      await setLoggedIn(true);
      setPinUnlockedThisRun(true);
      onContinue(pin);
    } catch (err: any) {
      console.log(`${TAG} ERROR:`, err?.message || err);
      Alert.alert("PIN Setup Failed", err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    console.log(`${TAG} Skip pressed`);
    if (loading) return;

    try {
      setLoading(true);

      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Session missing. Please login again.");

      await setHasPin(false);

      const me = await getMeApi({ accessToken });
      const userId = String(me.user._id);
      await setPinSkippedForUser(userId, true);

      await setLoggedIn(true);
      setPinUnlockedThisRun(true);
      onSkip?.();
    } catch (err: any) {
      console.log(`${TAG} Skip ERROR:`, err?.message || err);
      Alert.alert("Skip Failed", err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.safe}>
      <View style={styles.container}>

        {/* ── TOP: icon · title · subtitle · dots ── */}
        <View style={styles.topSection}>
          <View style={styles.iconWrap}>
            <LinearGradient
              colors={Colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Ionicons name="lock-closed" size={scale(30)} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <Text style={styles.screenTitle}>Create Your PIN</Text>
          <Text style={styles.screenSub}>
            Set a 4-digit PIN to quickly and securely{"\n"}access your account.
          </Text>

          <View style={styles.dotsCard}>
            {dots.map((filled, idx) => (
              <View
                key={idx}
                style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
              />
            ))}
          </View>
        </View>

        {/* ── KEYPAD ── */}
        <View style={styles.keypadSection}>
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
                  ? { transform: [{ scale: 0.93 }], opacity: 0.7 }
                  : null,
              ]}
            >
              <Ionicons
                name="backspace-outline"
                size={scale(24)}
                color="#07519C"
              />
            </Pressable>
          </View>
        </View>

        {/* ── BOTTOM: continue · skip ── */}
        <View style={styles.bottomArea}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            hitSlop={10}
            style={({ pressed }) => [
              styles.ctaOuter,
              !canSubmit && { opacity: 0.5 },
              pressed && canSubmit ? { transform: [{ scale: 0.99 }] } : null,
            ]}
          >
            <View style={styles.ctaInnerClip}>
              <LinearGradient
                colors={Colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.ctaText}>Continue</Text>
                )}
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
              pressed && !loading ? { opacity: 0.6 } : null,
            ]}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>

      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Key button
// ─────────────────────────────────────────────
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
      hitSlop={8}
      style={({ pressed }) => [
        styles.keyBtn,
        disabled && { opacity: 0.45 },
        pressed && !disabled
          ? { transform: [{ scale: 0.94 }], opacity: 0.85 }
          : null,
      ]}
    >
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
function createStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number,
  width: number,
  height: number
) {
  const hPad = scale(24);
  const keyGap = scale(14);
  const keypadW = width - hPad * 2;

  // Key is a circle: fit 3 per row (width constraint) and 4 rows (height constraint)
  const keySizeW = Math.floor((keypadW - keyGap * 2) / 3);
  const keySizeH = Math.floor((height * 0.46 - keyGap * 3) / 4);
  const keySize = clamp(Math.min(keySizeW, keySizeH), 52, 84);

  const dotSize = clamp(scale(22), 18, 28);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#FFFFFF" },

    container: {
      flex: 1,
      paddingHorizontal: hPad,
      paddingTop: vscale(6),
    },

    // ── Top ──────────────────────────────────
    topSection: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },

    iconWrap: {
      width: scale(72),
      height: scale(72),
      borderRadius: scale(22),
      overflow: "hidden",
      marginBottom: vscale(16),
      ...Platform.select({
        ios: {
          shadowColor: "#07519C",
          shadowOpacity: 0.28,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
        },
        android: { elevation: 5 },
      }),
    },

    iconGradient: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    screenTitle: {
      fontSize: scale(24),
      fontWeight: "800",
      color: "#111827",
      marginBottom: vscale(8),
      textAlign: "center",
    },

    screenSub: {
      fontSize: scale(13),
      lineHeight: scale(20),
      color: "#6B7280",
      textAlign: "center",
      marginBottom: vscale(24),
    },

    dotsCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: scale(18),
      backgroundColor: "#F8FAFC",
      borderRadius: scale(20),
      borderWidth: 1,
      borderColor: "#E2E8F0",
      paddingVertical: vscale(16),
      paddingHorizontal: scale(28),
    },

    dot: {
      width: dotSize,
      height: dotSize,
      borderRadius: 999,
      borderWidth: 2,
    },

    dotEmpty: {
      borderColor: "#BFDBFE",
      backgroundColor: "#FFFFFF",
    },

    dotFilled: {
      borderColor: "#07519C",
      backgroundColor: "#07519C",
    },

    // ── Keypad ───────────────────────────────
    keypadSection: {
      alignItems: "center",
      paddingBottom: vscale(8),
    },

    keypadGrid: {
      width: keypadW,
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: keyGap,
      rowGap: keyGap,
    },

    keyBtn: {
      width: keySize,
      height: keySize,
      borderRadius: 999,
      backgroundColor: "#EFF6FF",
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#07519C",
          shadowOpacity: 0.1,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        },
        android: { elevation: 2 },
      }),
    },

    keyText: {
      fontSize: scale(20),
      fontWeight: "700",
      color: "#07519C",
    },

    keySpacer: { width: keySize, height: keySize },

    iconBtn: {
      width: keySize,
      height: keySize,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },

    // ── Bottom ───────────────────────────────
    bottomArea: {
      paddingTop: vscale(16),
      paddingBottom: vscale(12),
      alignItems: "center",
      width: "100%",
    },

    ctaOuter: {
      width: "100%",
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
      borderRadius: scale(14),
      overflow: "hidden",
    },

    ctaGradient: {
      height: vscale(52),
      alignItems: "center",
      justifyContent: "center",
    },

    ctaText: {
      color: "#FFFFFF",
      fontSize: scale(14),
      fontWeight: "800",
    },

    skipWrap: {
      marginTop: vscale(14),
      paddingVertical: vscale(4),
    },

    skipText: {
      fontSize: scale(13),
      fontWeight: "600",
      color: "#6B7280",
    },
  });
}
