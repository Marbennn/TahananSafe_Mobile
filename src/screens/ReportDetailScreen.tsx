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
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
  Keyboard,
  Modal,
  AppState,
  AppStateStatus,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

import type { TabKey } from "../components/BottomNavBar";
import LogoutModal from "../components/LogoutModal";
import IncidentVideoPreviewModal from "../components/IncidentVideoPreviewModal";
import { Colors, useColors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { fetchMyNotifications, toggleNotificationRead } from "../api/notifications";

import type { ReportItem } from "./ReportScreen";
import {
  fetchReportDetail,
  fetchReportThreads,
  fetchReportTyping,
  setReportTyping,
  sendReportThreadMessage,
  updateReportThreadMessage,
  deleteReportThreadMessage,
  ThreadDto,
  ReportDetailDto,
  buildReportPhotoUrl,
} from "../api/reports";

// ✅ token + base url for cancel action
import { getAccessToken } from "../auth/session";

type ViewKey = "details" | "messages" | "timeline";

type ThreadMsg = {
  id: string;
  side: "left" | "right";
  sender?: string;
  text: string;
  time: string;

  createdAtMs?: number;
  editedAt?: string | null;
  deletedAt?: string | null;
  deletedByRole?: "resident" | "staff" | null;
  replyTo?: {
    threadId?: string | null;
    sender?: string;
    side: "left" | "right";
    text: string;
  } | null;

  // ✅ optimistic state
  pending?: boolean;
};

const RESPONDER_LABEL = "Barangay Admin";

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

function formatThreadMeta(msg: ThreadMsg) {
  if (msg.pending) return "Sending...";
  return msg.editedAt ? `${msg.time} • Edited` : msg.time;
}

function formatChatTime(msg: ThreadMsg) {
  if (msg.pending) return "Sending";
  if (msg.createdAtMs && Number.isFinite(msg.createdAtMs)) {
    return new Date(msg.createdAtMs).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  const parts = String(msg.time || "").split(",");
  return (parts[parts.length - 1] || msg.time || "").trim();
}

function formatChatDayPill(msg?: ThreadMsg) {
  if (!msg?.createdAtMs || !Number.isFinite(msg.createdAtMs)) return "Today";
  const d = new Date(msg.createdAtMs);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const day = isToday
    ? "Today"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day}, ${formatChatTime(msg)}`;
}

function getThreadSenderLabel(msg?: ThreadMsg | null) {
  if (!msg) return RESPONDER_LABEL;
  return msg.side === "right" ? "You" : msg.sender || RESPONDER_LABEL;
}

function getReplyIndicatorText(msg: ThreadMsg) {
  const targetLabel = msg.replyTo?.sender || (msg.replyTo?.side === "right" ? "You" : RESPONDER_LABEL);
  const actorLabel = msg.side === "right" ? "You" : msg.sender || RESPONDER_LABEL;
  return `${actorLabel} replied to ${targetLabel}`;
}

function getDeletedMessageLabel(msg: ThreadMsg) {
  return msg.side === "right" ? "You deleted a message" : `${msg.sender || RESPONDER_LABEL} deleted a message`;
}

function getThreadBubbleMaxWidth(text: string, isTablet: boolean) {
  const clean = String(text || "").trim();
  if (!clean) return isTablet ? "34%" : "40%";

  const lines = clean
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const words = clean.split(/\s+/).filter(Boolean);

  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0);
  const effectiveLength = Math.max(clean.length, longestLine, Math.round(longestWord * 1.2));

  if (effectiveLength <= 8) return isTablet ? "26%" : "32%";
  if (effectiveLength <= 14) return isTablet ? "32%" : "40%";
  if (effectiveLength <= 22) return isTablet ? "40%" : "50%";
  if (effectiveLength <= 34) return isTablet ? "46%" : "56%";
  if (effectiveLength <= 48) return isTablet ? "52%" : "60%";
  if (effectiveLength <= 64) return isTablet ? "58%" : "66%";
  return isTablet ? "62%" : "68%";
}

function getThreadBubbleMinWidthPx(
  text: string,
  isTablet: boolean,
  maxWidthPx: number,
  scale: (n: number) => number
) {
  const clean = String(text || "").trim();
  if (!clean) return scale(54);

  const words = clean.split(/\s+/).filter(Boolean);
  const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0);
  const effectiveLength = Math.max(clean.length, Math.round(longestWord * 1.25));

  if (effectiveLength <= 8) return scale(54);
  if (effectiveLength <= 14) return Math.round(maxWidthPx * (isTablet ? 0.32 : 0.4));
  if (effectiveLength <= 22) return Math.round(maxWidthPx * (isTablet ? 0.42 : 0.5));
  if (effectiveLength <= 34) return Math.round(maxWidthPx * (isTablet ? 0.5 : 0.58));
  if (effectiveLength <= 48) return Math.round(maxWidthPx * (isTablet ? 0.54 : 0.62));
  if (effectiveLength <= 64) return Math.round(maxWidthPx * (isTablet ? 0.6 : 0.68));
  return Math.round(maxWidthPx * (isTablet ? 0.66 : 0.76));
}

function dtoToUi(dto: ThreadDto): ThreadMsg {
  const isResident = dto.senderRole === "resident";
  const createdAtMs = dto.createdAt ? new Date(dto.createdAt).getTime() : undefined;

  return {
    id: dto._id,
    side: isResident ? "right" : "left",
    sender: isResident ? undefined : RESPONDER_LABEL,
    text: dto.text,
    time: dto.createdAt ? formatStamp(new Date(dto.createdAt)) : "",
    createdAtMs,
    editedAt: dto.editedAt || null,
    deletedAt: dto.deletedAt || null,
    deletedByRole: dto.deletedByRole || null,
    replyTo: dto.replyTo
      ? {
          threadId: dto.replyTo.threadId || null,
          sender: dto.replyTo.senderRole === "resident" ? "You" : RESPONDER_LABEL,
          side: dto.replyTo.senderRole === "resident" ? "right" : "left",
          text: dto.replyTo.text || "",
        }
      : null,
    pending: false,
  };
}

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

function formatSavedPhoneNumber(phone?: string) {
  const raw = String(phone || "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;

  if (digits.length === 12 && digits.startsWith("63")) return `0${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith("0")) return digits;
  if (digits.length === 10 && digits.startsWith("9")) return `0${digits}`;

  return raw;
}

function getSavedPhoneCandidate(user: any) {
  return (
    user?.phoneNumber ||
    user?.contactNumber ||
    user?.phone ||
    user?.personalInfo?.contactNumber ||
    user?.personalInfo?.phoneNumber ||
    user?.profile?.contactNumber ||
    user?.profile?.phoneNumber ||
    ""
  );
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
  const { user, refreshMe } = useAuth();
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

  const [view, setView] = useState<ViewKey>("details");

  const messageDotAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const bottomInset = Math.max(0, insets.bottom);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const subShow = Keyboard.addListener(showEvt, (event: any) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(event?.endCoordinates?.height ?? 0);
    });
    const subHide = Keyboard.addListener(hideEvt, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const keyboardOffset = Platform.OS === "ios" ? Math.max(insets.top, vscale(6)) + vscale(44) : 0;

  const threadScrollRef = useRef<ScrollView | null>(null);
  const composerInputRef = useRef<TextInput | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preEditDraftRef = useRef("");
  const [draft, setDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState<ThreadMsg | null>(null);
  const [visibleMessageMetaId, setVisibleMessageMetaId] = useState("");
  const [messageMenuVisible, setMessageMenuVisible] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [deleteMessageModalVisible, setDeleteMessageModalVisible] = useState(false);
  const [deleteTargetMessageId, setDeleteTargetMessageId] = useState("");
  const [sharePhoneDismissed, setSharePhoneDismissed] = useState(false);

  const [loadingThreads, setLoadingThreads] = useState(false);
  const [sending, setSending] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [messages, setMessages] = useState<ThreadMsg[]>([]);
  const [measuredBubbleWidths, setMeasuredBubbleWidths] = useState<Record<string, number>>({});
  const [threadsError, setThreadsError] = useState("");

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

  const savedPhoneNumber = useMemo(() => formatSavedPhoneNumber(getSavedPhoneCandidate(user)), [user]);
  const savedPhoneDigits = useMemo(() => savedPhoneNumber.replace(/\D/g, ""), [savedPhoneNumber]);
  const hasSharedSavedPhone = useMemo(() => {
    if (!savedPhoneDigits) return false;
    const altDigits = savedPhoneDigits.length > 10 ? savedPhoneDigits.slice(-10) : savedPhoneDigits;

    return messages.some((m) => {
      if (m.side !== "right") return false;
      const msgDigits = String(m.text || "").replace(/\D/g, "");
      if (!msgDigits) return false;
      return msgDigits.includes(savedPhoneDigits) || (!!altDigits && msgDigits.includes(altDigits));
    });
  }, [messages, savedPhoneDigits]);
  const lastIncomingMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.side === "left") return msg;
    }
    return null;
  }, [messages]);
  const editingMessage = useMemo(
    () => messages.find((m) => m.id === editingMessageId) ?? null,
    [messages, editingMessageId]
  );
  const selectedThreadMessage = useMemo(
    () => messages.find((m) => m.id === selectedMessageId) ?? null,
    [messages, selectedMessageId]
  );

  const detailAbortRef = useRef<AbortController | null>(null);
  const threadsAbortRef = useRef<AbortController | null>(null);
  const triedRefreshPhoneRef = useRef(false);

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

  const refreshMessageNotifications = useCallback(async () => {
    if (!reportId) return;

    try {
      const notifications = await fetchMyNotifications(80);
      const unreadThreadCount = notifications.filter(
        (item) =>
          item.type === "thread" &&
          item.unread &&
          String(item.incidentId || "") === String(reportId)
      ).length;
      setNewMsgCount(unreadThreadCount);
    } catch {
      // Notification polling should never interrupt the report details screen.
    }
  }, [reportId]);

  useEffect(() => {
    if (!reportId || view === "messages") return;

    void refreshMessageNotifications();
    const timer = setInterval(() => {
      void refreshMessageNotifications();
    }, 5000);

    return () => clearInterval(timer);
  }, [reportId, refreshMessageNotifications, view]);

  const openMessagesModal = useCallback(async () => {
    setNewMsgCount(0);
    setView("messages");

    try {
      const notifications = await fetchMyNotifications(80);
      const unreadThreadNotifications = notifications.filter(
        (item) =>
          item.type === "thread" &&
          item.unread &&
          String(item.incidentId || "") === String(reportId)
      );

      await Promise.all(
        unreadThreadNotifications.map((item) => toggleNotificationRead(item.id))
      );
    } catch {
      // The messages modal remains usable even if notification acknowledgement fails.
    }
  }, [reportId]);

  useEffect(() => {
    if (!reportId) {
      setAdminTyping(false);
      return;
    }

    let mounted = true;
    const pollTyping = async () => {
      try {
        const status = await fetchReportTyping(reportId);
        if (mounted) setAdminTyping(status.isTyping && status.role === "staff");
      } catch {
        if (mounted) setAdminTyping(false);
      }
    };

    void pollTyping();
    const timer = setInterval(() => {
      void pollTyping();
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(timer);
      setAdminTyping(false);
    };
  }, [reportId]);

  const hasMessageNotification = newMsgCount > 0;
  const hasMessageIndicator = hasMessageNotification || adminTyping || sending;
  useEffect(() => {
    if (!hasMessageIndicator) {
      messageDotAnims.forEach((dot) => dot.setValue(0));
      return;
    }

    const loops = messageDotAnims.map((dot, index) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(dot, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.delay(700),
        ])
      );
      loop.start();
      return loop;
    });

    return () => loops.forEach((loop) => loop.stop());
  }, [hasMessageIndicator, messageDotAnims]);

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
    if (view !== "messages") return;
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
    if (view === "messages") {
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
    setMeasuredBubbleWidths({});
    setThreadsError("");
    setLoadingThreads(false);
    setNewMsgCount(0);
    isAtBottomRef.current = true;

    pendingOptimisticRef.current.clear();

    if (reportId) loadDetail(true);
    else setDetailError("Missing report id.");
  }, [reportId, loadDetail]);

  useEffect(() => {
    preEditDraftRef.current = "";
    setEditingMessageId("");
    setReplyingToMessage(null);
    setVisibleMessageMetaId("");
    setSelectedMessageId("");
    setMessageMenuVisible(false);
    setDraft("");
    setSharePhoneDismissed(false);
  }, [reportId]);

  useEffect(() => {
    if (view !== "messages") return;
    if (savedPhoneNumber) return;
    if (triedRefreshPhoneRef.current) return;

    triedRefreshPhoneRef.current = true;
    void refreshMe();
  }, [refreshMe, savedPhoneNumber, view]);

  const publishTypingStatus = useCallback(
    (isTyping: boolean) => {
      if (!reportId) return;
      void setReportTyping(reportId, isTyping).catch(() => {});
    },
    [reportId]
  );

  const handleComposerTextChange = useCallback(
    (value: string) => {
      setDraft(value);

      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }

      const isTyping = value.trim().length > 0;
      publishTypingStatus(isTyping);
      if (isTyping) {
        typingStopTimerRef.current = setTimeout(() => {
          publishTypingStatus(false);
          typingStopTimerRef.current = null;
        }, 1200);
      }
    },
    [publishTypingStatus]
  );

  const sendThreadText = useCallback(async (
    rawText: string,
    opts?: { manageDraft?: boolean; replyTo?: ThreadMsg | null }
  ) => {
    const t = rawText.trim();
    if (!t) return;

    if (!reportId) {
      Alert.alert("Missing report id", "Cannot send message because reportId is empty.");
      return false;
    }
    if (sending) return false;

    publishTypingStatus(false);
    setSending(true);

    const now = Date.now();
    const tmpId = `tmp_${now}`;

    const optimistic: ThreadMsg = {
      id: tmpId,
      side: "right",
      text: t,
      time: formatStamp(new Date()),
      createdAtMs: now,
      replyTo: opts?.replyTo
        ? {
            threadId: opts.replyTo.id,
            sender: getThreadSenderLabel(opts.replyTo),
            side: opts.replyTo.side,
            text: opts.replyTo.text,
          }
        : null,
      pending: true,
    };

    pendingOptimisticRef.current.set(tmpId, { text: t, createdAtMs: now, side: "right" });

    isAtBottomRef.current = true;
    setNewMsgCount(0);

    setMessages((prev) => [...prev, optimistic]);
    if (opts?.manageDraft) setDraft("");

    setTimeout(() => scrollToBottom(true), 60);

    const controller = new AbortController();

    try {
      await sendReportThreadMessage(
        reportId,
        { text: t, replyToThreadId: opts?.replyTo?.id || undefined },
        controller.signal
      );

      await refreshThreads({ showLoader: false });

      setTimeout(() => {
        setMessages((prev) => {
          if (!pendingOptimisticRef.current.has(tmpId)) return prev;
          refreshThreads({ showLoader: false });
          return prev;
        });
      }, 800);
      return true;
    } catch (e: any) {
      if (!isAbortError(e)) {
        Alert.alert("Send failed", e?.message || "Could not send message.");
      }
      pendingOptimisticRef.current.delete(tmpId);
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      if (opts?.manageDraft) setDraft(t);
      return false;
    } finally {
      setSending(false);
    }
  }, [publishTypingStatus, reportId, sending, scrollToBottom, refreshThreads]);

  const updateThreadText = useCallback(async (messageId: string, rawText: string) => {
    const t = rawText.trim();
    if (!t) return false;

    if (!reportId) {
      Alert.alert("Missing report id", "Cannot edit message because reportId is empty.");
      return false;
    }
    if (sending) return false;

    setSending(true);

    const controller = new AbortController();

    try {
      const data = await updateReportThreadMessage(reportId, messageId, t, controller.signal);
      const updatedThread = data?.thread as ThreadDto | undefined;

      if (updatedThread?._id) {
        const updatedUi = dtoToUi(updatedThread);
        setMessages((prev) => prev.map((m) => (m.id === updatedUi.id ? updatedUi : m)));
      } else {
        await refreshThreads({ showLoader: false });
      }

      return true;
    } catch (e: any) {
      if (!isAbortError(e)) {
        Alert.alert("Edit failed", e?.message || "Could not edit message.");
      }
      return false;
    } finally {
      setSending(false);
    }
  }, [reportId, sending, refreshThreads]);

  const onSend = useCallback(async () => {
    const t = draft.trim();
    if (!t) return;
    if (editingMessageId) {
      const ok = await updateThreadText(editingMessageId, t);
      if (ok) {
        const restoredDraft = preEditDraftRef.current;
        preEditDraftRef.current = "";
        setEditingMessageId("");
        setDraft(restoredDraft);
      }
      return;
    }
    const ok = await sendThreadText(t, { manageDraft: true, replyTo: replyingToMessage });
    if (ok) {
      setReplyingToMessage(null);
    }
  }, [draft, editingMessageId, replyingToMessage, sendThreadText, updateThreadText]);

  const handleShareSavedPhone = useCallback(async () => {
    if (!savedPhoneNumber) return;
    if (editingMessageId) {
      preEditDraftRef.current = "";
      setEditingMessageId("");
      setDraft("");
    }
    setReplyingToMessage(null);
    await sendThreadText(`My saved phone number is ${savedPhoneNumber}.`);
  }, [editingMessageId, savedPhoneNumber, sendThreadText]);

  const deleteThreadText = useCallback(async (messageId: string) => {
    if (!reportId) {
      Alert.alert("Missing report id", "Cannot delete message because reportId is empty.");
      return false;
    }
    if (sending) return false;

    setSending(true);
    const controller = new AbortController();

    try {
      const data = await deleteReportThreadMessage(reportId, messageId, controller.signal);
      const deletedThread = data?.thread as ThreadDto | undefined;
      if (deletedThread?._id) {
        const deletedUi = dtoToUi(deletedThread);
        setMessages((prev) => prev.map((m) => (m.id === deletedUi.id ? deletedUi : m)));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      if (editingMessageId === messageId) {
        preEditDraftRef.current = "";
        setEditingMessageId("");
        setDraft("");
      }
      if (visibleMessageMetaId === messageId) {
        setVisibleMessageMetaId("");
      }
      if (replyingToMessage?.id === messageId) {
        setReplyingToMessage(null);
      }
      return true;
    } catch (e: any) {
      if (!isAbortError(e)) {
        Alert.alert("Delete failed", e?.message || "Could not delete message.");
      }
      return false;
    } finally {
      setSending(false);
    }
  }, [editingMessageId, replyingToMessage, reportId, sending, visibleMessageMetaId]);

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
  const canChat = !!reportId && statusUpper !== "CANCELLED" && statusUpper !== "RESOLVED";
  const canViewMessages = !!reportId;
  const showSharePhonePrompt = canChat && !!savedPhoneNumber && !sharePhoneDismissed;

  const closeMessageMenu = useCallback(() => {
    setMessageMenuVisible(false);
    setSelectedMessageId("");
  }, []);

  const openMessageMenu = useCallback((message: ThreadMsg) => {
    if (!canChat || message.pending || !!message.deletedAt) return;
    Keyboard.dismiss();
    setSelectedMessageId(message.id);
    setMessageMenuVisible(true);
  }, [canChat]);

  const toggleMessageMeta = useCallback((messageId: string) => {
    setVisibleMessageMetaId((prev) => (prev === messageId ? "" : messageId));
  }, []);

  const handleQuickReply = useCallback((target?: ThreadMsg | null) => {
    if (!canChat) return;

    if (editingMessageId) {
      const restoredDraft = preEditDraftRef.current;
      preEditDraftRef.current = "";
      setEditingMessageId("");
      setDraft(restoredDraft);
    }
    setReplyingToMessage(target || lastIncomingMessage || null);
    closeMessageMenu();

    setTimeout(() => {
      composerInputRef.current?.focus();
      scrollToBottom(true);
    }, 60);
  }, [canChat, closeMessageMenu, editingMessageId, lastIncomingMessage, scrollToBottom]);

  const handleEditSelectedMessage = useCallback((message: ThreadMsg | null) => {
    if (!message || message.side !== "right" || message.pending || !canChat) return;

    if (!editingMessageId) {
      preEditDraftRef.current = draft;
    }

    setReplyingToMessage(null);
    setEditingMessageId(message.id);
    setDraft(message.text);
    closeMessageMenu();

    setTimeout(() => {
      composerInputRef.current?.focus();
      scrollToBottom(true);
    }, 60);
  }, [canChat, closeMessageMenu, draft, editingMessageId, scrollToBottom]);

  const requestDeleteSelectedMessage = useCallback(() => {
    if (!selectedThreadMessage || selectedThreadMessage.side !== "right" || selectedThreadMessage.pending) return;

    setDeleteTargetMessageId(selectedThreadMessage.id);
    setDeleteMessageModalVisible(true);
    closeMessageMenu();
  }, [closeMessageMenu, selectedThreadMessage]);

  const closeDeleteMessageModal = useCallback(() => {
    setDeleteMessageModalVisible(false);
    setDeleteTargetMessageId("");
  }, []);

  const confirmDeleteMessage = useCallback(() => {
    const messageId = deleteTargetMessageId;
    setDeleteMessageModalVisible(false);
    setDeleteTargetMessageId("");
    if (messageId) {
      void deleteThreadText(messageId);
    }
  }, [deleteTargetMessageId, deleteThreadText]);

  const cancelEditingMessage = useCallback(() => {
    const restoredDraft = preEditDraftRef.current;
    preEditDraftRef.current = "";
    setEditingMessageId("");
    setDraft(restoredDraft);
  }, []);

  const cancelReplyMessage = useCallback(() => {
    setReplyingToMessage(null);
  }, []);

  const selectedMessageCanReply = !!selectedThreadMessage && !selectedThreadMessage.deletedAt;
  const selectedMessageCanEdit =
    !!selectedThreadMessage &&
    selectedThreadMessage.side === "right" &&
    !selectedThreadMessage.pending &&
    !selectedThreadMessage.deletedAt;
  const selectedMessageCanDelete =
    !!selectedThreadMessage &&
    selectedThreadMessage.side === "right" &&
    !selectedThreadMessage.pending &&
    !selectedThreadMessage.deletedAt;

  const [composerH, setComposerH] = useState(vscale(64));
  const threadBubbleMaxWidthPx = Math.round(
    (CONTENT_MAX_W - CONTENT_SIDE_PAD * 2) * (isTablet ? 0.66 : 0.72)
  );

  // ✅ FIX: composer should have a SMALL minimum padding, but not double-count insets
  const composerBaseBottomPad = Math.max(insets.bottom, vscale(6));
  const composerKeyboardLift =
    Platform.OS === "android" && isKeyboardVisible
      ? Math.max(vscale(44), Math.min(vscale(88), keyboardHeight * 0.22))
      : 0;
  const composerBottomPad =
    Platform.OS === "android" && isKeyboardVisible ? vscale(4) : composerBaseBottomPad;

  useEffect(() => {
    if (view !== "messages") return;
    if (!isKeyboardVisible) return;
    setTimeout(() => scrollToBottom(true), 60);
  }, [isKeyboardVisible, view, scrollToBottom]);

  const updateMeasuredBubbleWidth = useCallback(
    (messageId: string, text: string, lineWidth: number) => {
      if (!messageId || !Number.isFinite(lineWidth) || lineWidth <= 0) return;

      setMeasuredBubbleWidths((prev) => {
        if (prev[messageId]) return prev;

        const clean = String(text || "").trim();
        const floorWidth =
          clean.length > 44 ? scale(150) : clean.length > 22 ? scale(118) : scale(74);

        const nextWidth = clamp(
          Math.ceil(lineWidth + scale(30)),
          floorWidth,
          threadBubbleMaxWidthPx
        );

        return { ...prev, [messageId]: nextWidth };
      });
    },
    [scale, threadBubbleMaxWidthPx]
  );

  useEffect(() => {
    if (!messageMenuVisible) return;
    if (selectedThreadMessage) return;
    closeMessageMenu();
  }, [closeMessageMenu, messageMenuVisible, selectedThreadMessage]);

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

      <Modal visible={messageMenuVisible} animationType="fade" transparent onRequestClose={closeMessageMenu}>
        <View style={styles.threadMenuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMessageMenu} />

          {selectedThreadMessage ? (
            <View style={styles.threadMenuShell} pointerEvents="box-none">
              <View
                style={[
                  styles.threadMenuPreviewRow,
                  selectedThreadMessage.side === "right"
                    ? styles.threadMenuPreviewRowRight
                    : styles.threadMenuPreviewRowLeft,
                ]}
              >
                <View
                  style={[
                    styles.threadMenuPreviewBubble,
                    selectedThreadMessage.side === "right"
                      ? styles.threadMenuPreviewBubbleRight
                      : styles.threadMenuPreviewBubbleLeft,
                  ]}
                >
                  <Text
                    numberOfLines={3}
                    style={[
                      styles.threadMenuPreviewText,
                      selectedThreadMessage.side === "right"
                        ? styles.threadMenuPreviewTextRight
                        : styles.threadMenuPreviewTextLeft,
                    ]}
                  >
                    {selectedThreadMessage.text}
                  </Text>
                </View>
              </View>

              <View style={styles.threadMenuCard}>
                {selectedMessageCanReply ? (
                  <Pressable
                    onPress={() => handleQuickReply(selectedThreadMessage)}
                    style={({ pressed }) => [
                      styles.threadMenuAction,
                      !selectedMessageCanEdit && !selectedMessageCanDelete && styles.threadMenuActionLast,
                      pressed && styles.threadMenuActionPressed,
                    ]}
                  >
                    <Text style={styles.threadMenuActionText}>Reply</Text>
                    <Ionicons name="arrow-undo" size={styles._menuIcon} color="#FFFFFF" />
                  </Pressable>
                ) : null}

                {selectedMessageCanEdit ? (
                  <Pressable
                    onPress={() => handleEditSelectedMessage(selectedThreadMessage)}
                    style={({ pressed }) => [
                      styles.threadMenuAction,
                      !selectedMessageCanDelete && styles.threadMenuActionLast,
                      pressed && styles.threadMenuActionPressed,
                    ]}
                  >
                    <Text style={styles.threadMenuActionText}>Edit</Text>
                    <Ionicons name="create-outline" size={styles._menuIcon} color="#FFFFFF" />
                  </Pressable>
                ) : null}

                {selectedMessageCanDelete ? (
                  <Pressable
                    onPress={() => {
                      requestDeleteSelectedMessage();
                    }}
                    style={({ pressed }) => [
                      styles.threadMenuAction,
                      styles.threadMenuActionLast,
                      styles.threadMenuDeleteAction,
                      pressed && styles.threadMenuActionPressed,
                    ]}
                  >
                    <Text style={[styles.threadMenuActionText, styles.threadMenuDeleteText]}>Delete</Text>
                    <Ionicons name="trash-outline" size={styles._menuIcon} color="#F87171" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <LogoutModal
        visible={deleteMessageModalVisible}
        title="Delete message?"
        message="This will permanently remove this message from the thread."
        confirmLabel="Delete"
        confirmColor="#DC2626"
        onCancel={closeDeleteMessageModal}
        onConfirm={confirmDeleteMessage}
      />

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
        ) : view === "timeline" ? (
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
        ) : (
          <Modal
            visible={view === "messages"}
            transparent
            animationType="fade"
            onRequestClose={() => setView("details")}
          >
            <View style={styles.messageModalRoot}>
              <Pressable style={styles.messageModalBackdrop} onPress={() => setView("details")} />
              <View style={styles.messageModalCard}>
                <View style={styles.messageModalHeader}>
                  <Text style={styles.messageModalTitle}>Messages</Text>
                  <Pressable
                    onPress={() => setView("details")}
                    hitSlop={10}
                    style={({ pressed }) => [styles.messageModalClose, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="close" size={styles._miniIcon} color="#64748B" />
                  </Pressable>
                </View>
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
                      paddingBottom: vscale(18),
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

                  {messages.length > 0 ? (
                    <View style={styles.chatDatePill}>
                      <Text style={styles.chatDatePillText}>{formatChatDayPill(messages[0])}</Text>
                    </View>
                  ) : null}

                  {messages.map((m) => {
                    const isLeft = m.side === "left";
                    const showMeta = visibleMessageMetaId === m.id;
                    const measuredBubbleWidth = measuredBubbleWidths[m.id];
                    const bubbleSizingStyle = measuredBubbleWidth
                      ? { width: measuredBubbleWidth, maxWidth: threadBubbleMaxWidthPx }
                      : { maxWidth: threadBubbleMaxWidthPx };
                    return (
                      <View key={m.id} style={styles.msgBlock}>
                        {showMeta ? (
                          <View
                            style={[
                              styles.msgMetaWrap,
                              isLeft ? styles.msgMetaWrapLeft : styles.msgMetaWrapRight,
                            ]}
                          >
                            <Text style={styles.msgMetaText}>{formatThreadMeta(m)}</Text>
                          </View>
                        ) : null}
                        {m.deletedAt ? (
                          <View
                            style={[
                              styles.deletedMessageWrap,
                              isLeft ? styles.deletedMessageWrapLeft : styles.deletedMessageWrapRight,
                            ]}
                          >
                            <Pressable
                              onPress={() => toggleMessageMeta(m.id)}
                              style={({ pressed }) => [pressed && { opacity: 0.88 }]}
                            >
                              <View style={styles.deletedMessagePill}>
                                <Text style={styles.deletedMessageText}>{getDeletedMessageLabel(m)}</Text>
                              </View>
                            </Pressable>
                          </View>
                        ) : (
                        <>
                        {isLeft && m.sender ? (
                          <Text style={styles.msgTopLineHidden}>
                            {m.sender} <Text style={styles.msgTime}>• {formatThreadMeta(m)}</Text>
                          </Text>
                        ) : null}
                        <View
                          style={[
                            styles.messageStack,
                            isLeft ? styles.messageStackLeft : styles.messageStackRight,
                          ]}
                        >
                          {m.replyTo ? (
                            <View
                              style={[
                                styles.replyPreviewWrap,
                                isLeft ? styles.replyPreviewWrapLeft : styles.replyPreviewWrapRight,
                              ]}
                            >
                              <View
                                style={[
                                  styles.replyMetaRow,
                                  isLeft ? styles.replyMetaRowLeft : styles.replyMetaRowRight,
                                ]}
                              >
                                <Ionicons name="arrow-undo" size={styles._miniIcon} color="#94A3B8" />
                                <Text style={styles.replyMetaText} numberOfLines={1}>
                                  {getReplyIndicatorText(m)}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.replyPreviewBubble,
                                  isLeft ? styles.replyPreviewBubbleLeft : styles.replyPreviewBubbleRight,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.replyPreviewText,
                                    isLeft ? styles.replyPreviewTextLeft : styles.replyPreviewTextRight,
                                  ]}
                                  numberOfLines={2}
                                >
                                  {m.replyTo.text}
                                </Text>
                              </View>
                            </View>
                          ) : null}

                          <View style={[styles.msgRow, isLeft ? styles.msgRowLeft : styles.msgRowRight]}>
                            {isLeft ? (
                              <View style={styles.adminAvatar}>
                                <Ionicons name="shield-checkmark-outline" size={styles._miniIcon} color="#718093" />
                              </View>
                            ) : null}
                            <View style={[styles.messageBubbleGroup, isLeft ? styles.messageBubbleGroupLeft : styles.messageBubbleGroupRight]}>
                              {isLeft && m.sender ? <Text style={styles.msgTopLine}>{m.sender}</Text> : null}
                            <Pressable
                              disabled={!canChat || !!m.pending}
                              delayLongPress={220}
                              onPress={() => toggleMessageMeta(m.id)}
                              onLongPress={() => openMessageMenu(m)}
                              style={({ pressed }) => [
                                styles.bubblePressable,
                                bubbleSizingStyle,
                                pressed && !m.pending && canChat && { transform: [{ scale: 0.985 }] },
                              ]}
                            >
                              <View
                                style={[
                                  styles.bubble,
                                  bubbleSizingStyle,
                                  isLeft ? styles.bubbleLeft : styles.bubbleRight,
                                  m.pending && { opacity: 0.72 },
                                ]}
                              >
                                <Text
                                  style={[styles.bubbleText, isLeft ? styles.bubbleTextLeft : styles.bubbleTextRight]}
                                  onTextLayout={(event) => {
                                    const widths = (event.nativeEvent.lines || [])
                                      .map((line: any) => Number(line?.width || 0))
                                      .filter((width: number) => Number.isFinite(width) && width > 0);

                                    if (!widths.length) return;
                                    updateMeasuredBubbleWidth(m.id, m.text, Math.max(...widths));
                                  }}
                                >
                                  {m.text}
                                </Text>
                              </View>
                            </Pressable>
                              <Text style={[styles.msgTime, isLeft ? styles.msgTimeLeft : styles.msgTimeRight]}>
                                {formatChatTime(m)}
                              </Text>
                            </View>
                          </View>
                        </View>

                        </>
                        )}
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
                {replyingToMessage ? (
                  <View style={styles.replyBanner}>
                    <View style={styles.replyBannerAccent} />
                    <View style={styles.replyBannerBody}>
                      <Text style={styles.replyBannerTitle}>
                        Replying to {getThreadSenderLabel(replyingToMessage)}
                      </Text>
                      <Text style={styles.replyBannerText} numberOfLines={1}>
                        {replyingToMessage.text}
                      </Text>
                    </View>

                    <Pressable
                      onPress={cancelReplyMessage}
                      hitSlop={10}
                      style={({ pressed }) => [styles.replyBannerClose, pressed && { opacity: 0.75 }]}
                    >
                      <Ionicons name="close" size={styles._miniIcon} color="#64748B" />
                    </Pressable>
                  </View>
                ) : null}
                {editingMessage ? (
                  <View style={styles.editingBanner}>
                    <View style={styles.editingBannerAccent} />
                    <View style={styles.editingBannerBody}>
                      <Text style={styles.editingBannerTitle}>Editing message</Text>
                      <Text style={styles.editingBannerText} numberOfLines={1}>
                        {editingMessage.text}
                      </Text>
                    </View>

                    <Pressable
                      onPress={cancelEditingMessage}
                      hitSlop={10}
                      style={({ pressed }) => [styles.editingBannerClose, pressed && { opacity: 0.75 }]}
                    >
                      <Ionicons name="close" size={styles._miniIcon} color="#64748B" />
                    </Pressable>
                  </View>
                ) : null}
                {adminTyping || sending ? (
                  <View style={styles.typingIndicatorWrap} pointerEvents="none">
                    <View style={styles.typingIndicatorBubble}>
                      <View style={styles.typingIndicatorDots}>
                        {messageDotAnims.map((dot, index) => (
                          <Animated.View
                            key={index}
                            style={[
                              styles.typingIndicatorDot,
                              { transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                ) : null}

                <View
                  // ✅ FIX: don’t add threadsNavReserve here; just one bottom inset (small)
                  style={[
                    styles.composerDock,
                    {
                      paddingBottom: composerBottomPad,
                      marginBottom: composerKeyboardLift,
                    },
                  ]}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (h && Math.abs(h - composerH) > 2) setComposerH(h);
                  }}
                >
                  <View style={styles.composerRow}>
                  <View style={styles.composerInputWrap}>
                    <Ionicons name="attach-outline" size={styles._iconSize} color="#6E7B8A" />
                    <TextInput
                      ref={composerInputRef}
                      value={draft}
                      onChangeText={handleComposerTextChange}
                      placeholder={editingMessage ? "Edit your message..." : "Write a message..."}
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
                      <Ionicons
                        name={editingMessage ? "checkmark" : "arrow-forward"}
                        size={styles._sendIcon}
                        color="#FFFFFF"
                      />
                    )}
                  </Pressable>
                  </View>
                </View>
              </View>
            </View>
                </KeyboardAvoidingView>
              </View>
            </View>
          </Modal>
        )}

        {view !== "messages" && canViewMessages ? (
          <Pressable
            onPress={openMessagesModal}
            accessibilityRole="button"
            accessibilityLabel="Open messages"
            style={({ pressed }) => [
              styles.messageFab,
              { bottom: Math.max(insets.bottom, 16) + vscale(18), right: scale(18) },
              pressed && styles.messageFabPressed,
            ]}
          >
            <View style={styles.messageFabIconWrap}>
              <Ionicons name="chatbubble-outline" size={styles._messageFabIcon} color="#FFFFFF" />
              <View style={styles.messageFabDots}>
                {messageDotAnims.map((dot, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.messageFabDot,
                      { transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
                    ]}
                  />
                ))}
              </View>
            </View>
            {newMsgCount > 0 ? (
              <View style={styles.messageFabBadge}>
                <Text style={styles.messageFabBadgeText} allowFontScaling={false}>
                  {newMsgCount > 99 ? "99+" : newMsgCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
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
  const _menuIcon = scale(18);
  const _messageFabIcon = scale(24);

  const _viewerIcon = scale(22);
  const _viewerPad = scale(40);

  const _cancelIcon = scale(16);
  const _caseCheckIcon = scale(10);

  return Object.assign(
    StyleSheet.create({
      safe: { flex: 1, backgroundColor: BG },
      page: { flex: 1, backgroundColor: BG },

      heroWrap: { paddingHorizontal: sidePad, paddingBottom: vscale(10), backgroundColor: BG, gap: vscale(10) },

      reportTopBar: {
        width: "100%",
        paddingHorizontal: 22,
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
      messageFab: {
        position: "absolute",
        width: scale(56),
        height: scale(56),
        borderRadius: scale(28),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary,
        zIndex: 20,
        ...Platform.select({
          ios: {
            shadowColor: "#0F172A",
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          },
          android: { elevation: 8 },
        }),
      },
      messageFabPressed: {
        transform: [{ scale: 0.94 }],
        opacity: 0.92,
      },
      messageFabIconWrap: {
        width: scale(30),
        height: scale(28),
        alignItems: "center",
        justifyContent: "center",
      },
      messageFabDots: {
        position: "absolute",
        left: 0,
        right: 0,
        top: scale(12),
        flexDirection: "row",
        justifyContent: "center",
        gap: scale(2),
      },
      messageFabDot: {
        width: scale(3),
        height: scale(3),
        borderRadius: scale(2),
        backgroundColor: "#FFFFFF",
      },
      messageFabBadge: {
        position: "absolute",
        top: -scale(3),
        right: -scale(3),
        minWidth: scale(18),
        height: scale(18),
        borderRadius: scale(9),
        paddingHorizontal: scale(4),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E11D48",
        borderWidth: 2,
        borderColor: BG,
      },
      messageFabBadgeText: {
        fontSize: scale(9),
        fontWeight: "900",
        color: "#FFFFFF",
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
        backgroundColor: "#062B49",
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

      messageModalRoot: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      },
      messageModalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(15, 23, 42, 0.38)",
      },
      messageModalCard: {
        width: "92%",
        maxWidth: scale(520),
        height: "78%",
        borderRadius: scale(24),
        overflow: "hidden",
        backgroundColor: BG,
        ...Platform.select({
          ios: {
            shadowColor: "#0F172A",
            shadowOpacity: 0.2,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: -4 },
          },
          android: { elevation: 12 },
        }),
      },
      messageModalHeader: {
        height: vscale(58),
        paddingHorizontal: scale(18),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: SURFACE,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
      },
      messageModalTitle: {
        fontSize: scale(17),
        fontWeight: "900",
        color: TEXT_DARK,
      },
      messageModalClose: {
        width: scale(32),
        height: scale(32),
        borderRadius: scale(16),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F1F5F9",
      },
      threadsKav: { flex: 1, backgroundColor: BG },

      threadsWrap: { flex: 1, paddingHorizontal: 0, paddingTop: vscale(4), backgroundColor: BG },

      chatSurface: {
        flex: 1,
        width: "100%",
        borderTopLeftRadius: scale(18),
        borderTopRightRadius: scale(18),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#F7F9FC",
        overflow: "hidden",
      },

      chatScroll: { flex: 1, backgroundColor: "#F7F9FC" },
      chatContent: { paddingHorizontal: scale(22), paddingTop: vscale(14), paddingBottom: vscale(12) },

      emptyChat: { alignItems: "center", justifyContent: "center", paddingVertical: vscale(24), gap: vscale(6) },
      emptyChatTitle: { fontSize: scale(isTablet ? 13 : 12), fontWeight: "900", color: TEXT_DARK },
      emptyChatSub: { fontSize: scale(10.5), fontWeight: "400", color: "#94A3B8", textAlign: "center" },

      chatDatePill: {
        alignSelf: "center",
        borderRadius: scale(999),
        backgroundColor: "#EEF0F3",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(5),
        marginBottom: vscale(18),
      },
      chatDatePillText: {
        fontSize: scale(10),
        fontWeight: "900",
        color: "#9AA0A8",
      },
      msgBlock: { width: "100%", marginBottom: vscale(12) },
      systemPromptWrap: { marginBottom: vscale(12), gap: vscale(8) },
      systemPromptTag: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        alignSelf: "flex-start",
      },
      systemPromptTagText: { fontSize: scale(10), fontWeight: "900", color: "#64748B" },
      systemPromptCard: {
        borderRadius: scale(16),
        borderWidth: 1,
        borderColor: "#DBE7F5",
        backgroundColor: "#F8FBFF",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(12),
        gap: vscale(10),
      },
      systemPromptTitle: {
        fontSize: scale(isTablet ? 12 : 11),
        fontWeight: "700",
        lineHeight: vscale(isTablet ? 17 : 16),
        color: "#334155",
      },
      systemPromptText: {
        fontSize: scale(10.5),
        fontWeight: "400",
        lineHeight: vscale(15),
        color: "#6B7280",
      },
      systemPromptHint: {
        fontSize: scale(10.25),
        fontWeight: "600",
        lineHeight: vscale(15),
        color: primary,
      },
      systemPromptPrimaryBtn: {
        minHeight: vscale(40),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: primary,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: scale(12),
      },
      systemPromptPrimaryBtnText: {
        fontSize: scale(10.5),
        fontWeight: "900",
        color: primary,
      },
      systemPromptActionRow: {
        flexDirection: "row",
        gap: scale(10),
      },
      systemPromptMiniBtn: {
        flex: 1,
        minHeight: vscale(38),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: "#D7E3F4",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: scale(6),
        paddingHorizontal: scale(10),
      },
      systemPromptMiniBtnText: {
        fontSize: scale(10.5),
        fontWeight: "800",
        color: primary,
      },
      systemPromptSecondaryBtn: {
        minHeight: vscale(38),
        borderRadius: scale(14),
        backgroundColor: "#EEF2F7",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: scale(12),
      },
      systemPromptSecondaryBtnText: {
        fontSize: scale(10.5),
        fontWeight: "800",
        color: "#64748B",
      },
      threadMenuBackdrop: {
        flex: 1,
        backgroundColor: "rgba(15,23,42,0.26)",
        justifyContent: "center",
        paddingHorizontal: scale(20),
      },
      threadMenuShell: {
        alignSelf: "center",
        width: "100%",
        maxWidth: scale(288),
        gap: vscale(12),
      },
      threadMenuPreviewRow: {
        flexDirection: "row",
        width: "100%",
      },
      threadMenuPreviewRowLeft: { justifyContent: "flex-start" },
      threadMenuPreviewRowRight: { justifyContent: "flex-end" },
      threadMenuPreviewBubble: {
        maxWidth: "84%",
        borderRadius: scale(18),
        paddingHorizontal: scale(14),
        paddingVertical: vscale(10),
      },
      threadMenuPreviewBubbleLeft: {
        backgroundColor: "#EEF2F7",
        borderWidth: 1,
        borderColor: "#E6ECF5",
      },
      threadMenuPreviewBubbleRight: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#D7E3F4",
      },
      threadMenuPreviewText: {
        fontSize: scale(isTablet ? 12 : 11),
        fontWeight: "500",
        lineHeight: vscale(isTablet ? 16 : 15),
      },
      threadMenuPreviewTextLeft: { color: "#334155" },
      threadMenuPreviewTextRight: { color: "#0F172A" },
      threadMenuCard: {
        borderRadius: scale(18),
        backgroundColor: "#15181E",
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.08)",
        shadowColor: "#000000",
        shadowOpacity: 0.24,
        shadowRadius: scale(18),
        shadowOffset: { width: 0, height: vscale(8) },
        elevation: 10,
      },
      threadMenuAction: {
        minHeight: vscale(50),
        paddingHorizontal: scale(16),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(255,255,255,0.08)",
      },
      threadMenuActionPressed: {
        backgroundColor: "rgba(255,255,255,0.08)",
      },
      threadMenuActionLast: {
        borderBottomWidth: 0,
      },
      threadMenuActionText: {
        fontSize: scale(12),
        fontWeight: "700",
        color: "#FFFFFF",
      },
      threadMenuDeleteAction: {
        backgroundColor: "rgba(127,29,29,0.12)",
      },
      threadMenuDeleteText: {
        color: "#F87171",
      },
      msgTopLine: { fontSize: scale(10), fontWeight: "900", color: "#718093", marginBottom: vscale(5), marginLeft: scale(2) },
      msgTopLineHidden: {
        display: "none",
      },
      msgTime: { marginTop: vscale(4), fontSize: scale(9.5), fontWeight: "800", color: "#8F99A5" },
      msgTimeLeft: { alignSelf: "flex-start" },
      msgTimeRight: { alignSelf: "flex-end" },
      msgMetaWrap: {
        width: "100%",
        marginBottom: vscale(6),
      },
      msgMetaWrapLeft: {
        alignItems: "flex-start",
      },
      msgMetaWrapRight: {
        alignItems: "flex-end",
      },
      msgMetaText: {
        fontSize: scale(9.5),
        fontWeight: "500",
        color: "#94A3B8",
      },
      messageStack: {
        maxWidth: "100%",
        flexShrink: 1,
        width: "100%",
      },
      messageStackLeft: {
        alignSelf: "flex-start",
        alignItems: "flex-start",
      },
      messageStackRight: {
        alignSelf: "flex-end",
        alignItems: "flex-end",
      },
      replyPreviewWrap: {
        maxWidth: "100%",
        flexShrink: 1,
        flexDirection: "column",
        gap: vscale(4),
        marginBottom: vscale(8),
      },
      replyPreviewWrapLeft: {
        alignSelf: "flex-start",
        alignItems: "flex-start",
      },
      replyPreviewWrapRight: {
        alignSelf: "flex-end",
        alignItems: "flex-end",
      },
      replyMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "nowrap",
        gap: scale(4),
      },
      replyMetaRowLeft: { alignSelf: "flex-start" },
      replyMetaRowRight: { alignSelf: "flex-end", justifyContent: "flex-end" },
      replyMetaText: {
        fontSize: scale(9.5),
        fontWeight: "600",
        color: "#94A3B8",
        maxWidth: scale(isTablet ? 240 : 190),
      },
      replyPreviewBubble: {
        maxWidth: "100%",
        borderRadius: scale(14),
        paddingHorizontal: scale(12),
        paddingVertical: vscale(8),
        borderWidth: 1,
      },
      replyPreviewBubbleLeft: {
        backgroundColor: "#EEF2F7",
        borderColor: "#E6ECF5",
      },
      replyPreviewBubbleRight: {
        backgroundColor: "#1F2937",
        borderColor: "#1F2937",
      },
      replyPreviewText: {
        fontSize: scale(10.5),
        fontWeight: "500",
        lineHeight: vscale(14),
      },
      replyPreviewTextLeft: { color: "#334155" },
      replyPreviewTextRight: { color: "#F8FAFC" },
      deletedMessageWrap: {
        width: "100%",
        marginTop: vscale(2),
      },
      deletedMessageWrapLeft: {
        alignItems: "flex-start",
      },
      deletedMessageWrapRight: {
        alignItems: "flex-end",
      },
      deletedMessagePill: {
        borderRadius: scale(999),
        backgroundColor: "#111827",
        paddingHorizontal: scale(14),
        paddingVertical: vscale(7),
      },
      deletedMessageText: {
        fontSize: scale(10.5),
        fontWeight: "500",
        color: "#E5E7EB",
      },

      msgRow: { flexDirection: "row", alignItems: "flex-start", width: "100%" },
      msgRowLeft: { justifyContent: "flex-start" },
      msgRowRight: { justifyContent: "flex-end" },
      adminAvatar: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        backgroundColor: "#E5E9EF",
        alignItems: "center",
        justifyContent: "center",
        marginRight: scale(9),
        marginTop: vscale(18),
      },
      messageBubbleGroup: {
        maxWidth: isTablet ? "62%" : "76%",
        flexShrink: 1,
      },
      messageBubbleGroupLeft: {
        alignItems: "flex-start",
      },
      messageBubbleGroupRight: {
        alignItems: "flex-end",
      },
      bubblePressable: {
        alignSelf: "flex-start",
        maxWidth: "100%",
      },

      bubble: {
        maxWidth: "100%",
        alignSelf: "flex-start",
        borderRadius: scale(12),
        paddingHorizontal: scale(14),
        paddingVertical: vscale(11),
        borderWidth: 1,
      },
      bubbleLeft: { backgroundColor: "#E9ECEF", borderColor: "#D0D4DA" },
      bubbleRight: { backgroundColor: "#000000", borderColor: "#000000" },
      replySnippet: {
        borderRadius: scale(12),
        borderLeftWidth: scale(3),
        paddingHorizontal: scale(10),
        paddingVertical: vscale(7),
        marginBottom: vscale(8),
      },
      replySnippetLeft: {
        backgroundColor: "rgba(255,255,255,0.6)",
        borderLeftColor: "#94A3B8",
      },
      replySnippetRight: {
        backgroundColor: "#F8FBFF",
        borderLeftColor: primary,
      },
      replySnippetLabel: {
        fontSize: scale(9.5),
        fontWeight: "800",
        color: "#334155",
        marginBottom: vscale(2),
      },
      replySnippetText: {
        fontSize: scale(9.5),
        fontWeight: "400",
        color: "#64748B",
      },

      bubbleText: {
        fontSize: scale(isTablet ? 13 : 12),
        fontWeight: "800",
        lineHeight: vscale(isTablet ? 18 : 17),
      },
      bubbleTextLeft: { color: "#4D5662" },
      bubbleTextRight: { color: "#FFFFFF" },
      replyBanner: {
        paddingHorizontal: scale(12),
        paddingVertical: vscale(10),
        borderTopWidth: 1,
        borderTopColor: BORDER,
        backgroundColor: "#F8FBFF",
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
      },
      replyBannerAccent: {
        width: scale(3),
        alignSelf: "stretch",
        borderRadius: scale(999),
        backgroundColor: "#64748B",
      },
      replyBannerBody: {
        flex: 1,
        gap: vscale(2),
      },
      replyBannerTitle: {
        fontSize: scale(10.5),
        fontWeight: "900",
        color: "#334155",
      },
      replyBannerText: {
        fontSize: scale(10.5),
        fontWeight: "400",
        color: "#64748B",
      },
      replyBannerClose: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
      },
      editingBanner: {
        paddingHorizontal: scale(12),
        paddingVertical: vscale(10),
        borderTopWidth: 1,
        borderTopColor: BORDER,
        backgroundColor: "#F8FBFF",
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
      },
      editingBannerAccent: {
        width: scale(3),
        alignSelf: "stretch",
        borderRadius: scale(999),
        backgroundColor: primary,
      },
      editingBannerBody: {
        flex: 1,
        gap: vscale(2),
      },
      editingBannerTitle: {
        fontSize: scale(10.5),
        fontWeight: "900",
        color: primary,
      },
      editingBannerText: {
        fontSize: scale(10.5),
        fontWeight: "400",
        color: "#475569",
      },
      editingBannerClose: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
      },

      composerDock: {
        backgroundColor: "#F7F9FC",
        paddingTop: vscale(8),
      },
      typingIndicatorWrap: {
        paddingLeft: scale(59),
        paddingRight: scale(22),
        paddingBottom: vscale(4),
        alignItems: "flex-start",
        backgroundColor: "#F7F9FC",
      },
      typingIndicatorBubble: {
        alignItems: "center",
        justifyContent: "center",
        width: scale(44),
        height: vscale(28),
        borderRadius: scale(14),
        backgroundColor: "#EEF2F7",
      },
      typingIndicatorDots: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(3),
      },
      typingIndicatorDot: {
        width: scale(4),
        height: scale(4),
        borderRadius: scale(2),
        backgroundColor: "#64748B",
      },
      composerRow: {
        marginHorizontal: scale(28),
        marginBottom: vscale(8),
        minHeight: vscale(50),
        borderRadius: scale(999),
        borderWidth: 1,
        borderColor: "#D7DCE3",
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        paddingLeft: scale(11),
        paddingRight: scale(6),
        paddingVertical: vscale(5),
      },
      composerInputWrap: {
        flex: 1,
        minHeight: vscale(40),
        backgroundColor: "#FFFFFF",
        paddingHorizontal: scale(2),
        flexDirection: "row",
        alignItems: "center",
        gap: scale(8),
      },
      composerInput: {
        flex: 1,
        height: vscale(40),
        paddingVertical: 0,
        fontSize: scale(isTablet ? 13 : 12),
        fontWeight: "800",
        color: "#111827",
      },

      sendBtn: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        backgroundColor: "#000000",
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
      _menuIcon,
      _messageFabIcon,
      _viewerIcon,
      _viewerPad,
      _cancelIcon,
      _caseCheckIcon,
    }
  ) as any;
}
