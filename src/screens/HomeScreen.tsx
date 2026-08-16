// src/screens/HomeScreen.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  Animated,
  Modal,
  AppState,
  AppStateStatus,
  DeviceEventEmitter,
  Alert,
  Easing,
  InteractionManager,
  PanResponder,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

// âœ… NEW: refresh when Home regains focus
import { useFocusEffect, useIsFocused } from "@react-navigation/native";

import { Colors, useColors } from "../theme/colors";
import { FontFamily, FontSize, FontWeight } from "../theme/typography";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import LogoutModal from "../components/LogoutModal";

import GreetingCard from "../components/HomeScreen/GreetingCard";
import QuickActions from "../components/HomeScreen/QuickActions";
import ChatbotModal from "../components/HomeScreen/ChatbotModal";
import ServicesModal from "../components/HomeScreen/ServicesModal";
import RecentLogCard, { LogItem } from "../components/HomeScreen/RecentLogCard";

import HomeScreenLogo from "../../assets/HomeScreen/NewLogo.svg";

// âœ… Tutorial overlay
import FabTutorialOverlay from "../components/Tutorial/FabTutorialOverlay";
import ReportTutorialModal from "../components/Tutorial/ReportTutorialModal";
import VerifyAccountTutorialModal from "../components/Tutorial/VerifyAccountTutorialModal";
import TutorialPickerModal from "../components/Tutorial/TutorialPickerModal";

// âœ… Auth context
import { useAuth } from "../auth/AuthContext";

// âœ… session token fallback
import { getAccessToken } from "../auth/session";

// âœ… /me API
import { getMeApi } from "../api/pin";

// âœ… Use ReportItem type
import type { ReportItem } from "./ReportScreen";

// âœ… HIDE APP helper
import { closeAndRemoveFromRecents } from "../utils/hideApp";

// âœ… NEW: Use same API as NotificationsScreen (source of truth)
import {
  fetchMyNotificationsCombined,
  sendSosAlert,
  syncLocalReportStatusNotifications,
} from "../api/notifications";

// âœ… FIX: Use requestJson with auth for auto token refresh
import { requestJson } from "../api/http";
import { normalizeReportStatus } from "../utils/reportStatus";

// âœ… Location for SOS
import * as Location from "expo-location";

type Props = {
  onQuickExit?: () => void;
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
  isActive?: boolean;

  onOpenNotifications?: () => void;

  onOpenReport?: (report: ReportItem) => void;
};

const BG = "#F5FAFE";
const TEXT_DARK = "#0B2B45";

// âœ… once-only tutorial key
const FAB_TUTORIAL_SEEN_KEY = "tahanansafe_fab_tutorial_seen_v1";

// âœ… local "seen notifications" marker (kept, not removed)
const NOTIF_LAST_SEEN_KEY = "tahanansafe_notif_last_seen_v1";

// Matches the report-submission cooldown used by IncidentLogScreen.
const INCIDENT_SUBMIT_COOLDOWN_MS = 60_000;
const INCIDENT_LAST_SUBMIT_KEY = "tahanansafe_last_incident_submit_at_v1";

// âœ… ADDED: must match NotificationsScreen.tsx emit name
const NOTIF_CHANGED_EVENT = "tahanan:notifChanged";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// âœ… more stable scale for small phones
function makeScale(width: number, height: number) {
  const baseW = 375;
  const baseH = 812;
  const scaleW = width / baseW;
  const scaleH = height / baseH;
  // use smaller dimension influence to avoid "too big" on short devices
  const s = clamp(Math.min(scaleW, scaleH) * 1.04, 0.88, 1.28);
  const fs = clamp(s * 1.06, 0.92, 1.32);
  return { s, fs };
}

function makeGreeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function makeDateLine(d: Date) {
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
  const monthDayYear = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${weekday} | ${monthDayYear} | ${time}`;
}

// ---------------------------
// Small helpers for mapping
// ---------------------------
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toMonthName(mIndex: number) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[mIndex] ?? "";
}

function formatFullDate(d: Date) {
  return `${toMonthName(d.getMonth())} ${d.getDate()}, ${d.getFullYear()}`;
}

function parseDateSmart(input?: string): Date | null {
  if (!input) return null;

  const mdY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = input.match(mdY);
  if (match) {
    const mm = Number(match[1]);
    const dd = Number(match[2]);
    const yy = Number(match[3]);
    if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yy)) return null;
    return new Date(yy, mm - 1, dd);
  }

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getIncidentTimestamp(doc: any): number {
  const incidentDate = parseDateSmart(String(doc?.dateStr ?? ""));

  if (incidentDate) {
    const time = String(doc?.timeStr ?? "").trim();
    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);

    if (match) {
      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const meridiem = match[3]?.toUpperCase();

      if (meridiem === "AM") hours = hours === 12 ? 0 : hours;
      if (meridiem === "PM") hours = hours === 12 ? 12 : hours + 12;

      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        incidentDate.setHours(hours, minutes, 0, 0);
      }
    }

    return incidentDate.getTime();
  }

  return parseDateSmart(String(doc?.createdAt ?? ""))?.getTime() ?? 0;
}

function normalizePhoto(p: any): string {
  if (!p) return "";
  if (typeof p === "string") return p;
  if (typeof p?.url === "string") return p.url;
  if (typeof p?.secure_url === "string") return p.secure_url;
  if (typeof p?.path === "string") return p.path;
  if (typeof p?.filename === "string") return p.filename;
  try {
    return JSON.stringify(p);
  } catch {
    return String(p);
  }
}

export default function HomeScreen({
  onQuickExit,
  onTabChange,
  initialTab = "Home",
  isActive = true,
  onOpenNotifications,
  onOpenReport,
}: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);

  // Keep content readable on tablets while still using the full screen for
  // overlays and the bottom navigation.
  const contentWidth = Math.min(width, 720);

  const { s, fs } = useMemo(() => makeScale(contentWidth, height), [contentWidth, height]);

  // âœ… AuthContext
  const { user, setUser, accessToken, logout } = useAuth() as any;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    if (isActive) setActiveTab(initialTab);
  }, [initialTab, isActive]);

  // âœ… Tutorial
  const [showFabTutorial, setShowFabTutorial] = useState(false);
  const [showTutorialMenu, setShowTutorialMenu] = useState(false);
  const [showReportTutorial, setShowReportTutorial] = useState(false);
  const [showVerifyTutorial, setShowVerifyTutorial] = useState(false);
  const tutorialBootRef = useRef(false);

  const showFabTutorialOnce = useCallback(async () => {
    if (tutorialBootRef.current) return;
    tutorialBootRef.current = true;

    try {
      const seen = await AsyncStorage.getItem(FAB_TUTORIAL_SEEN_KEY);
      if (seen === "1") return;

      setShowFabTutorial(true);
      await AsyncStorage.setItem(FAB_TUTORIAL_SEEN_KEY, "1");
    } catch {
      setShowFabTutorial(true);
    }
  }, []);

  useEffect(() => {
    showFabTutorialOnce();
  }, [showFabTutorialOnce]);

  // =========================
  // âœ… FIXED: /me spam loop guard
  // =========================
  const userRef = useRef<any>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const lastMeSyncAtRef = useRef<number>(0);
  const lastTokenRef = useRef<string>("");

  const syncProfile = useCallback(async () => {
    // throttle: at least 8 seconds between calls
    const nowMs = Date.now();
    if (nowMs - lastMeSyncAtRef.current < 8000) return;

    const t = accessToken || (await getAccessToken());
    if (!t) return;

    // if token didn't change AND we already synced recently, skip
    if (lastTokenRef.current === t && nowMs - lastMeSyncAtRef.current < 30000) return;

    lastTokenRef.current = t;
    lastMeSyncAtRef.current = nowMs;

    try {
      const me = await getMeApi();
      const apiUser: any = me?.user ?? me;

      const nextFirst = (typeof apiUser?.firstName === "string" && apiUser.firstName.trim()) || "";
      const nextLast = (typeof apiUser?.lastName === "string" && apiUser.lastName.trim()) || "";

      const nextEmail = typeof apiUser?.email === "string" ? apiUser.email : "";
      const nextId = String(apiUser?._id ?? apiUser?.id ?? "");

      const cur = userRef.current;
      const curEmail = typeof cur?.email === "string" ? cur.email : "";
      const curId = String(cur?._id ?? cur?.id ?? "");
      const curFirst = typeof cur?.firstName === "string" ? cur.firstName.trim() : "";

      const accountChanged =
        (nextEmail && curEmail && nextEmail !== curEmail) || (nextId && curId && nextId !== curId);

      const missingNameInContext = !curFirst;
      const haveNameFromApi = !!nextFirst;

      // âœ… Only setUser if needed (prevents render loop)
      if (accountChanged || (missingNameInContext && haveNameFromApi)) {
        const nextUser = {
          _id: nextId,
          email: nextEmail,
          firstName: nextFirst,
          lastName: nextLast,
          gender: apiUser?.gender,
          phoneNumber: apiUser?.phoneNumber,
          dateOfBirth: apiUser?.dateOfBirth,
          age: apiUser?.age,
          hasPin: !!apiUser?.hasPin,
          profileImage: apiUser?.profileImage,
        };

        if (nextUser.email || nextUser._id || nextUser.firstName) {
          setUser(nextUser as any);
        }
      }
    } catch {
      // ignore
    }
  }, [accessToken, setUser]);

  // âœ… Run sync when token changes / first mount only
  useEffect(() => {
    syncProfile();
  }, [syncProfile, accessToken]);

  // âœ… LIVE CLOCK
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const greeting = useMemo(() => makeGreeting(now), [now]);
  const dateLine = useMemo(() => makeDateLine(now), [now]);

  const userName = useMemo(() => {
    const fn = user?.firstName;
    if (typeof fn === "string" && fn.trim().length > 0) return fn.trim();
    return "User";
  }, [user]);

  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 68;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabNavScale = clamp(width / 375, 0.86, 1.2);
  const fabCradleLift = clamp(Math.round(5 * fabNavScale), 4, 6);
  const fabBottom = navHeight - FAB_SIZE / 2 - 10 + fabCradleLift;

  const CONTENT_BOTTOM_PAD = useMemo(() => {
    const fabOverlapPad = Math.round(FAB_SIZE * 0.55);
    return navHeight + fabOverlapPad + 16;
  }, [navHeight]);

  const navigateToTab = useCallback(
    (key: TabKey) => {
      setActiveTab(key);
      onTabChange?.(key);
    },
    [onTabChange]
  );

  // =========================
  // âœ… Notifications badge logic (UPDATED to auto-refresh)
  // =========================
  const [notifCount, setNotifCount] = useState<number>(0);
  const notifFetchInFlightRef = useRef(false);
  const lastNotifFetchAtRef = useRef(0);
  const lastStatusSyncAtRef = useRef(0);

  const syncStatusesForNotifBadge = useCallback(async () => {
    try {
      const data: any = await requestJson({
        method: "GET",
        path: "/api/mobile/v1/reports/my",
        auth: true,
      });

      const rawList = Array.isArray(data) ? data : data?.incidents ?? [];
      if (!Array.isArray(rawList) || rawList.length === 0) return;

      await syncLocalReportStatusNotifications(
        rawList.map((doc: any) => ({
          id: String(doc?._id ?? doc?.id ?? "").trim(),
          title: String(doc?.incidentType ?? "Incident Report"),
          status: normalizeReportStatus(doc?.status),
          createdAt: doc?.createdAt ? String(doc.createdAt) : undefined,
          updatedAt: doc?.updatedAt ? String(doc.updatedAt) : undefined,
        }))
      );
    } catch {
      // Keep badge fetch resilient even if report sync fails.
    }
  }, []);

  const fetchNotifCount = useCallback(async (opts?: { force?: boolean; withStatusSync?: boolean }) => {
    const force = !!opts?.force;
    const withStatusSync = opts?.withStatusSync !== false;
    const now = Date.now();

    if (!force && now - lastNotifFetchAtRef.current < 15000) return;
    if (notifFetchInFlightRef.current) return;
    notifFetchInFlightRef.current = true;
    try {
      if (withStatusSync && now - lastStatusSyncAtRef.current >= 180000) {
        await syncStatusesForNotifBadge();
        lastStatusSyncAtRef.current = now;
      }
      const list = await fetchMyNotificationsCombined(80);
      const unread = list.filter((n) => n.unread).length;
      setNotifCount(unread > 0 ? unread : 0);
      lastNotifFetchAtRef.current = Date.now();
    } catch {
      setNotifCount(0);
    } finally {
      notifFetchInFlightRef.current = false;
    }
  }, [syncStatusesForNotifBadge]);

  useEffect(() => {
    fetchNotifCount({ force: true, withStatusSync: true });
  }, [fetchNotifCount]);

  useEffect(() => {
    let mounted = true;
    const onChange = (state: AppStateStatus) => {
      if (!mounted) return;
      if (state === "active") fetchNotifCount({ force: true, withStatusSync: true });
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [fetchNotifCount]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchNotifCount({ force: true, withStatusSync: false });
      });
      return () => task.cancel();
    }, [fetchNotifCount])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(NOTIF_CHANGED_EVENT, () => {
      InteractionManager.runAfterInteractions(() => {
        fetchNotifCount({ force: true, withStatusSync: false });
      });
    });
    return () => sub.remove();
  }, [fetchNotifCount]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const id = setInterval(() => {
        if (!alive) return;
        fetchNotifCount({ withStatusSync: true });
      }, 120000);

      return () => {
        alive = false;
        clearInterval(id);
      };
    }, [fetchNotifCount])
  );

  const handleOpenNotifications = useCallback(async () => {
    onOpenNotifications?.();

    try {
      await AsyncStorage.setItem(NOTIF_LAST_SEEN_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }, [onOpenNotifications]);

  // âœ… Recent reports
  const [recentReports, setRecentReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const reportsFetchInFlightRef = useRef(false);
  const lastReportsFetchAtRef = useRef(0);

  // âœ… FIX: Use requestJson with auth:true for auto token refresh
  const fetchRecentReports = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    const force = !!opts?.force;
    const silent = !!opts?.silent;
    const now = Date.now();

    if (!force && now - lastReportsFetchAtRef.current < 90000) return;
    if (reportsFetchInFlightRef.current) return;

    reportsFetchInFlightRef.current = true;
    try {
      if (!silent) setLoadingReports(true);

      // âœ… FIX: This auto-attaches the access token AND auto-refreshes on 401
      const json: any = await requestJson({
        method: "GET",
        path: "/api/mobile/v1/reports/my",
        auth: true,
      });

      const rawList = Array.isArray(json) ? json : json?.incidents ?? [];
      const topReportsRaw = [...rawList]
        .sort((a: any, b: any) => {
          return getIncidentTimestamp(b) - getIncidentTimestamp(a);
        })
        .slice(0, 2);

      const mapped: ReportItem[] = topReportsRaw.map((doc: any) => {
        const id = String(doc?._id ?? doc?.id ?? "");
        const incidentType = String(doc?.incidentType ?? "");
        const details = String(doc?.details ?? "");
        const offenderName = String(doc?.offenderName ?? "");

        const dateStr = String(doc?.dateStr ?? "");
        const timeStr = String(doc?.timeStr ?? "");

        const createdAtIso = doc?.createdAt ? String(doc.createdAt) : "";
        const updatedAtIso = doc?.updatedAt ? String(doc.updatedAt) : "";

        const dateObj = parseDateSmart(dateStr) ?? parseDateSmart(createdAtIso) ?? null;

        const leftDate = dateObj ? formatFullDate(dateObj) : dateStr || "â€”";
        const leftTime = timeStr || "â€”";

        const rightObj = parseDateSmart(updatedAtIso) ?? parseDateSmart(createdAtIso) ?? dateObj;
        const rightDate = rightObj ? formatFullDate(rightObj) : "â€”";
        const rightTime =
          rightObj && !Number.isNaN(rightObj.getTime())
            ? `${(() => {
                const h = rightObj.getHours();
                const m = rightObj.getMinutes();
                const ampm = h >= 12 ? "PM" : "AM";
                const hh = h % 12 === 0 ? 12 : h % 12;
                return `${hh}:${pad2(m)} ${ampm}`;
              })()}`
            : "â€”";

        const detailLine = details || offenderName || "No details provided.";

        const statusNorm = normalizeReportStatus(doc?.status);

        const photos: string[] = Array.isArray(doc?.photos)
          ? doc.photos.map((p: any) => normalizePhoto(p)).filter(Boolean)
          : [];

        return {
          id,
          groupLabel: "",
          title: incidentType || "Incident Report",
          detail: detailLine,
          dateLeft: leftDate,
          timeLeft: leftTime,
          dateRight: rightDate,
          timeRight: rightTime,
          status: statusNorm,
          witnessName: doc?.witnessName ? String(doc.witnessName) : "",
          witnessType: doc?.witnessType ? String(doc.witnessType) : "",
          location: doc?.locationStr ? String(doc.locationStr) : "",
          incidentTypeLabel: incidentType,
          alertNo: doc?.complainId ? `#${String(doc.complainId)}` : `#${String(id).slice(-4)}`,
          offenderName,
          photos,
          createdAt: createdAtIso,
          updatedAt: updatedAtIso,
        } as ReportItem;
      });

      setRecentReports(mapped);
      lastReportsFetchAtRef.current = Date.now();
    } catch {
      // Preserve existing cards when a background refresh fails.
      if (!silent) setRecentReports([]);
    } finally {
      if (!silent) setLoadingReports(false);
      reportsFetchInFlightRef.current = false;
    }
  }, []); // âœ… FIX: No more [accessToken] dependency â€” requestJson handles token internally

  useEffect(() => {
    fetchRecentReports({ force: true });
  }, [fetchRecentReports]);

  // âœ… Also refresh reports when Home screen regains focus
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchRecentReports({ force: false });
      });
      return () => task.cancel();
    }, [fetchRecentReports])
  );

  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    const becameActive = isActive && !wasActiveRef.current;
    wasActiveRef.current = isActive;
    if (!becameActive) return;

    const task = InteractionManager.runAfterInteractions(() => {
      fetchNotifCount({ force: true, withStatusSync: false });
      fetchRecentReports({ force: true, silent: true });
    });

    return () => task.cancel();
  }, [fetchNotifCount, fetchRecentReports, isActive]);

  const logs: LogItem[] = useMemo(() => {
    return recentReports.map((r) => ({
      id: r.id,
      title: r.title,
      detail: r.detail,
      dateLeft: r.dateLeft,
      timeLeft: r.timeLeft,
      dateRight: r.dateRight,
      timeRight: r.timeRight,
      updatedAt: r.updatedAt,
      status: r.status,
      alertNo: r.alertNo,
    }));
  }, [recentReports]);

  const PAD = useMemo(() => clamp(Math.round(16 * s), 12, 20), [s]);
  const GAP = useMemo(() => clamp(Math.round(16 * s), 12, 18), [s]);

  const logoW = clamp(Math.round(contentWidth * 0.48), 140, 230);
  const logoH = clamp(Math.round(36 * s), 28, 42);

  const iconBtnSize = clamp(Math.round(38 * s), 34, 44);
  const notifIconSize = clamp(Math.round(20 * s), 18, 24);
  const helpIconSize = clamp(Math.round(22 * s), 20, 26);
  const sosThumbSize = clamp(Math.round(52 * s), 48, 58);
  const sosGlowWidth = clamp(Math.round(88 * s), 74, 104);

  const HEADER_TOP_PAD = useMemo(() => clamp(Math.round(6 * s), 2, 10), [s]);
  const ACTION_GAP = useMemo(() => clamp(Math.round(14 * s), 10, 16), [s]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  const fabMenuAnim = useRef(new Animated.Value(0)).current;
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [chatbotModalVisible, setChatbotModalVisible] = useState(false);
  const [servicesModalVisible, setServicesModalVisible] = useState(false);
  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [sendingSos, setSendingSos] = useState(false);
  const [sosDragging, setSosDragging] = useState(false);
  const [sosSuccessVisible, setSosSuccessVisible] = useState(false);
  const [sosSuccessMessage, setSosSuccessMessage] = useState("");
  const [sosSliderWidth, setSosSliderWidth] = useState(0);
  const sosModalAnim = useRef(new Animated.Value(0)).current;
  const sosThumbPulseAnim = useRef(new Animated.Value(0)).current;
  const sosSliderX = useRef(new Animated.Value(0)).current;
  const sosSliderValueRef = useRef(0);
  const sosDragStartRef = useRef(0);

  useEffect(() => {
    const id = sosSliderX.addListener(({ value }) => {
      sosSliderValueRef.current = value;
    });

    return () => {
      sosSliderX.removeListener(id);
    };
  }, [sosSliderX]);

  const sosMaxSlide = useMemo(
    () => Math.max(0, sosSliderWidth - sosThumbSize - 12),
    [sosSliderWidth, sosThumbSize]
  );
  const sosCardTranslateY = useMemo(
    () =>
      sosModalAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [28, 0],
      }),
    [sosModalAnim]
  );
  const sosCardScale = useMemo(
    () =>
      sosModalAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.94, 1],
      }),
    [sosModalAnim]
  );
  const sosGuideTranslateY = useMemo(
    () =>
      sosModalAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [16, 0],
      }),
    [sosModalAnim]
  );
  const sosThumbScale = useMemo(
    () =>
      sosThumbPulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.08],
      }),
    [sosThumbPulseAnim]
  );
  const sosTrailBaseWidth = useMemo(() => Math.max(sosSliderWidth, sosThumbSize + 12), [sosSliderWidth, sosThumbSize]);
  const sosTrailTranslateX = useMemo(
    () =>
      sosSliderX.interpolate({
        inputRange: [0, Math.max(sosMaxSlide, 1)],
        outputRange: [sosThumbSize + 12 - sosTrailBaseWidth, 0],
        extrapolate: "clamp",
      }),
    [sosMaxSlide, sosSliderX, sosThumbSize, sosTrailBaseWidth]
  );

  const openFabMenu = useCallback(() => {
    if (!isFocusedRef.current || fabMenuOpen) return;

    fabMenuAnim.stopAnimation();
    setFabMenuOpen(true);
    Animated.spring(fabMenuAnim, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 190,
      damping: 20,
      mass: 0.85,
      restDisplacementThreshold: 0.001,
      restSpeedThreshold: 0.001,
    }).start();
  }, [fabMenuAnim, fabMenuOpen]);

  const closeFabMenu = useCallback(() => {
    if (!fabMenuOpen) return;

    fabMenuAnim.stopAnimation();
    Animated.timing(fabMenuAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setFabMenuOpen(false);
    });
  }, [fabMenuAnim, fabMenuOpen]);

  const toggleFabMenu = useCallback(() => {
    if (fabMenuOpen) {
      closeFabMenu();
      return;
    }

    openFabMenu();
  }, [closeFabMenu, fabMenuOpen, openFabMenu]);

  const resetSosSlider = useCallback(
    (animate = false) => {
      sosSliderX.stopAnimation();

      if (!animate) {
        sosSliderX.setValue(0);
        return;
      }

      Animated.spring(sosSliderX, {
        toValue: 0,
        useNativeDriver: false,
        speed: 20,
        bounciness: 0,
      }).start();
    },
    [sosSliderX]
  );

  useEffect(() => {
    sosModalAnim.stopAnimation();

    if (!sosModalVisible) {
      sosModalAnim.setValue(0);
      return;
    }

    sosModalAnim.setValue(0);
    Animated.spring(sosModalAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      mass: 0.9,
      stiffness: 180,
    }).start();
  }, [sosModalAnim, sosModalVisible]);

  useEffect(() => {
    sosThumbPulseAnim.stopAnimation();

    if (!sosModalVisible || sendingSos || sosDragging) {
      sosThumbPulseAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sosThumbPulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(sosThumbPulseAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
      sosThumbPulseAnim.setValue(0);
    };
  }, [sendingSos, sosDragging, sosModalVisible, sosThumbPulseAnim]);

  const closeSosModal = useCallback(() => {
    if (sendingSos) return;
    setSosDragging(false);
    setSosModalVisible(false);
    resetSosSlider();
  }, [resetSosSlider, sendingSos]);

  const closeSosSuccessModal = useCallback(() => {
    setSosSuccessVisible(false);
    setSosSuccessMessage("");
  }, []);

  const submitSosAlert = useCallback(async () => {
    if (sendingSos) return;

    setSosDragging(false);
    setSendingSos(true);
    let address: string | undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;

    try {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
          const [place] = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });
          if (place) {
            const parts = [place.street, place.district, place.city, place.region].filter(Boolean);
            address = parts.join(", ") || undefined;
          }
        }
      } catch {
        // location failed — send without address
      }

      const result = await sendSosAlert({ address, latitude, longitude });
      setSosModalVisible(false);
      resetSosSlider();
      setSosSuccessMessage(result.message);
      setSosSuccessVisible(true);
    } catch (e: any) {
      resetSosSlider(true);
      Alert.alert("Failed", e?.message ?? "Could not send alert. Please try again.");
    } finally {
      setSendingSos(false);
    }
  }, [resetSosSlider, sendingSos]);

  const handleAlertAction = useCallback(() => {
    setSosDragging(false);
    resetSosSlider();
    setSosModalVisible(true);
  }, [resetSosSlider]);

  const callEmergencyNumber = useCallback(async (number: string) => {
    if (Platform.OS === "web") {
      Alert.alert("Call not supported", "Calling is not supported on web.");
      return;
    }

    const url = `tel:${number}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Cannot place call", `Your device cannot call ${number}.`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Cannot place call", `Unable to call ${number}. Please dial it manually.`);
    }
  }, []);

  const sosPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => sosModalVisible && !sendingSos && sosMaxSlide > 0,
        onStartShouldSetPanResponderCapture: () => sosModalVisible && !sendingSos && sosMaxSlide > 0,
        onMoveShouldSetPanResponder: (_, gesture) =>
          sosModalVisible &&
          !sendingSos &&
          sosMaxSlide > 0 &&
          Math.abs(gesture.dx) > 4 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          setSosDragging(true);
          sosSliderX.stopAnimation();
          sosDragStartRef.current = sosSliderValueRef.current;
        },
        onPanResponderMove: (_, gesture) => {
          const next = clamp(sosDragStartRef.current + gesture.dx, 0, sosMaxSlide);
          sosSliderX.setValue(next);
        },
        onPanResponderRelease: () => {
          setSosDragging(false);
          if (sosSliderValueRef.current >= sosMaxSlide * 0.82) {
            Animated.timing(sosSliderX, {
              toValue: sosMaxSlide,
              duration: 110,
              useNativeDriver: false,
            }).start(() => {
              void submitSosAlert();
            });
            return;
          }

          resetSosSlider(true);
        },
        onPanResponderTerminate: () => {
          setSosDragging(false);
          resetSosSlider(true);
        },
      }),
    [resetSosSlider, sendingSos, sosMaxSlide, sosModalVisible, sosSliderX, submitSosAlert]
  );

  const handleFabHideApp = useCallback(() => {
    closeAndRemoveFromRecents();
  }, []);

  const handleFabIncidentLog = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(INCIDENT_LAST_SUBMIT_KEY);
      const lastSubmitAt = raw ? Number(raw) : 0;
      const remainingMs = INCIDENT_SUBMIT_COOLDOWN_MS - (Date.now() - lastSubmitAt);

      if (Number.isFinite(lastSubmitAt) && lastSubmitAt > 0 && remainingMs > 0) {
        const seconds = Math.ceil(remainingMs / 1000);
        Alert.alert(
          "Please wait",
          `You can submit a report again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
        );
        return;
      }
    } catch {
      // If local storage cannot be read, the server-side cooldown still applies.
    }

    navigateToTab("Incident");
  }, [navigateToTab]);

  const handleFabServices = useCallback(() => {
    setServicesModalVisible(true);
  }, []);

  const closeServicesModal = useCallback(() => {
    setServicesModalVisible(false);
  }, []);

  const handleSelectService = useCallback((serviceId: string) => {
    setServicesModalVisible(false);
    // TODO: navigate to the selected service screen
  }, []);

  const handleFabChatbot = useCallback(() => {
    closeFabMenu();
    setChatbotModalVisible(true);
  }, [closeFabMenu]);

  const closeChatbotModal = useCallback(() => {
    setChatbotModalVisible(false);
  }, []);

  const handleSharedSignOut = useCallback(
    async () => {
      try {
        await logout();
        onQuickExit?.();
      } catch {
        onQuickExit?.();
      }
    },
    [logout, onQuickExit]
  );

  const handleFabSignOut = useCallback(() => {
    setLogoutModalVisible(true);
  }, []);

  const handleLogoutModalCancel = useCallback(() => {
    setLogoutModalVisible(false);
  }, []);

  const handleLogoutModalConfirm = useCallback(() => {
    setLogoutModalVisible(false);
    void handleSharedSignOut();
  }, [handleSharedSignOut]);

  const openTutorialByKey = useCallback((key: "report" | "verify" | "quick_actions") => {
    setShowTutorialMenu(false);

    setTimeout(() => {
      if (key === "report") {
        setShowReportTutorial(true);
        return;
      }
      if (key === "verify") {
        setShowVerifyTutorial(true);
        return;
      }
      setShowFabTutorial(true);
    }, 140);
  }, []);

  const tutorialOptions = useMemo(
    () => [
      {
        key: "report",
        icon: "document-text-outline" as const,
        iconColor: "#1A3C6E",
        title: "How to Submit a Report",
        description: "Learn the step-by-step flow for creating and tracking an incident report.",
        onPress: () => openTutorialByKey("report"),
      },
      {
        key: "verify",
        icon: "shield-checkmark-outline" as const,
        iconColor: "#0F766E",
        title: "How to Verify Your Account",
        description: "See how to take a selfie, upload a valid ID, and complete verification.",
        onPress: () => openTutorialByKey("verify"),
      },
      {
        key: "quick_actions",
        icon: "add-circle-outline" as const,
        iconColor: "#7C3AED",
        title: "How to Use Quick Actions",
        description: "View the shortcut guide for Create Log, Alert, Schedule, Privacy, and Logout.",
        onPress: () => openTutorialByKey("quick_actions"),
      },
    ],
    [openTutorialByKey]
  );

  useEffect(() => {
    if (isFocused) return;

    fabMenuAnim.stopAnimation();
    fabMenuAnim.setValue(0);
    setFabMenuOpen(false);
  }, [fabMenuAnim, isFocused]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: BG },
        page: { flex: 1, backgroundColor: BG, position: "relative" },
        topBar: {
          width: "100%",
          maxWidth: contentWidth,
          alignSelf: "center",
          paddingHorizontal: PAD,
          paddingTop: HEADER_TOP_PAD,
          paddingBottom: clamp(Math.round(10 * s), 6, 14),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },

        logoWrap: { height: logoH, width: logoW, justifyContent: "center" },

        rightActions: { flexDirection: "row", alignItems: "center" },
        rightActionSpacer: { width: ACTION_GAP },

        iconBtn: {
          width: iconBtnSize,
          height: iconBtnSize,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        },

        badge: {
          position: "absolute",
          right: -3,
          top: -3,
          minWidth: clamp(Math.round(20 * s), 18, 22),
          height: clamp(Math.round(20 * s), 18, 22),
          paddingHorizontal: clamp(Math.round(6 * s), 5, 7),
          borderRadius: 999,
          backgroundColor: "#EF4444",
          alignItems: "center",
          justifyContent: "center",
        },
        badgeText: {
          fontFamily: FontFamily,
          fontSize: clamp(
            Math.round(FontSize.overline * fs),
            FontSize.micro,
            FontSize.label,
          ),
          fontWeight: FontWeight.bold,
          color: "#fff",
          lineHeight: clamp(Math.round(13 * fs), 11, 15),
        },

        scroll: { flex: 1 },
        scrollContent: {
          width: "100%",
          maxWidth: contentWidth,
          alignSelf: "center",
          paddingTop: clamp(Math.round(10 * s), 8, 12),
          paddingBottom: CONTENT_BOTTOM_PAD,
        },

        sectionRow: {
          marginTop: clamp(Math.round(22 * s), 18, 28),
          paddingHorizontal: PAD,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },

        sectionTitle: {
          fontFamily: FontFamily,
          fontSize: clamp(
            Math.round(FontSize.sectionTitle * fs),
            FontSize.bodyLarge,
            FontSize.modalTitle,
          ),
          fontWeight: FontWeight.bold,
          color: TEXT_DARK,
        },
        seeMore: {
          fontFamily: FontFamily,
          fontSize: clamp(
            Math.round(FontSize.label * fs),
            FontSize.caption,
            FontSize.bodyLarge,
          ),
          fontWeight: FontWeight.semibold,
          color: Colors.link,
        },

        logsWrap: { paddingHorizontal: PAD, paddingTop: clamp(Math.round(10 * s), 8, 12) },
        logsGap: { height: GAP },

        emergencyContactsWrap: {
          paddingHorizontal: PAD,
          paddingTop: clamp(Math.round(8 * s), 6, 10),
        },
        emergencyContactsRow: {
          flexDirection: "row",
          gap: clamp(Math.round(12 * s), 10, 14),
        },
        emergencyContactCard: {
          flex: 1,
          minWidth: 0,
          height: clamp(Math.round(96 * s), 88, 106),
          borderRadius: clamp(Math.round(16 * s), 14, 18),
          overflow: "hidden",
          ...Platform.select({
            ios: {
              shadowColor: "#0F172A",
              shadowOpacity: 0.14,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            },
            android: { elevation: 3 },
          }),
        },
        emergencyContactGradient: {
          flex: 1,
          paddingHorizontal: clamp(Math.round(13 * s), 11, 16),
          paddingVertical: clamp(Math.round(12 * s), 10, 14),
          justifyContent: "space-between",
        },
        emergencyContactTop: {
          flexDirection: "row",
          alignItems: "center",
          gap: clamp(Math.round(9 * s), 7, 11),
        },
        emergencyContactIcon: {
          width: clamp(Math.round(34 * s), 30, 38),
          height: clamp(Math.round(34 * s), 30, 38),
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.18)",
          alignItems: "center",
          justifyContent: "center",
        },
        emergencyContactPressed: {
          transform: [{ scale: 0.97 }],
          opacity: 0.92,
        },
        emergencyContactNumber: {
          fontFamily: FontFamily,
          flexShrink: 1,
          color: "#FFFFFF",
          fontSize: clamp(Math.round(FontSize.screenTitle * fs), 25, FontSize.display),
          fontWeight: FontWeight.bold,
          lineHeight: clamp(Math.round(34 * fs), 30, 38),
        },
        emergencyContactLabel: {
          fontFamily: FontFamily,
          color: "#FFFFFF",
          fontSize: clamp(
            Math.round(FontSize.overline * fs),
            FontSize.micro,
            FontSize.caption,
          ),
          fontWeight: FontWeight.semibold,
          opacity: 0.94,
        },

        // Safety status chips
        safetyScroll: {
          flexGrow: 0,
          paddingTop: clamp(Math.round(10 * s), 8, 12),
        },
        safetyRow: {
          paddingHorizontal: PAD,
          flexDirection: "row",
          gap: clamp(Math.round(8 * s), 6, 10),
        },
        safetyChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: clamp(Math.round(5 * s), 4, 7),
          backgroundColor: "#FFFFFF",
          borderRadius: 999,
          borderWidth: 1,
          borderColor: "#E7EEF7",
          paddingHorizontal: clamp(Math.round(12 * s), 10, 14),
          paddingVertical: clamp(Math.round(6 * s), 5, 8),
        },
        safetyChipGreen: {
          backgroundColor: "#F0FDF4",
          borderColor: "#BBF7D0",
        },
        safetyChipAmber: {
          backgroundColor: "#FFFBEB",
          borderColor: "#FDE68A",
        },
        safetyChipDot: {
          width: 7,
          height: 7,
          borderRadius: 4,
        },
        safetyChipText: {
          fontFamily: FontFamily,
          fontSize: clamp(
            Math.round(FontSize.caption * fs),
            FontSize.overline,
            FontSize.label,
          ),
          fontWeight: FontWeight.semibold,
          color: "#334155",
        },

        // Section icon + row wrapper
        sectionTitleRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: clamp(Math.round(8 * s), 6, 10),
        },
        sectionIcon: {
          width: clamp(Math.round(26 * s), 22, 30),
          height: clamp(Math.round(26 * s), 22, 30),
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
        },

        // Improved empty state
        emptyLogsCard: {
          borderRadius: clamp(Math.round(16 * s), 14, 18),
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: "#E7EEF7",
          alignItems: "center",
          paddingVertical: clamp(Math.round(24 * s), 20, 28),
          paddingHorizontal: PAD,
          gap: clamp(Math.round(6 * s), 4, 8),
        },
        emptyLogsIconWrap: {
          width: clamp(Math.round(36 * s), 30, 42),
          height: clamp(Math.round(36 * s), 30, 42),
          borderRadius: clamp(Math.round(10 * s), 8, 12),
          backgroundColor: "#EAF3FF",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: clamp(Math.round(2 * s), 1, 4),
        },
        emptyLogsTitle: {
          fontFamily: FontFamily,
          fontSize: clamp(
            Math.round(FontSize.caption * fs),
            FontSize.overline,
            FontSize.label,
          ),
          fontWeight: FontWeight.semibold,
          color: TEXT_DARK,
        },
        emptyLogsText: {
          fontFamily: FontFamily,
          fontSize: clamp(
            Math.round(FontSize.caption * fs),
            FontSize.overline,
            FontSize.label,
          ),
          fontWeight: FontWeight.regular,
          color: "#94A3B8",
          textAlign: "center",
        },
        emptyLogsBtn: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          marginTop: clamp(Math.round(6 * s), 4, 8),
          backgroundColor: Colors.actionPrimary,
          paddingHorizontal: clamp(Math.round(16 * s), 12, 20),
          paddingVertical: clamp(Math.round(8 * s), 6, 10),
          borderRadius: 999,
        },
        emptyLogsBtnText: {
          fontFamily: FontFamily,
          fontSize: clamp(
            Math.round(FontSize.caption * fs),
            FontSize.overline,
            FontSize.label,
          ),
          fontWeight: FontWeight.bold,
          color: "#FFFFFF",
        },

        miniCenter: { paddingHorizontal: PAD, paddingTop: 10, alignItems: "center", justifyContent: "center" },
        emptyHint: {
          fontFamily: FontFamily,
          fontSize: clamp(
            Math.round(FontSize.caption * fs),
            FontSize.overline,
            FontSize.body,
          ),
          fontWeight: FontWeight.semibold,
          color: "#64748B",
          textAlign: "center",
        },
        sosModalRoot: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: clamp(Math.round(24 * s), 20, 28),
        },
        sosModalBackdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.32)",
        },
        sosModalCard: {
          width: "100%",
          maxWidth: clamp(Math.round(320 * s), 300, 340),
          borderRadius: clamp(Math.round(20 * s), 18, 24),
          paddingHorizontal: clamp(Math.round(24 * s), 20, 26),
          paddingTop: clamp(Math.round(28 * s), 24, 30),
          paddingBottom: clamp(Math.round(20 * s), 18, 22),
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
            },
            android: { elevation: 10 },
          }),
        },
        sosCloseBtn: {
          position: "absolute",
          top: clamp(Math.round(16 * s), 14, 18),
          right: clamp(Math.round(16 * s), 14, 18),
          width: clamp(Math.round(32 * s), 28, 34),
          height: clamp(Math.round(32 * s), 28, 34),
          borderRadius: 999,
          backgroundColor: "#F3F4F6",
          alignItems: "center",
          justifyContent: "center",
        },
        sosTitle: {
          fontFamily: FontFamily,
          textAlign: "center",
          fontSize: clamp(
            Math.round(FontSize.sectionTitle * fs),
            FontSize.bodyLarge,
            FontSize.modalTitle,
          ),
          fontWeight: FontWeight.bold,
          color: "#111827",
          marginBottom: clamp(Math.round(24 * s), 20, 26),
        },
        sosGuideCard: {
          alignSelf: "stretch",
          borderRadius: clamp(Math.round(14 * s), 12, 16),
          paddingHorizontal: clamp(Math.round(14 * s), 12, 16),
          paddingVertical: clamp(Math.round(12 * s), 10, 14),
          backgroundColor: "#F9FAFB",
          borderWidth: 1,
          borderColor: "#E5E7EB",
          marginBottom: clamp(Math.round(16 * s), 14, 18),
        },
        sosGuideTitle: {
          fontFamily: FontFamily,
          fontSize: clamp(
            Math.round(FontSize.caption * fs),
            FontSize.overline,
            FontSize.label,
          ),
          fontWeight: FontWeight.semibold,
          color: "#111827",
          marginBottom: clamp(Math.round(6 * s), 4, 8),
        },
        sosGuideLine: {
          fontFamily: FontFamily,
          fontSize: clamp(
            Math.round(FontSize.overline * fs),
            FontSize.micro,
            FontSize.caption,
          ),
          fontWeight: FontWeight.regular,
          lineHeight: clamp(Math.round(16 * fs), 14, 18),
          color: "#6B7280",
        },
        sosSliderShell: {
          alignSelf: "stretch",
        },
        sosSliderTrack: {
          position: "relative",
          minHeight: sosThumbSize + 12,
          borderRadius: 999,
          backgroundColor: "#F9FAFB",
          borderWidth: 1,
          borderColor: "#D7E3F4",
          justifyContent: "center",
          overflow: "hidden",
        },
        sosSliderTrail: {
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          borderRadius: 999,
          overflow: "hidden",
        },
        sosSliderTrailFill: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: 999,
          backgroundColor: "#DBEAFE",
        },
        sosSliderTrailGlow: {
          position: "absolute",
          top: 2,
          bottom: 2,
          borderRadius: 999,
          overflow: "hidden",
        },
        sosSliderLabel: {
          fontFamily: FontFamily,
          zIndex: 1,
          textAlign: "center",
          fontSize: clamp(
            Math.round(FontSize.label * fs),
            FontSize.caption,
            FontSize.body,
          ),
          fontWeight: FontWeight.semibold,
          color: "#374151",
          paddingHorizontal: sosThumbSize + clamp(Math.round(18 * s), 16, 20),
        },
        sosSendingWrap: {
          zIndex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: clamp(Math.round(8 * s), 6, 10),
          paddingHorizontal: sosThumbSize + clamp(Math.round(18 * s), 16, 20),
        },
        sosSendingText: {
          fontFamily: FontFamily,
          fontSize: clamp(
            Math.round(FontSize.label * fs),
            FontSize.caption,
            FontSize.body,
          ),
          fontWeight: FontWeight.semibold,
          color: "#374151",
        },
        sosSliderThumb: {
          position: "absolute",
          left: 6,
          top: 6,
          zIndex: 2,
          backgroundColor: Colors.primary,
          alignItems: "center",
          justifyContent: "center",
          ...Platform.select({
            ios: {
              shadowColor: Colors.primary,
              shadowOpacity: 0.08,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 2 },
            },
            android: { elevation: 1 },
          }),
        },
      }),
    [
      PAD,
      GAP,
      s,
      fs,
      logoW,
      logoH,
      contentWidth,
      iconBtnSize,
      HEADER_TOP_PAD,
      ACTION_GAP,
      CONTENT_BOTTOM_PAD,
      sosThumbSize,
    ]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: TC.screenBg }]} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

      <View style={[styles.page, { backgroundColor: TC.screenBg }]}>
        {/* Top header */}
        <View style={styles.topBar}>
          <View style={styles.logoWrap}>
            <HomeScreenLogo width={logoW} height={logoH} />
          </View>

          <View style={styles.rightActions}>
            <Pressable
              onPress={() => {
                if (fabMenuOpen) closeFabMenu();
                handleOpenNotifications();
              }}
              hitSlop={12}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons name="notifications-outline" size={notifIconSize} color={TC.textDark} />

              {notifCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText} allowFontScaling={false}>
                    {notifCount > 99 ? "99+" : String(notifCount)}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <View style={styles.rightActionSpacer} />

            <Pressable
              onPress={() => {
                if (fabMenuOpen) closeFabMenu();
                setShowTutorialMenu(true);
              }}
              hitSlop={12}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons name="help-circle-outline" size={helpIconSize} color={TC.textDark} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ bottom: CONTENT_BOTTOM_PAD }}
          contentContainerStyle={styles.scrollContent}
        >
          <GreetingCard greeting={greeting} dateLine={dateLine} userName={userName} />


          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: TC.textDark }]} allowFontScaling={false}>
                Recent Logs
              </Text>
            </View>

            <Pressable onPress={() => onTabChange?.("Reports")} hitSlop={10}>
              <Text style={[styles.seeMore, { color: TC.primary }]} allowFontScaling={false}>
                View all
              </Text>
            </Pressable>
          </View>

          <View style={styles.logsWrap}>
            {loadingReports ? (
              <View style={styles.miniCenter}>
                <ActivityIndicator size="small" color={TC.primary} />
              </View>
            ) : (
              <>
                {logs.map((item, idx) => {
                  const full = recentReports.find((r) => r.id === item.id);
                  return (
                    <View key={item.id}>
                      <RecentLogCard
                        item={item}
                        onPress={() => {
                          if (!full) return;
                          onOpenReport?.(full);
                        }}
                      />
                      {idx !== logs.length - 1 ? <View style={styles.logsGap} /> : null}
                    </View>
                  );
                })}

                {logs.length < 2 ? (
                  <>
                    {logs.length > 0 ? <View style={styles.logsGap} /> : null}
                    <View style={[styles.emptyLogsCard, { borderColor: TC.divider }]}>
                      <View style={[styles.emptyLogsIconWrap, { backgroundColor: TC.chipBg }]}>
                        <Ionicons name="document-text-outline" size={14} color={TC.primary} />
                      </View>
                      <Text style={[styles.emptyLogsTitle, { color: TC.textDark }]} allowFontScaling={false}>
                        {logs.length === 0 ? "No report yet" : "No additional report yet"}
                      </Text>
                      {logs.length === 0 ? (
                        <Text style={[styles.emptyLogsText, { color: TC.muted }]} allowFontScaling={false}>
                          Your incident logs will appear here once you submit a report.
                        </Text>
                      ) : null}
                    </View>
                  </>
                ) : null}
              </>
            )}
          </View>

          {/* Emergency contacts */}
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: TC.textDark }]} allowFontScaling={false}>
                Emergency Contacts
              </Text>
            </View>
          </View>

          <View style={styles.emergencyContactsWrap}>
            <View style={styles.emergencyContactsRow}>
              <Pressable
                onPress={() => callEmergencyNumber("911")}
                accessibilityRole="button"
                accessibilityLabel="Call 911 Emergency Hotline"
                style={({ pressed }) => [styles.emergencyContactCard, pressed && styles.emergencyContactPressed]}
              >
                <LinearGradient
                  colors={["#E42535", "#B80D18"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emergencyContactGradient}
                >
                  <View style={styles.emergencyContactTop}>
                    <View style={styles.emergencyContactIcon}>
                      <Ionicons name="call" size={clamp(Math.round(17 * s), 15, 19)} color="#FFFFFF" />
                    </View>
                    <Text style={styles.emergencyContactNumber} numberOfLines={1} allowFontScaling={false}>911</Text>
                  </View>
                  <Text style={styles.emergencyContactLabel} numberOfLines={1} allowFontScaling={false}>
                    Emergency Hotline
                  </Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => callEmergencyNumber("117")}
                accessibilityRole="button"
                accessibilityLabel="Call 117 Police Assistance"
                style={({ pressed }) => [styles.emergencyContactCard, pressed && styles.emergencyContactPressed]}
              >
                <LinearGradient
                  colors={["#E88708", "#A94A00"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emergencyContactGradient}
                >
                  <View style={styles.emergencyContactTop}>
                    <View style={styles.emergencyContactIcon}>
                      <Ionicons name="call" size={clamp(Math.round(17 * s), 15, 19)} color="#FFFFFF" />
                    </View>
                    <Text style={styles.emergencyContactNumber} numberOfLines={1} allowFontScaling={false}>117</Text>
                  </View>
                  <Text style={styles.emergencyContactLabel} numberOfLines={1} allowFontScaling={false}>
                    Police Assistance
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <Modal visible={sosModalVisible} transparent animationType="fade" onRequestClose={closeSosModal}>
          <View style={styles.sosModalRoot}>
            <Pressable style={styles.sosModalBackdrop} onPress={closeSosModal} />

            <Animated.View
              style={[
                styles.sosModalCard,
                {
                  opacity: sosModalAnim,
                  transform: [{ translateY: sosCardTranslateY }, { scale: sosCardScale }],
                },
              ]}
            >
              <Pressable
                onPress={closeSosModal}
                disabled={sendingSos}
                hitSlop={10}
                style={({ pressed }) => [styles.sosCloseBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="close" size={18} color="#374151" />
              </Pressable>

              <Text style={styles.sosTitle} allowFontScaling={false}>
                SOS Emergency Alert
              </Text>

              <Animated.View
                style={[
                  styles.sosGuideCard,
                  {
                    opacity: sosModalAnim,
                    transform: [{ translateY: sosGuideTranslateY }],
                  },
                ]}
              >
                <Text style={styles.sosGuideTitle} allowFontScaling={false}>
                  How it works
                </Text>
                <Text style={styles.sosGuideLine} allowFontScaling={false}>
                  1. Slide to activate your emergency alert
                </Text>
                <Text style={styles.sosGuideLine} allowFontScaling={false}>
                  2. Share your real-time location
                </Text>
                <Text style={styles.sosGuideLine} allowFontScaling={false}>
                  3. Nearby Barangay Official will be notified
                </Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.sosSliderShell,
                  {
                    opacity: sosModalAnim,
                    transform: [{ translateY: sosGuideTranslateY }],
                  },
                ]}
              >
                <View
                  style={styles.sosSliderTrack}
                  onLayout={(event) => setSosSliderWidth(event.nativeEvent.layout.width)}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.sosSliderTrail,
                      {
                        width: sosTrailBaseWidth,
                        transform: [{ translateX: sosTrailTranslateX }],
                      },
                    ]}
                  >
                    <View style={styles.sosSliderTrailFill} />
                    <View
                      style={[
                        styles.sosSliderTrailGlow,
                        {
                          width: sosGlowWidth,
                          right: -sosGlowWidth * 0.22,
                          opacity: 0.92,
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={[
                          "rgba(96,165,250,0)",
                          "rgba(147,197,253,0.22)",
                          "rgba(255,255,255,0.92)",
                          "rgba(191,219,254,0.56)",
                          "rgba(96,165,250,0)",
                        ]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                    </View>
                  </Animated.View>

                  {!sendingSos ? (
                    <Text style={styles.sosSliderLabel} allowFontScaling={false}>
                      Slide to start SOS
                    </Text>
                  ) : (
                    <View style={styles.sosSendingWrap}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.sosSendingText} allowFontScaling={false}>
                        Sending SOS...
                      </Text>
                    </View>
                  )}

                  <Animated.View
                    {...(sendingSos ? {} : sosPanResponder.panHandlers)}
                    style={[
                      styles.sosSliderThumb,
                      {
                        width: sosThumbSize,
                        height: sosThumbSize,
                        borderRadius: sosThumbSize / 2,
                        transform: [{ translateX: sosSliderX }, { scale: sosDragging || sendingSos ? 1 : sosThumbScale }],
                      },
                    ]}
                  >
                    <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
                  </Animated.View>
                </View>
              </Animated.View>
            </Animated.View>
          </View>
        </Modal>

        <LogoutModal
          visible={logoutModalVisible}
          onConfirm={handleLogoutModalConfirm}
          onCancel={handleLogoutModalCancel}
          title="Log Out"
          message="Are you sure you want to log out?"
          confirmLabel="Log Out"
        />

        <LogoutModal
          visible={sosSuccessVisible}
          onConfirm={closeSosSuccessModal}
          onCancel={closeSosSuccessModal}
          title="Alert Sent"
          message={sosSuccessMessage}
          confirmLabel="OK"
          hideCancel
        />

        <ChatbotModal
          visible={chatbotModalVisible}
          onClose={closeChatbotModal}
        />

        <ServicesModal
          visible={servicesModalVisible}
          onClose={closeServicesModal}
          onSelectService={handleSelectService}
        />

        <BottomNavBar
          activeTab={activeTab}
          onTabPress={navigateToTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          centerLabel="Services"
        />

        <QuickActions
          isOpen={fabMenuOpen}
          animation={fabMenuAnim}
          navHeight={navHeight}
          navPaddingBottom={bottomPad}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onToggle={toggleFabMenu}
          onIncidentLog={handleFabIncidentLog}
          onSos={handleAlertAction}
          onServices={handleFabServices}
          onHideApp={handleFabHideApp}
          onSignOut={handleFabSignOut}
        />

        {/* âœ… Fab tutorial overlay */}
        <FabTutorialOverlay
          visible={showFabTutorial}
          onClose={() => setShowFabTutorial(false)}
          width={width}
          s={s}
          fabSize={FAB_SIZE}
          fabBottom={fabBottom}
          navHeight={navHeight}
          title="Open Quick Actions"
          message="Tap the + button to open Create Log, Alert, Schedule, Privacy, and Logout shortcuts."
        />

        <TutorialPickerModal
          visible={showTutorialMenu}
          onClose={() => setShowTutorialMenu(false)}
          options={tutorialOptions}
        />

        <ReportTutorialModal
          visible={showReportTutorial}
          onClose={() => setShowReportTutorial(false)}
        />

        <VerifyAccountTutorialModal
          visible={showVerifyTutorial}
          onClose={() => setShowVerifyTutorial(false)}
        />
      </View>
    </SafeAreaView>
  );
}
