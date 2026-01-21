// src/screens/IncidentLogConfirmedScreen.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable, StatusBar } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../theme/colors";

// ✅ use your SVG check asset
import ConfirmedCheckSvg from "../../assets/ConfirmedCheck.svg";

type Props = {
  alertNo: string;
  dateLine: string;
  onGoHome?: () => void;
};

export default function IncidentLogConfirmedScreen({
  alertNo,
  dateLine,
  onGoHome,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.page, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {/* Title */}
        <View style={[styles.topTitleWrap, { paddingTop: Math.max(insets.top, 8) }]}>
          <Text style={styles.topTitle}>Incident Log Confirmation</Text>
        </View>

        {/* Center content */}
        <View style={styles.center}>
          <View style={styles.card}>
            {/* ✅ no blue circle background */}
            <View style={styles.iconWrap}>
              <ConfirmedCheckSvg
                width={160}
                height={160}
                preserveAspectRatio="xMidYMid meet"
              />
            </View>

            <Text style={styles.h1}>Submission Confirmed</Text>

            <Text style={styles.sub}>
              Barangay officials will be notified, and you will{"\n"}
              receive updates accordingly
            </Text>

            <View style={styles.meta}>
              <Text style={styles.metaText}>Alert no. {alertNo}</Text>
              <Text style={styles.metaText}>{dateLine}</Text>
            </View>
          </View>
        </View>

        {/* Bottom button */}
        <Pressable
          onPress={onGoHome}
          style={({ pressed }) => [
            styles.homeBtn,
            pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 },
          ]}
        >
          <Text style={styles.homeBtnText}>Go back to home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const BG = "#F5FAFE";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  page: { flex: 1, backgroundColor: BG, paddingHorizontal: 14 },

  topTitleWrap: {
    alignItems: "center",
    paddingBottom: 10,
  },
  topTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: TEXT_DARK,
  },

  center: {
    flex: 1,
    justifyContent: "center",
  },

  // ✅ taller card box
  card: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    minHeight: 420, // ✅ taller than before
    paddingVertical: 34,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  // ✅ centers the SVG (no background)
  iconWrap: {
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  h1: {
    fontSize: 14,
    fontWeight: "900",
    color: TEXT_DARK,
    marginBottom: 8,
  },
  sub: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 14,
    marginBottom: 22,
  },

  meta: {
    width: "100%",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  metaText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#6B7280",
  },

  homeBtn: {
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    marginTop: 12,
  },
  homeBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
