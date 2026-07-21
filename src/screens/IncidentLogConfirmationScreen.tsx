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

import IncidentPreviewCard, {
  IncidentPreviewData,
} from "../components/IncidentLogConfirmationScreen/IncidentPreviewCard";
import IncidentLogConfirmedScreen from "./IncidentLogConfirmedScreen";

type ConfirmResult = {
  incidentId: string;
  createdAt?: string;
};

type Props = {
  data: IncidentPreviewData;
  onBack?: () => void;
  onConfirm?: () => Promise<ConfirmResult>;
  submitting?: boolean;
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
  const s = useMemo(() => clamp(screenWidth / 375, 0.9, 1.16), [screenWidth]);
  const isCompact = screenWidth < 350;

  const [stage, setStage] = useState<"preview" | "confirmed">("preview");
  const [confirmedAlertNo, setConfirmedAlertNo] = useState("");
  const [confirmedDateLine, setConfirmedDateLine] = useState("");

  const FOOTER_H = 84 * s;
  const CONTENT_BOTTOM_PAD = Math.max(insets.bottom, 10) + FOOTER_H + 16;

  const handleConfirm = async () => {
    if (submitting) return;

    try {
      const result = await onConfirm?.();
      if (!result?.incidentId) return;

      setConfirmedAlertNo(result.incidentId);
      setConfirmedDateLine(formatDateLine(result.createdAt));
      setStage("confirmed");
    } catch {
      // Parent handles the submit alert; keep the preview visible.
    }
  };

  if (stage === "confirmed") {
    return (
      <IncidentLogConfirmedScreen
        alertNo={confirmedAlertNo}
        dateLine={confirmedDateLine}
        data={data}
        onGoHome={onGoHome ?? onBack}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={styles.page}>
        <View style={styles.topBar}>
          <Pressable
            disabled={submitting}
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [
              styles.backBtn,
              (pressed || submitting) && { opacity: 0.65 },
            ]}
          >
            <Ionicons name="chevron-back" size={31} color="#00518D" />
          </Pressable>

          <Text style={[styles.topTitle, isCompact && styles.topTitleCompact]} allowFontScaling={false}>
            Incident Log Preview
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_BOTTOM_PAD },
          ]}
        >
          <View style={styles.stepHeader}>
            <Text style={styles.stepEyebrow} allowFontScaling={false}>
              STEP 2 OF 3
            </Text>
            <Text style={styles.stepTitle} allowFontScaling={false}>
              Details
            </Text>
            <View style={styles.progressRow}>
              <View style={[styles.progressSegment, styles.progressSegmentActive]} />
              <View style={[styles.progressSegment, styles.progressSegmentActive]} />
              <View style={styles.progressSegment} />
            </View>
            <Text style={styles.reviewCopy}>
              Please verify the information below before submitting for AI analysis and mediation scheduling.
            </Text>
          </View>

          <IncidentPreviewCard data={data} />
        </ScrollView>

        <View style={[styles.footerSurface, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.footer}>
            <Pressable
              disabled={submitting}
              onPress={onBack}
              style={({ pressed }) => [
                styles.editBtn,
                isCompact && styles.editBtnCompact,
                (pressed || submitting) && { opacity: 0.72 },
              ]}
            >
              <Text style={styles.editText} allowFontScaling={false}>
                Edit
              </Text>
            </Pressable>

            <Pressable
              disabled={submitting}
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                (pressed || submitting) && { opacity: 0.9 },
              ]}
            >
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text style={styles.confirmText} allowFontScaling={false}>
                {submitting ? "Submitting..." : "Confirm"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const BG = "#F5F7FA";
const NAVY = "#00223E";
const TEXT_DARK = "#344052";
const TEXT_MUTED = "#7B7F86";
const BORDER = "#D8DDE2";

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  page: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 17,
    paddingTop: 12,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 23,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  topTitleCompact: {
    fontSize: 20,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  scrollContent: {
    paddingHorizontal: 17,
    gap: 15,
  },
  stepHeader: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 11,
  },
  stepEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    color: "#858B94",
    marginBottom: 3,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: TEXT_DARK,
    marginBottom: 10,
  },
  progressRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: BORDER,
  },
  progressSegmentActive: {
    backgroundColor: NAVY,
  },
  reviewCopy: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    color: TEXT_MUTED,
  },
  footerSurface: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 17,
    backgroundColor: BG,
  },
  footer: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editBtn: {
    width: 97,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#B4B4B4",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnCompact: {
    width: 82,
  },
  editText: {
    fontSize: 18,
    fontWeight: "500",
    color: NAVY,
  },
  confirmBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  confirmText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#FFFFFF",
  },
});
