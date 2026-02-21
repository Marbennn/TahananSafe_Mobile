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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Colors } from "../theme/colors";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";

import GreetingCard from "../components/HomeScreen/GreetingCard";
import RecentLogCard, { LogItem } from "../components/HomeScreen/RecentLogCard";

import HomeScreenLogo from "../../assets/HomeScreen/NewLogo.svg";

// ✅ Tutorial overlay
import FabTutorialOverlay from "../components/Tutorial/FabTutorialOverlay";

// ✅ Auth context
import { useAuth } from "../auth/AuthContext";

// ✅ session token fallback
import { getAccessToken } from "../auth/session";

// ✅ /me API
import { getMeApi } from "../api/pin";

// ✅ Use ReportItem type
import type { ReportItem } from "./ReportScreen";

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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
  });
  return `${weekday} | ${monthDayYear} | ${time}`;
}

// ✅ API base
function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.replace(/\/+$/, "");
  }

  if (Platform.OS === "android") return "http://10.0.2.2:8000";
  return "http://localhost:8000";
}

const API_BASE_URL = getApiBaseUrl();

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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // ✅ AuthContext
  const { user, setUser, accessToken, refreshMe } = useAuth() as any;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // ✅ Tutorial
  const [showFabTutorial, setShowFabTutorial] = useState(false);
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
    const now = Date.now();
    if (now - lastMeSyncAtRef.current < 8000) return;

    const t = accessToken || (await getAccessToken());
    if (!t) return;

    // if token didn't change AND we already synced recently, skip
    if (lastTokenRef.current === t && now - lastMeSyncAtRef.current < 30000) return;

    lastTokenRef.current = t;
    lastMeSyncAtRef.current = now;

    try {
      const me = await getMeApi({ accessToken: t });
      const apiUser: any = me?.user ?? me;

      const nextFirst =
        (typeof apiUser?.firstName === "string" && apiUser.firstName.trim()) || "";
      const nextLast =
        (typeof apiUser?.lastName === "string" && apiUser.lastName.trim()) || "";

      const nextEmail = typeof apiUser?.email === "string" ? apiUser.email : "";
      const nextId = String(apiUser?._id ?? apiUser?.id ?? "");

      const cur = userRef.current;
      const curEmail = typeof cur?.email === "string" ? cur.email : "";
      const curId = String(cur?._id ?? cur?.id ?? "");
      const curFirst = typeof cur?.firstName === "string" ? cur.firstName.trim() : "";

      const accountChanged =
        (nextEmail && curEmail && nextEmail !== curEmail) ||
        (nextId && curId && nextId !== curId);

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
    // optional: refreshMe only once per token change
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

  // ✅ scale
  const s = useMemo(() => clamp(width / 375, 0.9, 1.25), [width]);
  const fs = useMemo(() => clamp(s * 1.06, 0.95, 1.3), [s]);

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

  const notifCount = 69;

  // ✅ Recent reports
  const [recentReports, setRecentReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const fetchRecentReports = useCallback(async () => {
    try {
      setLoadingReports(true);

      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      const access = accessToken || (await getAccessToken());
      if (access) headers.Authorization = `Bearer ${access}`;

      const url = `${API_BASE_URL}/api/mobile/v1/reports/my`;

      const res = await fetch(url, { method: "GET", headers });
      const txt = await res.text().catch(() => "");
      if (!res.ok) return;

      let json: any = {};
      try {
        json = txt ? JSON.parse(txt) : {};
      } catch {
        json = {};
      }

      const rawList = Array.isArray(json) ? json : json?.incidents ?? [];
      const mapped: ReportItem[] = rawList.map((doc: any) => {
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

      mapped.sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });

      setRecentReports(mapped.slice(0, 2));
    } finally {
      setLoadingReports(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchRecentReports();
  }, [fetchRecentReports]);

  const logs: LogItem[] = useMemo(() => {
    return recentReports.map((r) => ({
      id: r.id,
      title: r.title,
      detail: r.detail,
      dateLeft: r.dateLeft,
      timeLeft: r.timeLeft,
      dateRight: r.dateRight,
      timeRight: r.timeRight,
    }));
  }, [recentReports]);

  const PAD = useMemo(() => clamp(Math.round(16 * s), 12, 20), [s]);
  const GAP = useMemo(() => clamp(Math.round(16 * s), 12, 18), [s]);

  const logoW = clamp(Math.round(width * 0.48), 150, 230);
  const logoH = clamp(Math.round(36 * s), 30, 42);

  const iconBtnSize = clamp(Math.round(38 * s), 34, 44);
  const notifIconSize = clamp(Math.round(20 * s), 18, 24);
  const helpIconSize = clamp(Math.round(22 * s), 20, 26);

  const HEADER_TOP_PAD = useMemo(() => clamp(Math.round(6 * s), 2, 10), [s]);

  // =========================
  // ✅ Swipe-up Quick Actions Sheet
  // =========================
  const [sheetOpen, setSheetOpen] = useState(false);

  const SHEET_HEIGHT = useMemo(() => clamp(Math.round(height * 0.34), 250, 340), [height]);
  const sheetY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const chevronOpen = useRef(new Animated.Value(0)).current;
  const chevronBounce = useRef(new Animated.Value(0)).current;

  const startChevronBounce = useCallback(() => {
    chevronBounce.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(chevronBounce, { toValue: -1, duration: 650, useNativeDriver: true }),
        Animated.timing(chevronBounce, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    ).start();
  }, [chevronBounce]);

  const stopChevronBounce = useCallback(() => {
    chevronBounce.stopAnimation(() => chevronBounce.setValue(0));
  }, [chevronBounce]);

  useEffect(() => {
    if (!sheetOpen) startChevronBounce();
    else stopChevronBounce();
  }, [sheetOpen, startChevronBounce, stopChevronBounce]);

  const openSheet = useCallback(() => {
    setSheetOpen(true);
    Animated.parallel([
      Animated.timing(sheetY, { toValue: 0, duration: 240, useNativeDriver: true }),
      Animated.timing(chevronOpen, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [sheetY, chevronOpen]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(sheetY, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }),
      Animated.timing(chevronOpen, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setSheetOpen(false);
    });
  }, [sheetY, SHEET_HEIGHT, chevronOpen]);

  const handlePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dx) < 20,
      onPanResponderMove: (_, g) => {
        const next = clamp(g.dy, 0, SHEET_HEIGHT);
        sheetY.setValue(next);
        const t = clamp(next / SHEET_HEIGHT, 0, 1);
        chevronOpen.setValue(1 - t);
      },
      onPanResponderRelease: (_, g) => {
        const shouldClose = g.dy > 60 || g.vy > 0.9;
        if (shouldClose) closeSheet();
        else {
          Animated.parallel([
            Animated.timing(sheetY, { toValue: 0, duration: 190, useNativeDriver: true }),
            Animated.timing(chevronOpen, { toValue: 1, duration: 190, useNativeDriver: true }),
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
  const chevronHandleBottom = useMemo(() => navHeight + FAB_SIZE * 0.55 + CHEVRON_LIFT, [navHeight, FAB_SIZE, CHEVRON_LIFT]);

  const SHEET_TOTAL_HEIGHT = useMemo(() => SHEET_HEIGHT + bottomPad, [SHEET_HEIGHT, bottomPad]);

  const chevronRotate = chevronOpen.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const bounceY = chevronBounce.interpolate({ inputRange: [-1, 0], outputRange: [-4, 0] });
  const chevronScale = chevronOpen.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });

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

        rightActions: {
          flexDirection: "row",
          alignItems: "center",
          gap: clamp(Math.round(14 * s), 10, 16),
        },

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

        scrollContent: { paddingTop: clamp(Math.round(10 * s), 8, 12), rowGap: GAP },

        sectionRow: {
          marginTop: clamp(Math.round(6 * s), 4, 8),
          paddingHorizontal: PAD,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },

        sectionTitle: { fontSize: clamp(Math.round(14 * fs), 13, 16), fontWeight: "900", color: TEXT_DARK },
        seeMore: { fontSize: clamp(Math.round(13 * fs), 12, 15), fontWeight: "900", color: Colors.link },

        logsWrap: { paddingHorizontal: PAD, paddingTop: clamp(Math.round(10 * s), 8, 12), gap: clamp(Math.round(12 * s), 10, 14) },
        miniCenter: { paddingHorizontal: PAD, paddingTop: 10, alignItems: "center", justifyContent: "center" },
        emptyHint: { fontSize: clamp(Math.round(12 * fs), 11, 14), fontWeight: "800", color: "#64748B", textAlign: "center" },

        chevronHandleWrap: { position: "absolute", left: 0, right: 0, bottom: chevronHandleBottom, alignItems: "center", justifyContent: "center", zIndex: 60 },
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

        sheetOuter: { position: "absolute", left: 0, right: 0, bottom: 0, height: SHEET_TOTAL_HEIGHT, paddingHorizontal: 0, justifyContent: "flex-end" },

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
          gap: 10,
          marginBottom: clamp(Math.round(12 * s), 10, 12),
        },

        actionText: { fontSize: clamp(Math.round(16 * fs), 14, 18), fontWeight: "900", color: "#FFFFFF" },
        actionIcon: { marginTop: 1 },
        dangerBtn: { backgroundColor: "#0B2B45" },
        actionGroup: { gap: clamp(Math.round(10 * s), 8, 12) },
      }),
    [PAD, GAP, s, fs, logoW, logoH, iconBtnSize, HEADER_TOP_PAD, chevronHandleBottom, SHEET_TOTAL_HEIGHT, bottomPad]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Top header */}
        <View style={styles.topBar}>
          <View style={styles.logoWrap}>
            <HomeScreenLogo width={logoW} height={logoH} />
          </View>

          <View style={styles.rightActions}>
            <Pressable
              onPress={onOpenNotifications ?? (() => {})}
              hitSlop={12}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons name="notifications-outline" size={notifIconSize} color={TEXT_DARK} />
              {notifCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notifCount > 99 ? "99+" : String(notifCount)}</Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => {
                if (sheetOpen) closeSheet();
                setShowFabTutorial(true);
              }}
              hitSlop={12}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons name="help-circle-outline" size={helpIconSize} color={TEXT_DARK} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ bottom: CONTENT_BOTTOM_PAD }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: CONTENT_BOTTOM_PAD }]}
        >
          <GreetingCard greeting={greeting} dateLine={dateLine} userName={userName} />

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>

            <Pressable onPress={() => onTabChange?.("Reports")} hitSlop={10}>
              <Text style={styles.seeMore}>See more</Text>
            </Pressable>
          </View>

          <View style={styles.logsWrap}>
            {loadingReports ? (
              <View style={styles.miniCenter}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : logs.length === 0 ? (
              <View style={styles.miniCenter}>
                <Text style={styles.emptyHint}>No recent reports.</Text>
              </View>
            ) : (
              logs.map((item) => {
                const full = recentReports.find((r) => r.id === item.id);
                return (
                  <RecentLogCard
                    key={item.id}
                    item={item}
                    onPress={() => {
                      if (!full) return;
                      onOpenReport?.(full);
                    }}
                  />
                );
              })
            )}
          </View>
        </ScrollView>

        {/* ✅ Chevron handle */}
        <View style={styles.chevronHandleWrap} {...handleHandlePan.panHandlers}>
          <Pressable
            onPress={() => {
              if (sheetOpen) closeSheet();
              else openSheet();
            }}
            hitSlop={14}
            style={({ pressed }) => [styles.chevronHandle, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          >
            <Animated.View style={{ transform: [{ translateY: bounceY }, { rotate: chevronRotate }, { scale: chevronScale }] }}>
              <Ionicons name="chevron-up" size={22} color={TEXT_DARK} />
            </Animated.View>
          </Pressable>
        </View>

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
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={pressFab}
          onFabLongPress={longPressFab}
          centerLabel="Incident Log"
        />

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

        {/* ✅ Swipe-up Sheet Modal */}
        <Modal visible={sheetOpen} transparent animationType="none" onRequestClose={closeSheet}>
          <Pressable style={styles.backdrop} onPress={closeSheet} />
          <Animated.View style={[styles.sheetOuter, { transform: [{ translateY: sheetY }] }]}>
            <View style={styles.sheetCard} {...handlePan.panHandlers}>
              <View style={styles.sheetGrabber} />

              <View style={styles.actionGroup}>
                <Pressable
                  onPress={() => closeSheet()}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
                >
                  <Ionicons name="warning-outline" size={20} color="#fff" style={styles.actionIcon} />
                  <Text style={styles.actionText}>Alert</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    closeSheet();
                    onQuickExit?.();
                  }}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
                >
                  <Ionicons name="eye-off-outline" size={20} color="#fff" style={styles.actionIcon} />
                  <Text style={styles.actionText}>Hide App</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    closeSheet();
                    onQuickExit?.();
                  }}
                  style={({ pressed }) => [styles.actionBtn, styles.dangerBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
                >
                  <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.actionIcon} />
                  <Text style={styles.actionText}>Sign Out</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}