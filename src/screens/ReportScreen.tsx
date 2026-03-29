// src/screens/ReportScreen.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
  TextInput,
  SectionList,
  SectionListData,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors, useColors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";

// ✅ FIX: Use requestJson with auth for auto token refresh (replaces raw fetch + getAccessToken)
import { requestJson } from "../api/http";

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

// --- Palette (kept close to your existing vibe)
const BG = "#F5FAFE";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";
const MUTED = "#64748B";
const CARD = "#FFFFFF";

// ✅ IMPORTANT: force this to be a normal string (fixes TS literal type error)
const PRIMARY: string = String((Colors as any).primary ?? "#1E63D0");

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

function statusAccent(s?: ReportItem["status"]) {
  if (s === "RESOLVED") return "#16A34A";
  if (s === "CANCELLED") return "#DC2626";
  if (s === "ONGOING") return "#2563EB";
  return "#EAB308";
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

  return { pending, ongoing, cancelled, resolved };
}

function ReportStatusSegment({
  value,
  onChange,
  styles,
  TC,
}: {
  value: FilterKey;
  onChange: (k: FilterKey) => void;
  styles: ReturnType<typeof makeStyles>;
  TC: ReturnType<typeof useColors>;
}) {
  const options: FilterKey[] = ["Pending", "On going", "Cancelled", "Resolved"];
  return (
    <View style={[styles.segmentWrap, { borderColor: TC.divider, backgroundColor: TC.isDark ? TC.surface : "#F3F8FF" }]}>
      {options.map((k) => {
        const active = k === value;
        const accent = statusAccent(filterToStatus(k));
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={({ pressed }) => [
              styles.segmentBtn,
              active ? { backgroundColor: TC.surface, borderColor: "transparent" } : { backgroundColor: "transparent" },
              pressed && { opacity: 0.95 },
            ]}
          >
            <View style={styles.segmentInner}>
              <View style={[styles.segmentDot, { backgroundColor: active ? accent : "#CBD5E1" }]} />
              <Text style={[styles.segmentText, { color: active ? TC.textDark : TC.muted }]} numberOfLines={1}>
                {k}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function ReportCard({
  item,
  onPress,
  styles,
  TC,
}: {
  item: ReportItem;
  onPress?: () => void;
  styles: ReturnType<typeof makeStyles>;
  TC: ReturnType<typeof useColors>;
}) {
  const accent = statusAccent(item.status);
  const icon = statusIcon(item.status);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { borderColor: TC.divider, backgroundColor: TC.card }, pressed && { opacity: 0.98 }]}>
      <View style={styles.cardInner}>
        <View style={[styles.accentEdge, { backgroundColor: accent }]} />

        <View style={styles.cardTopRow}>
          <View style={[styles.leadingIconWrap, { backgroundColor: TC.chipBg, borderColor: TC.divider }]}>
            <Ionicons name={icon} size={styles._iconSize} color={accent} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.titleRow}>
              <Text style={[styles.cardTitle, { color: TC.textDark }]} numberOfLines={1}>
                {item.title}
              </Text>

              {!!item.alertNo && (
                <View style={[styles.alertTag, { borderColor: TC.divider, backgroundColor: TC.surface }]}>
                  <Ionicons name="alert-circle-outline" size={styles._miniIcon} color={TC.muted} />
                  <Text style={[styles.alertTagText, { color: TC.muted }]} numberOfLines={1}>
                    {item.alertNo}
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.cardDetail, { color: TC.muted }]} numberOfLines={2}>
              {item.detail}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={styles._chevron} color={TC.muted} />
        </View>

        <View style={styles.cardBottomRow}>
          <View style={[styles.statusPill, { borderColor: TC.divider, backgroundColor: TC.isDark ? TC.surface : "#F3F8FF" }]}>
            <View style={[styles.statusDot, { backgroundColor: accent }]} />
            <Text style={[styles.statusPillText, { color: accent }]}>{statusLabel(item.status)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={styles._miniIcon} color={TC.muted} />
            <Text style={[styles.metaText, { color: TC.muted }]} numberOfLines={1}>
              Updated {item.timeRight}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

type ReportSection = {
  title: string;
  data: ReportItem[];
};

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
  const TC = useColors();

  const { user } = useAuth() as any;

  const userId = useMemo(() => {
    const u = user as any;
    return String(u?.id ?? u?._id ?? u?.userId ?? u?.email ?? "").trim();
  }, [user]);

  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? "Reports");
  const [filter, setFilter] = useState<FilterKey>("Pending");
  const [query, setQuery] = useState<string>("");

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

  // ✅ FIX: Use requestJson with auth:true for auto token refresh
  const fetchMyReports = useCallback(async (signal?: AbortSignal): Promise<ReportItem[]> => {
    // ✅ FIX: requestJson auto-attaches token AND auto-refreshes on 401
    let data: any;
    try {
      data = await requestJson({
        method: "GET",
        path: "/api/mobile/v1/reports/my",
        auth: true,
      });
    } catch (e: any) {
      if (isAbortError(e)) throw e;
      throw e;
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
  }, []); // ✅ FIX: No dependencies needed — requestJson handles token internally

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

  const filtered = useMemo(() => {
    const want = filterToStatus(filter);
    const base = items.filter((x) => (x.status ?? "PENDING") === want);

    const q = query.trim().toLowerCase();
    if (!q) return base;

    return base.filter((x) => {
      const hay = `${x.title} ${x.detail} ${x.alertNo ?? ""} ${x.location ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, query]);

  const sections = useMemo<ReportSection[]>(() => {
    const map = new Map<string, ReportItem[]>();
    for (const it of filtered) {
      const key = String(it.groupLabel ?? "").trim() || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }

    const keys = Array.from(map.keys());
    keys.sort((a, b) => {
      if (a === "Today" && b !== "Today") return -1;
      if (b === "Today" && a !== "Today") return 1;
      return 0;
    });

    return keys.map((k) => ({ title: k, data: map.get(k)! }));
  }, [filtered]);

  // ✅ Simple list fade/slide when filter changes
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
    const translateY = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
    return { opacity, transform: [{ translateY }] };
  }, [tabAnim]);

  const setFilterAnimated = useCallback(
    (k: FilterKey) => {
      if (k === filter) return;
      Animated.timing(tabAnim, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
        setFilter(k);
      });
    },
    [filter, tabAnim]
  );

  return (
    <View style={[styles.safe, { backgroundColor: TC.screenBg }]}>
      <StatusBar barStyle={TC.statusBar} translucent backgroundColor="transparent" />

      <View style={[styles.page, { backgroundColor: TC.screenBg }]}>
        {/* ===== Gradient header backdrop — extends behind status bar ===== */}
        <LinearGradient
          colors={TC.isDark ? [TC.surface, TC.screenBg] : ["#EAF3FF", "#F5FAFE"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.headerBg}
        />

        {/* ===== Top header ===== */}
        <View style={[styles.headerWrap, { paddingTop: insets.top + vscale(8) }]}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: TC.textDark }]}>Reports</Text>
              <Text style={[styles.headerSub, { color: TC.muted }]}>Track your incident progress by status</Text>
            </View>
          </View>

          <View style={[styles.searchWrap, { borderColor: TC.divider, backgroundColor: TC.isDark ? TC.surface : "#F8FBFF" }]}>
              <Ionicons name="search-outline" size={styles._iconSize} color={TC.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search reports…"
                placeholderTextColor={TC.muted}
                style={[styles.searchInput, { color: TC.textDark }]}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {!!query && (
                <Pressable
                  onPress={() => setQuery("")}
                  style={({ pressed }) => [styles.clearBtn, { backgroundColor: TC.surface, borderColor: TC.divider }, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="close" size={styles._iconSize} color={TC.muted} />
                </Pressable>
              )}
          </View>

          <View style={styles.statusWrap}>
            <ReportStatusSegment value={filter} onChange={setFilterAnimated} styles={styles} TC={TC} />
          </View>
        </View>

        {/* ===== Body ===== */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={TC.primary} />
            <Text style={[styles.centerHint, { color: TC.muted }]}>Loading reports…</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.centerBox}>
            <Ionicons name="warning-outline" size={styles._emptyIcon} color="#F59E0B" />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Pressable onPress={load} style={({ pressed }) => [styles.retryBtn, { backgroundColor: TC.primary }, pressed && { opacity: 0.92 }]}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <Animated.View style={[styles.centerBox, listAnimStyle]}>
            <Ionicons name="document-text-outline" size={styles._emptyIcon} color="#94A3B8" />
            <Text style={[styles.centerHint, { color: TC.muted }]}>No reports found for {filter}.</Text>
            {!!query && <Text style={[styles.centerSubHint, { color: TC.muted }]}>Try a different keyword.</Text>}
          </Animated.View>
        ) : (
          <Animated.View style={[{ flex: 1 }, listAnimStyle]}>
            <SectionList
              sections={sections as SectionListData<ReportItem, ReportSection>[]}
              keyExtractor={(it) => it.id}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={[styles.listContent, { paddingBottom: CONTENT_BOTTOM_PAD }]}
              renderSectionHeader={({ section }) => (
                <View style={styles.sectionHeaderWrap}>
                  <View style={[styles.sectionPill, { borderColor: TC.divider, backgroundColor: TC.surface }]}>
                    <Ionicons name="calendar-outline" size={styles._miniIcon} color={TC.muted} />
                    <Text style={[styles.sectionPillText, { color: TC.muted }]}>{section.title}</Text>
                  </View>
                </View>
              )}
              renderItem={({ item }) => (
                <ReportCard item={item} onPress={() => onOpenReport?.(item)} styles={styles} TC={TC} />
              )}
              ItemSeparatorComponent={() => <View style={{ height: vscale(10) }} />}
            />
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
          centerLabel="Community"
        />
      </View>
    </View>
  );
}

function MiniStat({
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
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
      <Text style={styles.miniStatLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const CARD_R = scale(20);

  const _iconSize = scale(18);
  const _miniIcon = scale(14);
  const _emptyIcon = scale(44);
  const _chevron = scale(20);

  return Object.assign(
    StyleSheet.create({
      safe: { flex: 1, backgroundColor: BG },
      page: { flex: 1, backgroundColor: BG },

      headerBg: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: vscale(220),
      },

      headerWrap: {
        paddingHorizontal: scale(16),
        paddingTop: vscale(8),
        paddingBottom: vscale(10),
      },

      // ✅ NO SHADOWS AT ALL (super-flat iOS feel)
      headerTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: scale(10),
        marginBottom: vscale(10),
      },

      headerTitle: {
        fontSize: scale(28),
        fontWeight: "900",
        color: TEXT_DARK,
        letterSpacing: -0.2,
      },

      headerSub: {
        marginTop: vscale(4),
        fontSize: scale(12),
        fontWeight: "400",
        color: MUTED,
        lineHeight: scale(16),
      },

      headerBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        borderWidth: 1,
        borderRadius: scale(999),
        paddingHorizontal: scale(10),
        paddingVertical: vscale(6),
        backgroundColor: "#F3F8FF",
      },

      headerBadgeText: {
        fontSize: scale(11),
        fontWeight: "900",
      },

      statsRow: {
        marginTop: vscale(12),
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#EEF4FF",
        backgroundColor: "#F7FAFF",
        borderRadius: scale(16),
        paddingVertical: vscale(10),
        paddingHorizontal: scale(10),
      },

      statDivider: {
        width: 1,
        alignSelf: "stretch",
        backgroundColor: "#E6EEFF",
        marginHorizontal: scale(10),
      },

      miniStat: { flex: 1, alignItems: "center", justifyContent: "center" },
      miniStatValue: { fontSize: scale(16), fontWeight: "900" },
      miniStatLabel: { marginTop: vscale(2), fontSize: scale(10), fontWeight: "700", color: "#64748B" },

      searchWrap: {
        marginTop: vscale(12),
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
        borderWidth: 1,
        borderColor: "#EEF4FF",
        backgroundColor: "#F8FBFF",
        borderRadius: scale(16),
        paddingHorizontal: scale(12),
        height: vscale(44),
      },

      statusWrap: {
        marginTop: vscale(12),
      },

      searchInput: {
        flex: 1,
        fontSize: scale(12),
        color: TEXT_DARK,
        fontWeight: "400",
      },

      clearBtn: {
        width: vscale(30),
        height: vscale(30),
        borderRadius: vscale(999),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#EEF4FF",
      },

      // Segmented control
      segmentWrap: {
        marginTop: vscale(12),
        flexDirection: "row",
        borderWidth: 1,
        borderColor: "#EAF2FF",
        backgroundColor: "#F3F8FF",
        borderRadius: scale(16),
        padding: scale(4),
        gap: scale(6),
      },

      segmentBtn: {
        flex: 1,
        height: vscale(38),
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: "transparent",
        alignItems: "center",
        justifyContent: "center",
      },

      segmentInner: { flexDirection: "row", alignItems: "center", gap: scale(6) },
      segmentDot: { width: scale(8), height: scale(8), borderRadius: scale(99) },

      segmentText: {
        fontSize: scale(11),
        fontWeight: "600",
      },

      // List
      listContent: {
        paddingHorizontal: scale(16),
        paddingTop: vscale(6),
      },

      sectionHeaderWrap: {
        paddingTop: vscale(10),
        paddingBottom: vscale(8),
      },

      sectionPill: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        borderWidth: 1,
        borderColor: "#EEF4FF",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: scale(10),
        paddingVertical: vscale(6),
        borderRadius: vscale(999),
      },

      sectionPillText: { fontSize: scale(11), fontWeight: "900", color: "#94A3B8" },

      // ✅ NO SHADOWS AT ALL
      card: {
        borderRadius: CARD_R,
        borderWidth: 1,
        borderColor: "#EAF2FF",
        backgroundColor: "#FFFFFF",

        shadowColor: "transparent",
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      },

      cardInner: {
        borderRadius: CARD_R,
        overflow: "hidden",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(12),
      },

      accentEdge: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: scale(5),
        opacity: 0.9,
      },

      cardTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: scale(10),
      },

      leadingIconWrap: {
        width: vscale(42),
        height: vscale(42),
        borderRadius: vscale(14),
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
      },

      titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: scale(10),
      },

      cardTitle: {
        flex: 1,
        fontSize: scale(16),
        fontWeight: "900",
        color: TEXT_DARK,
        letterSpacing: -0.1,
      },

      alertTag: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        borderWidth: 1,
        borderColor: "#EEF4FF",
        backgroundColor: "#FFFFFF",
        borderRadius: vscale(999),
        paddingHorizontal: scale(8),
        paddingVertical: vscale(4),
      },

      alertTagText: { fontSize: scale(10), fontWeight: "900", color: "#64748B" },

      cardDetail: {
        marginTop: vscale(4),
        fontSize: scale(12),
        fontWeight: "400",
        color: MUTED,
        lineHeight: vscale(16),
      },

      cardBottomRow: {
        marginTop: vscale(10),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: scale(10),
        flexWrap: "wrap",
      },

      statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        borderWidth: 1,
        borderRadius: vscale(999),
        paddingHorizontal: scale(10),
        paddingVertical: vscale(6),
      },

      statusDot: { width: scale(8), height: scale(8), borderRadius: scale(99) },

      statusPillText: { fontSize: scale(11), fontWeight: "900" },

      metaRow: { flexDirection: "row", alignItems: "center", gap: scale(6) },
      metaText: { fontSize: scale(10), fontWeight: "400", color: "#94A3B8" },

      // Center states
      centerBox: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: scale(20),
        gap: vscale(10),
        paddingBottom: vscale(160),
      },

      centerHint: {
        fontSize: scale(13),
        fontWeight: "400",
        color: MUTED,
        textAlign: "center",
      },

      centerSubHint: {
        fontSize: scale(12),
        fontWeight: "400",
        color: "#94A3B8",
        textAlign: "center",
        marginTop: vscale(-4),
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
    { _iconSize, _miniIcon, _emptyIcon, _chevron }
  ) as any;
}
