// src/screens/ReportScreen.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";

import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";

// ✅ IMPORTANT: use the same token source as submitIncident()
import { getAccessToken } from "../auth/session";

type FilterKey = "Pending" | "On going" | "Cancelled" | "Resolved";

export type ReportItem = {
  id: string;

  title: string;
  detail: string;
  dateLeft: string;
  timeLeft: string;
  dateRight: string;
  timeRight: string;
  groupLabel?: string;

  status?: "PENDING" | "ONGOING" | "CANCELLED" | "RESOLVED";
  witnessName?: string;
  witnessType?: string;
  location?: string;
  incidentTypeLabel?: string;
  alertNo?: string;

  offenderName?: string;
  photos?: string[];
  createdAt?: string;
  updatedAt?: string;
};

const BG = "#F5FAFE";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";

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
// Helpers
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

function toShortMonthName(mIndex: number) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[mIndex] ?? "";
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

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatFullDate(d: Date) {
  return `${toMonthName(d.getMonth())} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatGroupDate(d: Date) {
  return `${toShortMonthName(d.getMonth())} ${d.getDate()}, ${d.getFullYear()}`;
}

function normalizeStatus(dbStatus?: string): ReportItem["status"] {
  const s = String(dbStatus ?? "").trim().toLowerCase();
  if (s === "submitted" || s === "pending") return "PENDING";
  if (s === "ongoing" || s === "on going" || s === "on-going" || s === "in_progress" || s === "in progress")
    return "ONGOING";
  if (s === "cancelled" || s === "canceled") return "CANCELLED";
  if (s === "resolved" || s === "done" || s === "completed") return "RESOLVED";
  return "PENDING";
}

function filterToStatus(filter: FilterKey): ReportItem["status"] {
  if (filter === "Pending") return "PENDING";
  if (filter === "On going") return "ONGOING";
  if (filter === "Cancelled") return "CANCELLED";
  return "RESOLVED";
}

function ReportCard({
  item,
  onPress,
  styles,
  chevronSize,
}: {
  item: ReportItem;
  onPress?: () => void;
  styles: ReturnType<typeof makeStyles>;
  chevronSize: number;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}>
      <View style={styles.cardLeftBar} />

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>

        <Text style={styles.cardDetail} numberOfLines={2}>
          {item.detail}
        </Text>

        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMeta}>
            {item.dateLeft}
            {"\n"}
            {item.timeLeft}
          </Text>

          <Text style={styles.cardMeta}>
            {item.dateRight}
            {"\n"}
            {item.timeRight}
          </Text>
        </View>
      </View>

      <View style={styles.cardChevron}>
        <Ionicons name="chevron-forward" size={chevronSize} color="#94A3B8" />
      </View>
    </Pressable>
  );
}

export default function ReportScreen({
  onQuickExit,
  onTabChange,
  initialTab,
  onOpenReport,
}: {
  onQuickExit?: () => void;
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
  onOpenReport?: (item: ReportItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { width, height } = useWindowDimensions();

  // We still keep user for UI logic, but token will be pulled from storage
  const { user } = useAuth() as any;

  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const chevronSize = scale(20);
  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? "Ledger");
  const [filter, setFilter] = useState<FilterKey>("Pending");

  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + 6;

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const pressFab = () => handleTab("Incident");
  const longPressFab = () => onQuickExit?.();

  const fetchMyReports = useCallback(async (): Promise<ReportItem[]> => {
    const token = await getAccessToken();

    if (!token) {
      // ✅ Give a clean message instead of raw JSON
      throw new Error("Please login again. (Missing access token)");
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const url = `${API_BASE_URL}/api/mobile/v1/reports/my`;

    let res: Response;
    try {
      res = await fetch(url, { method: "GET", headers });
    } catch (e) {
      throw new Error(
        `Network request failed.\n\nCheck EXPO_PUBLIC_API_URL:\n${API_BASE_URL}\n\nBackend port must match (8000).`
      );
    }

    const text = await res.text().catch(() => "");

    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!res.ok) {
      throw new Error(data?.message || `Request failed (${res.status})`);
    }

    const rawList = Array.isArray(data) ? data : data?.incidents ?? [];

    const today = new Date();

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

      const groupLabel = dateObj && isSameDay(dateObj, today) ? "Today" : dateObj ? formatGroupDate(dateObj) : "";

      const detailLine =
        leftDate && leftTime && leftDate !== "—" && leftTime !== "—"
          ? `On ${leftDate}, at approximately ${leftTime},`
          : details
          ? details
          : "—";

      const statusNorm = normalizeStatus(doc?.status);

      return {
        id,
        groupLabel,
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
        photos: Array.isArray(doc?.photos) ? doc.photos.map((p: any) => String(p)) : [],
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
      };
    });

    return mapped;
  }, []);

  const load = useCallback(async () => {
    try {
      setErrorMsg("");
      setLoading(true);

      if (!user) {
        setItems([]);
        setLoading(false);
        return;
      }

      const list = await fetchMyReports();
      setItems(list);
    } catch (e: any) {
      setErrorMsg(e?.message ? String(e.message) : "Failed to load reports.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchMyReports, user]);

  useEffect(() => {
    if (!isFocused) return;
    load();
  }, [isFocused, load]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMsg("");

      if (!user) {
        setItems([]);
        return;
      }

      const list = await fetchMyReports();
      setItems(list);
    } catch (e: any) {
      setErrorMsg(e?.message ? String(e.message) : "Failed to refresh reports.");
    } finally {
      setRefreshing(false);
    }
  }, [fetchMyReports, user]);

  const filtered = useMemo(() => {
    const want = filterToStatus(filter);
    return items.filter((x) => (x.status ?? "PENDING") === want);
  }, [items, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>Reports</Text>
        </View>

        <View style={styles.segmentWrap}>
          <View style={styles.segmentPill}>
            {(["Pending", "On going", "Cancelled", "Resolved"] as FilterKey[]).map((k) => {
              const active = k === filter;
              return (
                <Pressable
                  key={k}
                  onPress={() => setFilter(k)}
                  style={({ pressed }) => [
                    styles.segmentBtn,
                    active && styles.segmentBtnActive,
                    pressed && { transform: [{ scale: 0.99 }] },
                  ]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
                    {k}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.centerHint}>Loading reports…</Text>
            <Text style={styles.smallHint} numberOfLines={2}>
              API: {API_BASE_URL}
            </Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Pressable onPress={load} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.centerHint}>No reports found.</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: CONTENT_BOTTOM_PAD }]}
          >
            {(() => {
              let lastGroup = "";
              return filtered.map((item) => {
                const showGroup = item.groupLabel && item.groupLabel !== lastGroup;
                if (item.groupLabel) lastGroup = item.groupLabel;

                return (
                  <View key={item.id} style={styles.block}>
                    {showGroup ? <Text style={styles.groupLabel}>{item.groupLabel}</Text> : null}

                    <ReportCard item={item} onPress={() => onOpenReport?.(item)} styles={styles} chevronSize={chevronSize} />
                  </View>
                );
              });
            })()}
          </ScrollView>
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

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const SEG_H = vscale(40);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    topBar: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
      paddingBottom: vscale(10),
      flexDirection: "row",
      alignItems: "center",
    },
    topTitle: {
      fontSize: scale(28),
      fontWeight: "900",
      color: TEXT_DARK,
    },

    segmentWrap: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
      paddingBottom: vscale(10),
    },
    segmentPill: {
      height: SEG_H,
      borderRadius: Math.round(SEG_H / 2),
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
      flexDirection: "row",
      overflow: "hidden",
    },
    segmentBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(6),
    },
    segmentBtnActive: {
      backgroundColor: Colors.primary,
    },
    segmentText: {
      fontSize: scale(12),
      fontWeight: "800",
      color: "#6B7280",
    },
    segmentTextActive: {
      color: "#FFFFFF",
    },

    scrollContent: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
    },

    block: {
      marginBottom: vscale(12),
      gap: vscale(8),
    },

    groupLabel: {
      fontSize: scale(12),
      fontWeight: "800",
      color: "#94A3B8",
      paddingLeft: scale(2),
    },

    card: {
      flexDirection: "row",
      alignItems: "stretch",
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: "#FFFFFF",
      borderRadius: scale(16),
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    cardLeftBar: {
      width: scale(4),
      backgroundColor: Colors.primary,
    },
    cardBody: {
      flex: 1,
      paddingVertical: vscale(12),
      paddingLeft: scale(12),
      paddingRight: scale(10),
      gap: vscale(6),
    },
    cardTitle: {
      fontSize: scale(15),
      fontWeight: "900",
      color: Colors.primary,
    },
    cardDetail: {
      fontSize: scale(13),
      fontWeight: "700",
      color: "#6B7280",
      fontStyle: "italic",
      lineHeight: vscale(18),
    },
    cardMetaRow: {
      marginTop: vscale(6),
      flexDirection: "row",
      justifyContent: "space-between",
      gap: scale(10),
    },
    cardMeta: {
      fontSize: scale(11),
      fontWeight: "800",
      color: "#94A3B8",
      lineHeight: vscale(14),
    },
    cardChevron: {
      width: scale(38),
      alignItems: "center",
      justifyContent: "center",
      paddingRight: scale(10),
    },

    centerBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(20),
      gap: vscale(10),
    },
    centerHint: {
      fontSize: scale(13),
      fontWeight: "800",
      color: "#64748B",
      textAlign: "center",
    },
    smallHint: {
      fontSize: scale(11),
      fontWeight: "700",
      color: "#94A3B8",
      textAlign: "center",
    },
    errorText: {
      fontSize: scale(13),
      fontWeight: "900",
      color: "#B91C1C",
      textAlign: "center",
    },
    retryBtn: {
      marginTop: vscale(6),
      paddingVertical: vscale(10),
      paddingHorizontal: scale(18),
      backgroundColor: Colors.primary,
      borderRadius: scale(999),
    },
    retryText: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: scale(12),
    },
  });
}
