// src/screens/PinScreen.tsx
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, StatusBar, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../theme/colors";

import PinScreenLogo from "../../assets/Logo2.svg";

type Props = {
  onVerified: (pin: string) => void;
  onForgotPin: () => void;
};

type KeyVariant = "ghost";

export default function PinScreen({ onVerified, onForgotPin }: Props) {
  const insets = useSafeAreaInsets();

  const [pin, setPin] = useState<string>("");
  const PIN_LENGTH = 4;

  const masked = useMemo(() => {
    const arr = new Array<string>(PIN_LENGTH).fill("");
    for (let i = 0; i < pin.length && i < PIN_LENGTH; i++) arr[i] = "•";
    return arr;
  }, [pin]);

  const addDigit = (d: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      setTimeout(() => {
        Alert.alert("PIN Entered", next);
        onVerified(next);
      }, 80);
    }
  };

  const backspace = () => {
    if (!pin.length) return;
    setPin((p) => p.slice(0, -1));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={Colors.gradient} style={styles.background}>
        <StatusBar barStyle="light-content" />

        <View style={styles.topBrand}>
          <PinScreenLogo width={150} height={150} />
        </View>

        <View style={styles.topArea}>
          <Text style={styles.title}>Enter your pin</Text>
          <Text style={styles.subtitle}>Please enter your PIN to proceed</Text>

          <View style={styles.pinRow}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <View key={idx} style={styles.pinBox}>
                <Text style={styles.pinDot}>{masked[idx]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0.0)"]}
            style={styles.sheetTopFade}
          />

          <View style={styles.sheetInner}>
            <View style={styles.keypadWrap}>
              <View style={styles.keypadGrid}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <KeyBtn key={d} label={d} onPress={() => addDigit(d)} />
                ))}

                <View style={styles.keySpacer} />
                <KeyBtn label="0" onPress={() => addDigit("0")} />
                <KeyBtn label="⌫" onPress={backspace} variant="ghost" />
              </View>
            </View>

            <Pressable
              onPress={onForgotPin}
              hitSlop={10}
              style={({ pressed }) => [styles.forgotWrap, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.forgotText}>Forgot your PIN code?</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

function KeyBtn({
  label,
  onPress,
  variant,
}: {
  label: string;
  onPress: () => void;
  variant?: KeyVariant;
}) {
  const isGhost = variant === "ghost";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.keyBtn,
        isGhost && styles.keyBtnGhost,
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
      hitSlop={10}
    >
      <Text style={[styles.keyText, isGhost && styles.keyTextGhost]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B5E9B" },
  background: { flex: 1 },

  topBrand: { alignItems: "center", paddingTop: 10, paddingBottom: 6, marginBottom: 28 },

  topArea: { alignItems: "center", justifyContent: "center", paddingBottom: 30 },

  title: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 6 },
  subtitle: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 16, fontWeight: "600" },

  pinRow: { flexDirection: "row", gap: 12, marginTop: 2 },
  pinBox: {
    width: 46,
    height: 38,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinDot: { fontSize: 20, color: "#FFFFFF", fontWeight: "900", marginTop: -2 },

  sheet: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 26,
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
  },

  sheetTopFade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 18,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },

  sheetInner: { flex: 1, justifyContent: "space-between" },

  keypadWrap: { alignItems: "center", justifyContent: "flex-start", paddingTop: 6 },
  keypadGrid: {
    width: 270,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },

  keyBtn: {
    width: 78,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.6,
    borderColor: "#2B6CB0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontSize: 16, fontWeight: "800", color: "#2B6CB0" },

  keyBtnGhost: { borderColor: "rgba(43,108,176,0.25)", backgroundColor: "#F7FBFF" },
  keyTextGhost: { color: "rgba(43,108,176,0.7)" },

  keySpacer: { width: 78, height: 46 },

  forgotWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 80 },
  forgotText: { fontSize: 12, color: "#2B6CB0", fontWeight: "700" },
});
