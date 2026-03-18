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
  AppState,
  AppStateStatus,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors, useColors } from "../theme/colors";

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

  createdAtMs?: number;

  // ✅ optimistic state
  pending?: boolean;
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
  const createdAtMs = dto.createdAt ? new Date(dto.createdAt).getTime() : undefined;

  return {
    id: dto._id,
    side: isResident ? "right" : "left",
    sender: isResident ? undefined : dto.senderName || "Staff",
    text: dto.text,
    time: dto.createdAt ? formatStamp(new Date(dto.createdAt)) : "",
    createdAtMs,
    pending: false,
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

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [view, setView] = useState<ViewKey>("details");

  // =========================
  // ✅ BottomNavBar sizing (prevent FAB from getting bigger here)
  // =========================
  const NAV_BASE_HEIGHT = vscale(74);

  // ✅ IMPORTANT: do NOT allow FAB_SIZE to grow above 62
  const FAB_SIZE = clamp(scale(62), 56, 62);

  const bottomInset = Math.max(0, insets.bottom);
  const navHeight = NAV_BASE_HEIGHT + bottomInset;
  const paddingBottom = bottomInset;

  const fabBottom = bottomInset + (NAV_BASE_HEIGHT - FAB_SIZE / 2 - vscale(10));
  const chevronBottom = navHeight + vscale(90);

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

  const [cancelling, setCancelling] = useState(false);

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

  // =========================
  // ✅ REALTIME-LIKE THREADS (DEDUPED)
  // =========================
  const POLL_MS = 4000;

  const isAtBottomRef = useRef(true);
  const [newMsgCount, setNewMsgCount] = useState(0);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const pendingOptimisticRef = useRef<
    Map<string, { text: string; createdAtMs: number; side: "left" | "right" }>
  >(new Map());

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      threadScrollRef.current?.scrollToEnd({ animated });
    });
  }, []);

  function findMatchingServerMessage(
    optimistic: { text: string; createdAtMs: number; side: "left" | "right" },
    serverMsgs: ThreadMsg[]
  ) {
    const WINDOW_MS = 8000;
    const wantText = optimistic.text.trim();
    if (!wantText) return null;

    const candidates = serverMsgs.filter((m) => m.side === optimistic.side && !m.pending);

    let best: ThreadMsg | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;

    for (const m of candidates) {
      if (m.text.trim() !== wantText) continue;
      const t = m.createdAtMs ?? 0;
      if (!t) continue;
      const delta = Math.abs(t - optimistic.createdAtMs);
      if (delta <= WINDOW_MS && delta < bestDelta) {
        best = m;
        bestDelta = delta;
      }
    }
    return best;
  }

  const mergeThreadDtos = useCallback(
    (list: ThreadDto[]) => {
      const incoming = (list || []).map(dtoToUi);

      setMessages((prev) => {
        const incomingNonPending = incoming;

        const pendingMap = pendingOptimisticRef.current;

        const prevFiltered: ThreadMsg[] = [];
        for (const m of prev) {
          if (m.pending && pendingMap.has(m.id)) {
            const meta = pendingMap.get(m.id)!;
            const match = findMatchingServerMessage(meta, incomingNonPending);
            if (match) {
              pendingMap.delete(m.id);
              continue;
            }
          }
          prevFiltered.push(m);
        }

        const map = new Map<string, ThreadMsg>();

        for (const m of prevFiltered) map.set(m.id, m);
        for (const m of incomingNonPending) map.set(m.id, m);

        const merged = Array.from(map.values());

        merged.sort((a, b) => {
          const aa = a.createdAtMs ?? 0;
          const bb = b.createdAtMs ?? 0;
          if (aa !== bb) return aa - bb;
          return a.id.localeCompare(b.id);
        });

        const added = merged.length - prev.length;
        if (added > 0 && !isAtBottomRef.current) {
          setNewMsgCount((c) => c + added);
        }
        if (added > 0 && isAtBottomRef.current) {
          setTimeout(() => scrollToBottom(true), 60);
        }

        return merged;
      });
    },
    [scrollToBottom]
  );

  const refreshThreads = useCallback(
    async (opts?: { showLoader?: boolean }) => {
      if (!reportId) return;
      if (threadsInFlightRef.current) return;

      try {
        threadsAbortRef.current?.abort();
      } catch {}
      const controller = new AbortController();
      threadsAbortRef.current = controller;

      threadsInFlightRef.current = true;
      if (opts?.showLoader) setLoadingThreads(true);
      setThreadsError("");

      try {
        const list = await fetchReportThreads(reportId, controller.signal);

        if (!mountedRef.current) return;
        if (controller.signal.aborted) return;

        mergeThreadDtos(list || []);
      } catch (e: any) {
        if (!mountedRef.current) return;
        if (isAbortError(e)) return;
        setThreadsError(e?.message || "Failed to load threads");
      } finally {
        if (mountedRef.current && !controller.signal.aborted) setLoadingThreads(false);
        threadsInFlightRef.current = false;
      }
    },
    [reportId, mergeThreadDtos]
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();

    if (!reportId) return;
    if (view !== "threads") return;
    if (appStateRef.current !== "active") return;

    refreshThreads({ showLoader: messages.length === 0 });

    pollTimerRef.current = setInterval(() => {
      refreshThreads({ showLoader: false });
    }, POLL_MS);
  }, [stopPolling, reportId, view, refreshThreads, messages.length]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appStateRef.current = next;
      if (next === "active") startPolling();
      else stopPolling();
    });
    return () => sub.remove();
  }, [startPolling, stopPolling]);

  useEffect(() => {
    if (view === "threads") {
      startPolling();
    } else {
      stopPolling();
      try {
        threadsAbortRef.current?.abort();
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, reportId]);

  // =========================
  // END THREADS
  // =========================

  useEffect(() => {
    try {
      detailAbortRef.current?.abort();
      threadsAbortRef.current?.abort();
    } catch {}

    detailInFlightRef.current = false;
    threadsInFlightRef.current = false;

    lastDetailLoadedIdRef.current = "";

    setDetail(null);
    setDetailError("");
    setLoadingDetail(false);

    setMessages([]);
    setThreadsError("");
    setLoadingThreads(false);
    setNewMsgCount(0);
    isAtBottomRef.current = true;

    pendingOptimisticRef.current.clear();

    if (reportId) loadDetail(true);
    else setDetailError("Missing report id.");
  }, [reportId, loadDetail]);

  const onSend = useCallback(async () => {
    const t = draft.trim();
    if (!t) return;

    if (!reportId) {
      Alert.alert("Missing report id", "Cannot send message because reportId is empty.");
      return;
    }
    if (sending) return;

    setSending(true);

    const now = Date.now();
    const tmpId = `tmp_${now}`;

    const optimistic: ThreadMsg = {
      id: tmpId,
      side: "right",
      text: t,
      time: formatStamp(new Date()),
      createdAtMs: now,
      pending: true,
    };

    pendingOptimisticRef.current.set(tmpId, { text: t, createdAtMs: now, side: "right" });

    isAtBottomRef.current = true;
    setNewMsgCount(0);

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    setTimeout(() => scrollToBottom(true), 60);

    const controller = new AbortController();

    try {
      await sendReportThreadMessage(reportId, t, controller.signal);

      await refreshThreads({ showLoader: false });

      setTimeout(() => {
        setMessages((prev) => {
          if (!pendingOptimisticRef.current.has(tmpId)) return prev;
          refreshThreads({ showLoader: false });
          return prev;
        });
      }, 800);
    } catch (e: any) {
      if (!isAbortError(e)) {
        Alert.alert("Send failed", e?.message || "Could not send message.");
      }
      pendingOptimisticRef.current.delete(tmpId);
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      setDraft(t);
    } finally {
      setSending(false);
    }
  }, [draft, reportId, sending, scrollToBottom, refreshThreads]);

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
          },
        },
      ]
    );
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
    const urls = photosRaw.map((p) => buildReportPhotoUrl(reportId, p)).filter(Boolean) as string[];
    if (__DEV__) {
      console.log("[ReportDetail] photosRaw:", JSON.stringify(photosRaw));
      console.log("[ReportDetail] photoUrls:", urls);
    }
    return urls;
  }, [photosRaw, reportId]);

  const reportCode = String((report as any)?.alertNo ?? (reportId ? `#${reportId.slice(-4)}` : "#—"));

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

  const canCancel =
    !!resolvedReportId &&
    isObjectId24(resolvedReportId) &&
    statusUpper !== "CANCELLED" &&
    statusUpper !== "RESOLVED";
  const canChat = !!reportId && statusUpper !== "CANCELLED" && statusUpper !== "RESOLVED";

  const [composerH, setComposerH] = useState(vscale(64));

  // ✅ FIX: only reserve the true safe-area inset (don’t inflate with extra vscale(10))
  const threadsNavReserve = Math.max(0, insets.bottom);

  // ✅ FIX: composer should have a SMALL minimum padding, but not double-count insets
  const composerBottomPad = Math.max(insets.bottom, vscale(6));

  useEffect(() => {
    if (view !== "threads") return;
    if (!isKeyboardVisible) return;
    setTimeout(() => scrollToBottom(true), 60);
  }, [isKeyboardVisible, view, scrollToBottom]);

  const onChatScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const y = contentOffset.y;
    const visibleH = layoutMeasurement.height;
    const contentH = contentSize.height;

    const distanceFromBottom = contentH - visibleH - y;

    const atBottom = distanceFromBottom < 40;
    (isAtBottomRef as any).current = atBottom;

    if (atBottom) setNewMsgCount(0);
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: TC.screenBg }]} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

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

      <View style={[styles.page, { backgroundColor: TC.screenBg }]}>
        <View style={[styles.heroWrap, { paddingTop: Math.max(insets.top, vscale(6)), backgroundColor: TC.screenBg }]}>
          <View style={[styles.heroCard, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
            <View style={styles.heroHeaderRow}>
              <Pressable
                onPress={onBack}
                hitSlop={12}
                style={({ pressed }) => [styles.backBtn, { backgroundColor: TC.surface, borderColor: TC.divider }, pressed && { opacity: 0.75 }]}
              >
                <Ionicons name="chevron-back" size={styles._backIcon} color={TC.textDark} />
              </Pressable>

              <Text style={[styles.heroTitle, { color: TC.textDark }]} numberOfLines={1}>
                {incidentTitle}
              </Text>

              <View style={{ width: styles._backBox, height: styles._backBox }} />
            </View>

            <View style={styles.heroStatusCenterRow}>
              <View style={[styles.statusPill, { borderColor: TC.divider, backgroundColor: TC.surface }]}>
                <View style={[styles.dot, { backgroundColor: accent }]} />
                <Ionicons name={sIcon} size={styles._miniIcon} color={accent} />
                <Text style={[styles.statusPillText, { color: accent }]} numberOfLines={1}>
                  {statusUpper}
                </Text>
              </View>
            </View>

            <View style={[styles.tabsWrap, { borderColor: TC.divider, backgroundColor: TC.inputBg }]} onLayout={(e) => setTabW(e.nativeEvent.layout.width)}>
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
                  colors={TC.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>

              <Pressable
                onPress={() => setView("details")}
                style={({ pressed }) => [styles.tabBtn, pressed && { opacity: 0.92 }]}
              >
                <Text style={[styles.tabText, { color: TC.primary }, view === "details" && styles.tabTextActive]}>Incident Details</Text>
              </Pressable>

              <Pressable
                onPress={() => setView("threads")}
                style={({ pressed }) => [styles.tabBtn, pressed && { opacity: 0.92 }]}
              >
                <Text style={[styles.tabText, { color: TC.primary }, view === "threads" && styles.tabTextActive]}>Threads</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {view === "details" ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={[styles.detailsScroll, { backgroundColor: TC.screenBg }]}
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

            <View style={[styles.sectionCard, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="document-text-outline" size={styles._iconSize} color={TC.textDark} />
                <Text style={[styles.sectionTitle, { color: TC.textDark }]}>Incident narrative</Text>
              </View>
              <Text style={[styles.narrativeText, { color: TC.muted }]}>{incidentNarrative}</Text>
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
                    <Pressable
                      key={i}
                      onPress={() => openViewer(i)}
                      style={({ pressed }) => [styles.photoCard, pressed && { opacity: 0.92 }]}
                    >
                      <Image
                        source={{ uri: u }}
                        style={styles.photoImg}
                        resizeMode="cover"
                        onError={(e) => {
                          if (__DEV__) console.log("[ReportDetail] Image load error:", u, e.nativeEvent?.error);
                        }}
                      />
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
            style={styles.threadsKav}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                    onPress={() => refreshThreads({ showLoader: true })}
                    style={({ pressed }) => [styles.bannerBtn, pressed && { opacity: 0.92 }]}
                  >
                    <Text style={styles.bannerBtnText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.chatSurface}>
                <ScrollView
                  ref={(r) => {
                    threadScrollRef.current = r;
                  }}
                  style={styles.chatScroll}
                  contentContainerStyle={[
                    styles.chatContent,
                    {
                      // ✅ FIX: only account for composer + ONE bottom pad
                      paddingBottom: composerH + composerBottomPad + vscale(12),
                    },
                  ]}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                  onScroll={onChatScroll}
                  scrollEventThrottle={16}
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
                              m.pending && { opacity: 0.72 },
                            ]}
                          >
                            <Text style={[styles.bubbleText, isLeft ? styles.bubbleTextLeft : styles.bubbleTextRight]}>
                              {m.text}
                            </Text>
                          </View>
                        </View>

                        {!isLeft ? (
                          <Text style={[styles.msgTime, { textAlign: "right", marginTop: vscale(4) }]}>
                            {m.pending ? "Sending…" : m.time}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>

                {newMsgCount > 0 ? (
                  <View style={styles.newMsgPillWrap} pointerEvents="box-none">
                    <Pressable
                      onPress={() => {
                        (isAtBottomRef as any).current = true;
                        setNewMsgCount(0);
                        scrollToBottom(true);
                      }}
                      style={({ pressed }) => [
                        styles.newMsgPill,
                        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                      ]}
                    >
                      <Ionicons name="arrow-down" size={styles._miniIcon} color="#FFFFFF" />
                      <Text style={styles.newMsgPillText}>{newMsgCount} new message(s)</Text>
                    </Pressable>
                  </View>
                ) : null}

                {!canChat && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
                    <Text style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>
                      This report is {statusUpper.toLowerCase()} — messaging is disabled
                    </Text>
                  </View>
                )}
                <View
                  // ✅ FIX: don’t add threadsNavReserve here; just one bottom inset (small)
                  style={[styles.composerRow, { paddingBottom: composerBottomPad }]}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (h && Math.abs(h - composerH) > 2) setComposerH(h);
                  }}
                >
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
                      editable={!sending && canChat}
                      blurOnSubmit={false}
                      multiline={false}
                      textAlignVertical="center"
                      onFocus={() => {
                        setTimeout(() => scrollToBottom(true), 60);
                      }}
                      {...(Platform.OS === "android" ? { includeFontPadding: false as any } : null)}
                    />
                  </View>

                  <Pressable
                    onPress={onSend}
                    disabled={sending || !canChat}
                    style={({ pressed }) => [
                      styles.sendBtn,
                      pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
                      (sending || !canChat) && { opacity: 0.7 },
                    ]}
                  >
                    {sending ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Ionicons name="send" size={styles._sendIcon} color="#FFFFFF" />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        {view !== "threads" ? (
          <BottomNavBar
            activeTab={activeTab}
            onTabPress={handleTab}
            navHeight={navHeight}
            paddingBottom={paddingBottom}
            chevronBottom={chevronBottom}
            fabBottom={fabBottom}
            fabSize={FAB_SIZE}
            onFabPress={pressFab}
            onFabLongPress={longPressFab}
            centerLabel="Incident Log"
          />
        ) : null}
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
        textAlign: "left",
      },

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

      locationText: {
        fontSize: scale(isTablet ? 12.5 : 11.5),
        fontWeight: "400",
        color: TEXT_MUTED,
        lineHeight: vscale(isTablet ? 18 : 16),
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
      emptyEvidenceText: { fontSize: scale(11), fontWeight: "400", color: "#94A3B8" },

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

      threadsKav: { flex: 1, backgroundColor: BG },

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
      chatContent: { paddingHorizontal: scale(12), paddingVertical: vscale(12) },

      emptyChat: { alignItems: "center", justifyContent: "center", paddingVertical: vscale(24), gap: vscale(6) },
      emptyChatTitle: { fontSize: scale(isTablet ? 13 : 12), fontWeight: "900", color: TEXT_DARK },
      emptyChatSub: { fontSize: scale(10.5), fontWeight: "400", color: "#94A3B8", textAlign: "center" },

      msgBlock: { marginBottom: vscale(12) },
      msgTopLine: { fontSize: scale(10), fontWeight: "900", color: "#6B7280", marginBottom: vscale(6) },
      msgTime: { fontSize: scale(9), fontWeight: "400", color: "#94A3B8" },

      msgRow: { flexDirection: "row", alignItems: "flex-end" },
      msgRowLeft: { justifyContent: "flex-start" },
      msgRowRight: { justifyContent: "flex-end" },

      bubble: {
        maxWidth: isTablet ? "70%" : "82%",
        borderRadius: scale(16),
        paddingHorizontal: scale(12),
        paddingVertical: vscale(10),
        borderWidth: 1,
      },
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
      composerInput: {
        flex: 1,
        height: vscale(42),
        paddingVertical: 0,
        fontSize: scale(isTablet ? 12 : 11),
        fontWeight: "400",
        color: "#111827",
      },

      sendBtn: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        backgroundColor: primary,
        alignItems: "center",
        justifyContent: "center",
      },

      bannerNeutral: {
        ...CONTENT_ALIGN,
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(10),
      },
      bannerNeutralText: { fontSize: scale(10.5), fontWeight: "400", color: TEXT_MUTED },

      bannerDanger: {
        ...CONTENT_ALIGN,
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: scale(10),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: "#FECACA",
        backgroundColor: "#FEF2F2",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(10),
      },
      bannerDangerText: { flex: 1, fontSize: scale(10.5), fontWeight: "400", color: "#B91C1C" },

      bannerBtn: {
        paddingHorizontal: scale(12),
        paddingVertical: vscale(8),
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#FFFFFF",
      },
      bannerBtnText: { fontSize: scale(10.5), fontWeight: "900", color: primary },

      newMsgPillWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: vscale(74),
        alignItems: "center",
        zIndex: 10,
      },
      newMsgPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(8),
        paddingHorizontal: scale(12),
        paddingVertical: vscale(8),
        borderRadius: scale(999),
        backgroundColor: primary,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.25)",
      },
      newMsgPillText: { fontSize: scale(10.5), fontWeight: "900", color: "#FFFFFF" },

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
      _sendIcon,
      _viewerIcon,
      _viewerPad,
      _cancelIcon,
    }
  ) as any;
}
