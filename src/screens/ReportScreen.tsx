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
  FlatList,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors, useColors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import {
  getReportStatusMeta,
  isActiveReportStatus,
  normalizeReportStatus,
  type ReportStatus,
} from "../utils/reportStatus";

// ✅ FIX: Use requestJson with auth for auto token refresh (replaces raw fetch + getAccessToken)
import { requestJson } from "../api/http";

// ✅ NEW: local status-change notifications
import { syncLocalReportStatusNotifications } from "../api/notifications";

type FilterKey = "Active" | "Resolved" | "Archived";

export type ReportItem = {
  id: string;

  title: string;
  detail: string;
  dateLeft: string;
  timeLeft: string;
  dateRight: string;
  timeRight: string;
  groupLabel?: string;

  status?: ReportStatus;
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

const REPORT_SCREEN_STATUS_COLORS: Record<ReportStatus, { backgroundColor: string; textColor: string }> = {
  SUBMITTED: { backgroundColor: "#AFCDF8", textColor: "#40536B" },
  UNDER_REVIEW: { backgroundColor: "#FDE7A6", textColor: "#72551C" },
  MEDIATION_SCHEDULED: { backgroundColor: "#DDC7F7", textColor: "#7652C8" },
  ONGOING_ASSISTANCE: { backgroundColor: "#F8BB96", textColor: "#4B5563" },
  RESOLVED: { backgroundColor: "#C7F2D8", textColor: "#18723A" },
  CERTIFICATION_ISSUED: { backgroundColor: "#F2B0B6", textColor: "#70414C" },
  ARCHIVED: { backgroundColor: "#DDE2E8", textColor: "#4B5563" },
};

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

function isAbortError(err: any) {
  const name = err?.name || "";
  const msg = String(err?.message || "");
  return name === "AbortError" || msg.toLowerCase().includes("aborted");
}

function countByStatus(items: ReportItem[]) {
  let active = 0;
  let resolved = 0;
  let archived = 0;

  for (const it of items) {
    const s = normalizeReportStatus(it.status);
    if (s === "RESOLVED") resolved++;
    else if (s === "ARCHIVED") archived++;
    else active++;
  }

  return { active, resolved, archived };
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
  const options: FilterKey[] = ["Active", "Resolved", "Archived"];
  return (
    <View style={styles.segmentWrap}>
      {options.map((k) => {
        const active = k === value;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={({ pressed }) => [
              styles.segmentBtn,
              active ? styles.segmentBtnActive : styles.segmentBtnIdle,
              pressed && { opacity: 0.95 },
            ]}
          >
            <Text style={[styles.segmentText, active ? styles.segmentTextActive : styles.segmentTextIdle]} numberOfLines={1}>
              {k}
            </Text>
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
  const status = getReportStatusMeta(item.status);
  const statusColors = REPORT_SCREEN_STATUS_COLORS[normalizeReportStatus(item.status)];
  const cardDate = parseDateSmart(item.dateLeft) ? formatGroupDate(parseDateSmart(item.dateLeft)!) : item.dateLeft || "-";
  const dateLine = `${cardDate}${item.timeLeft && item.timeLeft !== "—" && item.timeLeft !== "-" ? ` • ${item.timeLeft}` : ""}`;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { borderColor: TC.divider, backgroundColor: TC.card }, pressed && { opacity: 0.96 }]}>
      <View style={styles.cardInner}>
        <View style={styles.cardMetaRow}>
          <Text style={[styles.reportNo, { color: TC.muted }]} numberOfLines={1}>
            REP {item.alertNo || `#${item.id.slice(-6).toUpperCase()}`}
          </Text>

          <View style={[styles.statusPill, { backgroundColor: statusColors.backgroundColor }]}>
            <Text style={[styles.statusPillText, { color: statusColors.textColor }]} numberOfLines={1}>{status.shortLabel}</Text>
          </View>
        </View>

        <Text style={[styles.cardTitle, { color: TC.textDark }]} numberOfLines={1}>
          {item.title}
        </Text>

        <Text style={[styles.cardDetail, { color: TC.muted }]} numberOfLines={2}>
          {item.detail}
        </Text>

        <View style={styles.cardBottomRow}>
          <Text style={[styles.metaText, { color: TC.muted }]} numberOfLines={1}>
            {dateLine}
          </Text>

          <View style={styles.viewDetailsRow}>
            <Text style={[styles.viewDetailsText, { color: TC.primary }]} numberOfLines={1}>View Details</Text>
            <Ionicons name="chevron-forward" size={styles._chevron} color={TC.primary} />
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
  isActive = true,
  onOpenReport,
}: {
  onQuickExit?: () => void;
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
  isActive?: boolean;
  onOpenReport?: (item: ReportItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const TC = useColors();

  const { user } = useAuth() as any;

  const userId = useMemo(() => {
    const u = user as any;
    return String(u?.id ?? u?._id ?? u?.userId ?? u?.email ?? "").trim();
  }, [user]);

  const compactHeight = height < 500;
  const designWidth = Math.min(width, compactHeight ? 390 : 430);
  const wScale = Math.min(Math.max(designWidth / 375, 0.9), 1.12);
  const hScale = Math.min(Math.max(height / 812, 0.9), compactHeight ? 1 : 1.12);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const styles = useMemo(() => makeStyles(scale, vscale, compactHeight), [width, height]);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? "Reports");
  const [filter, setFilter] = useState<FilterKey>("Active");
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    if (isActive) setActiveTab(initialTab ?? "Reports");
  }, [initialTab, isActive]);

  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const NAV_BASE_HEIGHT = compactHeight ? 66 : 78;
  const FAB_SIZE = compactHeight ? 60 : 68;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + (compactHeight ? 70 : 90);
  const fabBottom = navHeight - FAB_SIZE / 2 - (compactHeight ? 6 : 10);

  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + vscale(64);

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const longPressFab = () => onQuickExit?.();

  const abortRef = useRef<AbortController | null>(null);
  const loadInFlightRef = useRef(false);
  const hasLoadedRef = useRef(false);

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

      const statusNorm = normalizeReportStatus(doc?.status);

      return {
        id,
        groupLabel,
        title: incidentType || "Incident Report",
        detail: details || offenderName || "No details provided.",
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

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;

    if (!userId) {
      setItems([]);
      setLoading(false);
      hasLoadedRef.current = true;
      return;
    }

    if (silent && loadInFlightRef.current) return;

    try {
      abortRef.current?.abort();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;
    loadInFlightRef.current = true;

    try {
      if (!silent) setErrorMsg("");
      if (!silent) setLoading(true);

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

      if (!controller.signal.aborted) {
        setErrorMsg("");
        setItems(list);
      }
    } catch (e: any) {
      if (isAbortError(e)) return;
      if (!silent) {
        setErrorMsg(e?.message ? String(e.message) : "Failed to load reports.");
        setItems([]);
      }
    } finally {
      if (abortRef.current === controller) {
        loadInFlightRef.current = false;
        hasLoadedRef.current = true;
        if (!controller.signal.aborted && !silent) setLoading(false);
      }
    }
  }, [fetchMyReports, userId]);

  useEffect(() => {
    load();

    return () => {
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, [load]);

  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    const becameActive = isActive && !wasActiveRef.current;
    wasActiveRef.current = isActive;

    if (becameActive && hasLoadedRef.current) {
      load({ silent: true });
    }
  }, [isActive, load]);

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
    loadInFlightRef.current = true;

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
      if (abortRef.current === controller) {
        loadInFlightRef.current = false;
        hasLoadedRef.current = true;
        if (!controller.signal.aborted) setLoading(false);
      }
      if (!controller.signal.aborted) setRefreshing(false);
    }
  }, [fetchMyReports, userId]);

  const filtered = useMemo(() => {
    const base = items.filter((x) => {
      const status = normalizeReportStatus(x.status);
      if (filter === "Resolved") return status === "RESOLVED";
      if (filter === "Archived") return status === "ARCHIVED";
      return isActiveReportStatus(status);
    });

    const q = query.trim().toLowerCase();
    if (!q) return base;

    return base.filter((x) => {
      const hay = `${x.title} ${x.detail} ${x.alertNo ?? ""} ${x.location ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, query]);

  // ✅ Simple list fade/slide when filter changes
  const tabAnim = useRef(new Animated.Value(1)).current;
  const previousAnimatedFilterRef = useRef<FilterKey>(filter);
  useEffect(() => {
    const filterChanged = previousAnimatedFilterRef.current !== filter;
    previousAnimatedFilterRef.current = filter;
    tabAnim.stopAnimation();

    if (!isActive || !filterChanged) {
      tabAnim.setValue(1);
      return;
    }

    tabAnim.setValue(0);
    Animated.timing(tabAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [filter, isActive, tabAnim]);

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

  const openFilterMenu = useCallback(() => {
    Alert.alert("Filter reports", "Choose which reports to display.", [
      { text: "Active", onPress: () => setFilterAnimated("Active") },
      { text: "Resolved", onPress: () => setFilterAnimated("Resolved") },
      { text: "Archived", onPress: () => setFilterAnimated("Archived") },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [setFilterAnimated]);

  return (
    <View style={[styles.safe, { backgroundColor: TC.screenBg }]}>
      <StatusBar barStyle={TC.statusBar} translucent backgroundColor="transparent" />

      <View style={[styles.page, { backgroundColor: TC.screenBg }]}>
        {/* ===== Top header ===== */}
        <View style={[styles.headerWrap, { paddingTop: insets.top + vscale(compactHeight ? 10 : 18) }]}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: TC.heading }]}>My Reports</Text>
            </View>
          </View>

          <View style={styles.searchRow}>
            <View style={[styles.searchWrap, { borderColor: TC.divider, backgroundColor: TC.surface }]}>
              <Ionicons name="search-outline" size={styles._iconSize} color={TC.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
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

            <Pressable
              onPress={openFilterMenu}
              accessibilityRole="button"
              accessibilityLabel="Filter reports"
              style={({ pressed }) => [
                styles.filterButton,
                { backgroundColor: TC.surface, borderColor: TC.divider },
                pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Ionicons name="options-outline" size={styles._filterIcon} color={TC.muted} />
            </Pressable>
          </View>

          <View style={styles.statusWrap}>
            <ReportStatusSegment value={filter} onChange={setFilterAnimated} styles={styles} TC={TC} />
          </View>
        </View>

        {/* ===== Body ===== */}
        <Animated.View style={[{ flex: 1 }, listAnimStyle]}>
          <FlatList
            data={loading || errorMsg ? [] : filtered}
            keyExtractor={(it) => it.id}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical
            overScrollMode="always"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={TC.primary}
                colors={[TC.primary]}
                progressBackgroundColor={TC.surface}
              />
            }
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: CONTENT_BOTTOM_PAD },
              (loading || !!errorMsg || filtered.length === 0) && styles.emptyListContent,
            ]}
            ListEmptyComponent={
              <View style={styles.centerBox}>
                {loading ? (
                  <>
                    <ActivityIndicator size="large" color={TC.primary} />
                    <Text style={[styles.centerHint, { color: TC.muted }]}>Loading reports…</Text>
                  </>
                ) : errorMsg ? (
                  <>
                    <Ionicons name="warning-outline" size={styles._emptyIcon} color="#F59E0B" />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                    <Pressable onPress={() => load()} style={({ pressed }) => [styles.retryBtn, { backgroundColor: TC.primary }, pressed && { opacity: 0.92 }]}>
                      <Text style={styles.retryText}>Retry</Text>
                    </Pressable>
                    <Text style={[styles.centerSubHint, { color: TC.muted }]}>Or pull down to refresh.</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={styles._emptyIcon} color="#94A3B8" />
                    <Text style={[styles.centerHint, { color: TC.muted }]}>No reports found for {filter}.</Text>
                    {!!query && <Text style={[styles.centerSubHint, { color: TC.muted }]}>Try a different keyword.</Text>}
                    <Text style={[styles.centerSubHint, { color: TC.muted }]}>Pull down to refresh.</Text>
                  </>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <ReportCard item={item} onPress={() => onOpenReport?.(item)} styles={styles} TC={TC} />
            )}
            ItemSeparatorComponent={() => <View style={{ height: vscale(10) }} />}
          />
        </Animated.View>

        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          centerLabel="Services"
          fabQuickActions
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={() => handleTab("Incident")}
          onFabLongPress={longPressFab}
          onQuickExit={onQuickExit}
        />
      </View>
    </View>
  );
}

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number, compactHeight: boolean) {
  const compactScale = (n: number) => Math.min(scale(n), vscale(n));
  const CARD_R = compactScale(14);
  const SEARCH_CONTROL_SIZE = compactScale(40);
  const SEGMENT_HEIGHT = compactScale(32);

  const _iconSize = compactScale(18);
  const _filterIcon = compactScale(21);
  const _emptyIcon = compactScale(44);
  const _chevron = compactScale(17);

  return Object.assign(
    StyleSheet.create({
      safe: { flex: 1, backgroundColor: BG },
      page: { flex: 1, backgroundColor: BG },

      headerWrap: {
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
        paddingHorizontal: scale(20),
        paddingBottom: vscale(compactHeight ? 7 : 10),
      },

      // ✅ NO SHADOWS AT ALL (super-flat iOS feel)
      headerTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: scale(10),
        marginBottom: vscale(compactHeight ? 12 : 16),
      },

      headerTitle: {
        fontSize: scale(28),
        fontWeight: "700",
        color: TEXT_DARK,
        letterSpacing: -0.2,
      },

      searchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(9),
      },

      searchWrap: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
        borderWidth: 1,
        borderColor: "#D7DCE2",
        backgroundColor: "#FFFFFF",
        borderRadius: scale(999),
        paddingHorizontal: scale(14),
        height: SEARCH_CONTROL_SIZE,
      },

      filterButton: {
        width: SEARCH_CONTROL_SIZE,
        height: SEARCH_CONTROL_SIZE,
        flexShrink: 0,
        borderRadius: SEARCH_CONTROL_SIZE / 2,
        borderWidth: 1,
        borderColor: "#E1E5EA",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#64748B",
        shadowOpacity: 0.13,
        shadowRadius: scale(5),
        shadowOffset: { width: 0, height: vscale(2) },
        elevation: 2,
      },

      statusWrap: {
        marginTop: vscale(compactHeight ? 12 : 16),
      },

      searchInput: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 0,
        fontSize: scale(14),
        color: TEXT_DARK,
        fontWeight: "400",
      },

      clearBtn: {
        width: compactScale(28),
        height: compactScale(28),
        borderRadius: compactScale(14),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
      },

      // Segmented control
      segmentWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
      },

      segmentBtn: {
        flexShrink: 1,
        minWidth: compactScale(90),
        height: SEGMENT_HEIGHT,
        borderRadius: scale(999),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: scale(22),
      },

      segmentBtnActive: {
        backgroundColor: "#06223F",
      },

      segmentBtnIdle: {
        backgroundColor: "#E2E6EC",
      },

      segmentText: {
        fontSize: scale(12.5),
        fontWeight: "700",
      },

      segmentTextActive: {
        color: "#FFFFFF",
      },

      segmentTextIdle: {
        color: "#4B5563",
      },

      // List
      listContent: {
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
        paddingHorizontal: scale(14),
        paddingTop: vscale(6),
      },
      emptyListContent: {
        flexGrow: 1,
      },

      // ✅ NO SHADOWS AT ALL
      card: {
        borderRadius: CARD_R,
        borderWidth: 1,
        borderColor: "#D9DEE7",
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
        paddingHorizontal: scale(16),
        paddingVertical: vscale(compactHeight ? 10 : 12),
      },

      cardMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: scale(10),
        marginBottom: vscale(4),
      },

      reportNo: {
        flex: 1,
        fontSize: scale(9.5),
        fontWeight: "500",
        color: "#9CA3AF",
      },

      cardTitle: {
        fontSize: scale(16.5),
        fontWeight: "700",
        color: TEXT_DARK,
        lineHeight: compactScale(20),
      },

      cardDetail: {
        marginTop: 0,
        fontSize: scale(13.25),
        fontStyle: "italic",
        fontWeight: "400",
        color: MUTED,
        lineHeight: compactScale(19.5),
      },

      cardBottomRow: {
        marginTop: vscale(8),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: scale(10),
      },

      statusPill: {
        borderRadius: vscale(999),
        paddingHorizontal: scale(9),
        paddingVertical: vscale(5),
        maxWidth: scale(145),
      },

      statusPillText: {
        fontSize: scale(10),
        fontWeight: "700",
        color: "#374151",
      },

      metaText: {
        flex: 1,
        minWidth: 0,
        fontSize: scale(11),
        fontWeight: "400",
        color: "#9CA3AF",
      },

      viewDetailsRow: {
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: scale(4),
      },

      viewDetailsText: {
        fontSize: scale(11.5),
        fontWeight: "700",
      },

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
    { _iconSize, _filterIcon, _emptyIcon, _chevron }
  ) as any;
}
