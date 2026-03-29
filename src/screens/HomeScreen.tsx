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
  PanResponder,
  Modal,
  AppState,
  AppStateStatus,
  DeviceEventEmitter,
  Linking,
  Alert,
  Easing,
  InteractionManager,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ✅ NEW: refresh when Home regains focus
import { useFocusEffect, useIsFocused } from "@react-navigation/native";

import { Colors, useColors } from "../theme/colors";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";

import GreetingCard from "../components/HomeScreen/GreetingCard";
import RecentLogCard, { LogItem } from "../components/HomeScreen/RecentLogCard";

import HomeScreenLogo from "../../assets/HomeScreen/NewLogo.svg";

// ✅ Tutorial overlay
import FabTutorialOverlay from "../components/Tutorial/FabTutorialOverlay";
import ReportTutorialModal from "../components/Tutorial/ReportTutorialModal";

// ✅ Auth context
import { useAuth } from "../auth/AuthContext";

// ✅ session token fallback
import { getAccessToken } from "../auth/session";

// ✅ /me API
import { getMeApi } from "../api/pin";

// ✅ Use ReportItem type
import type { ReportItem } from "./ReportScreen";

// ✅ HIDE APP helper
import { closeAndRemoveFromRecents } from "../utils/hideApp";

// ✅ NEW: Use same API as NotificationsScreen (source of truth)
import {
  fetchMyNotificationsCombined,
  sendSosAlert,
  syncLocalReportStatusNotifications,
} from "../api/notifications";

// ✅ FIX: Use requestJson with auth for auto token refresh
import { requestJson } from "../api/http";

// ✅ Location for SOS
import * as Location from "expo-location";

type Props = {
  onQuickExit?: () => void;
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;

  onOpenNotifications?: () => void;

  onOpenReport?: (report: ReportItem) => void;
};

const BG = "#F5FAFE";
const TEXT_DARK = "#0B2B45";

// ✅ once-only tutorial key
const FAB_TUTORIAL_SEEN_KEY = "tahanansafe_fab_tutorial_seen_v1";

// ✅ local "seen notifications" marker (kept, not removed)
const NOTIF_LAST_SEEN_KEY = "tahanansafe_notif_last_seen_v1";

// ✅ ADDED: must match NotificationsScreen.tsx emit name
const NOTIF_CHANGED_EVENT = "tahanan:notifChanged";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ✅ more stable scale for small phones
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

function normalizeStatus(dbStatus?: string): ReportItem["status"] {
  const s = String(dbStatus ?? "").trim().toLowerCase();
  if (s === "submitted" || s === "pending") return "PENDING";
  if (
    s === "ongoing" ||
    s === "on going" ||
    s === "on-going" ||
    s === "in_progress" ||
    s === "in progress"
  )
    return "ONGOING";
  if (s === "cancelled" || s === "canceled") return "CANCELLED";
  if (s === "resolved" || s === "done" || s === "completed") return "RESOLVED";
  return "PENDING";
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
  onOpenNotifications,
  onOpenReport,
}: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);

  const { s, fs } = useMemo(() => makeScale(width, height), [width, height]);

  // ✅ AuthContext
  const { user, setUser, accessToken, refreshMe, logout } = useAuth() as any;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // ✅ Tutorial
  const [showFabTutorial, setShowFabTutorial] = useState(false);
  const [showReportTutorial, setShowReportTutorial] = useState(false);
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
  // ✅ FIXED: /me spam loop guard
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

      // ✅ Only setUser if needed (prevents render loop)
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

  // ✅ Run sync when token changes / first mount only
  useEffect(() => {
    syncProfile();
    refreshMe?.().catch?.(() => {});
  }, [syncProfile, refreshMe, accessToken]);

  // ✅ LIVE CLOCK
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
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  const CONTENT_BOTTOM_PAD = useMemo(() => {
    const fabOverlapPad = Math.round(FAB_SIZE * 0.55);
    return navHeight + fabOverlapPad + 16;
  }, [navHeight]);

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const pressFab = () => handleTab("Incident");
  const longPressFab = () => onQuickExit?.();

  // =========================
  // ✅ Emergency Call Buttons (911 / 117)
  // =========================
  const callEmergency = useCallback(async (num: "911" | "117") => {
    try {
      const url = `tel:${num}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Calling not supported", "This device cannot place phone calls.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Call failed", "Unable to start the call on this device.");
    }
  }, []);

  // ✅ Emergency button animations (press bounce)
  const em911Scale = useRef(new Animated.Value(1)).current;
  const em117Scale = useRef(new Animated.Value(1)).current;

  const pressInEmergency = useCallback((v: Animated.Value) => {
    v.stopAnimation();
    Animated.spring(v, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 22,
      bounciness: 0,
    }).start();
  }, []);

  const pressOutEmergency = useCallback((v: Animated.Value) => {
    v.stopAnimation();
    Animated.spring(v, {
      toValue: 1,
      useNativeDriver: true,
      speed: 16,
      bounciness: 8,
    }).start();
  }, []);

  // =========================
  // ✅ Notifications badge logic (UPDATED to auto-refresh)
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
          status: normalizeStatus(doc?.status),
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

  // ✅ Recent reports
  const [recentReports, setRecentReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const reportsFetchInFlightRef = useRef(false);
  const lastReportsFetchAtRef = useRef(0);

  // ✅ FIX: Use requestJson with auth:true for auto token refresh
  const fetchRecentReports = useCallback(async (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    const now = Date.now();

    if (!force && now - lastReportsFetchAtRef.current < 90000) return;
    if (reportsFetchInFlightRef.current) return;

    reportsFetchInFlightRef.current = true;
    try {
      setLoadingReports(true);

      // ✅ FIX: This auto-attaches the access token AND auto-refreshes on 401
      const json: any = await requestJson({
        method: "GET",
        path: "/api/mobile/v1/reports/my",
        auth: true,
      });

      const rawList = Array.isArray(json) ? json : json?.incidents ?? [];
      const topReportsRaw = [...rawList]
        .sort((a: any, b: any) => {
          const ta = new Date(String(a?.createdAt ?? 0)).getTime();
          const tb = new Date(String(b?.createdAt ?? 0)).getTime();
          return (tb || 0) - (ta || 0);
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

        const leftDate = dateObj ? formatFullDate(dateObj) : dateStr || "—";
        const leftTime = timeStr || "—";

        const rightObj = parseDateSmart(updatedAtIso) ?? parseDateSmart(createdAtIso) ?? dateObj;
        const rightDate = rightObj ? formatFullDate(rightObj) : "—";
        const rightTime =
          rightObj && !Number.isNaN(rightObj.getTime())
            ? `${(() => {
                const h = rightObj.getHours();
                const m = rightObj.getMinutes();
                const ampm = h >= 12 ? "PM" : "AM";
                const hh = h % 12 === 0 ? 12 : h % 12;
                return `${hh}:${pad2(m)} ${ampm}`;
              })()}`
            : "—";

        const detailLine =
          leftDate && leftTime && leftDate !== "—" && leftTime !== "—"
            ? `On ${leftDate}, at approximately ${leftTime},`
            : details
            ? details
            : "—";

        const statusNorm = normalizeStatus(doc?.status);

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
      // ✅ On error (including session expired), just clear reports silently
      setRecentReports([]);
    } finally {
      setLoadingReports(false);
      reportsFetchInFlightRef.current = false;
    }
  }, []); // ✅ FIX: No more [accessToken] dependency — requestJson handles token internally

  useEffect(() => {
    fetchRecentReports({ force: true });
  }, [fetchRecentReports]);

  // ✅ Also refresh reports when Home screen regains focus
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchRecentReports({ force: false });
      });
      return () => task.cancel();
    }, [fetchRecentReports])
  );

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
    }));
  }, [recentReports]);

  const PAD = useMemo(() => clamp(Math.round(16 * s), 12, 20), [s]);
  const GAP = useMemo(() => clamp(Math.round(16 * s), 12, 18), [s]);

  const logoW = clamp(Math.round(width * 0.48), 140, 230);
  const logoH = clamp(Math.round(36 * s), 28, 42);

  const iconBtnSize = clamp(Math.round(38 * s), 34, 44);
  const notifIconSize = clamp(Math.round(20 * s), 18, 24);
  const helpIconSize = clamp(Math.round(22 * s), 20, 26);

  const HEADER_TOP_PAD = useMemo(() => clamp(Math.round(6 * s), 2, 10), [s]);
  const ACTION_GAP = useMemo(() => clamp(Math.round(14 * s), 10, 16), [s]);

  // =========================
  // ✅ Swipe-up Quick Actions Sheet
  // =========================
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetOpenRef = useRef(false);

  const SHEET_HEIGHT = useMemo(() => clamp(Math.round(height * 0.34), 250, 340), [height]);
  const sheetY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const sheetAnimatingRef = useRef(false);

  const chevronOpen = useRef(new Animated.Value(0)).current;

  // ✅ Backdrop opacity animation
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
  }, [sheetOpen]);

  useEffect(() => {
    if (!isFocused) {
      sheetAnimatingRef.current = false;
      sheetOpenRef.current = false;
      sheetY.stopAnimation();
      chevronOpen.stopAnimation();
      backdropOpacity.stopAnimation();
      sheetY.setValue(SHEET_HEIGHT);
      chevronOpen.setValue(0);
      backdropOpacity.setValue(0);
      if (sheetOpen) setSheetOpen(false);
      return;
    }
  }, [
    isFocused,
    sheetOpen,
    sheetY,
    chevronOpen,
    backdropOpacity,
    SHEET_HEIGHT,
  ]);

  const openSheet = useCallback(() => {
    if (!isFocusedRef.current) return;
    if (sheetOpenRef.current) return;
    if (sheetAnimatingRef.current) return;
    sheetAnimatingRef.current = true;

    sheetY.stopAnimation();
    chevronOpen.stopAnimation();
    backdropOpacity.stopAnimation();

    sheetY.setValue(SHEET_HEIGHT);
    chevronOpen.setValue(0);
    backdropOpacity.setValue(0);

    sheetOpenRef.current = true;
    setSheetOpen(true);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        isInteraction: false,
        useNativeDriver: true,
      }),
      Animated.spring(sheetY, {
        toValue: 0,
        isInteraction: false,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
        mass: 0.9,
      }),
      Animated.timing(chevronOpen, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        isInteraction: false,
        useNativeDriver: true,
      }),
    ]).start(() => {
      sheetAnimatingRef.current = false;
    });
  }, [sheetY, chevronOpen, backdropOpacity, SHEET_HEIGHT]);

  const closeSheet = useCallback(() => {
    if (!sheetOpenRef.current && !sheetAnimatingRef.current) return;
    if (sheetAnimatingRef.current) return;
    sheetAnimatingRef.current = true;

    sheetY.stopAnimation();
    chevronOpen.stopAnimation();
    backdropOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.quad),
        isInteraction: false,
        useNativeDriver: true,
      }),
      Animated.timing(sheetY, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        isInteraction: false,
        useNativeDriver: true,
      }),
      Animated.timing(chevronOpen, {
        toValue: 0,
        duration: 160,
        easing: Easing.inOut(Easing.quad),
        isInteraction: false,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      sheetAnimatingRef.current = false;
      if (finished) {
        sheetOpenRef.current = false;
        sheetY.setValue(SHEET_HEIGHT);
        chevronOpen.setValue(0);
        backdropOpacity.setValue(0);
        setSheetOpen(false);
      }
    });
  }, [sheetY, SHEET_HEIGHT, chevronOpen, backdropOpacity]);

  const handlePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dx) < 20,
      onPanResponderMove: (_, g) => {
        const next = clamp(g.dy, 0, SHEET_HEIGHT);
        sheetY.setValue(next);
        const t = clamp(next / SHEET_HEIGHT, 0, 1);
        chevronOpen.setValue(1 - t);
        backdropOpacity.setValue(1 - t);
      },
      onPanResponderRelease: (_, g) => {
        const shouldClose = g.dy > 60 || g.vy > 0.9;
        if (shouldClose) closeSheet();
        else {
          Animated.parallel([
            Animated.timing(backdropOpacity, {
              toValue: 1,
              duration: 120,
              easing: Easing.out(Easing.quad),
              isInteraction: false,
              useNativeDriver: true,
            }),
            Animated.spring(sheetY, {
              toValue: 0,
              isInteraction: false,
              useNativeDriver: true,
              damping: 18,
              stiffness: 220,
              mass: 0.9,
            }),
            Animated.timing(chevronOpen, {
              toValue: 1,
              duration: 190,
              easing: Easing.out(Easing.quad),
              isInteraction: false,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const handleHandlePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dx) < 20,
      onPanResponderRelease: (_, g) => {
        if (g.dy < -30 || g.vy < -0.9) openSheet();
      },
    })
  ).current;

  const CHEVRON_LIFT = useMemo(() => clamp(Math.round(24 * s), 18, 34), [s]);
  const chevronHandleBottom = useMemo(
    () => navHeight + FAB_SIZE * 0.55 + CHEVRON_LIFT,
    [navHeight, FAB_SIZE, CHEVRON_LIFT]
  );

  const SHEET_TOTAL_HEIGHT = useMemo(() => SHEET_HEIGHT + bottomPad, [SHEET_HEIGHT, bottomPad]);

  const CHEVRON_ABOVE_SHEET_GAP = useMemo(() => clamp(Math.round(10 * s), 8, 14), [s]);
  const openBottom = useMemo(
    () => SHEET_TOTAL_HEIGHT + CHEVRON_ABOVE_SHEET_GAP,
    [SHEET_TOTAL_HEIGHT, CHEVRON_ABOVE_SHEET_GAP]
  );

  const deltaToOpen = useMemo(() => openBottom - chevronHandleBottom, [openBottom, chevronHandleBottom]);

  const chevronLiftToOpen = useMemo(
    () =>
      chevronOpen.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -deltaToOpen],
        extrapolate: "clamp",
      }),
    [chevronOpen, deltaToOpen]
  );

  const modalChevronTranslateY = useMemo(() => Animated.add(sheetY, chevronLiftToOpen), [sheetY, chevronLiftToOpen]);

  const chevronRotate = chevronOpen.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const chevronScale = chevronOpen.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });

  // Gentle looping bounce while sheet is closed
  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation;
    if (!sheetOpen) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: -5, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue:  0, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      bounceAnim.stopAnimation();
      bounceAnim.setValue(0);
    }
    return () => { if (loop) loop.stop(); };
  }, [sheetOpen, bounceAnim]);
  const bounceY = bounceAnim;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: BG },
        page: { flex: 1, backgroundColor: BG, position: "relative" },

        topBar: {
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
          borderRadius: 999,
          backgroundColor: "#F0F6FF",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "#E7EEF7",
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
          fontSize: clamp(Math.round(11 * fs), 10, 13),
          fontWeight: "900",
          color: "#fff",
          lineHeight: clamp(Math.round(13 * fs), 11, 15),
        },

        scroll: { flex: 1 },
        scrollContent: {
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

        sectionTitle: { fontSize: clamp(Math.round(14 * fs), 13, 16), fontWeight: "900", color: TEXT_DARK },
        seeMore: { fontSize: clamp(Math.round(13 * fs), 12, 15), fontWeight: "600", color: Colors.link },

        logsWrap: { paddingHorizontal: PAD, paddingTop: clamp(Math.round(10 * s), 8, 12) },
        logsGap: { height: GAP },

        // Emergency buttons
        emergencyWrap: {
          paddingHorizontal: PAD,
          paddingTop: clamp(Math.round(6 * s), 4, 8),
        },
        emergencyRow: {
          flexDirection: "row",
          gap: clamp(Math.round(10 * s), 8, 12),
        },
        emergencyBtnOuter: {
          flex: 1,
        },
        emergencyBtnCard: {
          width: "100%",
          borderRadius: 20,
          paddingVertical: clamp(Math.round(14 * s), 12, 17),
          paddingHorizontal: clamp(Math.round(14 * s), 12, 16),
          overflow: "hidden",
        },
        emergencyIconRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: clamp(Math.round(10 * s), 8, 12),
          marginBottom: clamp(Math.round(6 * s), 4, 8),
        },
        emergencyCircle: {
          width: clamp(Math.round(34 * s), 30, 40),
          height: clamp(Math.round(34 * s), 30, 40),
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.2)",
          alignItems: "center",
          justifyContent: "center",
        },
        emergencyTextGroup: {
          flex: 1,
        },
        emergencyNum: {
          fontSize: clamp(Math.round(26 * fs), 22, 30),
          fontWeight: "900",
          color: "#FFFFFF",
          letterSpacing: 0.5,
          lineHeight: clamp(Math.round(28 * fs), 24, 32),
        },
        emergencyLabel: {
          fontSize: clamp(Math.round(11 * fs), 10, 12),
          fontWeight: "600",
          color: "rgba(255,255,255,0.85)",
        },
        emergencySub: {
          fontSize: clamp(Math.round(10 * fs), 9, 11),
          fontWeight: "600",
          color: "rgba(255,255,255,0.65)",
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
          fontSize: clamp(Math.round(12 * fs), 11, 13),
          fontWeight: "700",
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
          backgroundColor: "#FFFFFF",
          borderRadius: clamp(Math.round(16 * s), 14, 18),
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
          fontSize: clamp(Math.round(12 * fs), 11, 13),
          fontWeight: "600",
          color: TEXT_DARK,
        },
        emptyLogsText: {
          fontSize: clamp(Math.round(12 * fs), 11, 13),
          fontWeight: "400",
          color: "#94A3B8",
          textAlign: "center",
        },
        emptyLogsBtn: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          marginTop: clamp(Math.round(6 * s), 4, 8),
          backgroundColor: Colors.primary,
          paddingHorizontal: clamp(Math.round(16 * s), 12, 20),
          paddingVertical: clamp(Math.round(8 * s), 6, 10),
          borderRadius: 999,
        },
        emptyLogsBtnText: {
          fontSize: clamp(Math.round(12 * fs), 11, 13),
          fontWeight: "800",
          color: "#FFFFFF",
        },

        miniCenter: { paddingHorizontal: PAD, paddingTop: 10, alignItems: "center", justifyContent: "center" },
        emptyHint: {
          fontSize: clamp(Math.round(12 * fs), 11, 14),
          fontWeight: "800",
          color: "#64748B",
          textAlign: "center",
        },

        chevronHandleWrap: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: chevronHandleBottom,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 60,
        },

        chevronModalWrap: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: chevronHandleBottom,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999,
          elevation: 999,
        },

        chevronHandle: {
          width: clamp(Math.round(54 * s), 46, 64),
          height: clamp(Math.round(26 * s), 22, 30),
          borderRadius: 999,
          backgroundColor: "#F0F6FF",
          borderWidth: 1,
          borderColor: "#E7EEF7",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },

        backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.18)" },

        sheetOuter: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: SHEET_TOTAL_HEIGHT,
          justifyContent: "flex-end",
        },

        sheetCard: {
          height: SHEET_TOTAL_HEIGHT,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: "#FFFFFF",
          paddingTop: clamp(Math.round(12 * s), 10, 14),
          paddingBottom: bottomPad + clamp(Math.round(14 * s), 12, 16),
          paddingHorizontal: clamp(Math.round(18 * s), 16, 22),
          shadowColor: "#000",
          shadowOpacity: 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -6 },
          elevation: 12,
        },

        sheetGrabber: {
          alignSelf: "center",
          width: clamp(Math.round(64 * s), 56, 72),
          height: 6,
          borderRadius: 999,
          backgroundColor: "#D7E3F2",
          marginBottom: clamp(Math.round(14 * s), 12, 16),
        },

        actionBtn: {
          width: "100%",
          borderRadius: 18,
          backgroundColor: "#083B67",
          paddingVertical: clamp(Math.round(16 * s), 14, 18),
          paddingHorizontal: clamp(Math.round(14 * s), 12, 16),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: clamp(Math.round(12 * s), 10, 12),
        },

        actionText: { fontSize: clamp(Math.round(16 * fs), 14, 18), fontWeight: "900", color: "#FFFFFF" },
        actionIcon: { marginTop: 1, marginRight: 10 },
        dangerBtn: { backgroundColor: "#0B2B45" },
      }),
    [
      PAD,
      GAP,
      s,
      fs,
      logoW,
      logoH,
      iconBtnSize,
      HEADER_TOP_PAD,
      ACTION_GAP,
      chevronHandleBottom,
      SHEET_TOTAL_HEIGHT,
      bottomPad,
      CONTENT_BOTTOM_PAD,
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
              onPress={handleOpenNotifications}
              hitSlop={12}
              style={({ pressed }) => [styles.iconBtn, { backgroundColor: TC.chipBg, borderColor: TC.divider }, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
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
                if (sheetOpen) closeSheet();
                setShowReportTutorial(true);
              }}
              hitSlop={12}
              style={({ pressed }) => [styles.iconBtn, { backgroundColor: TC.chipBg, borderColor: TC.divider }, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
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
                See more
              </Text>
            </Pressable>
          </View>

          <View style={styles.logsWrap}>
            {loadingReports ? (
              <View style={styles.miniCenter}>
                <ActivityIndicator size="small" color={TC.primary} />
              </View>
            ) : logs.length === 0 ? (
              <View style={[styles.emptyLogsCard, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
                <View style={[styles.emptyLogsIconWrap, { backgroundColor: TC.chipBg }]}>
                  <Ionicons name="document-text-outline" size={14} color={TC.primary} />
                </View>
                <Text style={[styles.emptyLogsTitle, { color: TC.textDark }]} allowFontScaling={false}>No reports yet</Text>
                <Text style={[styles.emptyLogsText, { color: TC.muted }]} allowFontScaling={false}>
                  Your incident logs will appear here once you submit a report.
                </Text>
               
              </View>
            ) : (
              logs.map((item, idx) => {
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
              })
            )}
          </View>

          {/* Emergency Contacts */}
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: TC.textDark }]} allowFontScaling={false}>
                Emergency Contacts
              </Text>
            </View>
          </View>

          <View style={styles.emergencyWrap}>
            <View style={styles.emergencyRow}>
              <Pressable
                onPress={() => callEmergency("911")}
                onPressIn={() => pressInEmergency(em911Scale)}
                onPressOut={() => pressOutEmergency(em911Scale)}
                hitSlop={8}
                style={styles.emergencyBtnOuter}
              >
                <Animated.View style={{ transform: [{ scale: em911Scale }], width: "100%" }}>
                  <LinearGradient
                    colors={["#DC2626", "#991B1B"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emergencyBtnCard}
                  >
                    <View style={styles.emergencyIconRow}>
                      <View style={styles.emergencyCircle}>
                        <Ionicons name="call" size={16} color="#fff" />
                      </View>
                      <Text style={styles.emergencyNum} allowFontScaling={false}>911</Text>
                    </View>
                    <Text style={styles.emergencyLabel} allowFontScaling={false}>Emergency Hotline</Text>
                  </LinearGradient>
                </Animated.View>
              </Pressable>

              <Pressable
                onPress={() => callEmergency("117")}
                onPressIn={() => pressInEmergency(em117Scale)}
                onPressOut={() => pressOutEmergency(em117Scale)}
                hitSlop={8}
                style={styles.emergencyBtnOuter}
              >
                <Animated.View style={{ transform: [{ scale: em117Scale }], width: "100%" }}>
                  <LinearGradient
                    colors={["#D97706", "#92400E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emergencyBtnCard}
                  >
                    <View style={styles.emergencyIconRow}>
                      <View style={styles.emergencyCircle}>
                        <Ionicons name="call" size={16} color="#fff" />
                      </View>
                      <Text style={styles.emergencyNum} allowFontScaling={false}>117</Text>
                    </View>
                    <Text style={styles.emergencyLabel} allowFontScaling={false}>Police Assistance</Text>
                  </LinearGradient>
                </Animated.View>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* ✅ Chevron handle (ONLY when sheet is CLOSED) */}
        {!sheetOpen ? (
          <View style={styles.chevronHandleWrap} {...handleHandlePan.panHandlers}>
            <Pressable
              onPress={() => {
                if (sheetOpen) closeSheet();
                else openSheet();
              }}
              hitSlop={14}
              style={({ pressed }) => [styles.chevronHandle, { backgroundColor: TC.chipBg, borderColor: TC.divider }, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            >
              <Animated.View
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
                style={{ transform: [{ translateY: bounceY }, { rotate: chevronRotate }, { scale: chevronScale }] }}
              >
                <Ionicons name="chevron-up" size={22} color={TC.textDark} />
              </Animated.View>
            </Pressable>
          </View>
        ) : null}

        {/* ✅ Bottom Nav */}
        <BottomNavBar
          activeTab={activeTab}
          onTabPress={(key) => {
            setActiveTab(key);
            onTabChange?.(key);
          }}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          centerLabel="Community"
        />

        {/* ✅ Floating FAB — bottom-right, above Settings tab */}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            bottom: navHeight + 28,
            right: 16,
            zIndex: 20,
          }}
        >
          <Pressable
            onPress={pressFab}
            onLongPress={longPressFab}
            delayLongPress={350}
            style={({ pressed }) => ({
              width: FAB_SIZE,
              height: FAB_SIZE,
              borderRadius: FAB_SIZE / 2,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              ...(pressed ? { transform: [{ scale: 0.95 }] } : {}),
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOpacity: 0.18,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 8 },
                },
                android: { elevation: 10 },
              }),
            })}
          >
            <LinearGradient
              colors={TC.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* ✅ Fab tutorial overlay */}
        <FabTutorialOverlay
          visible={showFabTutorial}
          onClose={() => setShowFabTutorial(false)}
          width={width}
          s={s}
          fabSize={FAB_SIZE}
          fabBottom={fabBottom}
          navHeight={navHeight}
          title="Create an Incident Log"
          message="Tap the + button to add a new report."
        />

        {/* ✅ Report submission tutorial modal */}
        <ReportTutorialModal
          visible={showReportTutorial}
          onClose={() => setShowReportTutorial(false)}
        />

        {/* ✅ Swipe-up Sheet Modal */}
        <Modal
          visible={sheetOpen}
          transparent
          animationType="none"
          onRequestClose={closeSheet}
          statusBarTranslucent
          hardwareAccelerated
        >
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable style={{ flex: 1 }} onPress={closeSheet} />
          </Animated.View>

          <Animated.View
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[
              styles.chevronModalWrap,
              {
                transform: [{ translateY: modalChevronTranslateY }],
              },
            ]}
            {...handlePan.panHandlers}
          >
            <Pressable
              onPress={() => closeSheet()}
              hitSlop={14}
              style={({ pressed }) => [styles.chevronHandle, { backgroundColor: TC.chipBg, borderColor: TC.divider }, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            >
              <Animated.View
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
                style={{ transform: [{ rotate: chevronRotate }, { scale: chevronScale }] }}
              >
                <Ionicons name="chevron-up" size={22} color={TC.textDark} />
              </Animated.View>
            </Pressable>
          </Animated.View>

          <Animated.View
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[styles.sheetOuter, { transform: [{ translateY: sheetY }] }]}
          >
            <View style={[styles.sheetCard, { backgroundColor: TC.surface }]} {...handlePan.panHandlers}>
              <View style={styles.sheetGrabber} />

              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Send SOS Alert",
                    "This will notify all Barangay Officials with your current location. Are you sure?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Send Alert",
                        style: "destructive",
                        onPress: async () => {
                          closeSheet();
                          let address: string | undefined;
                          let latitude: number | undefined;
                          let longitude: number | undefined;
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
                          try {
                            const result = await sendSosAlert({ address, latitude, longitude });
                            Alert.alert("Alert Sent", result.message);
                          } catch (e: any) {
                            Alert.alert("Failed", e?.message ?? "Could not send alert. Please try again.");
                          }
                        },
                      },
                    ]
                  );
                }}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
              >
                <Ionicons name="warning-outline" size={20} color="#fff" style={styles.actionIcon} />
                <Text style={styles.actionText} allowFontScaling={false}>
                  Alert
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  closeSheet();
                  closeAndRemoveFromRecents();
                }}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
              >
                <Ionicons name="eye-off-outline" size={20} color="#fff" style={styles.actionIcon} />
                <Text style={styles.actionText} allowFontScaling={false}>
                  Hide App
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  closeSheet();
                  try {
                    await logout();
                    onQuickExit?.();
                  } catch {
                    onQuickExit?.();
                  }
                }}
                style={({ pressed }) => [styles.actionBtn, styles.dangerBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
              >
                <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.actionIcon} />
                <Text style={styles.actionText} allowFontScaling={false}>
                  Sign Out
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}
