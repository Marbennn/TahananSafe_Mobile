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

// âœ… NEW: refresh when Home regains focus
import { useFocusEffect, useIsFocused } from "@react-navigation/native";

import { Colors, useColors } from "../theme/colors";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";

import GreetingCard from "../components/HomeScreen/GreetingCard";
import RecentLogCard, { LogItem } from "../components/HomeScreen/RecentLogCard";

import HomeScreenLogo from "../../assets/HomeScreen/NewLogo.svg";

// âœ… Tutorial overlay
import FabTutorialOverlay from "../components/Tutorial/FabTutorialOverlay";
import ReportTutorialModal from "../components/Tutorial/ReportTutorialModal";

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

// âœ… Location for SOS
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

// âœ… once-only tutorial key
const FAB_TUTORIAL_SEEN_KEY = "tahanansafe_fab_tutorial_seen_v1";

// âœ… local "seen notifications" marker (kept, not removed)
const NOTIF_LAST_SEEN_KEY = "tahanansafe_notif_last_seen_v1";

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

  // âœ… AuthContext
  const { user, setUser, accessToken, logout } = useAuth() as any;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // âœ… Tutorial
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
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

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
  // âœ… Emergency Call Buttons (911 / 117)
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

  // âœ… Emergency button animations (press bounce)
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

  // âœ… Recent reports
  const [recentReports, setRecentReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const reportsFetchInFlightRef = useRef(false);
  const lastReportsFetchAtRef = useRef(0);

  // âœ… FIX: Use requestJson with auth:true for auto token refresh
  const fetchRecentReports = useCallback(async (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    const now = Date.now();

    if (!force && now - lastReportsFetchAtRef.current < 90000) return;
    if (reportsFetchInFlightRef.current) return;

    reportsFetchInFlightRef.current = true;
    try {
      setLoadingReports(true);

      // âœ… FIX: This auto-attaches the access token AND auto-refreshes on 401
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

        const detailLine =
          leftDate && leftTime && leftDate !== "â€”" && leftTime !== "â€”"
            ? `On ${leftDate}, at approximately ${leftTime},`
            : details
            ? details
            : "â€”";

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
      // âœ… On error (including session expired), just clear reports silently
      setRecentReports([]);
    } finally {
      setLoadingReports(false);
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

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  const fabMenuAnim = useRef(new Animated.Value(0)).current;
  const [fabMenuOpen, setFabMenuOpen] = useState(false);

  const openFabMenu = useCallback(() => {
    if (!isFocusedRef.current || fabMenuOpen) return;

    fabMenuAnim.stopAnimation();
    setFabMenuOpen(true);
    Animated.spring(fabMenuAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 160,
    }).start();
  }, [fabMenuAnim, fabMenuOpen]);

  const closeFabMenu = useCallback(() => {
    if (!fabMenuOpen) return;

    fabMenuAnim.stopAnimation();
    Animated.timing(fabMenuAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => setFabMenuOpen(false));
  }, [fabMenuAnim, fabMenuOpen]);

  const toggleFabMenu = useCallback(() => {
    if (fabMenuOpen) {
      closeFabMenu();
      return;
    }

    openFabMenu();
  }, [closeFabMenu, fabMenuOpen, openFabMenu]);

  const handleAlertAction = useCallback(() => {
    Alert.alert(
      "Send SOS Alert",
      "This will notify all Barangay Officials with your current location. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Alert",
          style: "destructive",
          onPress: async () => {
            closeFabMenu();
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
  }, [closeFabMenu]);

  const handleFabHideApp = useCallback(() => {
    closeFabMenu();
    closeAndRemoveFromRecents();
  }, [closeFabMenu]);

  const handleFabIncidentLog = useCallback(() => {
    closeFabMenu();
    navigateToTab("Incident");
  }, [closeFabMenu, navigateToTab]);

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
    closeFabMenu();
    void handleSharedSignOut();
  }, [closeFabMenu, handleSharedSignOut]);

  const fabRotate = fabMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "135deg"],
  });
  const fabActionsOpacity = fabMenuAnim;
  const fabActionsTranslateY = fabMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });
  const fabActionsScale = fabMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

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
        fabBackdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(11, 43, 69, 0.12)",
          zIndex: 18,
        },
        fabActionList: {
          position: "absolute",
          right: 0,
          bottom: FAB_SIZE + clamp(Math.round(14 * s), 12, 18),
          gap: clamp(Math.round(10 * s), 8, 12),
          alignItems: "flex-end",
        },
        fabActionBtn: {
          minWidth: clamp(Math.round(182 * s), 168, 196),
          borderRadius: 999,
          borderWidth: 1,
          paddingVertical: clamp(Math.round(10 * s), 9, 12),
          paddingHorizontal: clamp(Math.round(12 * s), 10, 14),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          ...Platform.select({
            ios: {
              shadowColor: "#0F172A",
              shadowOpacity: 0.14,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
            },
            android: { elevation: 6 },
          }),
        },
        fabActionIconWrap: {
          width: clamp(Math.round(34 * s), 30, 36),
          height: clamp(Math.round(34 * s), 30, 36),
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          marginRight: clamp(Math.round(10 * s), 8, 12),
        },
        fabActionText: {
          fontSize: clamp(Math.round(13 * fs), 12, 14),
          fontWeight: "800",
        },
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
              onPress={() => {
                if (fabMenuOpen) closeFabMenu();
                handleOpenNotifications();
              }}
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
                if (fabMenuOpen) closeFabMenu();
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

        {fabMenuOpen ? (
          <Animated.View style={[styles.fabBackdrop, { opacity: fabActionsOpacity }]}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeFabMenu} />
          </Animated.View>
        ) : null}

        <BottomNavBar
          activeTab={activeTab}
          onTabPress={navigateToTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          centerLabel="Community"
        />

        {/* âœ… Floating FAB â€” bottom-right, above Settings tab */}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            bottom: navHeight + 28,
            right: 16,
            zIndex: 20,
          }}
        >
          {fabMenuOpen ? (
            <Animated.View
              style={[
                styles.fabActionList,
                {
                  opacity: fabActionsOpacity,
                  transform: [{ translateY: fabActionsTranslateY }, { scale: fabActionsScale }],
                },
              ]}
            >
              <Pressable
                onPress={handleFabIncidentLog}
                style={({ pressed }) => [
                  styles.fabActionBtn,
                  {
                    backgroundColor: TC.surface,
                    borderColor: TC.divider,
                  },
                  pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={[styles.fabActionIconWrap, { backgroundColor: TC.chipBg }]}>
                  <Ionicons name="document-text-outline" size={18} color={TC.primary} />
                </View>
                <Text style={[styles.fabActionText, { color: TC.textDark }]} allowFontScaling={false}>
                  Incident Log
                </Text>
              </Pressable>

              <Pressable
                onPress={handleAlertAction}
                style={({ pressed }) => [
                  styles.fabActionBtn,
                  {
                    backgroundColor: TC.surface,
                    borderColor: TC.divider,
                  },
                  pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={[styles.fabActionIconWrap, { backgroundColor: TC.chipBg }]}>
                  <Ionicons name="warning-outline" size={18} color={TC.primary} />
                </View>
                <Text style={[styles.fabActionText, { color: TC.textDark }]} allowFontScaling={false}>
                  Alert
                </Text>
              </Pressable>

              <Pressable
                onPress={handleFabHideApp}
                style={({ pressed }) => [
                  styles.fabActionBtn,
                  {
                    backgroundColor: TC.surface,
                    borderColor: TC.divider,
                  },
                  pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={[styles.fabActionIconWrap, { backgroundColor: TC.chipBg }]}>
                  <Ionicons name="eye-off-outline" size={18} color={TC.primary} />
                </View>
                <Text style={[styles.fabActionText, { color: TC.textDark }]} allowFontScaling={false}>
                  Hide App
                </Text>
              </Pressable>

              <Pressable
                onPress={handleFabSignOut}
                style={({ pressed }) => [
                  styles.fabActionBtn,
                  {
                    backgroundColor: TC.surface,
                    borderColor: TC.divider,
                  },
                  pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={[styles.fabActionIconWrap, { backgroundColor: TC.chipBg }]}>
                  <Ionicons name="log-out-outline" size={18} color={TC.primary} />
                </View>
                <Text style={[styles.fabActionText, { color: TC.textDark }]} allowFontScaling={false}>
                  Sign Out
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}

          <Pressable
            onPress={toggleFabMenu}
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
            <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
              <Ionicons name="add" size={30} color="#FFFFFF" />
            </Animated.View>
          </Pressable>
        </View>

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
          message="Tap the + button to open Incident Log, Alert, Hide App, and Sign Out shortcuts."
        />

        {/* âœ… Report submission tutorial modal */}
        <ReportTutorialModal
          visible={showReportTutorial}
          onClose={() => setShowReportTutorial(false)}
        />
      </View>
    </SafeAreaView>
  );
}
