// src/screens/ReportScreen.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";

import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { getAccessToken } from "../auth/session";

// ✅ NEW: local status-change notifications
import { syncLocalReportStatusNotifications } from "../api/notifications";

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
const MUTED = "#64748B";
const CARD = "#FFFFFF";

// ✅ IMPORTANT: force this to be a normal string (fixes TS literal type error)
const PRIMARY: string = String((Colors as any).primary ?? "#1E63D0");

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

function isAbortError(err: any) {
  const name = err?.name || "";
  const msg = String(err?.message || "");
  return name === "AbortError" || msg.toLowerCase().includes("aborted");
}

function statusLabel(s?: ReportItem["status"]) {
  if (s === "ONGOING") return "On going";
  if (s === "CANCELLED") return "Cancelled";
  if (s === "RESOLVED") return "Resolved";
  return "Pending";
}

function statusAccent(s?: ReportItem["status"], primary: string = PRIMARY) {
  if (s === "RESOLVED") return "#16A34A";
  if (s === "CANCELLED") return "#DC2626";
  if (s === "ONGOING") return "#2563EB";
  return primary;
}

function statusIcon(s?: ReportItem["status"]) {
  if (s === "RESOLVED") return "checkmark-circle-outline" as const;
  if (s === "CANCELLED") return "close-circle-outline" as const;
  if (s === "ONGOING") return "sync-circle-outline" as const;
  return "time-outline" as const;
}

function countByStatus(items: ReportItem[]) {
  let pending = 0;
  let ongoing = 0;
  let cancelled = 0;
  let resolved = 0;

  for (const it of items) {
    const s = (it.status ?? "PENDING") as ReportItem["status"];
    if (s === "PENDING") pending++;
    else if (s === "ONGOING") ongoing++;
    else if (s === "CANCELLED") cancelled++;
    else if (s === "RESOLVED") resolved++;
  }

  return { pending, ongoing, cancelled, resolved, total: items.length };
}

function FilterChip({
  label,
  active,
  onPress,
  styles,
  accent,
}: {
  label: FilterKey;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: active ? "transparent" : BORDER, backgroundColor: active ? accent : "#FFFFFF" },
        pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? "#FFFFFF" : "#64748B" }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ReportTicketCard({
  item,
  onPress,
  styles,
  chevronSize,
  primary,
}: {
  item: ReportItem;
  onPress?: () => void;
  styles: ReturnType<typeof makeStyles>;
  chevronSize: number;
  primary: string;
}) {
  const accent = statusAccent(item.status, primary);
  const icon = statusIcon(item.status);
  const pillText = statusLabel(item.status);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ticket, pressed && { transform: [{ scale: 0.995 }] }]}>
      <View style={[styles.ticketAccent, { backgroundColor: accent }]} />

      <View style={styles.ticketBody}>
        <View style={styles.ticketTopRow}>
          <View style={[styles.badge, { backgroundColor: "#EEF6FF" }]}>
            <Ionicons name={icon} size={styles._iconSize} color={accent} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.ticketTitleRow}>
              <Text style={[styles.ticketTitle, { color: TEXT_DARK }]} numberOfLines={1}>
                {item.title}
              </Text>

              {!!item.alertNo && (
                <View style={[styles.alertPill, { borderColor: BORDER, backgroundColor: "#FFFFFF" }]}>
                  <Ionicons name="alert-circle-outline" size={styles._miniIcon} color={MUTED} />
                  <Text style={[styles.alertPillText, { color: MUTED }]} numberOfLines={1}>
                    {item.alertNo}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.ticketDetail} numberOfLines={2}>
              {item.detail}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={chevronSize} color="#94A3B8" />
        </View>

        <View style={styles.ticketBottomRow}>
          <View style={[styles.statusChip, { backgroundColor: "#EEF6FF", borderColor: BORDER }]}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text style={[styles.statusChipText, { color: accent }]}>{pillText}</Text>
          </View>

          <View style={styles.metaInline}>
            <Ionicons name="time-outline" size={styles._miniIcon} color={MUTED} />
            <Text style={styles.metaInlineText} numberOfLines={1}>
              Updated: {item.timeRight}
            </Text>
          </View>
        </View>
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

  const { user } = useAuth() as any;

  const userId = useMemo(() => {
    const u = user as any;
    return String(u?.id ?? u?._id ?? u?.userId ?? u?.email ?? "").trim();
  }, [user]);

  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const chevronSize = scale(20);
  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? "Reports");
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

  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + vscale(64);

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const longPressFab = () => onQuickExit?.();

  const abortRef = useRef<AbortController | null>(null);

  const fetchMyReports = useCallback(async (signal?: AbortSignal): Promise<ReportItem[]> => {
    const token = await getAccessToken();

    if (!token) {
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
      res = await fetch(url, { method: "GET", headers, signal });
    } catch (e: any) {
      if (isAbortError(e)) throw e;
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
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      abortRef.current?.abort();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setErrorMsg("");
      setLoading(true);

      const list = await fetchMyReports(controller.signal);

      try {
        await syncLocalReportStatusNotifications(
          list.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
            updatedAt: r.updatedAt,
            createdAt: r.createdAt,
          }))
        );
      } catch {}

      if (!controller.signal.aborted) setItems(list);
    } catch (e: any) {
      if (isAbortError(e)) return;
      setErrorMsg(e?.message ? String(e.message) : "Failed to load reports.");
      setItems([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [fetchMyReports, userId]);

  useEffect(() => {
    if (!isFocused) {
      try {
        abortRef.current?.abort();
      } catch {}
      return;
    }

    load();

    return () => {
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, [isFocused, load]);

  const onRefresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }

    try {
      abortRef.current?.abort();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setRefreshing(true);
      setErrorMsg("");

      const list = await fetchMyReports(controller.signal);

      try {
        await syncLocalReportStatusNotifications(
          list.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
            updatedAt: r.updatedAt,
            createdAt: r.createdAt,
          }))
        );
      } catch {}

      if (!controller.signal.aborted) setItems(list);
    } catch (e: any) {
      if (isAbortError(e)) return;
      setErrorMsg(e?.message ? String(e.message) : "Failed to refresh reports.");
    } finally {
      setRefreshing(false);
    }
  }, [fetchMyReports, userId]);

  const counts = useMemo(() => countByStatus(items), [items]);

  const filtered = useMemo(() => {
    const want = filterToStatus(filter);
    return items.filter((x) => (x.status ?? "PENDING") === want);
  }, [items, filter]);

  // ✅ Simple tab-change animation (fade + slight slide up)
  const tabAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    tabAnim.setValue(0);
    Animated.timing(tabAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [filter, tabAnim]);

  const listAnimStyle = useMemo(() => {
    const opacity = tabAnim;
    const translateY = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
    return { opacity, transform: [{ translateY }] };
  }, [tabAnim]);

  const setFilterAnimated = useCallback(
    (k: FilterKey) => {
      if (k === filter) return;
      // kick a tiny "out" feel before switching
      Animated.timing(tabAnim, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
        setFilter(k);
      });
    },
    [filter, tabAnim]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Header card */}
        <View style={styles.heroWrap}>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Reports</Text>
                <Text style={styles.heroSub}>Track your incident progress by status</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatPill label="All" value={counts.total} color={TEXT_DARK} styles={styles} />
              <StatPill label="Pending" value={counts.pending} color={statusAccent("PENDING", PRIMARY)} styles={styles} />
              <StatPill
                label="On going"
                value={counts.ongoing}
                color={statusAccent("ONGOING", PRIMARY)}
                styles={styles}
              />
              <StatPill
                label="Resolved"
                value={counts.resolved}
                color={statusAccent("RESOLVED", PRIMARY)}
                styles={styles}
              />
            </View>
          </View>
        </View>

        {/* Filter chips */}
        <View style={styles.chipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
            {(["Pending", "On going", "Cancelled", "Resolved"] as FilterKey[]).map((k) => (
              <FilterChip
                key={k}
                label={k}
                active={k === filter}
                onPress={() => setFilterAnimated(k)}
                styles={styles}
                accent={statusAccent(filterToStatus(k), PRIMARY)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.centerHint}>Loading reports…</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Pressable onPress={load} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <Animated.View style={[styles.centerBox, listAnimStyle]}>
            <Ionicons name="document-text-outline" size={styles._emptyIcon} color="#94A3B8" />
            <Text style={styles.centerHint}>No reports found for {filter}.</Text>
          </Animated.View>
        ) : (
          <Animated.View style={[{ flex: 1 }, listAnimStyle]}>
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
                      {showGroup ? (
                        <View style={styles.groupPill}>
                          <Ionicons name="calendar-outline" size={styles._miniIcon} color={MUTED} />
                          <Text style={styles.groupPillText}>{item.groupLabel}</Text>
                        </View>
                      ) : null}

                      <ReportTicketCard
                        item={item}
                        onPress={() => onOpenReport?.(item)}
                        styles={styles}
                        chevronSize={chevronSize}
                        primary={PRIMARY}
                      />
                    </View>
                  );
                });
              })()}
            </ScrollView>
          </Animated.View>
        )}

        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={() => handleTab("Incident")}
          onFabLongPress={longPressFab}
          centerLabel="Incident Log"
        />
      </View>
    </SafeAreaView>
  );
}

function StatPill({
  label,
  value,
  color,
  styles,
}: {
  label: string;
  value: number;
  color: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[styles.statPill, { borderColor: BORDER, backgroundColor: "#FFFFFF" }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: MUTED }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const CARD_R = scale(18);

  const _iconSize = scale(20);
  const _miniIcon = scale(14);
  const _emptyIcon = scale(40);

  return Object.assign(
    StyleSheet.create({
      safe: { flex: 1, backgroundColor: BG },
      page: { flex: 1, backgroundColor: BG },

      // ===== Hero =====
      heroWrap: {
        paddingHorizontal: scale(16),
        paddingTop: vscale(6),
        paddingBottom: vscale(10),
      },
      heroCard: {
        borderRadius: CARD_R,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: CARD,
        paddingHorizontal: scale(14),
        paddingVertical: vscale(12),
        // ✅ REMOVED SHADOWS
        shadowColor: "transparent",
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      },
      heroTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: scale(10),
      },

      heroTitle: {
        fontSize: scale(28),
        fontWeight: "900",
        color: TEXT_DARK,
      },

      heroSub: {
        marginTop: vscale(4),
        fontSize: scale(12),
        fontWeight: "400",
        color: MUTED,
        lineHeight: scale(16),
      },

      statsRow: {
        marginTop: vscale(12),
        flexDirection: "row",
        gap: scale(10),
      },
      statPill: {
        flex: 1,
        borderWidth: 1,
        borderRadius: scale(14),
        paddingVertical: vscale(8),
        paddingHorizontal: scale(10),
        alignItems: "center",
        justifyContent: "center",
      },

      statValue: { fontSize: scale(16), fontWeight: "900" },
      statLabel: { marginTop: vscale(2), fontSize: scale(10), fontWeight: "900" },

      dot: { width: scale(8), height: scale(8), borderRadius: scale(99) },

      // ===== Chips =====
      chipsWrap: {
        paddingHorizontal: scale(16),
        paddingBottom: vscale(8),
      },
      chipsContent: { gap: scale(10), paddingRight: scale(6) },
      chip: {
        height: vscale(36),
        borderRadius: vscale(18),
        borderWidth: 1,
        paddingHorizontal: scale(14),
        alignItems: "center",
        justifyContent: "center",
      },
      chipText: { fontSize: scale(12), fontWeight: "900" },

      // ===== List =====
      scrollContent: {
        paddingHorizontal: scale(16),
        paddingTop: vscale(6),
      },
      block: { marginBottom: vscale(12), gap: vscale(8) },

      groupPill: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: scale(10),
        paddingVertical: vscale(6),
        borderRadius: vscale(999),
      },

      groupPillText: { fontSize: scale(11), fontWeight: "900", color: "#94A3B8" },

      // ===== Ticket card =====
      ticket: {
        flexDirection: "row",
        borderRadius: CARD_R,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
        // ✅ REMOVED SHADOWS
        shadowColor: "transparent",
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      },
      ticketAccent: { width: scale(6) },
      ticketBody: { flex: 1, paddingHorizontal: scale(12), paddingVertical: vscale(12) },

      ticketTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: scale(10),
      },
      badge: {
        width: vscale(40),
        height: vscale(40),
        borderRadius: vscale(14),
        alignItems: "center",
        justifyContent: "center",
      },
      ticketTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: scale(10),
      },

      ticketTitle: {
        flex: 1,
        fontSize: scale(16),
        fontWeight: "900",
      },
      alertPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        borderWidth: 1,
        borderRadius: vscale(999),
        paddingHorizontal: scale(8),
        paddingVertical: vscale(4),
      },

      alertPillText: { fontSize: scale(10), fontWeight: "900" },

      ticketDetail: {
        marginTop: vscale(4),
        fontSize: scale(12),
        fontWeight: "400",
        color: MUTED,
        lineHeight: vscale(16),
      },

      ticketBottomRow: {
        marginTop: vscale(10),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: scale(10),
        flexWrap: "wrap",
      },

      statusChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        borderWidth: 1,
        borderRadius: vscale(999),
        paddingHorizontal: scale(10),
        paddingVertical: vscale(6),
      },

      statusChipText: { fontSize: scale(11), fontWeight: "900" },

      metaInline: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
      },

      metaInlineText: { fontSize: scale(10), fontWeight: "400", color: "#94A3B8" },

      // ===== Center states =====
      centerBox: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: scale(20),
        gap: vscale(10),
      },

      centerHint: {
        fontSize: scale(13),
        fontWeight: "400",
        color: MUTED,
        textAlign: "center",
      },

      errorText: {
        fontSize: scale(13),
        fontWeight: "400",
        color: "#B91C1C",
        textAlign: "center",
      },

      retryBtn: {
        marginTop: vscale(6),
        paddingVertical: vscale(10),
        paddingHorizontal: scale(18),
        backgroundColor: PRIMARY,
        borderRadius: scale(999),
      },

      retryText: {
        color: "#FFFFFF",
        fontWeight: "900",
        fontSize: scale(12),
      },
    }),
    { _iconSize, _miniIcon, _emptyIcon }
  ) as any;
}