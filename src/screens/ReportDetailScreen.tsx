// src/screens/ReportDetailScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

import type { TabKey } from "../components/BottomNavBar";
import LogoutModal from "../components/LogoutModal";
import IncidentVideoPreviewModal from "../components/IncidentVideoPreviewModal";
import ReportMessaging from "../components/ReportDetailsScreen/ReportMessaging";
import type { ReportContextData } from "../components/ReportDetailsScreen/ReportContextPanel";
import { Colors, useColors } from "../theme/colors";
import { createTypography } from "../theme/typography";

import type { ReportItem } from "./ReportScreen";
import {
  ReportDetailDto,
  buildReportPhotoUrl,
} from "../api/reports";
import { mobileQueryClient } from "../app/queryClient";
import { reportDetailQuery, reportKeys } from "../features/reports/queries";
import {
  getCaseStatusMeta,
  getProcessStageMeta,
  normalizeProcessStage,
} from "../utils/reportStatus";

// ✅ token + base url for cancel action
import { getAccessToken } from "../auth/session";
import { requestJson } from "../api/http";

type ViewKey = "details" | "timeline";

type Props = {
  report: ReportItem;

  initialTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  onQuickExit?: () => void;

  onBack?: () => void;
};

function prettyStatus(s?: string) {
  if (!s) return "PENDING";
  return String(s).toUpperCase();
}

function formatTimelineStamp(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMediationOutcome(value?: string) {
  const outcome = String(value || "").trim().toLowerCase();
  if (outcome === "settlement-reached") return "Settlement Reached";
  if (outcome === "no-settlement") return "No Settlement";
  if (outcome === "rescheduled") return "Rescheduled";
  if (outcome === "did-not-proceed") return "Did Not Proceed";
  return outcome
    ? outcome
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
    : "Not Yet Confirmed";
}

function formatAttendance(value?: string) {
  const attendance = String(value || "").trim().toLowerCase();
  if (!attendance) return "Not recorded";
  return attendance.charAt(0).toUpperCase() + attendance.slice(1);
}

function isAbortError(err: any) {
  const name = err?.name || "";
  const msg = String(err?.message || "");
  return name === "AbortError" || msg.toLowerCase().includes("aborted");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function escHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReportLocationMapHtml(
  coords: { latitude: number; longitude: number },
  label: string
) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #F8FBFF; }
    .popup-title { font: 700 13px sans-serif; color: #0B2B45; margin-bottom: 4px; }
    .popup-text { font: 12px/1.5 sans-serif; color: #475569; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${coords.latitude}, ${coords.longitude}], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '\\u00a9 OpenStreetMap'
    }).addTo(map);

    L.circle([${coords.latitude}, ${coords.longitude}], {
      radius: 30,
      color: '#60A5FA',
      fillColor: '#93C5FD',
      fillOpacity: 0.24,
      weight: 1
    }).addTo(map);

    var marker = L.circleMarker([${coords.latitude}, ${coords.longitude}], {
      radius: 10,
      color: '#FFFFFF',
      weight: 3,
      fillColor: '#07519C',
      fillOpacity: 1
    }).addTo(map);

    marker.bindPopup(
      '<div class="popup-title">Incident location</div>' +
      '<div class="popup-text">${escHtml(label || "Saved report location")}</div>'
    ).openPopup();
  <\/script>
</body>
</html>`;
}

const BG = "#FFFFFF";
const SURFACE = "#FFFFFF";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";
const TEXT_MUTED = "#6E7D90";

// ✅ API base url helper (same pattern as your other screens)
function isObjectId24(v: string) {
  return /^[a-fA-F0-9]{24}$/.test(String(v || "").trim());
}

function cleanReportFieldValue(value: unknown) {
  const cleaned = String(value ?? "").trim();
  if (!cleaned || /^[\u002D\u2013\u2014]+$/.test(cleaned)) return "";
  return cleaned;
}

function firstReportFieldValue(values: unknown[]) {
  for (const value of values) {
    const cleaned = cleanReportFieldValue(value);
    if (cleaned) return cleaned;
  }
  return "";
}

export default function ReportDetailScreen({
  report,
  initialTab = "Reports",
  onTabChange,
  onQuickExit,
  onBack,
}: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const shortSide = Math.min(width, height);
  const isTablet = shortSide >= 600;
  const isWideLayout = width >= 600;
  const isNarrow = width < 360;

  const wScale = clamp(width / 375, 0.92, isTablet ? 1.08 : 1.18);
  const hScale = clamp(height / 812, 0.92, isTablet ? 1.08 : 1.18);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const PRIMARY: string = String((Colors as any).primary ?? "#0B5AA7");

  const CONTENT_MAX_W = isWideLayout ? Math.min(720, Math.round(width * 0.92)) : width;
  const CONTENT_SIDE_PAD = isTablet ? scale(18) : scale(14);

  const thumbW = clamp(
    Math.round(width * (isTablet ? 0.22 : 0.34)),
    scale(110),
    scale(isTablet ? 190 : 140)
  );
  const thumbH = clamp(Math.round(thumbW * 0.7), vscale(74), vscale(110));

  const styles = useMemo(
    () =>
      makeStyles({
        scale,
        vscale,
        primary: PRIMARY,
        isTablet,
        isNarrow,
        contentMaxW: CONTENT_MAX_W,
        sidePad: CONTENT_SIDE_PAD,
        thumbW,
        thumbH,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, PRIMARY, isTablet, isNarrow, CONTENT_MAX_W, CONTENT_SIDE_PAD, thumbW, thumbH]
  );

  const [view, setView] = useState<ViewKey>("details");

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detail, setDetail] = useState<ReportDetailDto | null>(null);
  const [evidenceAuthHeaders, setEvidenceAuthHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    getAccessToken().then((token) => {
      if (mounted && token) setEvidenceAuthHeaders({ Authorization: `Bearer ${token}` });
    }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const [cancelling, setCancelling] = useState(false);
  const [cancelReportModalVisible, setCancelReportModalVisible] = useState(false);

  const reportId = useMemo(() => {
    const id = (report as any)?.id || (report as any)?._id || "";
    return String(id || "").trim();
  }, [report]);

  const resolvedReportId = useMemo(() => {
    if (isObjectId24(reportId)) return reportId;
    const detailId = String((detail as any)?._id || "").trim();
    if (isObjectId24(detailId)) return detailId;
    return reportId;
  }, [reportId, detail]);

  const detailAbortRef = useRef<AbortController | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        detailAbortRef.current?.abort();
      } catch {}
    };
  }, []);

  const detailInFlightRef = useRef(false);

  const lastDetailLoadedIdRef = useRef<string>("");

  const loadDetail = useCallback(
    async (force = false) => {
      if (!reportId) {
        setDetailError("Missing report id.");
        return;
      }

      if (!force && lastDetailLoadedIdRef.current === reportId) return;
      if (detailInFlightRef.current) return;

      try {
        detailAbortRef.current?.abort();
      } catch {}
      const controller = new AbortController();
      detailAbortRef.current = controller;

      detailInFlightRef.current = true;
      setLoadingDetail(true);
      setDetailError("");

      try {
        if (force) {
          await mobileQueryClient.invalidateQueries({
            queryKey: reportKeys.detail(reportId),
          });
        }
        const d = await mobileQueryClient.fetchQuery(reportDetailQuery(reportId));

        if (!mountedRef.current) return;
        if (controller.signal.aborted) return;

        lastDetailLoadedIdRef.current = reportId;
        setDetail(d);
      } catch (e: any) {
        if (!mountedRef.current) return;
        if (isAbortError(e)) return;
        setDetailError(e?.message || "Failed to load report detail");
      } finally {
        if (mountedRef.current && !controller.signal.aborted) setLoadingDetail(false);
        detailInFlightRef.current = false;
      }
    },
    [reportId]
  );

  useEffect(() => {
    detailAbortRef.current?.abort();
    detailInFlightRef.current = false;
    lastDetailLoadedIdRef.current = "";

    setDetail(null);
    setDetailError("");
    setLoadingDetail(false);

    if (reportId) void loadDetail();
    else setDetailError("Missing report id.");
  }, [reportId, loadDetail]);

  useEffect(() => {
    if (!reportId) return;

    const timer = setInterval(() => {
      void loadDetail(true);
    }, 15_000);

    return () => clearInterval(timer);
  }, [loadDetail, reportId]);
  const requestCancelReport = useCallback(() => {
    if (!reportId) {
      Alert.alert("Missing report id", "Cannot cancel because reportId is empty.");
      return;
    }
    if (cancelling) return;

    setCancelReportModalVisible(true);
  }, [reportId, cancelling]);

  const closeCancelReportModal = useCallback(() => {
    if (cancelling) return;
    setCancelReportModalVisible(false);
  }, [cancelling]);

  const confirmCancelReport = useCallback(async () => {
    if (!reportId) {
      Alert.alert("Missing report id", "Cannot cancel because reportId is empty.");
      return;
    }
    if (cancelling) return;

    setCancelReportModalVisible(false);
    setCancelling(true);
    try {
      if (!isObjectId24(resolvedReportId)) {
        throw new Error("Cannot cancel yet. Please wait for report details to load, then try again.");
      }

      await requestJson({
        method: "POST",
        path: `/api/mobile/v1/reports/${encodeURIComponent(resolvedReportId)}/cancel`,
        body: { reason: "User cancelled" },
        auth: true,
      });
      await mobileQueryClient.invalidateQueries({ queryKey: reportKeys.all });

      setDetail((prev) => {
        const base: any = prev ?? {};
        return {
          ...base,
          status: "CANCELLED",
          currentProcessStage: "CANCELLED",
          caseStatus: "Completed",
          updatedAt: new Date().toISOString(),
        } as any;
      });

      lastDetailLoadedIdRef.current = "";
      await loadDetail(true);

      Alert.alert("Cancelled", "Your report has been cancelled.");
    } catch (e: any) {
      Alert.alert("Cancel failed", e?.message || "Could not cancel report.");
    } finally {
      if (mountedRef.current) setCancelling(false);
    }
  }, [reportId, resolvedReportId, cancelling, loadDetail]);

  const incidentTitle =
    detail?.incidentType ||
    (report as any)?.incidentTitle ||
    (report as any)?.incidentType ||
    report.title ||
    "Incident";

  const incidentNarrative =
    firstReportFieldValue([
      detail?.details,
      (detail as any)?.narrative,
      (report as any)?.details,
      report.detail,
    ]) || "None";

  const complaintValue = firstReportFieldValue([
    detail?.offenderName,
    (detail as any)?.complaint,
    (report as any)?.offenderName,
    (report as any)?.complaint,
  ]);
  const complaintName = complaintValue || "None";

  const witnessName = firstReportFieldValue([
    detail?.witnessName,
    (report as any)?.witnessName,
  ]);
  const witnessRole = firstReportFieldValue([
    detail?.witnessType,
    (report as any)?.witnessRole,
    (report as any)?.witnessType,
  ]);

  const locationValue = firstReportFieldValue([
    detail?.locationStr,
    (report as any)?.locationStr,
    (report as any)?.location,
  ]);
  const locationLabel = locationValue || "Not shared";
  const locationLatitude = Number(detail?.latitude ?? (report as any)?.latitude);
  const locationLongitude = Number(detail?.longitude ?? (report as any)?.longitude);
  const hasLocationCoords =
    Number.isFinite(locationLatitude) &&
    Number.isFinite(locationLongitude) &&
    Math.abs(locationLatitude) <= 90 &&
    Math.abs(locationLongitude) <= 180;
  const [showLocationMap, setShowLocationMap] = useState(false);
  const reportLocationMapHtml = useMemo(() => {
    if (!hasLocationCoords) return "";
    return buildReportLocationMapHtml(
      { latitude: locationLatitude, longitude: locationLongitude },
      locationLabel
    );
  }, [hasLocationCoords, locationLabel, locationLatitude, locationLongitude]);

  useEffect(() => {
    if (!hasLocationCoords) {
      setShowLocationMap(false);
    }
  }, [hasLocationCoords, reportId]);

  const processStage =
    detail?.currentProcessStage ||
    detail?.status ||
    (report as any)?.currentProcessStage ||
    (report as any)?.status;
  const statusUpper = prettyStatus(processStage);
  const processStageMeta = getProcessStageMeta(processStage);
  const statusLabel = processStageMeta.label;
  const caseStatusMeta = getCaseStatusMeta(
    detail?.caseStatus || (report as any)?.caseStatus,
    processStage
  );

  const dateValue = firstReportFieldValue([
    detail?.dateStr,
    (report as any)?.dateStr,
    report.dateLeft,
  ]);
  const timeValue = firstReportFieldValue([
    detail?.timeStr,
    (report as any)?.timeStr,
    report.timeLeft,
  ]);
  const dateLabel = dateValue || "None";
  const timeLabel = timeValue || "None";

  const photosRaw = ((detail?.photos ?? (report as any)?.photos) || []) as any[];
  const videosRaw = ((detail?.videos ?? (report as any)?.videos) || []) as any[];

  const photoUrls = useMemo(() => {
    const urls = photosRaw.map((p) => buildReportPhotoUrl(reportId, p)).filter(Boolean) as string[];
    if (__DEV__) {
      console.log("[ReportDetail] photosRaw:", JSON.stringify(photosRaw));
      console.log("[ReportDetail] photoUrls:", urls);
    }
    return urls;
  }, [photosRaw, reportId]);

  const videoUrls = useMemo(() => {
    return videosRaw.map((p) => buildReportPhotoUrl(reportId, p)).filter(Boolean) as string[];
  }, [videosRaw, reportId]);

  const evidenceItems = useMemo(
    () => [
      ...photoUrls.map((uri, index) => ({ type: "photo" as const, uri, index })),
      ...videoUrls.map((uri, index) => ({ type: "video" as const, uri, index })),
    ],
    [photoUrls, videoUrls]
  );
  const evidenceCount = evidenceItems.length;

  const reportCode = String((report as any)?.alertNo ?? (reportId ? `#${reportId.slice(-4)}` : "#—"));

  const reportRef = reportCode.trim().toUpperCase().startsWith("REP") ? reportCode : `REP ${reportCode}`;
  const messageReference = reportCode.replace(/^REP\s*/i, "").trim();
  const messageModalTitle = messageReference ? `Report ${messageReference}` : "Report Messages";
  const canChat =
    !["Completed", "Archived"].includes(caseStatusMeta.label) &&
    !["CANCELLED", "CANCELED", "RESOLVED"].includes(statusUpper);
  const reportContext = useMemo<ReportContextData>(
    () => ({
      reference: messageReference || reportRef,
      title: incidentTitle,
      description: incidentNarrative,
      statusLabel: caseStatusMeta.label,
      statusColor: caseStatusMeta.color,
      statusBackgroundColor: caseStatusMeta.bg,
      processStageLabel: statusLabel,
      incidentDate: dateLabel,
      incidentTime: timeLabel,
      location: locationLabel,
      reportedPerson: complaintValue,
      witnessName,
      witnessType: witnessRole,
      evidenceCount,
    }),
    [
      caseStatusMeta.bg,
      caseStatusMeta.color,
      caseStatusMeta.label,
      complaintValue,
      dateLabel,
      evidenceCount,
      incidentNarrative,
      incidentTitle,
      locationLabel,
      messageReference,
      reportRef,
      statusLabel,
      timeLabel,
      witnessName,
      witnessRole,
    ]
  );

  const workflowEvents = useMemo(() => {
    const events = Array.isArray(detail?.actionLog)
      ? detail.actionLog
          .filter((entry) => entry?.status)
          .map((entry) => ({
            title: String(entry.status || "Case updated"),
            meta: formatTimelineStamp(entry.date) || "Time unavailable",
            body:
              String(entry.result || "").trim() ||
              (entry.actorName
                ? `Recorded by ${entry.actorName}.`
                : "Case activity recorded by TahananSafe."),
            timestamp: new Date(entry.date || 0).getTime(),
          }))
      : [];

    if (!events.some((entry) => entry.title.toLowerCase().includes("submitted"))) {
      events.push({
        title: "Report Submitted",
        meta:
          formatTimelineStamp(detail?.createdAt || (report as any)?.createdAt) ||
          [dateValue, timeValue].filter(Boolean).join(" • ") ||
          "Submission date unavailable",
        body: "Your report was recorded and sent to the barangay office.",
        timestamp: new Date(detail?.createdAt || (report as any)?.createdAt || 0).getTime(),
      });
    }

    return events.sort((left, right) => left.timestamp - right.timestamp);
  }, [dateValue, detail?.actionLog, detail?.createdAt, report, timeValue]);

  const submittedTimelineMeta =
    formatTimelineStamp(detail?.createdAt || (report as any)?.createdAt) ||
    [dateValue, timeValue].filter(Boolean).join(" • ") ||
    "Pending";
  const latestTimelineMeta =
    formatTimelineStamp(detail?.updatedAt || (report as any)?.updatedAt) || submittedTimelineMeta;

  const currentTimelineStatus = statusLabel;
  const caseProgressIndex = useMemo(() => {
    const stage = normalizeProcessStage(processStage);
    if (["ARCHIVED", "BARANGAY_PROCESSING_COMPLETED", "BARANGAY_PROCESSING_COMPLETED_NO_SETTLEMENT"].includes(stage)) return 6;
    if (stage === "SETTLEMENT_DOCUMENTATION") return 5;
    if (stage === "MEDIATION_CONDUCTED") return 4;
    if (stage === "MEDIATION_SCHEDULED") return 3;
    if (stage === "MEDIATION_SCHEDULING") return 2;
    if (stage === "FOR_OFFICIAL_REVIEW") return 1;
    return 0;
  }, [processStage]);

  const caseProgressSteps = useMemo(() => {
    const finalStageTitle =
      normalizeProcessStage(processStage) === "BARANGAY_PROCESSING_COMPLETED_NO_SETTLEMENT"
        ? "Barangay Processing Completed — No Settlement"
        : "Barangay Processing Completed";
    const titles = [
      "Report Submitted",
      "For Official Review",
      "Mediation Scheduling",
      "Mediation Scheduled",
      "Mediation Conducted",
      "Settlement Documentation",
      finalStageTitle,
    ];
    return titles.map((title, index) => {
      const matchingEvent = workflowEvents.find((event) => {
        const eventTitle = event.title.toLowerCase();
        const target = title.toLowerCase();
        if (index === 1) return eventTitle.includes("viewed") || eventTitle.includes("official review");
        if (index === 2) return eventTitle.includes("mediation selected") || eventTitle.includes("scheduling");
        if (index === 3) return eventTitle.includes("mediation scheduled");
        if (index === 4) return eventTitle.includes("mediation record") || eventTitle.includes("mediation conducted");
        if (index === 5) return eventTitle.includes("outcome confirmed") || eventTitle.includes("settlement");
        if (index === 6) return eventTitle.includes("processing completed") || eventTitle.includes("archived");
        return eventTitle.includes(target);
      });
      return {
        title,
        complete: index <= caseProgressIndex,
        meta:
          index <= caseProgressIndex
            ? matchingEvent?.meta || (index === 0 ? submittedTimelineMeta : latestTimelineMeta)
            : "Pending",
      };
    });
  }, [caseProgressIndex, latestTimelineMeta, processStage, submittedTimelineMeta, workflowEvents]);

  const mediationSchedule = detail?.mediationSchedule;
  const mediationDate = mediationSchedule?.scheduledAt
    ? new Date(mediationSchedule.scheduledAt)
    : null;
  const validMediationDate = Boolean(mediationDate && !Number.isNaN(mediationDate.getTime()));
  const releasedDocuments = Array.isArray(detail?.caseDocuments)
    ? detail.caseDocuments.filter((document) => document.status === "released")
    : [];
  const mediationRecord =
    detail?.mediationRecord?.status === "confirmed" ? detail.mediationRecord : null;
  const mediationOutcomeLabel = formatMediationOutcome(mediationRecord?.outcome);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [previewVideoUri, setPreviewVideoUri] = useState<string | null>(null);

  const openViewer = useCallback(
    (idx: number) => {
      if (!photoUrls?.length) return;
      const safeIdx = Math.max(0, Math.min(idx, photoUrls.length - 1));
      setViewerIndex(safeIdx);
      setViewerVisible(true);
    },
    [photoUrls]
  );

  const closeViewer = useCallback(() => setViewerVisible(false), []);
  const goPrev = useCallback(() => setViewerIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setViewerIndex((i) => Math.min(photoUrls.length - 1, i + 1)), [photoUrls.length]);

  const handleViewAiAnalysis = useCallback(() => {
    const ai = (detail as any)?.ai || (report as any)?.ai;
    if (!ai) {
      Alert.alert("AI Analysis", "AI analysis is not available for this report yet.");
      return;
    }

    const analysisStatus = String(ai.status || "").toLowerCase();
    if (["pending", "processing", "retrying"].includes(analysisStatus)) {
      Alert.alert(
        "AI Analysis",
        "Analysis is still processing. The report is already submitted and can be reviewed while this completes."
      );
      return;
    }
    if (["failed", "skipped"].includes(analysisStatus)) {
      Alert.alert(
        "AI Analysis",
        "Automated analysis is currently unavailable. This does not affect the submitted report."
      );
      return;
    }

    const type = ai.incident_type || ai.incidentType || ai.category || "Not specified";
    const risk = ai.risk_level || ai.riskLevel || ai.priority_level || "Not specified";
    const summary = ai.summary || ai.recommendation || ai.explanation || "No AI summary provided.";
    Alert.alert("AI Analysis", `Category: ${type}\nRisk: ${risk}\n\n${summary}`);
  }, [detail, report]);

  const canPrev = viewerIndex > 0;
  const canNext = viewerIndex < photoUrls.length - 1;

  const canCancel =
    !!resolvedReportId &&
    isObjectId24(resolvedReportId) &&
    caseStatusMeta.label === "Submitted" &&
    statusUpper !== "CANCELLED";
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: TC.screenBg }]} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

      <LogoutModal
        visible={cancelReportModalVisible}
        title="Cancel this report?"
        message="This will mark your incident report as CANCELLED. You can still view it in the Cancelled tab."
        confirmLabel="Yes, Cancel"
        confirmColor="#DC2626"
        onCancel={closeCancelReportModal}
        onConfirm={confirmCancelReport}
      />

      {/* Image Viewer Modal */}
      <Modal visible={viewerVisible} animationType="fade" transparent onRequestClose={closeViewer}>
        <View style={styles.viewerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeViewer} />

          <View style={styles.viewerTopBar}>
            <Pressable
              onPress={closeViewer}
              hitSlop={12}
              style={({ pressed }) => [styles.viewerIconBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="close" size={styles._viewerIcon} color="#FFFFFF" />
            </Pressable>

            <Text style={styles.viewerCounter} numberOfLines={1}>
              {photoUrls.length ? `${viewerIndex + 1} / ${photoUrls.length}` : ""}
            </Text>

            <View style={{ width: styles._viewerPad, height: styles._viewerPad }} />
          </View>

          <View style={styles.viewerStage}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.viewerStageInner}
              minimumZoomScale={Platform.OS === "ios" ? 1 : undefined}
              maximumZoomScale={Platform.OS === "ios" ? 3 : undefined}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              bounces={false}
              centerContent
            >
              {!!photoUrls[viewerIndex] ? (
                <Image
                  source={{ uri: photoUrls[viewerIndex], headers: evidenceAuthHeaders }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              ) : null}
            </ScrollView>

            {photoUrls.length > 1 ? (
              <>
                <Pressable
                  onPress={goPrev}
                  disabled={!canPrev}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.viewerNavBtn,
                    styles.viewerNavLeft,
                    pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
                    !canPrev && { opacity: 0.35 },
                  ]}
                >
                  <Ionicons name="chevron-back" size={styles._viewerIcon} color="#FFFFFF" />
                </Pressable>

                <Pressable
                  onPress={goNext}
                  disabled={!canNext}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.viewerNavBtn,
                    styles.viewerNavRight,
                    pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
                    !canNext && { opacity: 0.35 },
                  ]}
                >
                  <Ionicons name="chevron-forward" size={styles._viewerIcon} color="#FFFFFF" />
                </Pressable>
              </>
            ) : null}
          </View>

          <Text style={styles.viewerHint}>Tap outside to close{Platform.OS === "ios" ? " • Pinch to zoom" : ""}</Text>
        </View>
      </Modal>

      <IncidentVideoPreviewModal
        visible={!!previewVideoUri}
        uri={previewVideoUri}
        title="Video Evidence"
        headers={evidenceAuthHeaders}
        onClose={() => setPreviewVideoUri(null)}
      />

      <View style={[styles.page, { backgroundColor: TC.screenBg }]}>
        <View style={[styles.heroWrap, { backgroundColor: TC.screenBg }]}>
          <View style={styles.reportTopBar}>
            <Pressable
              onPress={onBack}
              hitSlop={12}
              style={({ pressed }) => [styles.reportCloseBtn, pressed && { opacity: 0.72 }]}
            >
              <Ionicons name="close" size={28} color="#344052" />
            </Pressable>

            <Text style={styles.reportScreenTitle} numberOfLines={1} allowFontScaling={false}>
              {view === "timeline" ? "Timeline" : "Report Details"}
            </Text>

            <View style={styles.reportHeaderSpacer} />
          </View>

          <View style={styles.reportHeroContent}>
            <View style={styles.reportTabsRow}>
              {(["details", "timeline"] as const).map((key) => {
                const active = view === key;
                const label = key === "details" ? "Details" : "Timeline";
                return (
                  <Pressable
                    key={key}
                    onPress={() => setView(key)}
                    style={({ pressed }) => [
                      styles.reportTabPill,
                      active ? styles.reportTabPillActive : styles.reportTabPillInactive,
                      pressed && { opacity: 0.86 },
                    ]}
                  >
                    <Text style={[styles.reportTabText, active && styles.reportTabTextActive]} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.reportSummaryBlock}>
              <View style={styles.reportSummaryTextBlock}>
                <Text style={styles.reportRefText} numberOfLines={1}>
                  {reportRef}
                </Text>
                <Text style={styles.reportTitleText} numberOfLines={2}>
                  {incidentTitle}
                </Text>
              </View>
              <View style={[styles.reportStatusChip, { backgroundColor: caseStatusMeta.bg }]}>
                <View
                  accessibilityElementsHidden
                  style={[styles.reportStatusDot, { backgroundColor: caseStatusMeta.color }]}
                />
                <Text
                  style={[styles.reportStatusText, { color: caseStatusMeta.color }]}
                  numberOfLines={1}
                >
                  {caseStatusMeta.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {view === "details" ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={[styles.detailsScroll, { backgroundColor: TC.screenBg }]}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, vscale(18)) + vscale(34) }]}
          >
            {!reportId ? (
              <View style={styles.bannerDanger}>
                <Ionicons name="warning-outline" size={styles._miniIcon} color="#B91C1C" />
                <Text style={styles.bannerDangerText}>Missing report id. Open this report again from Reports list.</Text>
              </View>
            ) : loadingDetail ? (
              <View style={styles.bannerNeutral}>
                <ActivityIndicator />
                <Text style={styles.bannerNeutralText}>Loading report detail…</Text>
              </View>
            ) : detailError ? (
              <View style={styles.bannerDanger}>
                <Ionicons name="alert-circle-outline" size={styles._miniIcon} color="#B91C1C" />
                <Text style={styles.bannerDangerText}>{detailError}</Text>
                <Pressable
                  onPress={() => {
                    lastDetailLoadedIdRef.current = "";
                    loadDetail(true);
                  }}
                  style={({ pressed }) => [styles.bannerBtn, pressed && { opacity: 0.92 }]}
                >
                  <Text style={styles.bannerBtnText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.reportInfoCard}>
              <Text style={styles.reportCardTitle}>Incident Information</Text>

              <Text style={styles.reportFieldLabel}>Description</Text>
              <View style={styles.reportTextBoxLarge}>
                <Text style={styles.reportBoxText}>{incidentNarrative}</Text>
              </View>

              <Text style={styles.reportFieldLabel}>Complaint</Text>
              <View style={styles.reportTextBox}>
                <Text style={styles.reportBoxText} numberOfLines={2}>
                  {complaintName}
                </Text>
              </View>

              <View style={styles.reportWitnessRow}>
                <View style={styles.reportWitnessCell}>
                  <Text style={styles.reportFieldLabel}>Witness</Text>
                  <View style={styles.reportTextBox}>
                    <Text style={styles.reportBoxText} numberOfLines={2}>
                      {witnessName || "None"}
                    </Text>
                  </View>
                </View>
                <View style={styles.reportWitnessCell}>
                  <Text style={styles.reportFieldLabel}>Relationship</Text>
                  <View style={styles.reportTextBox}>
                    <Text style={styles.reportBoxText} numberOfLines={2}>
                      {witnessRole || "None"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.reportDateTimeRow}>
                <View style={styles.reportDateTimeCell}>
                  <Text style={styles.reportFieldLabel}>Date</Text>
                  <Text style={styles.reportPlainText}>{dateLabel}</Text>
                </View>
                <View style={styles.reportDateTimeCell}>
                  <Text style={styles.reportFieldLabel}>Time</Text>
                  <Text style={styles.reportPlainText}>{timeLabel}</Text>
                </View>
              </View>

              <View style={styles.reportLocationHeader}>
                <Text style={styles.reportFieldLabel}>Location</Text>
                <Pressable
                  onPress={() => {
                    if (!hasLocationCoords) {
                      Alert.alert("Map unavailable", "This report does not have saved map coordinates.");
                      return;
                    }
                    setShowLocationMap((prev) => !prev);
                  }}
                  style={({ pressed }) => [
                    styles.locationMapBtn,
                    pressed && { opacity: 0.86 },
                    !hasLocationCoords && styles.locationMapBtnDisabled,
                  ]}
                >
                  <Ionicons
                    name={showLocationMap ? "map" : "map-outline"}
                    size={styles._miniIcon}
                    color={hasLocationCoords ? PRIMARY : "#94A3B8"}
                  />
                  <Text
                    style={[
                      styles.locationMapBtnText,
                      !hasLocationCoords && styles.locationMapBtnTextDisabled,
                    ]}
                  >
                    {showLocationMap ? "Hide Map" : "Show in Map"}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.reportPlainText}>{locationLabel}</Text>
              {showLocationMap && hasLocationCoords && reportLocationMapHtml ? (
                <View style={styles.locationMapCard}>
                  <WebView
                    source={{ html: reportLocationMapHtml }}
                    originWhitelist={["*"]}
                    javaScriptEnabled
                    domStorageEnabled
                    scrollEnabled={false}
                    nestedScrollEnabled={false}
                    style={styles.locationMapWebview}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.reportEvidenceCard}>
              <View style={styles.reportEvidenceHeader}>
                <Text style={styles.reportCardTitle}>Evidence</Text>
                <Text style={styles.reportEvidenceCount}>
                  {evidenceCount} {evidenceCount === 1 ? "File" : "Files"}
                </Text>
              </View>

              {evidenceItems.length > 0 ? (
                <View style={styles.reportEvidenceGrid}>
                  {evidenceItems.map((item) =>
                    item.type === "photo" ? (
                      <Pressable
                        key={`photo-${item.index}`}
                        onPress={() => openViewer(item.index)}
                        style={({ pressed }) => [styles.reportEvidenceThumb, pressed && { opacity: 0.9 }]}
                      >
                        <Image
                          source={{ uri: item.uri, headers: evidenceAuthHeaders }}
                          style={styles.reportEvidenceImage}
                          resizeMode="cover"
                          onError={(e) => {
                            if (__DEV__) console.log("[ReportDetail] Image load error:", item.uri, e.nativeEvent?.error);
                          }}
                        />
                      </Pressable>
                    ) : (
                      <Pressable
                        key={`video-${item.index}`}
                        onPress={() => setPreviewVideoUri(item.uri)}
                        style={({ pressed }) => [styles.reportEvidenceThumb, styles.reportVideoThumb, pressed && { opacity: 0.9 }]}
                      >
                        <Ionicons name="play-circle" size={styles._iconSize + 8} color="#FFFFFF" />
                        <Text style={styles.reportVideoText}>Video</Text>
                      </Pressable>
                    )
                  )}
                </View>
              ) : (
                <View style={styles.emptyEvidence}>
                  <Ionicons name="image-outline" size={styles._emptyIcon} color="#94A3B8" />
                  <Text style={styles.emptyEvidenceText}>No uploaded evidence.</Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={handleViewAiAnalysis}
              style={({ pressed }) => [styles.reportAiButton, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.reportAiButtonText}>View AI Analysis</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={[styles.detailsScroll, { backgroundColor: TC.screenBg }]}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, vscale(18)) + vscale(34) }]}
          >
            <View style={styles.timelineProgressCard}>
              <Text style={styles.timelineSectionTitle} allowFontScaling={false}>Case Progress</Text>
              <View style={styles.caseProgressList}>
                {caseProgressSteps.map((step) => (
                  <View key={step.title} style={styles.caseProgressRow}>
                    <View style={[styles.caseProgressDot, step.complete ? styles.caseProgressDotDone : styles.caseProgressDotPending]}>
                      {step.complete ? (
                        <Ionicons name="checkmark" size={styles._caseCheckIcon} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <View style={styles.caseProgressTextWrap}>
                      <Text
                        style={[
                          styles.caseProgressTitle,
                          !step.complete && styles.caseProgressTitlePending,
                        ]}
                        allowFontScaling={false}
                      >
                        {step.title}
                      </Text>
                      <Text
                        style={[
                          styles.caseProgressMeta,
                          !step.complete && styles.caseProgressMetaPending,
                        ]}
                        allowFontScaling={false}
                      >
                        {step.meta}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.currentStatusCard}>
              <View style={styles.currentStatusIcon}>
                <Ionicons name="calendar-number-outline" size={styles._iconSize} color="#111827" />
              </View>
              <View style={styles.currentStatusTextWrap}>
                <Text style={styles.currentStatusLabel} allowFontScaling={false}>Current Process Stage</Text>
                <Text style={styles.currentStatusValue} allowFontScaling={false}>{currentTimelineStatus}</Text>
              </View>
            </View>

            <View style={styles.timelineInfoCard}>
              <View style={styles.timelineCardHeaderRow}>
                <Ionicons name="calendar-outline" size={styles._iconSize} color="#718093" />
                <Text style={styles.timelineSectionTitle} allowFontScaling={false}>Mediation Schedule</Text>
              </View>
              {validMediationDate && mediationDate ? (
                <View style={styles.mediationScheduleBox}>
                  <View style={styles.mediationDateBadge}>
                    <Text style={styles.mediationMonth} allowFontScaling={false}>
                      {mediationDate.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
                    </Text>
                    <Text style={styles.mediationDay} allowFontScaling={false}>
                      {mediationDate.getDate()}
                    </Text>
                  </View>
                  <View style={styles.mediationScheduleText}>
                    <Text style={styles.mediationTime} allowFontScaling={false}>
                      {mediationDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </Text>
                    <Text style={styles.mediationPlace} allowFontScaling={false}>
                      {mediationSchedule?.venue || "Venue to be announced"}
                    </Text>
                    <Text style={styles.certSubtitle} allowFontScaling={false}>
                      {mediationSchedule?.status === "completed" ? "Session completed" : "Confirmed schedule"}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyEvidence}>
                  <Ionicons name="calendar-clear-outline" size={styles._emptyIcon} color="#94A3B8" />
                  <Text style={styles.emptyEvidenceText}>No mediation has been scheduled.</Text>
                </View>
              )}
            </View>

            <View style={styles.timelineInfoCard}>
              <View style={styles.timelineCardHeaderRow}>
                <Ionicons name="checkmark-done-outline" size={styles._iconSize} color="#718093" />
                <Text style={styles.timelineSectionTitle} allowFontScaling={false}>Mediation Outcome</Text>
              </View>
              {mediationRecord ? (
                <View style={styles.outcomeBox}>
                  <View style={styles.outcomeTitleRow}>
                    <Text style={styles.outcomeTitle} allowFontScaling={false}>
                      {mediationOutcomeLabel}
                    </Text>
                    <View style={styles.outcomeConfirmedBadge}>
                      <Text style={styles.outcomeConfirmedText} allowFontScaling={false}>Confirmed</Text>
                    </View>
                  </View>
                  <View style={styles.outcomeAttendanceRow}>
                    <View style={styles.outcomeAttendanceCell}>
                      <Text style={styles.outcomeMetaLabel} allowFontScaling={false}>Complainant</Text>
                      <Text style={styles.outcomeMetaValue} allowFontScaling={false}>
                        {formatAttendance(mediationRecord.complainantAttendance)}
                      </Text>
                    </View>
                    <View style={styles.outcomeAttendanceCell}>
                      <Text style={styles.outcomeMetaLabel} allowFontScaling={false}>Respondent</Text>
                      <Text style={styles.outcomeMetaValue} allowFontScaling={false}>
                        {formatAttendance(mediationRecord.respondentAttendance)}
                      </Text>
                    </View>
                  </View>
                  {mediationRecord.captainRemarks ? (
                    <Text style={styles.outcomeRemarks} allowFontScaling={false}>
                      Captain's remarks: {mediationRecord.captainRemarks}
                    </Text>
                  ) : null}
                  {mediationRecord.confirmedAt ? (
                    <Text style={styles.certSubtitle} allowFontScaling={false}>
                      Confirmed {formatTimelineStamp(mediationRecord.confirmedAt)}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.emptyEvidence}>
                  <Ionicons name="hourglass-outline" size={styles._emptyIcon} color="#94A3B8" />
                  <Text style={styles.emptyEvidenceText}>No mediation outcome has been confirmed.</Text>
                </View>
              )}
            </View>

            <View style={styles.timelineInfoCard}>
              <Text style={styles.timelineSectionTitle} allowFontScaling={false}>Case Updates</Text>
              <View style={styles.updateList}>
                {workflowEvents.length ? (
                  [...workflowEvents].reverse().slice(0, 6).map((event, index) => (
                    <View
                      key={`${event.title}-${event.timestamp}-${index}`}
                      style={index === 0 ? styles.updateItemPrimary : styles.updateItem}
                    >
                      <Text style={styles.updateDate} allowFontScaling={false}>{event.meta}</Text>
                      <Text style={styles.updateText} allowFontScaling={false}>
                        {event.title}{event.body ? ` — ${event.body}` : ""}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyEvidenceText}>No case updates are available yet.</Text>
                )}
              </View>
            </View>

            <View style={styles.timelineInfoCard}>
              <View style={styles.certHeaderRow}>
                <View style={styles.certHeaderText}>
                  <Text style={styles.timelineSectionTitle} allowFontScaling={false}>Released Case Documents</Text>
                  <Text style={styles.certSubtitle} allowFontScaling={false}>Documents released by the Barangay Secretary.</Text>
                </View>
                <View style={[styles.certBadge, releasedDocuments.length > 0 && { backgroundColor: "#DCFCE7" }]}>
                  <Text
                    style={[styles.certBadgeText, releasedDocuments.length > 0 && { color: "#15803D" }]}
                    allowFontScaling={false}
                  >
                    {releasedDocuments.length > 0 ? `${releasedDocuments.length} Available` : "Not Yet Available"}
                  </Text>
                </View>
              </View>
              {releasedDocuments.map((document, index) => (
                <Pressable
                  key={String(document._id || index)}
                  onPress={() =>
                    Alert.alert(
                      document.title || "Case Document",
                      Object.entries(document.fields || {})
                        .map(([key, value]) => `${key}: ${String(value ?? "-")}`)
                        .join("\n") || "This document has been released for your case.",
                    )
                  }
                  style={({ pressed }) => [styles.certActionButton, pressed && { opacity: 0.82 }]}
                >
                  <Ionicons name="document-text-outline" size={styles._miniIcon} color={PRIMARY} />
                  <Text style={[styles.certActionText, { color: PRIMARY }]} allowFontScaling={false}>
                    {document.title || "View Document"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

      </View>

      <ReportMessaging
        reportId={resolvedReportId || reportId}
        canChat={canChat}
        reportStatus={statusUpper}
        modalTitle={messageModalTitle}
        reportContext={reportContext}
      />
    </SafeAreaView>
  );
}

function makeStyles(args: {
  scale: (n: number) => number;
  vscale: (n: number) => number;
  primary: string;
  isTablet: boolean;
  isNarrow: boolean;
  contentMaxW: number;
  sidePad: number;
  thumbW: number;
  thumbH: number;
}) {
  const { scale, vscale, primary, isTablet, isNarrow, contentMaxW, sidePad, thumbW, thumbH } = args;
  const type = createTypography(scale, vscale);

  const CARD_R = scale(isTablet ? 20 : 18);

  const _iconSize = scale(18);
  const _miniIcon = scale(14);
  const _emptyIcon = scale(isTablet ? 52 : 44);

  const TAB_H = vscale(isTablet ? 48 : 44);
  const TAB_R = TAB_H / 2;
  const TAB_PAD = vscale(4);

  const CONTENT_ALIGN: any = { width: "100%", maxWidth: contentMaxW, alignSelf: "center" };

  const metaDirection = isNarrow ? ("column" as const) : ("row" as const);

  const _backBox = scale(36);
  const _backIcon = scale(22);

  const _viewerIcon = scale(22);
  const _viewerPad = scale(40);

  const _cancelIcon = scale(16);
  const _caseCheckIcon = scale(10);

  return Object.assign(
    StyleSheet.create({
      safe: { flex: 1, backgroundColor: BG },
      page: { flex: 1, backgroundColor: BG },
      bannerBtn: {
        paddingHorizontal: scale(14),
        paddingVertical: vscale(8),
        borderRadius: scale(999),
        backgroundColor: Colors.actionPrimary,
      },
      bannerBtnText: {
        ...type.microStrong,
        color: "#FFFFFF",
      },

      heroWrap: { paddingBottom: vscale(10), backgroundColor: BG, gap: vscale(10) },

      reportTopBar: {
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
        paddingHorizontal: 22,
        paddingTop: 14,
        paddingBottom: 22,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      reportCloseBtn: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
      },
      reportScreenTitle: {
        ...type.authTitle,
        flex: 1,
        textAlign: "center",
        color: "#374151",
      },
      reportHeaderSpacer: {
        width: 40,
        height: 40,
      },
      reportHeroContent: {
        paddingHorizontal: sidePad,
        gap: vscale(10),
      },
      reportTabsRow: {
        ...CONTENT_ALIGN,
        flexDirection: "row",
        alignItems: "stretch",
        borderRadius: scale(999),
        backgroundColor: "#E3E8EE",
        overflow: "hidden",
      },
      reportTabPill: {
        flex: 1,
        minHeight: vscale(isTablet ? 44 : 40),
        borderRadius: scale(999),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: scale(17),
        flexDirection: "row",
        gap: scale(4),
      },
      reportTabPillActive: {
        backgroundColor: "#062B49",
      },
      reportTabPillInactive: {
        backgroundColor: "#E3E8EE",
      },
      reportTabText: {
        ...type.label,
        color: "#344052",
      },
      reportTabTextActive: {
        color: "#FFFFFF",
      },
      reportTabBadge: {
        position: "absolute",
        top: -scale(4),
        right: scale(8),
        minWidth: scale(13),
        height: scale(13),
        borderRadius: scale(8),
        backgroundColor: "#E11D48",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: scale(2),
      },
      reportTabBadgeText: {
        ...type.badge,
        color: "#FFFFFF",
      },
      reportSummaryBlock: {
        ...CONTENT_ALIGN,
        minHeight: vscale(isTablet ? 92 : 84),
        flexDirection: "row",
        alignItems: "center",
        gap: scale(12),
        borderWidth: 1,
        borderColor: "#E3E8EE",
        borderRadius: scale(isTablet ? 20 : 18),
        backgroundColor: "#FFFFFF",
        paddingHorizontal: scale(isTablet ? 20 : 16),
        paddingVertical: vscale(isTablet ? 17 : 14),
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: vscale(2) },
        shadowOpacity: 0.12,
        shadowRadius: scale(5),
        elevation: 2,
      },
      reportSummaryTextBlock: {
        flex: 1,
      },
      reportRefText: {
        ...type.micro,
        color: "#9AA4B2",
      },
      reportTitleText: {
        ...type.sectionTitle,
        marginTop: vscale(2),
        color: TEXT_DARK,
      },
      reportStatusChip: {
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        borderRadius: scale(999),
        paddingHorizontal: scale(9),
        paddingVertical: vscale(4),
      },
      reportStatusDot: {
        width: scale(7),
        height: scale(7),
        borderRadius: scale(999),
      },
      reportStatusText: {
        ...type.badge,
      },

      heroTopBar: {
        ...CONTENT_ALIGN,
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
      },

      heroCard: {
        ...CONTENT_ALIGN,
        borderRadius: CARD_R,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: SURFACE,
        paddingHorizontal: scale(12),
        paddingVertical: vscale(12),
      },

      backBtn: {
        width: _backBox,
        height: _backBox,
        alignItems: "center",
        justifyContent: "center",
      },

      heroTitle: {
        ...type.sectionTitle,
        flex: 1,
        color: TEXT_DARK,
        textAlign: "left",
      },

      heroStatusCenterRow: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
      },
      heroMetaSlot: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      },

      statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        paddingHorizontal: scale(10),
        paddingVertical: vscale(6),
        borderRadius: scale(999),
        borderWidth: 1,
        maxWidth: "94%",
      },
      statusPillText: { ...type.badge },
      alertNoPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        paddingHorizontal: scale(10),
        paddingVertical: vscale(6),
        borderRadius: scale(999),
        borderWidth: 1,
        maxWidth: "94%",
      },
      alertNoPillText: {
        ...type.badge,
      },
      dot: { width: scale(7), height: scale(7), borderRadius: scale(99) },

      tabsWrap: {
        marginTop: vscale(12),
        height: TAB_H,
        borderRadius: TAB_R,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#F8FAFC",
        flexDirection: "row",
        overflow: "hidden",
        position: "relative",
      },

      tabUnderline: {
        position: "absolute",
        top: TAB_PAD,
        bottom: TAB_PAD,
        left: TAB_PAD,
        borderRadius: vscale(999),
        overflow: "hidden",
      },

      tabBtn: { flex: 1, alignItems: "center", justifyContent: "center" },
      tabText: { ...type.captionStrong, color: primary },
      tabTextActive: { color: "#FFFFFF" },

      detailsScroll: { backgroundColor: BG },
      scrollContent: { paddingHorizontal: sidePad, paddingTop: vscale(2), gap: vscale(12) },

      reportInfoCard: {
        ...CONTENT_ALIGN,
        borderRadius: scale(20),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: SURFACE,
        paddingHorizontal: scale(18),
        paddingVertical: vscale(20),
      },
      reportEvidenceCard: {
        ...CONTENT_ALIGN,
        borderRadius: scale(20),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: SURFACE,
        paddingHorizontal: scale(18),
        paddingVertical: vscale(18),
      },
      reportCardTitle: {
        ...type.sectionTitle,
        color: TEXT_DARK,
      },
      reportFieldLabel: {
        ...type.label,
        marginTop: vscale(10),
        marginBottom: vscale(6),
        color: "#7C7F86",
      },
      reportTextBoxLarge: {
        minHeight: vscale(72),
        borderRadius: scale(8),
        borderWidth: 1,
        borderColor: "#D8D8D8",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(10),
      },
      reportTextBox: {
        minHeight: vscale(38),
        borderRadius: scale(8),
        borderWidth: 1,
        borderColor: "#D8D8D8",
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(8),
      },
      reportBoxText: {
        ...type.bodySmall,
        color: "#08233F",
      },
      reportDateTimeRow: {
        flexDirection: "row",
        gap: scale(14),
        marginTop: vscale(2),
      },
      reportDateTimeCell: {
        flex: 1,
      },
      reportWitnessRow: {
        flexDirection: metaDirection,
        gap: scale(14),
        marginTop: vscale(2),
      },
      reportWitnessCell: {
        flex: metaDirection === "row" ? 1 : undefined,
        width: metaDirection === "row" ? undefined : "100%",
      },
      reportPlainText: {
        ...type.bodySmall,
        color: "#08233F",
      },
      reportLocationHeader: {
        marginTop: vscale(6),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: scale(8),
      },
      reportEvidenceHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: vscale(12),
      },
      reportEvidenceCount: {
        ...type.captionStrong,
        color: "#8A8D93",
      },
      reportEvidenceGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        rowGap: vscale(10),
      },
      reportEvidenceThumb: {
        width: scale(isTablet ? 84 : 66),
        height: scale(isTablet ? 84 : 66),
        borderRadius: scale(6),
        borderWidth: 1,
        borderColor: "#B9C4FF",
        backgroundColor: "#EEF3FF",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      },
      reportEvidenceImage: {
        width: "100%",
        height: "100%",
      },
      reportVideoThumb: {
        backgroundColor: "#08233F",
        gap: vscale(3),
      },
      reportVideoText: {
        ...type.badge,
        color: "#FFFFFF",
      },
      reportAiButton: {
        ...CONTENT_ALIGN,
        minHeight: vscale(46),
        borderRadius: scale(999),
        backgroundColor: Colors.actionPrimary,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: scale(16),
        marginTop: vscale(16),
      },
      reportAiButtonText: {
        ...type.button,
        color: "#FFFFFF",
      },
      timelineProgressCard: {
        ...CONTENT_ALIGN,
        borderRadius: scale(24),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: SURFACE,
        paddingHorizontal: scale(17),
        paddingTop: vscale(18),
        paddingBottom: vscale(14),
      },
      timelineInfoCard: {
        ...CONTENT_ALIGN,
        borderRadius: scale(22),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: SURFACE,
        paddingHorizontal: scale(17),
        paddingVertical: vscale(17),
      },
      timelineSectionTitle: {
        ...type.sectionTitle,
        color: TEXT_DARK,
      },
      caseProgressList: {
        marginTop: vscale(15),
        gap: vscale(14),
      },
      caseProgressRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: scale(12),
      },
      caseProgressDot: {
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        alignItems: "center",
        justifyContent: "center",
        marginTop: vscale(1),
      },
      caseProgressDotDone: {
        backgroundColor: "#000000",
      },
      caseProgressDotPending: {
        backgroundColor: "#E6E9ED",
        borderWidth: 1,
        borderColor: "#D0D5DC",
      },
      caseProgressTextWrap: {
        flex: 1,
      },
      caseProgressTitle: {
        ...type.bodyLarge,
        color: TEXT_DARK,
      },
      caseProgressTitlePending: {
        color: "#98A1AD",
      },
      caseProgressMeta: {
        ...type.bodySmall,
        marginTop: vscale(4),
        color: TEXT_MUTED,
      },
      caseProgressMetaPending: {
        color: "#B4BAC3",
      },
      currentStatusCard: {
        ...CONTENT_ALIGN,
        borderRadius: scale(12),
        backgroundColor: "#EFF3FF",
        borderWidth: 1,
        borderColor: "#E0E7FF",
        paddingHorizontal: scale(17),
        paddingVertical: vscale(14),
        flexDirection: "row",
        alignItems: "center",
        gap: scale(12),
      },
      currentStatusIcon: {
        width: scale(26),
        height: scale(30),
        alignItems: "center",
        justifyContent: "center",
      },
      currentStatusTextWrap: {
        flex: 1,
      },
      currentStatusLabel: {
        ...type.bodySmall,
        color: "#718093",
      },
      currentStatusValue: {
        ...type.sectionTitle,
        marginTop: vscale(1),
        color: TEXT_DARK,
      },
      timelineCardHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(9),
        marginBottom: vscale(16),
      },
      mediationScheduleBox: {
        minHeight: vscale(68),
        borderRadius: scale(8),
        borderWidth: 1,
        borderColor: "#E3E5EC",
        backgroundColor: "#F4F4FA",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: scale(12),
        gap: scale(14),
      },
      mediationDateBadge: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(6),
        backgroundColor: "#172842",
        alignItems: "center",
        justifyContent: "center",
      },
      mediationMonth: {
        ...type.overline,
        color: "#8FA0B8",
      },
      mediationDay: {
        ...type.numeric,
        marginTop: vscale(1),
        color: "#FFFFFF",
      },
      mediationScheduleText: {
        flex: 1,
      },
      mediationTime: {
        ...type.sectionTitle,
        color: TEXT_DARK,
      },
      mediationPlace: {
        ...type.bodyLarge,
        marginTop: vscale(4),
        color: TEXT_MUTED,
      },
      outcomeBox: {
        borderRadius: scale(10),
        borderWidth: 1,
        borderColor: "#DDE7E1",
        backgroundColor: "#F7FCF9",
        paddingHorizontal: scale(13),
        paddingVertical: vscale(13),
        gap: vscale(10),
      },
      outcomeTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: scale(10),
      },
      outcomeTitle: {
        ...type.sectionTitle,
        color: TEXT_DARK,
        flex: 1,
      },
      outcomeConfirmedBadge: {
        borderRadius: scale(999),
        backgroundColor: "#DCFCE7",
        paddingHorizontal: scale(9),
        paddingVertical: vscale(5),
      },
      outcomeConfirmedText: {
        ...type.microStrong,
        color: "#15803D",
      },
      outcomeAttendanceRow: {
        flexDirection: "row",
        gap: scale(10),
      },
      outcomeAttendanceCell: {
        flex: 1,
        borderRadius: scale(8),
        backgroundColor: "#FFFFFF",
        paddingHorizontal: scale(10),
        paddingVertical: vscale(9),
      },
      outcomeMetaLabel: {
        ...type.overline,
        color: TEXT_MUTED,
      },
      outcomeMetaValue: {
        ...type.bodyLarge,
        color: TEXT_DARK,
        marginTop: vscale(3),
      },
      outcomeRemarks: {
        ...type.bodySmall,
        color: TEXT_MUTED,
      },
      updateList: {
        marginTop: vscale(16),
        marginLeft: scale(6),
        paddingLeft: scale(13),
        borderLeftWidth: 2,
        borderLeftColor: "#7B7F86",
        gap: vscale(16),
      },
      updateItemPrimary: {
        gap: vscale(3),
      },
      updateItem: {
        gap: vscale(3),
      },
      updateDate: {
        ...type.bodySmall,
        color: "#8A8F98",
      },
      updateText: {
        ...type.bodyLarge,
        color: TEXT_DARK,
      },
      certHeaderRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: scale(10),
      },
      certHeaderText: {
        flex: 1,
      },
      certSubtitle: {
        ...type.bodySmall,
        marginTop: vscale(6),
        color: TEXT_MUTED,
      },
      certBadge: {
        borderRadius: scale(7),
        backgroundColor: "#E5E8EC",
        paddingHorizontal: scale(10),
        paddingVertical: vscale(7),
      },
      certBadgeText: {
        ...type.microStrong,
        color: "#848B95",
      },
      certActionsRow: {
        marginTop: vscale(18),
        flexDirection: "row",
        gap: scale(10),
      },
      certActionButton: {
        flex: 1,
        minHeight: vscale(40),
        borderRadius: scale(8),
        borderWidth: 1,
        borderColor: "#E0E2E8",
        backgroundColor: "#FAFAFC",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: scale(7),
        opacity: 0.8,
      },
      certActionText: {
        ...type.button,
        color: "#AEB4BD",
      },
      timelineCard: {
        ...CONTENT_ALIGN,
        borderRadius: scale(20),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: SURFACE,
        paddingHorizontal: scale(18),
        paddingVertical: vscale(18),
      },
      timelineItem: {
        flexDirection: "row",
        gap: scale(10),
        marginTop: vscale(14),
      },
      timelineRail: {
        width: scale(16),
        alignItems: "center",
      },
      timelineDot: {
        width: scale(10),
        height: scale(10),
        borderRadius: scale(5),
        backgroundColor: "#062B49",
      },
      timelineLine: {
        width: 1,
        flex: 1,
        minHeight: vscale(42),
        backgroundColor: "#D9DEE5",
        marginTop: vscale(4),
      },
      timelineBody: {
        flex: 1,
        paddingBottom: vscale(6),
      },
      timelineTitle: {
        ...type.cardTitle,
        color: TEXT_DARK,
      },
      timelineMeta: {
        ...type.microStrong,
        marginTop: vscale(2),
        color: "#8A8D93",
      },
      timelineText: {
        ...type.caption,
        marginTop: vscale(4),
        color: "#556070",
      },

      sectionCard: {
        ...CONTENT_ALIGN,
        borderRadius: CARD_R,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: SURFACE,
        paddingHorizontal: scale(12),
        paddingVertical: vscale(12),
      },

      sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: scale(8), marginBottom: vscale(10) },
      sectionTitle: { ...type.captionStrong, flex: 1, color: TEXT_DARK },
      sectionHint: { ...type.badge, color: "#94A3B8" },
      locationMapBtn: {
        minHeight: vscale(28),
        borderRadius: scale(999),
        borderWidth: 1,
        borderColor: "#D7E3F4",
        backgroundColor: "#F8FBFF",
        paddingHorizontal: scale(10),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: scale(5),
      },
      locationMapBtnDisabled: {
        opacity: 0.7,
      },
      locationMapBtnText: {
        ...type.captionStrong,
        color: primary,
      },
      locationMapBtnTextDisabled: {
        color: "#94A3B8",
      },

      narrativeText: {
        ...type.caption,
        color: TEXT_MUTED,
        fontStyle: "italic",
      },

      metaGrid: { ...CONTENT_ALIGN, flexDirection: metaDirection, gap: scale(10) },
      metaCard: {
        flex: metaDirection === "row" ? 1 : undefined,
        width: metaDirection === "row" ? undefined : "100%",
        borderRadius: scale(16),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(12),
      },
      metaRow: { flexDirection: "row", alignItems: "center", gap: scale(6) },
      metaLabel: { ...type.overline, color: "#94A3B8" },
      metaValue: { ...type.caption, marginTop: vscale(6), color: TEXT_DARK },

      locationText: {
        ...type.caption,
        color: TEXT_MUTED,
      },
      locationMapCard: {
        marginTop: vscale(12),
        borderRadius: scale(16),
        borderWidth: 1,
        borderColor: BORDER,
        overflow: "hidden",
        backgroundColor: "#F8FBFF",
      },
      locationMapWebview: {
        width: "100%",
        height: vscale(isTablet ? 220 : 190),
        backgroundColor: "#F8FBFF",
      },

      witnessRow: { flexDirection: "row", alignItems: "center", gap: scale(10) },
      witnessBadge: {
        width: vscale(isTablet ? 44 : 40),
        height: vscale(isTablet ? 44 : 40),
        borderRadius: vscale(14),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#F6FAFF",
        alignItems: "center",
        justifyContent: "center",
      },
      witnessName: { ...type.captionStrong, color: TEXT_DARK },
      witnessRole: { ...type.micro, marginTop: vscale(2), color: "#94A3B8" },

      galleryRow: { gap: scale(10), paddingRight: scale(6) },
      photoCard: {
        width: thumbW,
        height: thumbH,
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#F1F6FD",
        overflow: "hidden",
        position: "relative",
      },
      photoImg: { width: "100%", height: "100%" },
      photoOverlay: {
        position: "absolute",
        right: scale(8),
        bottom: scale(8),
        width: scale(26),
        height: scale(26),
        borderRadius: scale(13),
        backgroundColor: "rgba(0,0,0,0.35)",
        alignItems: "center",
        justifyContent: "center",
      },

      emptyEvidence: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: vscale(18),
        gap: vscale(8),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#FFFFFF",
      },
      emptyEvidenceText: { ...type.caption, color: "#94A3B8" },

      cancelBottomWrap: { ...CONTENT_ALIGN, marginTop: vscale(2) },
      cancelBottomBtn: {
        width: "100%",
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: "#FECACA",
        backgroundColor: "#FFFFFF",
        paddingVertical: vscale(12),
        paddingHorizontal: scale(12),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: scale(8),
      },
      cancelBottomText: {
        ...type.captionStrong,
        color: "#DC2626",
      },

      viewerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center" },
      viewerTopBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        paddingTop: vscale(10) + (Platform.OS === "ios" ? vscale(16) : 0),
        paddingHorizontal: sidePad,
        height: vscale(60) + (Platform.OS === "ios" ? vscale(18) : 0),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 5,
      },
      viewerIconBtn: {
        width: _viewerPad,
        height: _viewerPad,
        borderRadius: _viewerPad / 2,
        backgroundColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
      },
      viewerCounter: { ...type.captionStrong, color: "#FFFFFF", maxWidth: "65%", textAlign: "center" },
      viewerStage: { flex: 1, paddingTop: vscale(70), paddingBottom: vscale(36) },
      viewerStageInner: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: sidePad },
      viewerImage: { width: "100%", height: "100%" },

      viewerNavBtn: {
        position: "absolute",
        top: "50%",
        marginTop: -scale(22),
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        backgroundColor: "rgba(255,255,255,0.14)",
        alignItems: "center",
        justifyContent: "center",
      },
      viewerNavLeft: { left: sidePad },
      viewerNavRight: { right: sidePad },

      viewerHint: {
        ...type.micro,
        position: "absolute",
        bottom: vscale(10),
        left: 0,
        right: 0,
        textAlign: "center",
        color: "rgba(255,255,255,0.72)",
      },
    }),
    {
      _iconSize,
      _miniIcon,
      _emptyIcon,
      _backBox,
      _backIcon,
      _viewerIcon,
      _viewerPad,
      _cancelIcon,
      _caseCheckIcon,
    }
  ) as any;
}
