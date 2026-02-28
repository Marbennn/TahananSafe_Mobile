// src/screens/PinScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import NewLogo from "../../assets/NewLogo.svg";

// ✅ Auth (to know which account is logged-in)
import { useAuth } from "../auth/AuthContext";

// ✅ SecureStore (to read the local PIN toggle)
import * as SecureStore from "expo-secure-store";

type Props = {
  onVerified: (pin: string) => void;
  onForgotPin: () => void;
  onBack?: () => void;

  /**
   * ✅ NEW:
   * If PIN is disabled from Settings (device-level), we bypass this screen.
   * In App.tsx PinScreenWrapper, pass: onBypass={() => navigation.reset({ index: 0, routes: [{ name: "Main" }] })}
   */
  onBypass?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const BLUE = "#1D4ED8";
const BORDER = "#93C5FD";

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

export default function PinScreen({ onVerified, onForgotPin, onBack, onBypass }: Props) {
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const [pin, setPin] = useState("");
  const PIN_LENGTH = 4;

  // ✅ Check if PIN is disabled (device-level) then bypass this screen
  const { user } = useAuth() as any;
  const userEmail: string = (user?.email ? String(user.email) : "").trim().toLowerCase();
  const [checkingLocal, setCheckingLocal] = useState(true);

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
    if (pin.length >= PIN_LENGTH) return;

    const next = pin + d;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      setTimeout(() => onVerified(next), 90);
    }
  };

  const backspace = () => {
    if (!pin.length) return;
    setPin((p) => p.slice(0, -1));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (onBack ? onBack() : undefined)}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={scale(22)} color="#111827" />
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
            <Text style={styles.loadingText}>Checking security settings...</Text>
          </View>
        ) : (
          <>
            {/* Title + Dots */}
            <View style={styles.pinHeader}>
              <Text style={styles.title}>Enter Current PIN</Text>

              <View style={styles.dotsRow}>
                {dots.map((filled, idx) => (
                  <View
                    key={idx}
                    style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
                  />
                ))}
              </View>

              {/* Optional help row */}
              <Pressable
                onPress={onForgotPin}
                hitSlop={10}
                style={({ pressed }) => [styles.forgotBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.forgotText}>Forgot PIN?</Text>
              </Pressable>
            </View>

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
                      pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
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
                    pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
                  ]}
                >
                  <Text style={styles.keyText}>0</Text>
                </Pressable>

                {/* ✅ BIGGER backspace icon */}
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
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const dotSize = clamp(scale(18), 16, 26);
  const dotBorder = clamp(Math.round(dotSize * 0.1), 1, 2);
  const dotGap = clamp(scale(14), 12, 18);

  const spaceLogoToTitle = clamp(vscale(22), 16, 30);
  const spaceTitleToDots = clamp(vscale(18), 14, 26);
  const spaceDotsToKeypad = clamp(vscale(28), 22, 44);
  const keypadTop = clamp(vscale(10), 8, 18);
  const keypadRowGap = clamp(vscale(18), 14, 24);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#FFFFFF" },

    container: {
      flex: 1,
      paddingHorizontal: scale(22),
      paddingTop: vscale(6),
      alignItems: "center",
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
    },

    title: {
      fontSize: scale(13),
      fontWeight: "800",
      marginBottom: spaceTitleToDots,
    },

    dotsRow: {
      flexDirection: "row",
      gap: dotGap,
      marginBottom: spaceDotsToKeypad,
    },

    dot: {
      width: dotSize,
      height: dotSize,
      borderRadius: 999,
      borderWidth: dotBorder,
    },

    dotEmpty: {
      borderColor: "#CBD5E1",
    },

    dotFilled: {
      borderColor: BLUE,
      backgroundColor: BLUE,
    },

    forgotBtn: {
      marginTop: vscale(2),
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
      width: scale(74),
      height: vscale(54),
      borderRadius: scale(10),
      borderWidth: scale(1.6),
      borderColor: BORDER,
      alignItems: "center",
      justifyContent: "center",
    },

    keyText: {
      fontSize: scale(16),
      fontWeight: "800",
      color: BLUE,
    },

    keySpacer: {
      width: scale(74),
      height: vscale(54),
    },

    iconBtn: {
      width: scale(74),
      height: vscale(54),
      alignItems: "center",
      justifyContent: "center",
    },
  });
}