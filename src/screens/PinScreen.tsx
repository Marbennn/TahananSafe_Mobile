// src/screens/PinScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import InvalidPinModal from "../components/PinScreen/InvalidPinModal";
import ForgotPinModal from "../components/PinScreen/ForgotPinModal";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, useColors } from "../theme/colors";

import NewLogo from "../../assets/NewLogo.svg";

// ✅ SecureStore (to read the local PIN toggle)
import * as SecureStore from "expo-secure-store";

type Props = {
  onVerified: (pin: string) => void;
  onForgotPin: () => void;
  onBack?: () => void;
  onBypass?: () => void;
  onUserActivity?: () => void;
  accountEmail?: string;

  invalidPinVisible?: boolean;
  invalidPinMsg?: string;
  onInvalidPinDismiss?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const BLUE = Colors.primary;

/** SecureStore keys must only contain: A-Z a-z 0-9 . - _ */
function safeKeyPart(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
}

function pinEnabledKeyForEmail(email: string) {
  return `tahanansafe_pin_enabled_${safeKeyPart(email)}`;
}

/**
 * If key is missing -> default TRUE (so old users are not blocked)
 */
async function isPinEnabledLocally(email: string): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(pinEnabledKeyForEmail(email));
    if (v === null || v === undefined || String(v).trim() === "") return true;
    return v === "1";
  } catch {
    return true;
  }
}

// ✅ SECURITY FIX: PIN brute-force rate limiting
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 5 * 60 * 1000; // 5-minute lockout after max attempts

async function getPinAttemptCount(email: string): Promise<{ count: number; lockedUntil: number }> {
  try {
    const raw = await SecureStore.getItemAsync(`tahanansafe_pin_attempts_${safeKeyPart(email)}`);
    if (!raw) return { count: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    return { count: parsed.count || 0, lockedUntil: parsed.lockedUntil || 0 };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

async function incrementPinAttempt(email: string): Promise<{ count: number; locked: boolean }> {
  const data = await getPinAttemptCount(email);
  const newCount = data.count + 1;
  const locked = newCount >= MAX_PIN_ATTEMPTS;
  const lockedUntil = locked ? Date.now() + PIN_LOCKOUT_MS : 0;
  await SecureStore.setItemAsync(
    `tahanansafe_pin_attempts_${safeKeyPart(email)}`,
    JSON.stringify({ count: newCount, lockedUntil })
  );
  return { count: newCount, locked };
}

export async function resetPinAttempts(email: string) {
  await SecureStore.deleteItemAsync(`tahanansafe_pin_attempts_${safeKeyPart(email)}`).catch(() => {});
}

export default function PinScreen({
  onVerified,
  onForgotPin,
  onBack,
  onBypass,
  onUserActivity,
  accountEmail,
  invalidPinVisible = false,
  invalidPinMsg,
  onInvalidPinDismiss,
}: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const [pin, setPin] = useState("");
  const [lockedOut, setLockedOut] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [forgotPinVisible, setForgotPinVisible] = useState(false);
  const PIN_LENGTH = 4;

  // Lockout modal animation
  const lockFade = React.useRef(new Animated.Value(0)).current;
  const lockPop = React.useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (!lockedOut) return;
    lockFade.setValue(0);
    lockPop.setValue(0.96);
    Animated.parallel([
      Animated.timing(lockFade, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(lockPop, { toValue: 1, speed: 18, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, [lockedOut]);

  // Reset pin when invalid PIN modal appears + track failed attempt
  useEffect(() => {
    if (invalidPinVisible) {
      setPin("");
      // ✅ SECURITY: Track failed PIN attempt
      if (userEmail) {
        incrementPinAttempt(userEmail).then(({ locked }) => {
          if (locked) {
            setLockedOut(true);
            setLockSeconds(Math.ceil(PIN_LOCKOUT_MS / 1000));
          }
        });
      }
    }
  }, [invalidPinVisible]);

  // ✅ Check if PIN is disabled (device-level) then bypass this screen
  const userEmail: string = String(accountEmail || "").trim().toLowerCase();
  const [checkingLocal, setCheckingLocal] = useState(true);

  // ✅ SECURITY: Check lockout status on mount
  useEffect(() => {
    if (!userEmail) return;
    getPinAttemptCount(userEmail).then(({ lockedUntil }) => {
      if (lockedUntil > Date.now()) {
        setLockedOut(true);
        setLockSeconds(Math.ceil((lockedUntil - Date.now()) / 1000));
      }
    });
  }, [userEmail]);

  // ✅ SECURITY: Countdown timer for lockout
  useEffect(() => {
    if (!lockedOut || lockSeconds <= 0) return;
    const t = setInterval(() => {
      setLockSeconds((s) => {
        if (s <= 1) {
          setLockedOut(false);
          if (userEmail) resetPinAttempts(userEmail);
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [lockedOut, lockSeconds > 0]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!userEmail) {
          if (!mounted) return;
          setCheckingLocal(false);
          return;
        }

        const enabled = await isPinEnabledLocally(userEmail);
        if (!mounted) return;

        // If disabled locally, immediately bypass (go Main) if caller provided handler.
        if (!enabled) {
          onBypass?.();
          return;
        }
      } finally {
        if (mounted) setCheckingLocal(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userEmail, onBypass]);

  const dots = useMemo(() => {
    return Array.from({ length: PIN_LENGTH }).map((_, i) => i < pin.length);
  }, [pin]);

  const addDigit = (d: string) => {
    onUserActivity?.();
    if (lockedOut) return; // ✅ SECURITY: Block input during lockout
    if (pin.length >= PIN_LENGTH) return;

    const next = pin + d;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      // NOTE: Do NOT reset attempts here — only reset after parent confirms success
      setTimeout(() => onVerified(next), 90);
    }
  };

  const backspace = () => {
    onUserActivity?.();
    if (!pin.length) return;
    setPin((p) => p.slice(0, -1));
  };

  return (
    <>
      <SafeAreaView style={[styles.safe, { backgroundColor: TC.screenBg }]} edges={["top", "bottom"]}>
      <StatusBar barStyle={TC.statusBar} backgroundColor={TC.screenBg} />

      <View style={[styles.container, { backgroundColor: TC.screenBg }]}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              onUserActivity?.();
              onBack?.();
            }}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={scale(22)} color={TC.textDark} />
          </Pressable>

          <View style={styles.headerSpacer} />
        </View>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <NewLogo width={scale(210)} height={scale(78)} />
        </View>

        {/* While checking local flag */}
        {checkingLocal ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
            <Text style={[styles.loadingText, { color: TC.muted }]}>Checking security settings...</Text>
          </View>
        ) : (
          <>
            {/* Title + Dots */}
            <View style={styles.pinHeader}>
              <Text style={[styles.title, { color: TC.textDark }]}>Enter Your Current PIN</Text>

              <View style={styles.dotsRow}>
                {dots.map((filled, idx) => (
                  <View
                    key={idx}
                    style={[styles.dot, filled ? { borderColor: TC.primary, backgroundColor: TC.primary } : { borderColor: TC.isDark ? "#334155" : "#BFDBFE", backgroundColor: TC.surface }]}
                  />
                ))}
              </View>

            </View>

            {/* Forgot PIN — sits just above the keypad */}
            <Pressable
              onPress={() => {
                onUserActivity?.();
                setForgotPinVisible(true);
              }}
              hitSlop={10}
              style={({ pressed }) => [styles.forgotBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.forgotText}>Forgot PIN?</Text>
            </Pressable>

            {/* Keypad */}
            <View style={styles.keypad}>
              <View style={styles.keypadGrid}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => addDigit(d)}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.keyBtn,
                      pressed ? { transform: [{ scale: 0.94 }], opacity: 0.85 } : null,
                    ]}
                  >
                    <Text style={styles.keyText}>{d}</Text>
                  </Pressable>
                ))}

                <View style={styles.keySpacer} />

                <Pressable
                  onPress={() => addDigit("0")}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.keyBtn,
                    pressed ? { transform: [{ scale: 0.94 }], opacity: 0.85 } : null,
                  ]}
                >
                  <Text style={styles.keyText}>0</Text>
                </Pressable>

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
          </>
        )}
      </View>
      </SafeAreaView>

      <InvalidPinModal
        visible={invalidPinVisible}
        message={invalidPinMsg}
        onClose={() => onInvalidPinDismiss?.()}
      />

      <ForgotPinModal
        visible={forgotPinVisible}
        onClose={() => setForgotPinVisible(false)}
        onPinReset={() => {
          setForgotPinVisible(false);
          onForgotPin();
        }}
        prefillEmail={userEmail}
      />

      {/* ✅ SECURITY: Lockout modal */}
      <Modal visible={lockedOut} transparent animationType="none">
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: scale(18) }}>
          <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.32)", opacity: lockFade }]} />

          <Animated.View
            style={{
              opacity: lockFade,
              transform: [{ scale: lockPop }],
              width: "100%",
              maxWidth: scale(320),
              borderRadius: scale(18),
              backgroundColor: TC.surface,
              paddingHorizontal: scale(24),
              paddingTop: scale(28),
              paddingBottom: scale(24),
              alignItems: "center" as const,
              ...Platform.select({
                ios: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
                android: { elevation: 10 },
              }),
            }}
          >
            {/* Icon */}
            <View style={{ width: scale(72), height: scale(72), borderRadius: scale(36), backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center", marginBottom: scale(16) }}>
              <Ionicons name="lock-closed" size={scale(34)} color="#DC2626" />
            </View>

            <Text style={{ textAlign: "center", fontSize: scale(16), fontWeight: "900", color: TC.textDark, marginBottom: scale(10) }}>
              Too Many Attempts
            </Text>

            <Text style={{ textAlign: "center", fontSize: scale(12), lineHeight: scale(18), color: TC.muted, marginBottom: scale(8) }}>
              You've entered the wrong PIN too many times.{"\n"}Please wait before trying again.
            </Text>

            {/* Countdown */}
            <View style={{ backgroundColor: TC.isDark ? "#1E293B" : "#F1F5F9", borderRadius: scale(12), paddingVertical: vscale(12), paddingHorizontal: scale(20), marginBottom: scale(20), alignItems: "center" }}>
              <Text style={{ fontSize: scale(28), fontWeight: "900", color: "#DC2626", fontVariant: ["tabular-nums"] }}>
                {Math.floor(lockSeconds / 60)}:{String(lockSeconds % 60).padStart(2, "0")}
              </Text>
            </View>

            <Text style={{ textAlign: "center", fontSize: scale(11), color: TC.muted }}>
              The keypad will unlock automatically
            </Text>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const dotSize = clamp(scale(22), 18, 28);

  const spaceLogoToTitle = clamp(vscale(22), 16, 30);
  const spaceTitleToDots = clamp(vscale(18), 14, 26);
  const spaceDotsToKeypad = clamp(vscale(10), 6, 14);
  const keypadTop = clamp(vscale(48), 40, 70);
  const keypadRowGap = clamp(vscale(12), 10, 18);

  const btnSize = scale(70);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#F0F4F8" },

    container: {
      flex: 1,
      paddingHorizontal: scale(22),
      paddingTop: vscale(6),
      alignItems: "center",
      backgroundColor: "#F0F4F8",
    },

    topBar: {
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: vscale(4),
    },

    backBtn: {
      width: scale(36),
      height: scale(36),
      justifyContent: "center",
    },

    headerSpacer: { width: scale(36), height: scale(36) },

    logoWrap: {
      marginTop: vscale(26),
      marginBottom: spaceLogoToTitle,
      alignItems: "center",
    },

    loadingWrap: {
      marginTop: vscale(10),
      alignItems: "center",
      justifyContent: "center",
      gap: vscale(10),
    },
    loadingText: {
      fontSize: scale(12),
      fontWeight: "800",
      color: "#6B7280",
    },

    pinHeader: {
      alignItems: "center",
      marginTop: vscale(48),
    },


    title: {
      fontSize: scale(15),
      fontWeight: "800",
      color: "#111827",
      marginBottom: spaceTitleToDots,
    },

    dotsRow: {
      flexDirection: "row",
      gap: scale(18),
      marginBottom: spaceDotsToKeypad,
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
      borderColor: BLUE,
      backgroundColor: BLUE,
    },

    forgotBtn: {
      marginBottom: vscale(8),
      paddingVertical: vscale(6),
      paddingHorizontal: scale(10),
      borderRadius: scale(10),
    },
    forgotText: {
      fontSize: scale(12),
      fontWeight: "900",
      color: BLUE,
    },

    keypad: {
      alignItems: "center",
      marginTop: keypadTop,
    },

    keypadGrid: {
      width: scale(260),
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: keypadRowGap,
    },

    keyBtn: {
      width: btnSize,
      height: btnSize,
      borderRadius: btnSize / 2,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#94A3B8",
          shadowOpacity: 0.45,
          shadowRadius: 10,
          shadowOffset: { width: 4, height: 6 },
        },
        android: { elevation: 6 },
      }),
    },

    keyText: {
      fontSize: scale(20),
      fontWeight: "700",
      color: BLUE,
    },

    keySpacer: {
      width: btnSize,
      height: btnSize,
    },

    iconBtn: {
      width: btnSize,
      height: btnSize,
      borderRadius: btnSize / 2,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
