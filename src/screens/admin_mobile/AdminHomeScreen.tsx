// src/screens/admin_mobile/AdminHomeScreen.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  Animated,
  PanResponder,
  Modal,
  Easing,
  ActivityIndicator,
  AppState,
  InteractionManager,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";

import { Colors } from "../../theme/colors";
import AdminBotNav, { TabKey } from "../../components/AdminComponents/AdminBotNav";
import GreetingCard from "../../components/HomeScreen/GreetingCard";
import HomeScreenLogo from "../../../assets/HomeScreen/NewLogo.svg";
import FabTutorialOverlay from "../../components/Tutorial/FabTutorialOverlay";
import { useAuth } from "../../auth/AuthContext";
import { fetchMyNotifications } from "../../api/notifications";
import { ensureAdminAlarmNotificationPermissions, showAdminAlarmNotification } from "../../utils/adminAlarmNotifications";

const BG = "#F5FAFE";
const TEXT_DARK = "#0B2B45";

const ADMIN_TUTORIAL_KEY = "tahanansafe_admin_fab_tutorial_seen_v1";
const NOTIFICATION_POLL_MS = 60000;

type ReportItem = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  level: "Low" | "Moderate" | "High";
};

type StatCard = {
  id: string;
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  onOpenNotifications?: () => void;
  onOpenHelp?: () => void;
  onOpenReports?: () => void;
  onOpenUsers?: () => void;
  onOpenHotlines?: () => void;
  onOpenAlerts?: () => void;
  onOpenAnalytics?: () => void;
  onOpenPendingReports?: () => void;
  onOpenVerifiedUsers?: () => void;
  onOpenEscalatedCases?: () => void;
  onOpenReportDetail?: (reportId: string) => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function makeScale(width: number, height: number) {
  const s = clamp(Math.min(width / 375, height / 812) * 1.04, 0.88, 1.28);
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

const AdminHomeScreen: React.FC<Props> = ({
  onOpenNotifications,
  onOpenHelp,
  onOpenReports,
  onOpenAlerts,
  onOpenPendingReports,
  onOpenSettings,
  onLogout,
}) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { s, fs } = useMemo(() => makeScale(width, height), [width, height]);
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  const { logout } = useAuth() as any;

  const [activeTab, setActiveTab] = useState<TabKey>("Home");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // ── Tutorial (show once) ──────────────────────────────────────────
  const tutorialBootRef = useRef(false);
  const showTutorialOnce = useCallback(async () => {
    if (tutorialBootRef.current) return;
    tutorialBootRef.current = true;
    try {
      const seen = await AsyncStorage.getItem(ADMIN_TUTORIAL_KEY);
      if (seen === "1") return;
      setShowTutorial(true);
      await AsyncStorage.setItem(ADMIN_TUTORIAL_KEY, "1");
    } catch {
      setShowTutorial(true);
    }
  }, []);

  useEffect(() => { showTutorialOnce(); }, [showTutorialOnce]);

  // ── Live clock ────────────────────────────────────────────────────
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const greeting = useMemo(() => makeGreeting(now), [now]);
  const dateLine = useMemo(() => makeDateLine(now), [now]);

  const handleLogout = useCallback(async () => {
    try { await logout(); } finally { onLogout?.(); }
  }, [logout, onLogout]);

  // ── Nav sizing ────────────────────────────────────────────────────
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

  // ── Sheet animation ───────────────────────────────────────────────
  const SHEET_HEIGHT = useMemo(() => clamp(Math.round(height * 0.34), 250, 340), [height]);
  const SHEET_TOTAL_HEIGHT = useMemo(() => SHEET_HEIGHT + bottomPad, [SHEET_HEIGHT, bottomPad]);

  const sheetY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const chevronOpen = useRef(new Animated.Value(0)).current;
  const sheetOpenRef = useRef(false);
  const sheetAnimatingRef = useRef(false);

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
    }
  }, [isFocused, sheetOpen, sheetY, chevronOpen, backdropOpacity, SHEET_HEIGHT]);

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
        if (activeTab === "Incident" || activeTab === "Settings") setActiveTab("Home");
      }
    });
  }, [sheetY, SHEET_HEIGHT, chevronOpen, backdropOpacity, activeTab]);

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

  // ── Chevron positioning ───────────────────────────────────────────
  const CHEVRON_LIFT = useMemo(() => clamp(Math.round(24 * s), 18, 34), [s]);
  const chevronHandleBottom = useMemo(
    () => navHeight + FAB_SIZE * 0.55 + CHEVRON_LIFT,
    [navHeight, CHEVRON_LIFT]
  );
  const CHEVRON_ABOVE_SHEET_GAP = useMemo(() => clamp(Math.round(10 * s), 8, 14), [s]);
  const openBottom = useMemo(
    () => SHEET_TOTAL_HEIGHT + CHEVRON_ABOVE_SHEET_GAP,
    [SHEET_TOTAL_HEIGHT, CHEVRON_ABOVE_SHEET_GAP]
  );
  const deltaToOpen = useMemo(() => openBottom - chevronHandleBottom, [openBottom, chevronHandleBottom]);
  const chevronLiftToOpen = useMemo(
    () => chevronOpen.interpolate({ inputRange: [0, 1], outputRange: [0, -deltaToOpen], extrapolate: "clamp" }),
    [chevronOpen, deltaToOpen]
  );
  const modalChevronTranslateY = useMemo(
    () => Animated.add(sheetY, chevronLiftToOpen),
    [sheetY, chevronLiftToOpen]
  );

  const chevronRotate = chevronOpen.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const bounceY = 0;
  const chevronScale = chevronOpen.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });

  // ── Tab handler ───────────────────────────────────────────────────
  const handleTabPress = useCallback(
    (tab: TabKey) => {
      if (tab === "Home") { setActiveTab("Home"); return; }
      if (tab === "Inbox") { setActiveTab("Inbox"); onOpenAlerts?.(); return; }
      if (tab === "Reports") { setActiveTab("Reports"); onOpenReports?.(); return; }
      if (tab === "Settings") { setActiveTab("Settings"); onOpenSettings?.(); return; }
      if (tab === "Incident") { setActiveTab("Incident"); openSheet(); }
    },
    [onOpenAlerts, onOpenReports, onOpenSettings, openSheet]
  );

  const handleFabPress = useCallback(() => { setActiveTab("Incident"); openSheet(); }, [openSheet]);

  // ── Sizing ────────────────────────────────────────────────────────
  const PAD = useMemo(() => clamp(Math.round(16 * s), 12, 20), [s]);
  const GAP = useMemo(() => clamp(Math.round(16 * s), 12, 18), [s]);
  const logoW = clamp(Math.round(width * 0.48), 140, 230);
  const logoH = clamp(Math.round(36 * s), 28, 42);
  const iconBtnSize = clamp(Math.round(38 * s), 34, 44);
  const notifIconSize = clamp(Math.round(20 * s), 18, 24);
  const helpIconSize = clamp(Math.round(22 * s), 20, 26);
  const HEADER_TOP_PAD = useMemo(() => clamp(Math.round(6 * s), 2, 10), [s]);
  const ACTION_GAP = useMemo(() => clamp(Math.round(14 * s), 10, 16), [s]);

  const statCardWidth = useMemo(() => {
    const gap = 12;
    return (width - PAD * 2 - gap) / 2;
  }, [width, PAD]);

  // ── Notification badge count ──────────────────────────────────────
  const [notifCount, setNotifCount] = useState(0);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const alertsPrimedRef = useRef(false);
  const alertsFetchInFlightRef = useRef(false);
  const lastAlertsFetchAtRef = useRef(0);

  // ── Static admin data ─────────────────────────────────────────────
  const stats: StatCard[] = useMemo(() => [
    { id: "1", label: "Pending Reports", value: "18", icon: "document-text-outline" },
    { id: "3", label: "Active Alerts", value: String(activeAlertCount), icon: "notifications-outline" },
  ], [activeAlertCount]);

  // ── Recent Alerts (live from backend) ────────────────────────────
  const [recentAlerts, setRecentAlerts] = useState<ReportItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  const fetchRecentAlerts = useCallback(async (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    const now = Date.now();
    if (!force && now - lastAlertsFetchAtRef.current < 15000) return;
    if (alertsFetchInFlightRef.current) return;
    alertsFetchInFlightRef.current = true;

    try {
      if (!alertsPrimedRef.current) {
        setLoadingAlerts(true);
      }

      const notifs = await fetchMyNotifications(80);
      // Badge: count all unread
      const unread = notifs.filter((n) => n.unread).length;
      setNotifCount(unread);
      // Active Alerts card: count of alert-type notifications (unread)
      const alertUnread = notifs.filter((n) => n.type === "alert" && n.unread).length;
      setActiveAlertCount(alertUnread);
      const unreadAlerts = notifs.filter((n) => n.type === "alert" && n.unread);

      if (!alertsPrimedRef.current) {
        seenAlertIdsRef.current = new Set(unreadAlerts.map((n) => n.id));
        alertsPrimedRef.current = true;
      } else {
        const nextSeen = new Set(seenAlertIdsRef.current);
        const newUnreadAlerts = unreadAlerts.filter((n) => !nextSeen.has(n.id));

        for (const alert of newUnreadAlerts) {
          nextSeen.add(alert.id);
          await showAdminAlarmNotification(alert).catch(() => {});
        }

        seenAlertIdsRef.current = nextSeen;
      }

      // Cards: only alert-type, latest 3
      const alerts = notifs
        .filter((n) => n.type === "alert")
        .slice(0, 3)
        .map((n) => {
          const d = new Date(n.time);
          const date = isNaN(d.getTime())
            ? "—"
            : d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
          const time = isNaN(d.getTime())
            ? "—"
            : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
          return { id: n.id, title: n.title, subtitle: n.message, date, time, level: "High" as const };
        });
      setRecentAlerts(alerts);
      lastAlertsFetchAtRef.current = Date.now();
    } catch {
      if (!alertsPrimedRef.current) {
        setRecentAlerts([]);
      }
    } finally {
      alertsFetchInFlightRef.current = false;
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    ensureAdminAlarmNotificationPermissions().catch(() => {});
    const task = InteractionManager.runAfterInteractions(() => {
      fetchRecentAlerts({ force: true }).catch(() => {});
    });

    const intervalId = setInterval(() => {
      fetchRecentAlerts({ force: false }).catch(() => {});
    }, NOTIFICATION_POLL_MS);

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        fetchRecentAlerts({ force: true }).catch(() => {});
      }
    });

    return () => {
      task.cancel();
      clearInterval(intervalId);
      appStateSub.remove();
    };
  }, [fetchRecentAlerts]);

  // ── Alert detail modal ────────────────────────────────────────────
  const [selectedAlert, setSelectedAlert] = useState<ReportItem | null>(null);

  const getRiskColor = (level: ReportItem["level"]) => {
    if (level === "High") return "#F04452";
    if (level === "Moderate") return "#F5B301";
    return "#35B56A";
  };

  const quickActions = [
    {
      id: "1",
      label: "Alerts",
      icon: "notifications-outline" as keyof typeof Ionicons.glyphMap,
      colors: ["#DC2626", "#991B1B"] as [string, string],
      sub: "System notifications",
      onPress: onOpenAlerts,
    },
  ];

  // ── Styles ────────────────────────────────────────────────────────
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
          marginTop: clamp(Math.round(6 * s), 4, 8),
          paddingHorizontal: PAD,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
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
        sectionTitle: {
          fontSize: clamp(Math.round(14 * fs), 13, 16),
          fontWeight: "900",
          color: TEXT_DARK,
        },
        seeMore: {
          fontSize: clamp(Math.round(13 * fs), 12, 15),
          fontWeight: "900",
          color: Colors.primary,
        },

        // Stats grid
        statsGrid: {
          paddingHorizontal: PAD,
          paddingTop: clamp(Math.round(10 * s), 8, 12),
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: 12,
        },
        statCard: {
          backgroundColor: "#FFFFFF",
          borderRadius: clamp(Math.round(18 * s), 14, 20),
          padding: 14,
          borderWidth: 1,
          borderColor: "#E6EDF5",
          minHeight: 108,
          justifyContent: "space-between",
        },
        statIconWrap: {
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: "#EAF3FF",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        },
        statValue: {
          fontSize: clamp(Math.round(24 * fs), 20, 28),
          fontWeight: "900",
          color: TEXT_DARK,
        },
        statLabel: {
          fontSize: clamp(Math.round(12 * fs), 11, 13),
          color: "#5B6B7A",
          fontWeight: "600",
          lineHeight: 17,
        },

        // Reports list
        logsWrap: {
          paddingHorizontal: PAD,
          paddingTop: clamp(Math.round(10 * s), 8, 12),
          gap: GAP,
        },
        reportCard: {
          backgroundColor: "#FFFFFF",
          borderRadius: clamp(Math.round(16 * s), 14, 18),
          borderWidth: 1,
          borderColor: "#E6EDF5",
          paddingVertical: 14,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        riskIndicator: { width: 4, alignSelf: "stretch", borderRadius: 10 },
        reportMainContent: { flex: 1 },
        reportTopRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
        reportTitle: {
          flex: 1,
          fontSize: clamp(Math.round(14 * fs), 13, 15),
          fontWeight: "800",
          color: TEXT_DARK,
        },
        riskPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
        riskPillText: { fontSize: clamp(Math.round(11 * fs), 10, 12), fontWeight: "800" },
        reportSubtitle: {
          fontSize: clamp(Math.round(12 * fs), 11, 13),
          color: "#657586",
          lineHeight: 18,
          marginBottom: 8,
        },
        reportBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        reportDate: { fontSize: clamp(Math.round(12 * fs), 11, 13), color: "#7B8794", fontWeight: "500" },
        reportTime: { fontSize: clamp(Math.round(12 * fs), 11, 13), color: "#7B8794", fontWeight: "500" },

        // Quick actions (emergency-card style)
        actionsWrap: {
          paddingHorizontal: PAD,
          paddingTop: clamp(Math.round(6 * s), 4, 8),
        },
        actionsRow: {
          flexDirection: "row",
          gap: clamp(Math.round(10 * s), 8, 12),
        },
        actionCardOuter: { flex: 1 },
        actionCard: {
          width: "100%",
          borderRadius: 20,
          paddingVertical: clamp(Math.round(14 * s), 12, 17),
          paddingHorizontal: clamp(Math.round(14 * s), 12, 16),
          overflow: "hidden",
        },
        actionCardIconRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: clamp(Math.round(10 * s), 8, 12),
          marginBottom: clamp(Math.round(6 * s), 4, 8),
        },
        actionCardCircle: {
          width: clamp(Math.round(34 * s), 30, 40),
          height: clamp(Math.round(34 * s), 30, 40),
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.2)",
          alignItems: "center",
          justifyContent: "center",
        },
        actionCardLabel: {
          fontSize: clamp(Math.round(14 * fs), 13, 16),
          fontWeight: "800",
          color: "#FFFFFF",
        },
        actionCardSub: {
          fontSize: clamp(Math.round(11 * fs), 10, 12),
          fontWeight: "600",
          color: "rgba(255,255,255,0.7)",
        },

        // Chevron handle
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

        emptyAlertsCard: {
          backgroundColor: "#FFFFFF",
          borderRadius: clamp(Math.round(16 * s), 14, 18),
          borderWidth: 1,
          borderColor: "#E7EEF7",
          alignItems: "center" as const,
          paddingVertical: clamp(Math.round(20 * s), 16, 24),
          gap: 8,
        },
        emptyAlertsText: {
          fontSize: clamp(Math.round(13 * fs), 12, 14),
          fontWeight: "600" as const,
          color: "#94A3B8",
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
      chevronHandleBottom,
      SHEET_TOTAL_HEIGHT,
      bottomPad,
      CONTENT_BOTTOM_PAD,
    ]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.topBar}>
          <View style={styles.logoWrap}>
            <HomeScreenLogo width={logoW} height={logoH} />
          </View>

          <View style={styles.rightActions}>
            <Pressable
              onPress={onOpenNotifications}
              hitSlop={12}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons name="notifications-outline" size={notifIconSize} color={TEXT_DARK} />
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
              onPress={onOpenHelp}
              hitSlop={12}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons name="help-circle-outline" size={helpIconSize} color={TEXT_DARK} />
            </Pressable>
          </View>
        </View>

        {/* ── Scroll content ── */}
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ bottom: CONTENT_BOTTOM_PAD }}
          contentContainerStyle={styles.scrollContent}
        >
          <GreetingCard greeting={greeting} dateLine={dateLine} userName="Admin" />

          {/* System Overview */}
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: "#EAF3FF" }]}>
                <Ionicons name="grid-outline" size={14} color={Colors.primary} />
              </View>
              <Text style={styles.sectionTitle} allowFontScaling={false}>
                System Overview
              </Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            {stats.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.statCard, { width: statCardWidth }]}
                onPress={
                  item.label === "Pending Reports"
                    ? onOpenPendingReports
                    : onOpenAlerts
                }
              >
                <View style={styles.statIconWrap}>
                  <Ionicons name={item.icon} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.statValue} allowFontScaling={false}>{item.value}</Text>
                <Text style={styles.statLabel} allowFontScaling={false}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Recent Alerts */}
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: "#EAF3FF" }]}>
                <Ionicons name="notifications-outline" size={14} color={Colors.primary} />
              </View>
              <Text style={styles.sectionTitle} allowFontScaling={false}>
                Recent Alerts
              </Text>
            </View>
            <Pressable onPress={onOpenReports} hitSlop={10}>
              <Text style={styles.seeMore} allowFontScaling={false}>See more</Text>
            </Pressable>
          </View>

          <View style={styles.logsWrap}>
            {loadingAlerts ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />
            ) : recentAlerts.length === 0 ? (
              <View style={styles.emptyAlertsCard}>
                <Ionicons name="notifications-off-outline" size={26} color="#94A3B8" />
                <Text style={styles.emptyAlertsText} allowFontScaling={false}>No recent alerts</Text>
              </View>
            ) : (
              recentAlerts.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.reportCard}
                  onPress={() => setSelectedAlert(item)}
                >
                  <View style={[styles.riskIndicator, { backgroundColor: getRiskColor(item.level) }]} />

                  <View style={styles.reportMainContent}>
                    <View style={styles.reportTopRow}>
                      <Text style={styles.reportTitle} numberOfLines={1} allowFontScaling={false}>
                        {item.title}
                      </Text>
                      <View style={[styles.riskPill, { backgroundColor: `${getRiskColor(item.level)}18` }]}>
                        <Text style={[styles.riskPillText, { color: getRiskColor(item.level) }]} allowFontScaling={false}>
                          SOS
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.reportSubtitle} numberOfLines={2} allowFontScaling={false}>
                      {item.subtitle}
                    </Text>

                    <View style={styles.reportBottomRow}>
                      <Text style={styles.reportDate} allowFontScaling={false}>{item.date}</Text>
                      <Text style={styles.reportTime} allowFontScaling={false}>{item.time}</Text>
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
                </Pressable>
              ))
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: "#FFEDE9" }]}>
                <Ionicons name="flash-outline" size={14} color="#DC2626" />
              </View>
              <Text style={styles.sectionTitle} allowFontScaling={false}>
                Quick Actions
              </Text>
            </View>
          </View>

          <View style={styles.actionsWrap}>
            <View style={styles.actionsRow}>
              {quickActions.map((action) => (
                <Pressable key={action.id} style={styles.actionCardOuter} onPress={action.onPress}>
                  <LinearGradient
                    colors={action.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionCard}
                  >
                    <View style={styles.actionCardIconRow}>
                      <View style={styles.actionCardCircle}>
                        <Ionicons name={action.icon} size={16} color="#fff" />
                      </View>
                    </View>
                    <Text style={styles.actionCardLabel} allowFontScaling={false}>{action.label}</Text>
                    <Text style={styles.actionCardSub} allowFontScaling={false}>{action.sub}</Text>
                  </LinearGradient>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* ── Chevron handle (closed state) ── */}
        {!sheetOpen ? (
          <View style={styles.chevronHandleWrap} {...handleHandlePan.panHandlers}>
            <Pressable
              onPress={() => { if (sheetOpen) closeSheet(); else openSheet(); }}
              hitSlop={14}
              style={({ pressed }) => [
                styles.chevronHandle,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Animated.View
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
                style={{ transform: [{ translateY: bounceY }, { rotate: chevronRotate }, { scale: chevronScale }] }}
              >
                <Ionicons name="chevron-up" size={22} color={TEXT_DARK} />
              </Animated.View>
            </Pressable>
          </View>
        ) : null}

        {/* ── Bottom Nav ── */}
        <AdminBotNav
          activeTab={activeTab}
          onTabPress={handleTabPress}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={handleFabPress}
          centerLabel="Admin Menu"
        />

        {/* ── Tutorial overlay ── */}
        <FabTutorialOverlay
          visible={showTutorial}
          onClose={() => setShowTutorial(false)}
          width={width}
          s={s}
          fabSize={FAB_SIZE}
          fabBottom={fabBottom}
          navHeight={navHeight}
          title="Admin Menu"
          message="Tap the center button to access admin actions."
        />

        {/* ── Alert Detail Modal ── */}
        <Modal
          visible={!!selectedAlert}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedAlert(null)}
          statusBarTranslucent
        >
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", paddingHorizontal: PAD + 8 }}
            onPress={() => setSelectedAlert(null)}
          >
            <Pressable onPress={() => {}} style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: clamp(Math.round(20 * s), 16, 24),
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 6 },
              elevation: 14,
            }}>
              {/* Header row */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="warning" size={20} color="#DC2626" />
                </View>
                <Text style={{ flex: 1, fontSize: clamp(Math.round(15 * fs), 14, 17), fontWeight: "900", color: TEXT_DARK }} allowFontScaling={false} numberOfLines={2}>
                  {selectedAlert?.title ?? ""}
                </Text>
                <Pressable onPress={() => setSelectedAlert(null)} hitSlop={10}>
                  <Ionicons name="close-circle" size={24} color="#94A3B8" />
                </Pressable>
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: "#F1F5F9", marginBottom: 12 }} />

              {/* Message */}
              <Text style={{ fontSize: clamp(Math.round(13 * fs), 12, 15), color: "#334155", lineHeight: 20, fontWeight: "500", marginBottom: 16 }} allowFontScaling={false}>
                {selectedAlert?.subtitle ?? ""}
              </Text>

              {/* Date + Time */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons name="calendar-outline" size={14} color="#64748B" />
                  <Text style={{ fontSize: clamp(Math.round(12 * fs), 11, 13), color: "#64748B", fontWeight: "600" }} allowFontScaling={false}>
                    {selectedAlert?.date ?? ""}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons name="time-outline" size={14} color="#64748B" />
                  <Text style={{ fontSize: clamp(Math.round(12 * fs), 11, 13), color: "#64748B", fontWeight: "600" }} allowFontScaling={false}>
                    {selectedAlert?.time ?? ""}
                  </Text>
                </View>
              </View>

              {/* Dismiss button */}
              <Pressable
                onPress={() => setSelectedAlert(null)}
                style={({ pressed }) => [{
                  backgroundColor: Colors.primary,
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: "center" as const,
                  opacity: pressed ? 0.85 : 1,
                }]}
              >
                <Text style={{ fontSize: clamp(Math.round(14 * fs), 13, 15), fontWeight: "800", color: "#FFFFFF" }} allowFontScaling={false}>
                  Dismiss
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ── Sheet Modal ── */}
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
            style={[styles.chevronModalWrap, { transform: [{ translateY: modalChevronTranslateY }] }]}
            {...handlePan.panHandlers}
          >
            <Pressable
              onPress={() => closeSheet()}
              hitSlop={14}
              style={({ pressed }) => [
                styles.chevronHandle,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Animated.View
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
                style={{ transform: [{ rotate: chevronRotate }, { scale: chevronScale }] }}
              >
                <Ionicons name="chevron-up" size={22} color={TEXT_DARK} />
              </Animated.View>
            </Pressable>
          </Animated.View>

          <Animated.View
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[styles.sheetOuter, { transform: [{ translateY: sheetY }] }]}
          >
            <View style={styles.sheetCard} {...handlePan.panHandlers}>
              <View style={styles.sheetGrabber} />

              <Pressable
                onPress={() => { closeSheet(); setActiveTab("Inbox"); onOpenAlerts?.(); }}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
              >
                <Ionicons name="notifications-outline" size={20} color="#fff" style={styles.actionIcon} />
                <Text style={styles.actionText} allowFontScaling={false}>View Alerts</Text>
              </Pressable>

              <Pressable
                onPress={async () => { closeSheet(); await handleLogout(); }}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.dangerBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
                ]}
              >
                <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.actionIcon} />
                <Text style={styles.actionText} allowFontScaling={false}>Sign Out</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default AdminHomeScreen;
