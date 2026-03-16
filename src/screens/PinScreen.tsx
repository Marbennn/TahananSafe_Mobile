// src/screens/PinScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import InvalidPinModal from "../components/PinScreen/InvalidPinModal";
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
import { Colors } from "../theme/colors";

import NewLogo from "../../assets/NewLogo.svg";

// ✅ Auth (to know which account is logged-in)
import { useAuth } from "../auth/AuthContext";

// ✅ SecureStore (to read the local PIN toggle)
import * as SecureStore from "expo-secure-store";

type Props = {
  onVerified: (pin: string) => void;
  onForgotPin: () => void;
  onBack?: () => void;
  onBypass?: () => void;

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

export default function PinScreen({ onVerified, onForgotPin, onBack, onBypass, invalidPinVisible = false, invalidPinMsg, onInvalidPinDismiss }: Props) {
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const [pin, setPin] = useState("");
  const PIN_LENGTH = 4;

  // Reset pin when invalid PIN modal appears
  useEffect(() => {
    if (invalidPinVisible) setPin("");
  }, [invalidPinVisible]);

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
    <>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4F8" />

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
              <Text style={styles.title}>Enter Your Current PIN</Text>

              <View style={styles.dotsRow}>
                {dots.map((filled, idx) => (
                  <View
                    key={idx}
                    style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
                  />
                ))}
              </View>

            </View>

            {/* Forgot PIN — sits just above the keypad */}
            <Pressable
              onPress={onForgotPin}
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