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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";

import GreetingCard from "../components/HomeScreen/GreetingCard";
import RecentLogCard, { LogItem } from "../components/HomeScreen/RecentLogCard";
import QuickActions from "../components/HomeScreen/QuickActions";

import HomeScreenLogo from "../../assets/HomeScreen/NewLogo.svg";

// ✅ Tutorial overlay
import FabTutorialOverlay from "../components/Tutorial/FabTutorialOverlay";

// ✅ Auth context (real logged in user)
import { useAuth } from "../auth/AuthContext";

// ✅ session token fallback
import { getAccessToken } from "../auth/session";

// ✅ /me API
import { getMeApi } from "../api/pin";

// ✅ Use ReportItem type (same object your ReportDetailScreen expects)
import type { ReportItem } from "./ReportScreen";

type Props = {
  onQuickExit?: () => void;
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;

  onOpenNotifications?: () => void;

  // ✅ NEW: used to open ReportDetailScreen via MainShell state (NO navigation.navigate)
  onOpenReport?: (report: ReportItem) => void;
};

const BG = "#F5FAFE";
const TEXT_DARK = "#0B2B45";

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

// ✅ Use your Expo .env variable (ngrok or LAN IP)
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

  // mm/dd/yyyy
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

// ✅ Safer photo mapping (fixes "[object Object]" issue)
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
  const { width } = useWindowDimensions();

  // ✅ IMPORTANT: AuthContext fields are accessToken + refreshMe (not "token")
  const { user, setUser, accessToken, refreshMe } = useAuth() as any;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // ✅ Tutorial overlay state
  const [showFabTutorial, setShowFabTutorial] = useState(false);

  useEffect(() => {
    setShowFabTutorial(true);
  }, []);

  /**
   * ✅ Fix: Always sync profile from /me after auth changes.
   * This prevents "User" showing even though DB already has firstName.
   */
  const syncingRef = useRef(false);

  const syncProfile = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    try {
      const t = accessToken || (await getAccessToken());
      if (!t) return;

      const me = await getMeApi({ accessToken: t });
      const apiUser: any = me?.user ?? me;

      const nextFirst =
        (typeof apiUser?.firstName === "string" && apiUser.firstName.trim()) || "";
      const nextLast =
        (typeof apiUser?.lastName === "string" && apiUser.lastName.trim()) || "";

      const nextEmail = typeof apiUser?.email === "string" ? apiUser.email : "";
      const nextId = String(apiUser?._id ?? apiUser?.id ?? "");

      // Decide if we should overwrite context user
      const curEmail = typeof user?.email === "string" ? user.email : "";
      const curId = String(user?._id ?? user?.id ?? "");
      const curFirst = typeof user?.firstName === "string" ? user.firstName.trim() : "";

      const accountChanged =
        (nextEmail && curEmail && nextEmail !== curEmail) ||
        (nextId && curId && nextId !== curId);

      const missingNameInContext = !curFirst;
      const haveNameFromApi = !!nextFirst;

      // ✅ Update if account changed OR context is missing firstName but API has it
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
      // ignore (home should still load)
    } finally {
      syncingRef.current = false;
    }
  }, [accessToken, user, setUser]);

  // Run when home mounts and when accessToken changes
  useEffect(() => {
    syncProfile();
    // Also ask AuthContext to refresh its own storage if available
    // (safe even if accessToken is null)
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

  // ✅ scale based on common mobile width (375)
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

  // ✅ Recent logs state (real from backend)
  const [recentReports, setRecentReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const fetchRecentReports = useCallback(async () => {
    try {
      setLoadingReports(true);

      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      // ✅ Bearer token (use AuthContext token first)
      const access = accessToken || (await getAccessToken());
      if (access) headers.Authorization = `Bearer ${access}`;

      const url = `${API_BASE_URL}/api/mobile/v1/reports/my`;

      const res = await fetch(url, { method: "GET", headers });
      const txt = await res.text().catch(() => "");
      if (!res.ok) {
        return;
      }

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

        logoWrap: {
          height: logoH,
          width: logoW,
          justifyContent: "center",
        },

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

        scrollContent: {
          paddingTop: clamp(Math.round(10 * s), 8, 12),
          rowGap: GAP,
        },

        sectionRow: {
          marginTop: clamp(Math.round(6 * s), 4, 8),
          paddingHorizontal: PAD,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },

        sectionTitle: {
          fontSize: clamp(Math.round(14 * fs), 13, 16),
          fontWeight: "900",
          color: TEXT_DARK,
        },

        seeMore: {
          fontSize: clamp(Math.round(13 * fs), 12, 15),
          fontWeight: "900",
          color: Colors.link,
        },

        logsWrap: {
          paddingHorizontal: PAD,
          paddingTop: clamp(Math.round(10 * s), 8, 12),
          gap: clamp(Math.round(12 * s), 10, 14),
        },

        miniCenter: {
          paddingHorizontal: PAD,
          paddingTop: 10,
          alignItems: "center",
          justifyContent: "center",
        },

        emptyHint: {
          fontSize: clamp(Math.round(12 * fs), 11, 14),
          fontWeight: "800",
          color: "#64748B",
          textAlign: "center",
        },
      }),
    [PAD, GAP, s, fs, logoW, logoH, iconBtnSize, HEADER_TOP_PAD]
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
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons
                name="notifications-outline"
                size={notifIconSize}
                color={TEXT_DARK}
              />
              {notifCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {notifCount > 99 ? "99+" : String(notifCount)}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => {}}
              hitSlop={12}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons
                name="help-circle-outline"
                size={helpIconSize}
                color={TEXT_DARK}
              />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ bottom: CONTENT_BOTTOM_PAD }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_BOTTOM_PAD },
          ]}
        >
          <GreetingCard greeting={greeting} dateLine={dateLine} userName={userName} />

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>

            <Pressable
              onPress={() => {
                onTabChange?.("Reports");
              }}
              hitSlop={10}
            >
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

          <QuickActions
            onSignOut={() => onQuickExit?.()}
            onHideApp={() => onQuickExit?.()}
            onAlert={() => {}}
            onProfile={() => {}}
          />
        </ScrollView>

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
      </View>
    </SafeAreaView>
  );
}
