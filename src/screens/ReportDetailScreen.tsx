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

import type { ReportItem } from "./ReportScreen";
import {
  fetchReportDetail,
  ReportDetailDto,
  buildReportPhotoUrl,
} from "../api/reports";

// ✅ token + base url for cancel action
import { getAccessToken } from "../auth/session";

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

function formatStatusLabel(s?: string) {
  const raw = String(s || "").trim();
  if (!raw) return "Submitted";

  const normalized = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (normalized.includes("mediation")) return "Mediation";
  if (normalized.includes("review")) return "Under Review";
  if (normalized.includes("assist") || normalized.includes("ongoing") || normalized.includes("progress")) {
    return "Ongoing";
  }
  if (normalized.includes("resolve") || normalized.includes("complete")) return "Resolved";
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("submit") || normalized.includes("pending")) return "Submitted";

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.replace(/\/+$/, "");
  }

  if (Platform.OS === "android") return "http://10.0.2.2:8000";
  return "http://localhost:8000";
}
const API_BASE_URL = getApiBaseUrl();

function statusColor(statusUpper: string, primary: string) {
  const s = String(statusUpper || "").toUpperCase();
  if (s === "RESOLVED") return "#16A34A";
  if (s === "CANCELLED") return "#DC2626";
  if (s === "ONGOING" || s === "ON GOING") return "#2563EB";
  return primary;
}

function statusIconName(statusUpper: string) {
  const s = String(statusUpper || "").toUpperCase();
  if (s === "RESOLVED") return "checkmark-circle-outline" as const;
  if (s === "CANCELLED") return "close-circle-outline" as const;
  if (s === "ONGOING" || s === "ON GOING") return "sync-circle-outline" as const;
  return "time-outline" as const;
}

async function readJsonSafe(res: Response) {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function sanitizeApiMessage(msg: any, fallback: string) {
  const s = String(msg || "").trim();
  if (!s) return fallback;
  if (s.includes("<!DOCTYPE") || s.includes("<html")) return fallback;
  return s;
}

function isObjectId24(v: string) {
  return /^[a-fA-F0-9]{24}$/.test(String(v || "").trim());
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
        const d = await fetchReportDetail(reportId, controller.signal);

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

    if (reportId) void loadDetail(true);
    else setDetailError("Missing report id.");
  }, [reportId, loadDetail]);
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

      const token = await getAccessToken();
      if (!token) throw new Error("Please login again. (Missing access token)");

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch(
        `${API_BASE_URL}/api/mobile/v1/reports/${encodeURIComponent(resolvedReportId)}/cancel`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ reason: "User cancelled" }),
        }
      );

      const data: any = await readJsonSafe(res);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        if (res.status === 403) {
          throw new Error(
            sanitizeApiMessage(
              data?.message,
              "You are not allowed to cancel this report."
            )
          );
        }
        throw new Error(
          sanitizeApiMessage(
            data?.message || `Cancel failed (${res.status})`,
            "Could not cancel report on the server."
          )
        );
      }

      setDetail((prev) => {
        const base: any = prev ?? {};
        return { ...base, status: "CANCELLED", updatedAt: new Date().toISOString() } as any;
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
    detail?.details ||
    (detail as any)?.narrative ||
    (report as any)?.details ||
    report.detail ||
    "No details provided.";

  const complaintName =
    detail?.offenderName ||
    (detail as any)?.complaint ||
    (report as any)?.offenderName ||
    (report as any)?.complaint ||
    "-";

  const witnessName = detail?.witnessName || (report as any)?.witnessName || "—";
  const witnessRole = detail?.witnessType || (report as any)?.witnessRole || (report as any)?.witnessType || "—";

  const locationLabel = detail?.locationStr || (report as any)?.locationStr || (report as any)?.location || "—";
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

  const statusUpper = prettyStatus(detail?.status || (report as any)?.status);
  const statusLabel = formatStatusLabel(detail?.status || (report as any)?.status);
  const accent = useMemo(() => statusColor(statusUpper, PRIMARY), [statusUpper, PRIMARY]);
  const sIcon = useMemo(() => statusIconName(statusUpper), [statusUpper]);

  const dateLabel = detail?.dateStr || (report as any)?.dateStr || report.dateLeft || "—";
  const timeLabel = detail?.timeStr || (report as any)?.timeStr || report.timeLeft || "—";

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
  const canChat = !["CANCELLED", "CANCELED", "RESOLVED"].includes(statusUpper);
  const reportContext = useMemo<ReportContextData>(
    () => ({
      reference: messageReference || reportRef,
      title: incidentTitle,
      description: incidentNarrative,
      statusLabel,
      statusColor: accent,
      statusBackgroundColor: `${accent}1A`,
      incidentDate: dateLabel,
      incidentTime: timeLabel,
      location: locationLabel,
      reportedPerson: complaintName,
      witnessName,
      witnessType: witnessRole,
      evidenceCount,
    }),
    [
      accent,
      complaintName,
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

  const timelineEntries = useMemo(() => {
    const submittedAt =
      formatTimelineStamp(detail?.createdAt || (report as any)?.createdAt) ||
      [dateLabel, timeLabel].filter((v) => v && v !== "—" && v !== "â€”").join(" • ");
    const updatedAt = formatTimelineStamp(detail?.updatedAt || (report as any)?.updatedAt);

    return [
      {
        title: "Report submitted",
        meta: submittedAt || "Submission date unavailable",
        body: "Your report was recorded and sent to the barangay office.",
      },
      {
        title: statusLabel,
        meta: updatedAt || "Latest status",
        body: "Current case status based on the latest report update.",
      },
    ];
  }, [dateLabel, detail?.createdAt, detail?.updatedAt, report, statusLabel, timeLabel]);

  const submittedTimelineMeta =
    formatTimelineStamp(detail?.createdAt || (report as any)?.createdAt) ||
    [dateLabel, timeLabel].filter((v) => v && v !== "—" && v !== "â€”").join(" • ") ||
    "Pending";
  const latestTimelineMeta =
    formatTimelineStamp(detail?.updatedAt || (report as any)?.updatedAt) || submittedTimelineMeta;

  const currentTimelineStatus = statusLabel === "Mediation" ? "Ongoing Mediation" : statusLabel;
  const caseProgressIndex = useMemo(() => {
    const s = `${statusLabel} ${statusUpper}`.toLowerCase();
    if (s.includes("resolved") || s.includes("complete")) return 4;
    if (s.includes("ongoing") || s.includes("assist")) return 3;
    if (s.includes("mediation")) return 2;
    if (s.includes("review")) return 1;
    return 0;
  }, [statusLabel, statusUpper]);

  const caseProgressSteps = useMemo(() => {
    const fallbackDoneMeta = [
      submittedTimelineMeta,
      "June 11, 2026 • 02:30 PM",
      "June 12, 2026 • 10:15 AM",
      latestTimelineMeta,
      latestTimelineMeta,
    ];
    return ["Submitted", "Under Review", "Mediation Scheduled", "Ongoing Assistance", "Resolved"].map(
      (title, index) => ({
        title,
        complete: index <= caseProgressIndex,
        meta: index <= caseProgressIndex ? fallbackDoneMeta[index] : "Pending",
      })
    );
  }, [caseProgressIndex, latestTimelineMeta, submittedTimelineMeta]);

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
    statusUpper !== "CANCELLED" &&
    statusUpper !== "RESOLVED";
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
                <Image source={{ uri: photoUrls[viewerIndex] }} style={styles.viewerImage} resizeMode="contain" />
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
        onClose={() => setPreviewVideoUri(null)}
      />

      <View style={[styles.page, { backgroundColor: TC.screenBg }]}>
        <View style={[styles.heroWrap, { paddingTop: Math.max(insets.top, 14), backgroundColor: TC.screenBg }]}>
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
            <Text style={styles.reportRefText} numberOfLines={1}>
              {reportRef}
            </Text>
            <Text style={styles.reportTitleText} numberOfLines={2}>
              {incidentTitle}
            </Text>
            <View style={styles.reportStatusChip}>
              <Text style={styles.reportStatusText} numberOfLines={1}>
                {statusLabel}
              </Text>
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
                          source={{ uri: item.uri }}
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
                <Text style={styles.currentStatusLabel} allowFontScaling={false}>Current Status</Text>
                <Text style={styles.currentStatusValue} allowFontScaling={false}>{currentTimelineStatus}</Text>
              </View>
            </View>

            <View style={styles.timelineInfoCard}>
              <View style={styles.timelineCardHeaderRow}>
                <Ionicons name="calendar-outline" size={styles._iconSize} color="#718093" />
                <Text style={styles.timelineSectionTitle} allowFontScaling={false}>Mediation Schedule</Text>
              </View>
              <View style={styles.mediationScheduleBox}>
                <View style={styles.mediationDateBadge}>
                  <Text style={styles.mediationMonth} allowFontScaling={false}>JUN</Text>
                  <Text style={styles.mediationDay} allowFontScaling={false}>15</Text>
                </View>
                <View style={styles.mediationScheduleText}>
                  <Text style={styles.mediationTime} allowFontScaling={false}>2:00 PM</Text>
                  <Text style={styles.mediationPlace} allowFontScaling={false}>Barangay Hall - Room A</Text>
                </View>
              </View>
            </View>

            <View style={styles.timelineInfoCard}>
              <Text style={styles.timelineSectionTitle} allowFontScaling={false}>Mediation Updates</Text>
              <View style={styles.updateList}>
                <View style={styles.updateItemPrimary}>
                  <Text style={styles.updateDate} allowFontScaling={false}>June 15, 2026</Text>
                  <Text style={styles.updateText} allowFontScaling={false}>
                    Both parties have confirmed attendance for the scheduled mediation session.
                  </Text>
                </View>
                <View style={styles.updateItem}>
                  <Text style={styles.updateDate} allowFontScaling={false}>June 10, 2026</Text>
                  <Text style={styles.updateText} allowFontScaling={false}>
                    Initial report reviewed by Barangay Captain. Case designated for mediation.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.timelineInfoCard}>
              <View style={styles.certHeaderRow}>
                <View style={styles.certHeaderText}>
                  <Text style={styles.timelineSectionTitle} allowFontScaling={false}>Certification to File Action</Text>
                  <Text style={styles.certSubtitle} allowFontScaling={false}>Available if mediation fails.</Text>
                </View>
                <View style={styles.certBadge}>
                  <Text style={styles.certBadgeText} allowFontScaling={false}>Not Yet Available</Text>
                </View>
              </View>
              <View style={styles.certActionsRow}>
                <Pressable disabled style={styles.certActionButton}>
                  <Ionicons name="eye-outline" size={styles._miniIcon} color="#AEB4BD" />
                  <Text style={styles.certActionText} allowFontScaling={false}>View</Text>
                </Pressable>
                <Pressable disabled style={styles.certActionButton}>
                  <Ionicons name="download-outline" size={styles._miniIcon} color="#AEB4BD" />
                  <Text style={styles.certActionText} allowFontScaling={false}>Download PDF</Text>
                </Pressable>
              </View>
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
        fontSize: scale(11),
        fontWeight: "800",
        color: "#FFFFFF",
      },

      heroWrap: { paddingHorizontal: sidePad, paddingBottom: vscale(10), backgroundColor: BG, gap: vscale(10) },

      reportTopBar: {
        ...CONTENT_ALIGN,
        paddingHorizontal: scale(22),
        paddingBottom: vscale(22),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      reportCloseBtn: {
        width: scale(40),
        height: scale(40),
        alignItems: "center",
        justifyContent: "center",
      },
      reportScreenTitle: {
        flex: 1,
        textAlign: "center",
        fontSize: 26,
        fontWeight: "800",
        color: "#374151",
      },
      reportHeaderSpacer: {
        width: 40,
        height: 40,
      },
      reportTabsRow: {
        ...CONTENT_ALIGN,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: scale(9),
      },
      reportTabPill: {
        minWidth: scale(isTablet ? 120 : 100),
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
        fontSize: scale(isTablet ? 14 : 13),
        fontWeight: "800",
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
        fontSize: scale(6.5),
        fontWeight: "900",
        color: "#FFFFFF",
      },
      reportSummaryBlock: {
        ...CONTENT_ALIGN,
        paddingTop: vscale(16),
        paddingLeft: scale(8),
      },
      reportRefText: {
        fontSize: scale(11),
        fontWeight: "500",
        color: "#9AA4B2",
      },
      reportTitleText: {
        marginTop: vscale(2),
        fontSize: scale(isTablet ? 17 : 16),
        fontWeight: "900",
        lineHeight: vscale(isTablet ? 22 : 21),
        color: TEXT_DARK,
      },
      reportStatusChip: {
        marginTop: vscale(4),
        alignSelf: "flex-start",
        borderRadius: scale(999),
        backgroundColor: "#DCC7FF",
        paddingHorizontal: scale(9),
        paddingVertical: vscale(4),
      },
      reportStatusText: {
        fontSize: scale(10.5),
        fontWeight: "900",
        color: "#5B3B8C",
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
        flex: 1,
        fontSize: scale(isTablet ? 18 : 16.5),
        fontWeight: "900",
        color: TEXT_DARK,
        letterSpacing: 0.1,
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
      statusPillText: { fontSize: scale(10.5), fontWeight: "900" },
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
        fontSize: scale(10.25),
        fontWeight: "900",
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
      tabText: { fontSize: scale(isTablet ? 13 : 12), fontWeight: "900", color: primary },
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
        fontSize: scale(isTablet ? 17.5 : 16),
        fontWeight: "900",
        color: TEXT_DARK,
      },
      reportFieldLabel: {
        marginTop: vscale(10),
        marginBottom: vscale(6),
        fontSize: scale(12.5),
        fontWeight: "900",
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
        fontSize: scale(13),
        fontWeight: "500",
        lineHeight: vscale(19),
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
      reportPlainText: {
        fontSize: scale(13),
        fontWeight: "500",
        lineHeight: vscale(19),
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
        fontSize: scale(12),
        fontWeight: "800",
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
        fontSize: scale(10.5),
        fontWeight: "900",
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
        fontSize: scale(14),
        fontWeight: "500",
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
        fontSize: scale(17),
        fontWeight: "800",
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
        fontSize: scale(16.5),
        fontWeight: "500",
        color: TEXT_DARK,
      },
      caseProgressTitlePending: {
        color: "#98A1AD",
      },
      caseProgressMeta: {
        marginTop: vscale(4),
        fontSize: scale(13),
        fontWeight: "500",
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
        fontSize: scale(13),
        fontWeight: "500",
        color: "#718093",
      },
      currentStatusValue: {
        marginTop: vscale(1),
        fontSize: scale(17),
        fontWeight: "500",
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
        fontSize: scale(11),
        fontWeight: "900",
        color: "#8FA0B8",
      },
      mediationDay: {
        marginTop: vscale(1),
        fontSize: scale(19),
        fontWeight: "800",
        color: "#FFFFFF",
      },
      mediationScheduleText: {
        flex: 1,
      },
      mediationTime: {
        fontSize: scale(17),
        fontWeight: "500",
        color: TEXT_DARK,
      },
      mediationPlace: {
        marginTop: vscale(4),
        fontSize: scale(15),
        fontWeight: "500",
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
        fontSize: scale(13),
        fontWeight: "500",
        color: "#8A8F98",
      },
      updateText: {
        fontSize: scale(15),
        fontWeight: "500",
        lineHeight: vscale(21),
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
        marginTop: vscale(6),
        fontSize: scale(13),
        fontWeight: "500",
        color: TEXT_MUTED,
      },
      certBadge: {
        borderRadius: scale(7),
        backgroundColor: "#E5E8EC",
        paddingHorizontal: scale(10),
        paddingVertical: vscale(7),
      },
      certBadgeText: {
        fontSize: scale(11),
        fontWeight: "800",
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
        fontSize: scale(15),
        fontWeight: "500",
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
        fontSize: scale(14),
        fontWeight: "900",
        color: TEXT_DARK,
      },
      timelineMeta: {
        marginTop: vscale(2),
        fontSize: scale(11.5),
        fontWeight: "700",
        color: "#8A8D93",
      },
      timelineText: {
        marginTop: vscale(4),
        fontSize: scale(12.5),
        fontWeight: "500",
        lineHeight: vscale(18),
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
      sectionTitle: { flex: 1, fontSize: scale(isTablet ? 13 : 12), fontWeight: "900", color: TEXT_DARK },
      sectionHint: { fontSize: scale(10), fontWeight: "900", color: "#94A3B8" },
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
        fontSize: scale(11.5),
        fontWeight: "900",
        color: primary,
      },
      locationMapBtnTextDisabled: {
        color: "#94A3B8",
      },

      narrativeText: {
        fontSize: scale(isTablet ? 12.5 : 11.5),
        fontWeight: "400",
        color: TEXT_MUTED,
        lineHeight: vscale(isTablet ? 18 : 16),
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
      metaLabel: { fontSize: scale(10), fontWeight: "900", color: "#94A3B8" },
      metaValue: { marginTop: vscale(6), fontSize: scale(isTablet ? 12.5 : 11.5), fontWeight: "400", color: TEXT_DARK },

      locationText: {
        fontSize: scale(isTablet ? 12.5 : 11.5),
        fontWeight: "400",
        color: TEXT_MUTED,
        lineHeight: vscale(isTablet ? 18 : 16),
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
      witnessName: { fontSize: scale(isTablet ? 13 : 12), fontWeight: "900", color: TEXT_DARK },
      witnessRole: { marginTop: vscale(2), fontSize: scale(10.5), fontWeight: "400", color: "#94A3B8" },

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
      emptyEvidenceText: { fontSize: scale(12.5), fontWeight: "400", color: "#94A3B8" },

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
        fontSize: scale(12),
        fontWeight: "900",
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
      viewerCounter: { fontSize: scale(12), fontWeight: "900", color: "#FFFFFF", maxWidth: "65%", textAlign: "center" },
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
        position: "absolute",
        bottom: vscale(10),
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: scale(10.5),
        fontWeight: "400",
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
