// src/screens/HomeScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";

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

// ✅ use existing session token + me API
import { getAccessToken } from "../auth/session";
import { getMeApi } from "../api/pin";

type Props = {
  onQuickExit?: () => void;
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;

  onOpenNotifications?: () => void;
};

const BG = "#F5FAFE";
const TEXT_DARK = "#0B2B45";
const CARD_BORDER = "#E7EEF7";

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

  // Fallbacks (only if env missing)
  if (Platform.OS === "android") return "http://10.0.2.2:8000";
  return "http://localhost:8000";
}

const API_BASE_URL = getApiBaseUrl();

/* ===================== DATE HELPERS (same as Reports) ===================== */
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

// Accepts: "02/12/2026" OR ISO date string from Mongo createdAt/updatedAt
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

function formatFullDate(d: Date) {
  return `${toMonthName(d.getMonth())} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatTimeFromDate(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad2(m)} ${ampm}`;
}

/* ===================== FETCH RECENT LOGS ===================== */
/**
 * ✅ Your Mongo incident docs look like:
 * {
 *   _id, user, incidentType, details, dateStr, timeStr, status, createdAt, updatedAt ...
 * }
 *
 * We'll fetch "my incidents" from the mobile API and show the latest 2.
 *
 * IMPORTANT:
 * - This endpoint must exist in your backend.
 * - If your Reports screen already uses `/api/mobile/v1/reports/my`,
 *   we reuse the SAME endpoint here.
 */
async function fetchMyRecentLogs(): Promise<LogItem[]> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API_BASE_URL}/api/mobile/v1/reports/my`;

  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text().catch(() => "");
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    // backend often returns JSON string like {"message":"Please Login - no token"}
    const msg = typeof json?.message === "string" ? json.message : text || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  const rawList = Array.isArray(json) ? json : json?.incidents ?? json?.reports ?? [];

  const mapped: LogItem[] = (rawList as any[])
    .map((doc: any) => {
      const id = String(doc?._id ?? doc?.id ?? "");
      const incidentType = String(doc?.incidentType ?? "Incident Report");
      const details = String(doc?.details ?? "");

      const dateStr = String(doc?.dateStr ?? "");
      const timeStr = String(doc?.timeStr ?? "");

      const createdAtIso = doc?.createdAt ? String(doc.createdAt) : "";
      const updatedAtIso = doc?.updatedAt ? String(doc.updatedAt) : "";

      const leftObj = parseDateSmart(dateStr) ?? parseDateSmart(createdAtIso);
      const leftDate = leftObj ? formatFullDate(leftObj) : dateStr || "—";
      const leftTime = timeStr || (leftObj ? formatTimeFromDate(leftObj) : "—");

      const rightObj = parseDateSmart(updatedAtIso) ?? parseDateSmart(createdAtIso) ?? leftObj;
      const rightDate = rightObj ? formatFullDate(rightObj) : "—";
      const rightTime = rightObj ? formatTimeFromDate(rightObj) : "—";

      const detailLine =
        leftDate && leftTime && leftDate !== "—" && leftTime !== "—"
          ? `On ${leftDate}, at approximately ${leftTime},`
          : details
          ? details
          : "—";

      return {
        id,
        title: incidentType,
        detail: detailLine,
        dateLeft: leftDate,
        timeLeft: leftTime,
        dateRight: rightDate,
        timeRight: rightTime,
      };
    })
    .filter((x) => x.id);

  // newest first using createdAt (fallback: dateLeft parse)
  const sorted = [...mapped].sort((a, b) => {
    const ad = parseDateSmart(a.dateLeft) ?? null;
    const bd = parseDateSmart(b.dateLeft) ?? null;
    const at = ad ? ad.getTime() : 0;
    const bt = bd ? bd.getTime() : 0;
    return bt - at;
  });

  // show latest 2 cards like your UI
  return sorted.slice(0, 2);
}

export default function HomeScreen({
  onQuickExit,
  onTabChange,
  initialTab = "Home",
  onOpenNotifications,
}: Props) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();

  // ✅ real user from AuthContext
  const { user, setUser } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // ✅ Tutorial overlay state
  const [showFabTutorial, setShowFabTutorial] = useState(false);

  useEffect(() => {
    setShowFabTutorial(true);
  }, []);

  // ✅ Fetch real profile once to populate AuthContext.user
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const existingFirst =
          typeof user?.firstName === "string" ? user.firstName.trim() : "";
        if (existingFirst.length > 0) return;

        const token = await getAccessToken();
        if (!token) return;

        const me = await getMeApi({ accessToken: token });
        const apiUser: any = me?.user ?? me;

        const firstName =
          (typeof apiUser?.firstName === "string" && apiUser.firstName.trim()) ||
          (typeof apiUser?.profile?.firstName === "string" &&
            apiUser.profile.firstName.trim()) ||
          (typeof apiUser?.personalInfo?.firstName === "string" &&
            apiUser.personalInfo.firstName.trim()) ||
          "";

        const lastName =
          (typeof apiUser?.lastName === "string" && apiUser.lastName.trim()) ||
          (typeof apiUser?.profile?.lastName === "string" &&
            apiUser.profile.lastName.trim()) ||
          (typeof apiUser?.personalInfo?.lastName === "string" &&
            apiUser.personalInfo.lastName.trim()) ||
          "";

        const nextUser = {
          _id: String(apiUser?._id ?? apiUser?.id ?? ""),
          email: String(apiUser?.email ?? ""),
          firstName,
          lastName,
          gender: apiUser?.gender,
          phoneNumber: apiUser?.phoneNumber,
          dateOfBirth: apiUser?.dateOfBirth,
          age: apiUser?.age,
          hasPin: !!apiUser?.hasPin,
          profileImage: apiUser?.profileImage,
        };

        if (!mounted) return;

        if (nextUser.email || nextUser._id || nextUser.firstName) {
          setUser(nextUser as any);
        }
      } catch {
        // ignore (home should still load)
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, setUser]);

  // ✅ LIVE CLOCK
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    setNow(new Date());

    const id = setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);

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

  // ✅ small boost for Home fonts only
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

  /* ===================== REAL RECENT LOGS ===================== */
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(true);
  const [logsRefreshing, setLogsRefreshing] = useState<boolean>(false);
  const [logsError, setLogsError] = useState<string>("");

  const loadRecentLogs = useCallback(async () => {
    try {
      setLogsError("");
      setLogsLoading(true);

      const list = await fetchMyRecentLogs();
      setLogs(list);
    } catch (e: any) {
      setLogs([]);
      setLogsError(e?.message ? String(e.message) : "Failed to load recent logs.");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const refreshRecentLogs = useCallback(async () => {
    try {
      setLogsError("");
      setLogsRefreshing(true);

      const list = await fetchMyRecentLogs();
      setLogs(list);
    } catch (e: any) {
      setLogsError(e?.message ? String(e.message) : "Failed to refresh recent logs.");
    } finally {
      setLogsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    loadRecentLogs();
  }, [isFocused, loadRecentLogs]);

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

        logsStateBox: {
          borderWidth: 1,
          borderColor: CARD_BORDER,
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          paddingVertical: clamp(Math.round(14 * s), 12, 16),
          paddingHorizontal: clamp(Math.round(14 * s), 12, 16),
          alignItems: "center",
          justifyContent: "center",
          gap: clamp(Math.round(8 * s), 6, 10),
        },

        logsHint: {
          fontSize: clamp(Math.round(12 * fs), 11, 14),
          fontWeight: "800",
          color: "#64748B",
          textAlign: "center",
        },

        logsError: {
          fontSize: clamp(Math.round(12 * fs), 11, 14),
          fontWeight: "900",
          color: "#B91C1C",
          textAlign: "center",
        },

        retryBtn: {
          marginTop: clamp(Math.round(4 * s), 3, 6),
          paddingVertical: clamp(Math.round(10 * s), 8, 10),
          paddingHorizontal: clamp(Math.round(16 * s), 14, 18),
          backgroundColor: Colors.primary,
          borderRadius: 999,
        },

        retryText: {
          color: "#FFFFFF",
          fontWeight: "900",
          fontSize: clamp(Math.round(12 * fs), 11, 13),
        },

        apiHint: {
          fontSize: clamp(Math.round(10 * fs), 9, 11),
          fontWeight: "700",
          color: "#94A3B8",
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
              <Ionicons name="notifications-outline" size={notifIconSize} color={TEXT_DARK} />
              {notifCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notifCount > 99 ? "99+" : String(notifCount)}</Text>
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
              <Ionicons name="help-circle-outline" size={helpIconSize} color={TEXT_DARK} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ bottom: CONTENT_BOTTOM_PAD }}
          refreshControl={<RefreshControl refreshing={logsRefreshing} onRefresh={refreshRecentLogs} />}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_BOTTOM_PAD },
          ]}
        >
          <GreetingCard greeting={greeting} dateLine={dateLine} userName={userName} />

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>
            <Pressable onPress={() => {}} hitSlop={10}>
              <Text style={styles.seeMore}>See more</Text>
            </Pressable>
          </View>

          <View style={styles.logsWrap}>
            {logsLoading ? (
              <View style={styles.logsStateBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.logsHint}>Loading recent logs…</Text>
                <Text style={styles.apiHint}>API: {API_BASE_URL}</Text>
              </View>
            ) : logsError ? (
              <View style={styles.logsStateBox}>
                <Text style={styles.logsError}>{logsError}</Text>
                <Pressable
                  onPress={loadRecentLogs}
                  style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
                <Text style={styles.apiHint}>API: {API_BASE_URL}</Text>
              </View>
            ) : logs.length === 0 ? (
              <View style={styles.logsStateBox}>
                <Text style={styles.logsHint}>No recent logs yet.</Text>
              </View>
            ) : (
              logs.map((item) => <RecentLogCard key={item.id} item={item} onPress={() => {}} />)
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
