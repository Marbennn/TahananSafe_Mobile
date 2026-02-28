// src/screens/ReportDetailScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
  Animated,
  Easing,
  Keyboard,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors } from "../theme/colors";

import type { ReportItem } from "./ReportScreen";
import {
  fetchReportDetail,
  fetchReportThreads,
  sendReportThreadMessage,
  ThreadDto,
  ReportDetailDto,
  buildReportPhotoUrl,
} from "../api/reports";

// ✅ token + base url for cancel action
import { getAccessToken } from "../auth/session";

type ViewKey = "details" | "threads";

type ThreadMsg = {
  id: string;
  side: "left" | "right";
  sender?: string;
  text: string;
  time: string;
};

type Props = {
  report: ReportItem;

  initialTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  onQuickExit?: () => void;

  onBack?: () => void;
};

function formatStamp(d: Date) {
  return d.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dtoToUi(dto: ThreadDto): ThreadMsg {
  const isResident = dto.senderRole === "resident";
  return {
    id: dto._id,
    side: isResident ? "right" : "left",
    sender: isResident ? undefined : dto.senderName || "Staff",
    text: dto.text,
    time: dto.createdAt ? formatStamp(new Date(dto.createdAt)) : "",
  };
}

function prettyStatus(s?: string) {
  if (!s) return "PENDING";
  return String(s).toUpperCase();
}

function isAbortError(err: any) {
  const name = err?.name || "";
  const msg = String(err?.message || "");
  return name === "AbortError" || msg.toLowerCase().includes("aborted");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

export default function ReportDetailScreen({
  report,
  initialTab = "Reports",
  onTabChange,
  onQuickExit,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const shortSide = Math.min(width, height);
  const isTablet = shortSide >= 768;
  const isNarrow = width < 360;

  const wScale = clamp(width / 375, 0.92, isTablet ? 1.08 : 1.18);
  const hScale = clamp(height / 812, 0.92, isTablet ? 1.08 : 1.18);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const PRIMARY: string = String((Colors as any).primary ?? "#0B5AA7");

  const gradColors = (Colors.gradient ??
    ([PRIMARY, String((Colors as any).primaryDark ?? "#021C36")] as const)) as readonly [
    string,
    string,
    ...string[]
  ];

  const CONTENT_MAX_W = isTablet ? Math.min(720, Math.round(width * 0.92)) : width;
  const CONTENT_SIDE_PAD = isTablet ? scale(18) : scale(14);

  const thumbW = clamp(Math.round(width * (isTablet ? 0.22 : 0.34)), scale(110), scale(isTablet ? 190 : 140));
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

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [view, setView] = useState<ViewKey>("details");

  const NAV_BASE_HEIGHT = vscale(78);
  const FAB_SIZE = scale(62);

  const bottomPad = Math.max(insets.bottom, vscale(10));
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + vscale(90);
  const fabBottom = navHeight - FAB_SIZE / 2 - vscale(10);

  const RESERVED_BOTTOM = navHeight + vscale(18);
  const DETAILS_EXTRA_BOTTOM = vscale(isTablet ? 130 : 110);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const subShow = Keyboard.addListener(showEvt, () => setIsKeyboardVisible(true));
    const subHide = Keyboard.addListener(hideEvt, () => setIsKeyboardVisible(false));

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const keyboardOffset = Platform.OS === "ios" ? Math.max(insets.top, vscale(6)) + vscale(44) : 0;

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const pressFab = () => handleTab("Incident");
  const longPressFab = () => onQuickExit?.();

  const threadScrollRef = useRef<ScrollView | null>(null);
  const [draft, setDraft] = useState("");

  const [loadingThreads, setLoadingThreads] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ThreadMsg[]>([]);
  const [threadsError, setThreadsError] = useState("");

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detail, setDetail] = useState<ReportDetailDto | null>(null);

  // ✅ cancel state
  const [cancelling, setCancelling] = useState(false);

  const reportId = useMemo(() => {
    const id = (report as any)?.id || (report as any)?._id || "";
    return String(id || "");
  }, [report]);

  const detailAbortRef = useRef<AbortController | null>(null);
  const threadsAbortRef = useRef<AbortController | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        detailAbortRef.current?.abort();
        threadsAbortRef.current?.abort();
      } catch {}
    };
  }, []);

  const detailInFlightRef = useRef(false);
  const threadsInFlightRef = useRef(false);

  const lastDetailLoadedIdRef = useRef<string>("");
  const lastThreadsLoadedIdRef = useRef<string>("");

  const [tabW, setTabW] = useState(0);
  const tabAnim = useRef(new Animated.Value(view === "details" ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(tabAnim, {
      toValue: view === "details" ? 0 : 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const underlineX = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabW / 2],
  });

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

  const loadThreads = useCallback(
    async (force = false) => {
      if (!reportId) {
        setThreadsError("Missing report id.");
        return;
      }

      if (!force && lastThreadsLoadedIdRef.current === reportId) return;
      if (threadsInFlightRef.current) return;

      try {
        threadsAbortRef.current?.abort();
      } catch {}
      const controller = new AbortController();
      threadsAbortRef.current = controller;

      threadsInFlightRef.current = true;
      setLoadingThreads(true);
      setThreadsError("");

      try {
        const list = await fetchReportThreads(reportId, controller.signal);

        if (!mountedRef.current) return;
        if (controller.signal.aborted) return;

        const ui = (list || []).map(dtoToUi);
        lastThreadsLoadedIdRef.current = reportId;
        setMessages(ui);

        setTimeout(() => {
          threadScrollRef.current?.scrollToEnd({ animated: true });
        }, 80);
      } catch (e: any) {
        if (!mountedRef.current) return;
        if (isAbortError(e)) return;
        setThreadsError(e?.message || "Failed to load threads");
      } finally {
        if (mountedRef.current && !controller.signal.aborted) setLoadingThreads(false);
        threadsInFlightRef.current = false;
      }
    },
    [reportId]
  );

  useEffect(() => {
    try {
      detailAbortRef.current?.abort();
      threadsAbortRef.current?.abort();
    } catch {}

    detailInFlightRef.current = false;
    threadsInFlightRef.current = false;

    lastDetailLoadedIdRef.current = "";
    lastThreadsLoadedIdRef.current = "";

    setDetail(null);
    setDetailError("");
    setLoadingDetail(false);

    setMessages([]);
    setThreadsError("");
    setLoadingThreads(false);

    if (reportId) loadDetail(true);
    else setDetailError("Missing report id.");
  }, [reportId, loadDetail]);

  useEffect(() => {
    if (view === "threads") loadThreads(true);

    if (view !== "threads") {
      try {
        threadsAbortRef.current?.abort();
      } catch {}
    }
  }, [view, loadThreads]);

  const onSend = useCallback(async () => {
    const t = draft.trim();
    if (!t) return;

    if (!reportId) {
      Alert.alert("Missing report id", "Cannot send message because reportId is empty.");
      return;
    }
    if (sending) return;

    setSending(true);

    const optimistic: ThreadMsg = {
      id: `tmp_${Date.now()}`,
      side: "right",
      text: t,
      time: formatStamp(new Date()),
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    setTimeout(() => {
      threadScrollRef.current?.scrollToEnd({ animated: true });
    }, 60);

    const controller = new AbortController();

    try {
      await sendReportThreadMessage(reportId, t, controller.signal);

      lastThreadsLoadedIdRef.current = "";
      await loadThreads(true);
    } catch (e: any) {
      if (!isAbortError(e)) {
        Alert.alert("Send failed", e?.message || "Could not send message.");
      }
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(t);
    } finally {
      setSending(false);
    }
  }, [draft, reportId, sending, loadThreads]);

  // ✅ Cancel report (tries a dedicated cancel route first, then falls back to PATCH status)
  const cancelReport = useCallback(async () => {
    if (!reportId) {
      Alert.alert("Missing report id", "Cannot cancel because reportId is empty.");
      return;
    }
    if (cancelling) return;

    Alert.alert(
      "Cancel this report?",
      "This will mark your incident report as CANCELLED. You can still view it in the Cancelled tab.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              const token = await getAccessToken();
              if (!token) throw new Error("Please login again. (Missing access token)");

              const headers: Record<string, string> = {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              };

              // 1) try: POST /reports/:id/cancel
              let res = await fetch(`${API_BASE_URL}/api/mobile/v1/reports/${reportId}/cancel`, {
                method: "POST",
                headers,
                body: JSON.stringify({ reason: "User cancelled" }),
              });

              // 2) fallback: PATCH /reports/:id with status
              if (!res.ok) {
                res = await fetch(`${API_BASE_URL}/api/mobile/v1/reports/${reportId}`, {
                  method: "PATCH",
                  headers,
                  body: JSON.stringify({ status: "CANCELLED" }),
                });
              }

              const data: any = await readJsonSafe(res);
              if (!res.ok) throw new Error(data?.message || `Cancel failed (${res.status})`);

              // update local UI immediately
              setDetail((prev) => {
                const base: any = prev ?? {};
                return { ...base, status: "CANCELLED", updatedAt: new Date().toISOString() } as any;
              });

              // force reload detail so status/time are accurate
              lastDetailLoadedIdRef.current = "";
              await loadDetail(true);

              Alert.alert("Cancelled", "Your report has been cancelled.");
            } catch (e: any) {
              Alert.alert("Cancel failed", e?.message || "Could not cancel report.");
            } finally {
              if (mountedRef.current) setCancelling(false);
            }
          },
        },
      ]
    );
  }, [reportId, cancelling, loadDetail]);

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

  const witnessName = detail?.witnessName || (report as any)?.witnessName || "—";
  const witnessRole = detail?.witnessType || (report as any)?.witnessRole || (report as any)?.witnessType || "—";

  const locationLabel = detail?.locationStr || (report as any)?.locationStr || (report as any)?.location || "—";

  const statusUpper = prettyStatus(detail?.status || (report as any)?.status);
  const accent = useMemo(() => statusColor(statusUpper, PRIMARY), [statusUpper, PRIMARY]);
  const sIcon = useMemo(() => statusIconName(statusUpper), [statusUpper]);

  const dateLabel = detail?.dateStr || (report as any)?.dateStr || report.dateLeft || "—";
  const timeLabel = detail?.timeStr || (report as any)?.timeStr || report.timeLeft || "—";

  const photosRaw = ((detail?.photos ?? (report as any)?.photos) || []) as any[];

  const photoUrls = useMemo(() => {
    return photosRaw.map((p) => buildReportPhotoUrl(reportId, p)).filter(Boolean) as string[];
  }, [photosRaw, reportId]);

  const reportCode = String((report as any)?.alertNo ?? (reportId ? `#${reportId.slice(-4)}` : "#—"));

  const threadsBottomGap = isKeyboardVisible ? vscale(10) : RESERVED_BOTTOM;

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

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

  const canPrev = viewerIndex > 0;
  const canNext = viewerIndex < photoUrls.length - 1;

  const canCancel = !!reportId && statusUpper !== "CANCELLED" && statusUpper !== "RESOLVED";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

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

      <View style={styles.page}>
        <View style={[styles.heroWrap, { paddingTop: Math.max(insets.top, vscale(6)) }]}>
          <View style={styles.heroCard}>
            {/* ✅ Row 1: Back + Title aligned (like your screenshot) */}
            <View style={styles.heroHeaderRow}>
              <Pressable onPress={onBack} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}>
                <Ionicons name="chevron-back" size={styles._backIcon} color={TEXT_DARK} />
              </Pressable>

              <Text style={styles.heroTitle} numberOfLines={1}>
                {incidentTitle}
              </Text>

              {/* right spacer to keep title visually centered between left/right */}
              <View style={{ width: styles._backBox, height: styles._backBox }} />
            </View>

            {/* ✅ Row 2: Status centered */}
            <View style={styles.heroStatusCenterRow}>
              <View style={[styles.statusPill, { borderColor: BORDER, backgroundColor: "#FFFFFF" }]}>
                <View style={[styles.dot, { backgroundColor: accent }]} />
                <Ionicons name={sIcon} size={styles._miniIcon} color={accent} />
                <Text style={[styles.statusPillText, { color: accent }]} numberOfLines={1}>
                  {statusUpper}
                </Text>
              </View>
            </View>

            <View style={styles.tabsWrap} onLayout={(e) => setTabW(e.nativeEvent.layout.width)}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.tabUnderline,
                  {
                    width: tabW / 2,
                    transform: [{ translateX: underlineX }],
                  },
                ]}
              >
                <LinearGradient
                  colors={gradColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>

              <Pressable onPress={() => setView("details")} style={({ pressed }) => [styles.tabBtn, pressed && { opacity: 0.92 }]}>
                <Text style={[styles.tabText, view === "details" && styles.tabTextActive]}>Incident Details</Text>
              </Pressable>

              <Pressable onPress={() => setView("threads")} style={({ pressed }) => [styles.tabBtn, pressed && { opacity: 0.92 }]}>
                <Text style={[styles.tabText, view === "threads" && styles.tabTextActive]}>Threads</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {view === "details" ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.detailsScroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: RESERVED_BOTTOM + DETAILS_EXTRA_BOTTOM }]}
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

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="document-text-outline" size={styles._iconSize} color={TEXT_DARK} />
                <Text style={styles.sectionTitle}>Incident narrative</Text>
              </View>
              <Text style={styles.narrativeText}>{incidentNarrative}</Text>
            </View>

            <View style={styles.metaGrid}>
              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={styles._miniIcon} color={TEXT_MUTED} />
                  <Text style={styles.metaLabel}>Date</Text>
                </View>
                <Text style={styles.metaValue}>{dateLabel}</Text>
              </View>

              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={styles._miniIcon} color={TEXT_MUTED} />
                  <Text style={styles.metaLabel}>Time</Text>
                </View>
                <Text style={styles.metaValue}>{timeLabel}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="location-outline" size={styles._iconSize} color={TEXT_DARK} />
                <Text style={styles.sectionTitle}>Location</Text>
              </View>
              <Text style={styles.locationText}>{locationLabel}</Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="person-circle-outline" size={styles._iconSize} color={TEXT_DARK} />
                <Text style={styles.sectionTitle}>Witness</Text>
              </View>

              <View style={styles.witnessRow}>
                <View style={styles.witnessBadge}>
                  <Ionicons name="person-outline" size={styles._miniIcon} color={TEXT_MUTED} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.witnessName} numberOfLines={1}>
                    {witnessName}
                  </Text>
                  <Text style={styles.witnessRole} numberOfLines={1}>
                    {witnessRole}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="images-outline" size={styles._iconSize} color={TEXT_DARK} />
                <Text style={styles.sectionTitle}>Evidence</Text>
                <Text style={styles.sectionHint}>{photoUrls.length} photo(s)</Text>
              </View>

              {photoUrls.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                  {photoUrls.map((u, i) => (
                    <Pressable key={i} onPress={() => openViewer(i)} style={({ pressed }) => [styles.photoCard, pressed && { opacity: 0.92 }]}>
                      <Image source={{ uri: u }} style={styles.photoImg} resizeMode="cover" />
                      <View style={styles.photoOverlay}>
                        <Ionicons name="expand-outline" size={styles._miniIcon} color="#FFFFFF" />
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyEvidence}>
                  <Ionicons name="image-outline" size={styles._emptyIcon} color="#94A3B8" />
                  <Text style={styles.emptyEvidenceText}>No uploaded evidence yet.</Text>
                </View>
              )}
            </View>

            {/* ✅ Cancel moved to bottom ABOVE Alert no */}
            {canCancel ? (
              <View style={styles.cancelBottomWrap}>
                <Pressable
                  onPress={cancelReport}
                  disabled={cancelling}
                  style={({ pressed }) => [
                    styles.cancelBottomBtn,
                    pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                    cancelling && { opacity: 0.7 },
                  ]}
                >
                  {cancelling ? (
                    <ActivityIndicator />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={styles._cancelIcon} color="#DC2626" />
                      <Text style={styles.cancelBottomText} numberOfLines={1}>
                        Cancel report
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.footerNote}>
              Alert no: <Text style={styles.footerCode}>{reportCode}</Text>
            </Text>
          </ScrollView>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: BG }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={keyboardOffset}
          >
            <View style={styles.threadsWrap}>
              {!reportId ? (
                <View style={styles.bannerDanger}>
                  <Ionicons name="warning-outline" size={styles._miniIcon} color="#B91C1C" />
                  <Text style={styles.bannerDangerText}>Missing report id. Cannot load threads.</Text>
                </View>
              ) : loadingThreads ? (
                <View style={styles.bannerNeutral}>
                  <ActivityIndicator />
                  <Text style={styles.bannerNeutralText}>Loading threads…</Text>
                </View>
              ) : threadsError ? (
                <View style={styles.bannerDanger}>
                  <Ionicons name="alert-circle-outline" size={styles._miniIcon} color="#B91C1C" />
                  <Text style={styles.bannerDangerText}>{threadsError}</Text>
                  <Pressable
                    onPress={() => {
                      lastThreadsLoadedIdRef.current = "";
                      loadThreads(true);
                    }}
                    style={({ pressed }) => [styles.bannerBtn, pressed && { opacity: 0.92 }]}
                  >
                    <Text style={styles.bannerBtnText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={[styles.chatSurface, { marginBottom: threadsBottomGap }]}>
                <ScrollView
                  ref={(r) => {
                    threadScrollRef.current = r;
                  }}
                  style={styles.chatScroll}
                  contentContainerStyle={styles.chatContent}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {messages.length === 0 && !loadingThreads && !threadsError ? (
                    <View style={styles.emptyChat}>
                      <Ionicons name="chatbubble-ellipses-outline" size={styles._emptyIcon} color="#94A3B8" />
                      <Text style={styles.emptyChatTitle}>No messages yet</Text>
                      <Text style={styles.emptyChatSub}>Send a message to follow up this report.</Text>
                    </View>
                  ) : null}

                  {messages.map((m) => {
                    const isLeft = m.side === "left";
                    return (
                      <View key={m.id} style={styles.msgBlock}>
                        {isLeft && m.sender ? (
                          <Text style={styles.msgTopLine}>
                            {m.sender} <Text style={styles.msgTime}>• {m.time}</Text>
                          </Text>
                        ) : null}

                        <View style={[styles.msgRow, isLeft ? styles.msgRowLeft : styles.msgRowRight]}>
                          <View
                            style={[
                              styles.bubble,
                              isLeft ? styles.bubbleLeft : styles.bubbleRight,
                              !isLeft && { borderColor: BORDER },
                            ]}
                          >
                            <Text style={[styles.bubbleText, isLeft ? styles.bubbleTextLeft : styles.bubbleTextRight]}>
                              {m.text}
                            </Text>
                          </View>
                        </View>

                        {!isLeft ? (
                          <Text style={[styles.msgTime, { textAlign: "right", marginTop: vscale(4) }]}>{m.time}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={styles.composerRow}>
                  <View style={styles.composerInputWrap}>
                    <Ionicons name="chatbox-ellipses-outline" size={styles._miniIcon} color="#94A3B8" />
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Write a message…"
                      placeholderTextColor="#9AA4B2"
                      style={styles.composerInput}
                      returnKeyType="send"
                      onSubmitEditing={onSend}
                      editable={!sending && !!reportId}
                      blurOnSubmit={false}
                      multiline={false}
                      textAlignVertical="center"
                      {...(Platform.OS === "android" ? { includeFontPadding: false as any } : null)}
                    />
                  </View>

                  <Pressable
                    onPress={onSend}
                    disabled={sending || !reportId}
                    style={({ pressed }) => [
                      styles.sendBtn,
                      pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
                      (sending || !reportId) && { opacity: 0.7 },
                    ]}
                  >
                    {sending ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send" size={styles._sendIcon} color="#FFFFFF" />}
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={pressFab}
          onFabLongPress={longPressFab}
          centerLabel="Incident Log"
        />
      </View>
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
  const _sendIcon = scale(18);

  const _viewerIcon = scale(22);
  const _viewerPad = scale(40);

  const _cancelIcon = scale(16);

  return Object.assign(
    StyleSheet.create({
      safe: { flex: 1, backgroundColor: BG },
      page: { flex: 1, backgroundColor: BG },

      heroWrap: { paddingHorizontal: sidePad, paddingBottom: vscale(10), backgroundColor: BG },

      heroCard: {
        ...CONTENT_ALIGN,
        borderRadius: CARD_R,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: SURFACE,
        paddingHorizontal: scale(12),
        paddingVertical: vscale(12),
      },

      // ✅ header: align title with back arrow
      heroHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: scale(10),
      },

      backBtn: {
        width: _backBox,
        height: _backBox,
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
      },

      heroTitle: {
        flex: 1,
        fontSize: scale(isTablet ? 18 : 16.5),
        fontWeight: "900",
        color: TEXT_DARK,
        letterSpacing: 0.1,
        textAlign: "left", // aligned to back arrow row
      },

      // ✅ status centered
      heroStatusCenterRow: {
        marginTop: vscale(8),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
      },

      statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        paddingHorizontal: scale(10),
        paddingVertical: vscale(6),
        borderRadius: scale(999),
        borderWidth: 1,
      },
      statusPillText: { fontSize: scale(10.5), fontWeight: "900" },
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

      locationText: { fontSize: scale(isTablet ? 12.5 : 11.5), fontWeight: "400", color: TEXT_MUTED, lineHeight: vscale(isTablet ? 18 : 16) },

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
      emptyEvidenceText: { fontSize: scale(11), fontWeight: "400", color: "#94A3B8" },

      // ✅ cancel at bottom
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

      footerNote: {
        ...CONTENT_ALIGN,
        paddingTop: vscale(2),
        paddingBottom: vscale(12),
        textAlign: "center",
        fontSize: scale(10.5),
        fontWeight: "400",
        color: "#94A3B8",
      },
      footerCode: { color: primary, fontWeight: "900" },

      threadsWrap: { flex: 1, paddingHorizontal: sidePad, paddingTop: vscale(2), gap: vscale(12), backgroundColor: BG },

      chatSurface: {
        ...CONTENT_ALIGN,
        flex: 1,
        borderRadius: CARD_R,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: SURFACE,
        overflow: "hidden",
      },

      chatScroll: { flex: 1, backgroundColor: "#FFFFFF" },
      chatContent: { paddingHorizontal: scale(12), paddingVertical: vscale(12), paddingBottom: vscale(12) + vscale(64) },

      emptyChat: { alignItems: "center", justifyContent: "center", paddingVertical: vscale(24), gap: vscale(6) },
      emptyChatTitle: { fontSize: scale(isTablet ? 13 : 12), fontWeight: "900", color: TEXT_DARK },
      emptyChatSub: { fontSize: scale(10.5), fontWeight: "400", color: "#94A3B8", textAlign: "center" },

      msgBlock: { marginBottom: vscale(12) },
      msgTopLine: { fontSize: scale(10), fontWeight: "900", color: "#6B7280", marginBottom: vscale(6) },
      msgTime: { fontSize: scale(9), fontWeight: "400", color: "#94A3B8" },

      msgRow: { flexDirection: "row", alignItems: "flex-end" },
      msgRowLeft: { justifyContent: "flex-start" },
      msgRowRight: { justifyContent: "flex-end" },

      bubble: { maxWidth: isTablet ? "70%" : "82%", borderRadius: scale(16), paddingHorizontal: scale(12), paddingVertical: vscale(10), borderWidth: 1 },
      bubbleLeft: { backgroundColor: "#EEF2F7", borderColor: "#E6ECF5" },
      bubbleRight: { backgroundColor: "#FFFFFF" },

      bubbleText: { fontSize: scale(isTablet ? 12 : 11), fontWeight: "400", lineHeight: vscale(isTablet ? 16 : 15) },
      bubbleTextLeft: { color: "#334155" },
      bubbleTextRight: { color: "#0F172A" },

      composerRow: {
        paddingHorizontal: scale(12),
        paddingVertical: vscale(10),
        borderTopWidth: 1,
        borderTopColor: BORDER,
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
      },
      composerInputWrap: {
        flex: 1,
        minHeight: vscale(42),
        borderRadius: scale(999),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#F8FAFC",
        paddingHorizontal: scale(12),
        flexDirection: "row",
        alignItems: "center",
        gap: scale(8),
      },
      composerInput: { flex: 1, height: vscale(42), paddingVertical: 0, fontSize: scale(isTablet ? 12 : 11), fontWeight: "400", color: "#111827" },

      sendBtn: { width: scale(44), height: scale(44), borderRadius: scale(22), backgroundColor: primary, alignItems: "center", justifyContent: "center" },

      bannerNeutral: { ...CONTENT_ALIGN, flexDirection: "row", alignItems: "center", gap: scale(10), borderRadius: scale(14), borderWidth: 1, borderColor: BORDER, backgroundColor: "#FFFFFF", paddingHorizontal: scale(12), paddingVertical: vscale(10) },
      bannerNeutralText: { fontSize: scale(10.5), fontWeight: "400", color: TEXT_MUTED },

      bannerDanger: { ...CONTENT_ALIGN, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: scale(10), borderRadius: scale(14), borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FEF2F2", paddingHorizontal: scale(12), paddingVertical: vscale(10) },
      bannerDangerText: { flex: 1, fontSize: scale(10.5), fontWeight: "400", color: "#B91C1C" },

      bannerBtn: { paddingHorizontal: scale(12), paddingVertical: vscale(8), borderRadius: scale(12), borderWidth: 1, borderColor: BORDER, backgroundColor: "#FFFFFF" },
      bannerBtnText: { fontSize: scale(10.5), fontWeight: "900", color: primary },

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
      viewerIconBtn: { width: _viewerPad, height: _viewerPad, borderRadius: _viewerPad / 2, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
      viewerCounter: { fontSize: scale(12), fontWeight: "900", color: "#FFFFFF", maxWidth: "65%", textAlign: "center" },
      viewerStage: { flex: 1, paddingTop: vscale(70), paddingBottom: vscale(36) },
      viewerStageInner: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: sidePad },
      viewerImage: { width: "100%", height: "100%" },

      viewerNavBtn: { position: "absolute", top: "50%", marginTop: -scale(22), width: scale(44), height: scale(44), borderRadius: scale(22), backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
      viewerNavLeft: { left: sidePad },
      viewerNavRight: { right: sidePad },

      viewerHint: { position: "absolute", bottom: vscale(10), left: 0, right: 0, textAlign: "center", fontSize: scale(10.5), fontWeight: "400", color: "rgba(255,255,255,0.72)" },
    }),
    {
      _iconSize,
      _miniIcon,
      _emptyIcon,
      _backBox,
      _backIcon,
      _sendIcon,
      _viewerIcon,
      _viewerPad,
      _cancelIcon,
    }
  ) as any;
}