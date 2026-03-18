// src/screens/IncidentLogConfirmedScreen.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "../theme/colors";

// ✅ use your SVG check asset
import ConfirmedCheckSvg from "../../assets/ConfirmedCheck.svg";

type Props = {
  alertNo: string;
  dateLine: string;
  onGoHome?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function IncidentLogConfirmedScreen({ alertNo, dateLine, onGoHome }: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const s = useMemo(() => clamp(screenWidth / 375, 0.9, 1.2), [screenWidth]);

  // ✅ mimic ConfirmationScreen footer spacing behavior
  const FOOTER_H = 72 * s;
  const CONTENT_BOTTOM_PAD = Math.max(insets.bottom, 10) + FOOTER_H + 16;

  // ✅ card height similar to preview card feel
  const CARD_H = useMemo(() => {
    const target = screenHeight * 0.66;
    return Math.round(clamp(target, 460, 640));
  }, [screenHeight]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: TC.screenBg }]} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

      <View style={[styles.page, { backgroundColor: TC.screenBg }]}>
        {/* Title (same spacing vibe as confirmation screen) */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={{ width: 40, height: 40 }} />
          <Text style={[styles.topTitle, { color: TC.textDark }]}>Incident Log Confirmation</Text>
          <View style={{ width: 40, height: 40 }} />
        </View>

        {/* Scrollable content (same pattern) */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_BOTTOM_PAD },
          ]}
        >
          <View style={[styles.card, { height: CARD_H, backgroundColor: TC.surface, borderColor: TC.divider }]}>
  <View style={{ flex: 1, width: "100%" }}>

    {/* 🔽 PUSHED DOWN TOP CONTENT */}
    <View style={{ 
      alignItems: "center",
      marginTop: Math.round(40 * s)   // 👈 adjust this number if needed
    }}>
      <View style={styles.iconWrap}>
        <ConfirmedCheckSvg
          width={170 * s}
          height={170 * s}
          preserveAspectRatio="xMidYMid meet"
        />
      </View>

            <Text style={[styles.h1, { fontSize: 16 * s, color: TC.textDark }]}>
              Submission Confirmed
            </Text>

            <Text
              style={[styles.sub, { fontSize: 12 * s, lineHeight: 18 * s, color: TC.muted }]}
            >
              Barangay officials will be notified, and you will{"\n"}
              receive updates accordingly
            </Text>
          </View>

          {/* ✅ META stays down */}
          <View style={[styles.meta, { marginTop: "auto", paddingBottom: 6 }]}>
            <Text style={[styles.metaText, { fontSize: 11 * s, color: TC.muted }]}>
              Alert no. {alertNo}
            </Text>
            <Text style={[styles.metaText, { fontSize: 11 * s, color: TC.muted }]}>
              {dateLine}
            </Text>
          </View>

        </View>
      </View>
        </ScrollView>

        {/* ✅ Fixed bottom button (same as confirmation screen) */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: TC.screenBg }]}>
          <Pressable
            onPress={onGoHome}
            style={({ pressed }) => [styles.submitShadow, pressed && { opacity: 0.95 }]}
          >
            <LinearGradient
              colors={TC.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.submitBtn, { height: 56 * s }]}
            >
              <Text style={styles.submitText}>Go back to home</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const BG = "#F5FAFE";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";
const TEXT_MUTED = "#6B7280";
const SHADOW = "#000";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  page: { flex: 1, backgroundColor: BG },

  // ✅ matches top bar spacing from IncidentLogConfirmationScreen
  topBar: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: TEXT_DARK,
    letterSpacing: 0.2,
  },

  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },

  // ✅ card style aligned with preview card style
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
    paddingHorizontal: 18,
    paddingVertical: 26,
    // ✅ changed from center so meta can go down
    justifyContent: "flex-start",
  },

  iconWrap: {
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  h1: {
    fontWeight: "900",
    color: TEXT_DARK,
    marginBottom: 10,
    textAlign: "center",
  },
  sub: {
    fontWeight: "700",
    color: TEXT_MUTED,
    textAlign: "center",
    marginBottom: 22,
  },

  meta: {
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontWeight: "800",
    color: TEXT_MUTED,
    textAlign: "center",
  },

  // ✅ footer/button styles copied from IncidentLogConfirmationScreen
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: BG,
  },
  submitShadow: {
    borderRadius: 28,
    shadowColor: SHADOW,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  submitBtn: {
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});