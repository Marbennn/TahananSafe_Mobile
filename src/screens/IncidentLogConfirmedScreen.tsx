// src/screens/IncidentLogConfirmedScreen.tsx
import React, { useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import type { IncidentPreviewData } from "../components/IncidentLogConfirmationScreen/IncidentPreviewCard";
import ConfirmedCheckSvg from "../../assets/ConfirmedCheck.svg";
import { PRIMARY_ACTION_COLOR } from "../theme/colors";

type Props = {
  alertNo: string;
  dateLine: string;
  data?: IncidentPreviewData;
  onGoHome?: () => void;
};

function compactRef(alertNo: string) {
  const clean = String(alertNo || "").replace(/^#/, "").trim();
  if (!clean) return "#RPT-PENDING";
  if (clean.toUpperCase().startsWith("RPT-")) return `#${clean.toUpperCase()}`;
  return `#RPT-${clean.slice(-6).toUpperCase()}`;
}

function displayValue(value?: string) {
  const clean = String(value || "").trim();
  return clean || "-";
}

export default function IncidentLogConfirmedScreen({
  alertNo,
  dateLine,
  data,
  onGoHome,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 340;
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);

  const reportRef = useMemo(() => compactRef(alertNo), [alertNo]);
  const summaryDate = displayValue(data?.dateStr || dateLine);
  const summaryLocation = displayValue(data?.locationStr);

  if (showAiAnalysis) {
    return (
      <AiIncidentAnalysisScreen
        onBack={() => setShowAiAnalysis(false)}
        onGoHome={onGoHome}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={styles.page}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 14) + 24 },
          ]}
        >
          <View style={styles.successHeader}>
            <ConfirmedCheckSvg width={96} height={96} style={styles.checkIcon} />

            <Text style={styles.title} allowFontScaling={false}>
              Report Submitted{"\n"}Successfully
            </Text>
            <Text style={styles.subtitle}>
              Your incident report has been securely recorded and transmitted to the barangay office.
            </Text>
          </View>

          <View style={[styles.summaryCard, isCompact && styles.summaryCardCompact]}>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.refText} numberOfLines={1}>
                Incident Ref: {reportRef}
              </Text>
              <View style={styles.summaryLine}>
                <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                <Text style={styles.summaryDetail} numberOfLines={2}>
                  {summaryDate} • {summaryLocation}
                </Text>
              </View>
            </View>

            <Pressable style={[styles.viewDetailsBtn, isCompact && styles.viewDetailsBtnCompact]}>
              <Text style={styles.viewDetailsText} allowFontScaling={false}>
                View Details
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#001F3F" />
            </Pressable>
          </View>

          <View style={styles.nextHeader}>
            <Ionicons name="information-circle-outline" size={17} color="#636363" />
            <Text style={styles.nextTitle} allowFontScaling={false}>
              WHAT HAPPENS NEXT?
            </Text>
          </View>

          <View style={styles.timeline}>
            <View style={styles.timelineLine} />

            <View style={styles.timelineItem}>
              <View style={styles.timelineDotActive} />
              <Text style={styles.timelineText}>
                Our Barangay officials have been notified and will begin an initial review
                of your case within 24 hours.
              </Text>
            </View>

            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <Text style={styles.timelineTextMuted}>
                You can track the progress and upload additional evidence in the{" "}
                <Text style={styles.bold}>My Reports</Text> section.
              </Text>
            </View>

            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <Text style={styles.timelineTextMuted}>
                You will receive a real-time notification once the review is complete or
                if mediation is required.
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => setShowAiAnalysis(true)}
              style={({ pressed }) => [styles.aiBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.aiBtnText} allowFontScaling={false}>
                View AI Analysis
              </Text>
            </Pressable>

            <Pressable
              onPress={onGoHome}
              style={({ pressed }) => [styles.homeBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.homeBtnText} allowFontScaling={false}>
                Go back to Home
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function AiIncidentAnalysisScreen({
  onBack,
  onGoHome,
}: {
  onBack: () => void;
  onGoHome?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 340;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={styles.page}>
        <View style={styles.analysisHeader}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.analysisBackBtn}>
            <Ionicons name="chevron-back" size={31} color="#00518D" />
          </Pressable>
          <Text style={[styles.analysisTitle, isCompact && styles.analysisTitleCompact]} allowFontScaling={false}>
            AI Incident Analysis
          </Text>
          <View style={styles.analysisHeaderSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.analysisContent,
            { paddingBottom: Math.max(insets.bottom, 14) + 22 },
          ]}
        >
          <View style={styles.analysisIntroCard}>
            <Text style={styles.analysisIntroText}>
              The system analyzed your report and identified relevant information to help you
              review your submission.
            </Text>
          </View>

          <View style={styles.insightsCard}>
            <View style={styles.insightsHeader}>
              <Ionicons name="settings-outline" size={18} color="#001F3F" />
              <Text style={styles.insightsTitle} allowFontScaling={false}>
                AI Insights
              </Text>
            </View>

            <View style={styles.insightsBody}>
              <Text style={styles.analysisLabel} allowFontScaling={false}>
                Detected Categories
              </Text>
              <View style={styles.categoryRow}>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryText} allowFontScaling={false}>
                    Threats/Intimidation
                  </Text>
                </View>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryText} allowFontScaling={false}>
                    Harassment
                  </Text>
                </View>
              </View>

              <Text style={styles.analysisLabel} allowFontScaling={false}>
                Summary
              </Text>
              <Text style={styles.analysisSummary}>
                The report indicates a pattern of threatening behavior by a neighbor directed at
                the reporter near their residence.
              </Text>

              <Text style={styles.analysisLabel} allowFontScaling={false}>
                Key Indicators
              </Text>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Threat mentioned explicitly</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Repeated incidents indicated</Text>
              </View>
            </View>
          </View>

          <Text style={styles.frameworkTitle} allowFontScaling={false}>
            Applicable Legal Framework
          </Text>

          <View style={styles.frameworkCard}>
            <View style={styles.frameworkCorner} />
            <View style={styles.frameworkHeader}>
              <Ionicons name="hammer-outline" size={20} color="#111111" />
              <Text style={styles.frameworkLaw} allowFontScaling={false}>
                PD 1508
              </Text>
            </View>
            <Text style={styles.frameworkName}>Katarungang Pambarangay</Text>
            <Text style={styles.frameworkDescription}>
              Mandates the amicable settlement of disputes at the barangay level before filing
              a complaint in court.
            </Text>
          </View>

          <Pressable
            onPress={onGoHome}
            style={({ pressed }) => [styles.analysisHomeBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.analysisHomeText} allowFontScaling={false}>
              Go Back Home
            </Text>
          </Pressable>

          <View style={styles.secureFooter}>
            <View style={styles.secureRow}>
              <Ionicons name="lock-closed-outline" size={10} color="#7A7A7A" />
              <Text style={styles.secureText} allowFontScaling={false}>
                Secured by Blockchain Record
              </Text>
            </View>
            <Text style={styles.analysisDisclaimer}>
              This analysis is for guidance and transparency only. Barangay officials will conduct the official review and determine the appropriate actions.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const BG = "#F5F7FA";
const NAVY = PRIMARY_ACTION_COLOR;
const TEXT_DARK = "#344052";
const TEXT_MUTED = "#7A7A7A";

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  page: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  successHeader: {
    alignItems: "center",
  },
  checkIcon: {
    marginBottom: 22,
  },
  title: {
    fontSize: 18,
    lineHeight: 19,
    fontWeight: "900",
    color: TEXT_DARK,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: TEXT_MUTED,
    textAlign: "center",
  },
  summaryCard: {
    marginTop: 28,
    minHeight: 88,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E0E4EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  summaryCardCompact: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  summaryTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  refText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#515B67",
    marginBottom: 7,
  },
  summaryLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
  },
  summaryDetail: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
    color: "#001F3F",
  },
  viewDetailsBtn: {
    minWidth: 82,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  viewDetailsBtnCompact: {
    alignSelf: "flex-end",
    minHeight: 40,
  },
  viewDetailsText: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "800",
    color: "#000000",
    textAlign: "center",
  },
  nextHeader: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nextTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#515151",
  },
  timeline: {
    marginTop: 15,
    position: "relative",
    paddingLeft: 27,
    gap: 17,
  },
  timelineLine: {
    position: "absolute",
    top: 8,
    bottom: 5,
    left: 8,
    width: 2,
    backgroundColor: "#E4E8EE",
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  timelineDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#111111",
    marginLeft: -23,
    marginTop: 7,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9B9B9B",
    marginLeft: -23,
    marginTop: 7,
  },
  timelineText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    color: "#444444",
  },
  timelineTextMuted: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    color: "#777777",
  },
  bold: {
    fontWeight: "900",
    color: "#333333",
  },
  actions: {
    marginTop: 44,
    gap: 13,
  },
  aiBtn: {
    height: 46,
    borderRadius: 23,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  aiBtnText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  homeBtn: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#C9C9C9",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  homeBtnText: {
    fontSize: 16,
    fontWeight: "500",
    color: NAVY,
  },
  analysisHeader: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  analysisBackBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  analysisTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  analysisTitleCompact: {
    fontSize: 18,
  },
  analysisHeaderSpacer: {
    width: 38,
    height: 38,
  },
  analysisContent: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 15,
  },
  analysisIntroCard: {
    borderWidth: 1,
    borderColor: "#E4E8EE",
    borderRadius: 6,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingVertical: 19,
  },
  analysisIntroText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: TEXT_DARK,
  },
  insightsCard: {
    marginTop: 8,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  insightsHeader: {
    minHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#D7D7D7",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  insightsTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  insightsBody: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 9,
  },
  analysisLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    color: "#7A7A7A",
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 15,
  },
  categoryPill: {
    minHeight: 27,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#757575",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "900",
    color: TEXT_DARK,
  },
  analysisSummary: {
    marginBottom: 18,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 15,
    marginBottom: 7,
  },
  bullet: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "900",
    color: "#111111",
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: "#545454",
  },
  frameworkTitle: {
    marginTop: 12,
    marginLeft: 7,
    marginBottom: 3,
    fontSize: 16,
    fontWeight: "900",
    color: TEXT_DARK,
  },
  frameworkCard: {
    marginHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingTop: 15,
    paddingBottom: 15,
    overflow: "hidden",
  },
  frameworkCorner: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 73,
    height: 73,
    borderBottomLeftRadius: 73,
    backgroundColor: "#F0F0F0",
  },
  frameworkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  frameworkLaw: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111111",
  },
  frameworkName: {
    marginTop: 9,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "500",
    color: "#111111",
  },
  frameworkDescription: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  analysisHomeBtn: {
    marginTop: 40,
    height: 46,
    borderRadius: 23,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  analysisHomeText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  secureFooter: {
    marginTop: 11,
    alignItems: "center",
  },
  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  secureText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#7A7A7A",
  },
  analysisDisclaimer: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 8,
    lineHeight: 10,
    fontStyle: "italic",
    fontWeight: "500",
    color: "#8A8A8A",
  },
});
