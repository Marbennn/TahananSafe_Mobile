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
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, useColors } from "../theme/colors";

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
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const s = useMemo(() => clamp(screenWidth / 375, 0.9, 1.2), [screenWidth]);

  const [stage, setStage] = useState<"preview" | "confirmed">("preview");
  const [confirmedAlertNo, setConfirmedAlertNo] = useState<string>("");
  const [confirmedDateLine, setConfirmedDateLine] = useState<string>("");

  // AI analysis data
  const ai = data.aiResult ?? null;
  const isBlocked = ai?.submission_decision?.toUpperCase() === "BLOCKED" || ai?.allow_submission === false;
  const confidenceScoreRaw = typeof ai?.confidence_score === "number" ? ai.confidence_score : null;
  // AI returns 0-100 scale; normalize to 0-100 for display
  const confidenceScore = confidenceScoreRaw !== null
    ? (confidenceScoreRaw > 1 ? confidenceScoreRaw : confidenceScoreRaw * 100)
    : null;
  const incidentTip = ai?.incident_tip?.trim() || null;
  const validationReason = ai?.validation_reason?.trim() || null;

  const FOOTER_H = 72 * s;
  const CONTENT_BOTTOM_PAD = Math.max(insets.bottom, 10) + FOOTER_H + 16;

  const handleConfirm = async () => {
    if (submitting || isBlocked) return;

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
    <SafeAreaView style={[styles.safe, { backgroundColor: TC.screenBg }]} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

      <View style={[styles.page, { backgroundColor: TC.screenBg }]}>
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
            <Ionicons name="chevron-back" size={24} color={TC.primary} />
          </Pressable>

          <Text style={[styles.topTitle, { color: TC.textDark }]}>Incident Log Preview</Text>

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

          {/* AI Analysis Card */}
          {ai && (
            <View style={[styles.aiCard, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
              {/* Header */}
              <View style={styles.aiCardHeader}>
                <View style={[styles.aiIconBadge, { backgroundColor: isBlocked ? "#FEE2E2" : "#DBEAFE" }]}>
                  <Ionicons
                    name={isBlocked ? "shield-outline" : "sparkles"}
                    size={18}
                    color={isBlocked ? "#DC2626" : Colors.primary}
                  />
                </View>
                <Text style={[styles.aiCardTitle, { color: TC.textDark }]}>AI Analysis</Text>
              </View>

              {/* Confidence Score */}
              {confidenceScore !== null && (
                <View style={[styles.aiRow, { backgroundColor: TC.isDark ? "#1E293B" : "#F8FAFC" }]}>
                  <Text style={[styles.aiLabel, { color: TC.muted }]}>Confidence Score</Text>
                  <View style={styles.aiScoreWrap}>
                    <View style={[styles.aiScoreBarBg, { backgroundColor: TC.isDark ? "#334155" : "#E2E8F0" }]}>
                      <View
                        style={[
                          styles.aiScoreBarFill,
                          {
                            width: `${Math.min(confidenceScore, 100)}%`,
                            backgroundColor:
                              confidenceScore >= 70 ? "#22C55E" : confidenceScore >= 40 ? "#F59E0B" : "#EF4444",
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.aiScoreText, { color: TC.textDark }]}>
                      {confidenceScore.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              )}

              {/* Incident Tip */}
              {incidentTip && (
                <View style={[styles.aiTipBox, { backgroundColor: isBlocked ? "#FEF2F2" : (TC.isDark ? "#0F2A1D" : "#F0FDF4"), borderColor: isBlocked ? "#FECACA" : (TC.isDark ? "#166534" : "#BBF7D0") }]}>
                  <View style={styles.aiTipHeader}>
                    <Ionicons
                      name={isBlocked ? "warning" : "bulb-outline"}
                      size={16}
                      color={isBlocked ? "#DC2626" : "#16A34A"}
                    />
                    <Text style={[styles.aiTipLabel, { color: isBlocked ? "#DC2626" : "#16A34A" }]}>
                      {isBlocked ? "Notice" : "Safety Tip"}
                    </Text>
                  </View>
                  <Text style={[styles.aiTipText, { color: TC.textDark }]}>{incidentTip}</Text>
                </View>
              )}

              {/* Blocked Banner */}
              {isBlocked && (
                <View style={styles.aiBlockedBanner}>
                  <Ionicons name="close-circle" size={20} color="#DC2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aiBlockedTitle}>Submission Blocked</Text>
                    <Text style={styles.aiBlockedReason}>
                      {validationReason || "This report has been flagged and cannot be submitted."}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Fixed bottom button */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: TC.screenBg }]}>
          {isBlocked ? (
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [
                styles.submitShadow,
                pressed && { opacity: 0.95 },
              ]}
            >
              <View style={[styles.blockedBtn, { height: 56 * s }]}>
                <Ionicons name="arrow-back" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitText}>Go Back & Edit</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              disabled={submitting}
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.submitShadow,
                (pressed || submitting) && { opacity: 0.95 },
              ]}
            >
              <LinearGradient
                colors={TC.gradient}
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
          )}
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

  blockedBtn: {
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    backgroundColor: "#6B7280",
  },

  // AI Card
  aiCard: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EEF7",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 3 },
    }),
  },
  aiCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  aiIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  aiCardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT_DARK,
  },

  aiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  aiLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  aiScoreWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  aiScoreBarBg: {
    width: 80,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  aiScoreBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  aiScoreText: {
    fontSize: 14,
    fontWeight: "900",
    minWidth: 48,
    textAlign: "right",
  },

  aiTipBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  aiTipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aiTipLabel: {
    fontSize: 12,
    fontWeight: "900",
  },
  aiTipText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },

  aiBlockedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  aiBlockedTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#DC2626",
    marginBottom: 2,
  },
  aiBlockedReason: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7F1D1D",
    lineHeight: 18,
  },
});
