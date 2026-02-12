// src/screens/IncidentLogConfirmationScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";

// ✅ preview card
import IncidentPreviewCard, {
  IncidentPreviewData,
} from "../components/IncidentLogConfirmationScreen/IncidentPreviewCard";

// ✅ confirmed screen
import IncidentLogConfirmedScreen from "./IncidentLogConfirmedScreen";

type ConfirmResult = {
  incidentId: string;
  createdAt?: string; // ISO string
};

type Props = {
  data: IncidentPreviewData;
  onBack?: () => void;

  /**
   * MUST resolve with incidentId if success.
   * If it rejects/throws, we stay on preview screen.
   */
  onConfirm?: () => Promise<ConfirmResult>;

  submitting?: boolean;

  /**
   * Optional: what to do when pressing "Go back to home" on the confirmed screen.
   * If not provided, it falls back to onBack().
   */
  onGoHome?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatDateLine(iso?: string) {
  try {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso || new Date().toISOString();
  }
}

export default function IncidentLogConfirmationScreen({
  data,
  onBack,
  onConfirm,
  submitting = false,
  onGoHome,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const s = useMemo(() => clamp(screenWidth / 375, 0.9, 1.2), [screenWidth]);

  const [stage, setStage] = useState<"preview" | "confirmed">("preview");
  const [confirmedAlertNo, setConfirmedAlertNo] = useState<string>("");
  const [confirmedDateLine, setConfirmedDateLine] = useState<string>("");

  const FOOTER_H = 72 * s;
  const CONTENT_BOTTOM_PAD = Math.max(insets.bottom, 10) + FOOTER_H + 16;

  const handleConfirm = async () => {
    if (submitting) return;

    try {
      const result = await onConfirm?.();

      // If parent didn't return anything, stay on preview.
      if (!result?.incidentId) return;

      setConfirmedAlertNo(result.incidentId);
      setConfirmedDateLine(formatDateLine(result.createdAt));
      setStage("confirmed");
    } catch {
      // parent already logs/alerts; just keep preview open
    }
  };

  if (stage === "confirmed") {
    return (
      <IncidentLogConfirmedScreen
        alertNo={confirmedAlertNo}
        dateLine={confirmedDateLine}
        onGoHome={onGoHome ?? onBack}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <Pressable
            disabled={submitting}
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [
              styles.backBtn,
              (pressed || submitting) && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          </Pressable>

          <Text style={styles.topTitle}>Incident Log Preview</Text>

          <View style={{ width: 36, height: 36 }} />
        </View>

        {/* Scrollable content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_BOTTOM_PAD },
          ]}
        >
          <IncidentPreviewCard data={data} />
        </ScrollView>

        {/* Fixed bottom button */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable
            disabled={submitting}
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.submitShadow,
              (pressed || submitting) && { opacity: 0.95 },
            ]}
          >
            <LinearGradient
              colors={Colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.submitBtn, { height: 56 * s }]}
            >
              {submitting ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.submitText}>Submitting...</Text>
                </View>
              ) : (
                <Text style={styles.submitText}>Confirm</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const BG = "#F5FAFE";
const TEXT_DARK = "#0B2B45";
const SHADOW = "#000";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  page: { flex: 1, backgroundColor: BG },

  topBar: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
