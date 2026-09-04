// src/screens/NotificationsScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  StatusBar,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  SectionList,
  Modal,
  DeviceEventEmitter,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "../theme/colors";
import { createTypography } from "../theme/typography";
import { useNavigation } from "@react-navigation/native";

import {
  syncLocalReportStatusNotifications,
  fetchMyNotificationsCombined,
  markAllNotificationsReadCombined,
  toggleNotificationReadCombined,
  clearAllNotificationsCombined,
  deleteNotificationCombined,
  type NotificationItem,
  type NotifType,
} from "../api/notifications";
import { requestJson } from "../api/http";

import type { ReportItem } from "./ReportScreen";
import { normalizeCaseStatus, normalizeReportStatus } from "../utils/reportStatus";

type Props = {
  onBack: () => void;
};

// Colors now provided by useColors() hook for dark mode support

type FilterKey = "all" | "unread" | "alert" | "report" | "thread" | "info";

function iconForType(t: NotifType): keyof typeof Ionicons.glyphMap {
  if (t === "alert") return "warning-outline";
  if (t === "report") return "document-text-outline";
  if (t === "thread") return "chatbubble-ellipses-outline";
  return "information-circle-outline";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatTimeLabel(isoOrAny: string) {
  const d = new Date(isoOrAny);
  if (Number.isNaN(d.getTime())) return isoOrAny;

  const now = new Date();
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  const time = `${hh}:${pad2(m)} ${ampm}`;

  if (isSameDay) return `Today - ${time}`;
  if (isYesterday) return `Yesterday - ${time}`;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()} - ${time}`;
}

function groupLabelFromDate(isoOrAny: string) {
  const d = new Date(isoOrAny);
  if (Number.isNaN(d.getTime())) return "Earlier";

  const now = new Date();
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isSameDay) return "Today";
  if (isYesterday) return "Yesterday";

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
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Use your Expo .env variable (ngrok or LAN IP)
function normalizeStatus(dbStatus?: string): ReportItem["status"] {
  return normalizeReportStatus(dbStatus);
}

function normalizePhoto(p: any): string {
  if (!p) return "";
  if (typeof p === "string") return p;
  if (typeof p?.url === "string") return p.url;
  if (typeof p?.secure_url === "string") return p.secure_url;
  if (typeof p?.path === "string") return p.path;
  if (typeof p?.filename === "string") return p.filename;
  return "";
}

// Fetch report detail (owned by user)
// GET /api/mobile/v1/reports/:id  -> { report: incident }
async function fetchMyReportDetailAsReportItem(incidentId: string): Promise<ReportItem> {
  const data = await requestJson<any>({
    path: `/api/mobile/v1/reports/${encodeURIComponent(incidentId)}`,
    auth: true,
  });

  const doc = data?.report ?? data?.incident ?? data;
  if (!doc?._id && !doc?.id) throw new Error("Unexpected response: missing report");

  const id = String(doc?._id ?? doc?.id ?? "");
  const incidentType = String(doc?.incidentType ?? "") || "Incident Report";
  const details = String(doc?.details ?? "") || "-";
  const offenderName = String(doc?.offenderName ?? "");
  const dateLeft = String(doc?.dateStr ?? "") || "-";
  const timeLeft = String(doc?.timeStr ?? "") || "-";

  const createdAtIso = doc?.createdAt ? String(doc.createdAt) : "";
  const updatedAtIso = doc?.updatedAt ? String(doc.updatedAt) : "";

  const photos: string[] = Array.isArray(doc?.photos)
    ? doc.photos.map((p: any) => normalizePhoto(p)).filter(Boolean)
    : [];

  const mapped: ReportItem = {
    id,
    groupLabel: "",
    title: incidentType,
    detail: details,
    dateLeft,
    timeLeft,
    dateRight: "-",
    timeRight: "-",
    status: normalizeStatus(doc?.status),
    caseStatus: normalizeCaseStatus(
      doc?.caseStatus,
      doc?.currentProcessStage || doc?.status
    ),
    currentProcessStage: String(doc?.currentProcessStage || doc?.status || "submitted"),
    witnessName: doc?.witnessName ? String(doc.witnessName) : "",
    witnessType: doc?.witnessType ? String(doc.witnessType) : "",
    location: doc?.locationStr ? String(doc.locationStr) : "",
    incidentTypeLabel: incidentType,
    alertNo: doc?.complainId ? `#${String(doc.complainId)}` : `#${String(id).slice(-4)}`,
    offenderName,
    photos,
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
  };

  return mapped;
}

type NotifVM = NotificationItem & {
  timeLabel: string;
  groupLabel: string;
  _ts: number; // for sorting
};

type SectionT = { title: string; data: NotifVM[]; sortKey: number };
const NOTIF_CHANGED_EVENT = "tahanan:notifChanged";

export default function NotificationsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const TC = useColors();

  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const styles = useMemo(() => makeStyles(scale, vscale, TC), [width, height, TC.isDark]);

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<NotifVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [showCaughtUp, setShowCaughtUp] = useState(false);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  // Top-right menu (quick actions for all)
  const [menuOpen, setMenuOpen] = useState(false);

  // Long-press menu (per item)
  const [itemMenuOpen, setItemMenuOpen] = useState(false);
  const [itemMenu, setItemMenu] = useState<NotifVM | null>(null);
  const refreshInFlightRef = useRef(false);
  const lastReportSyncAtRef = useRef(0);
  const caughtUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const caughtUpAnim = useRef(new Animated.Value(0)).current;

  const unreadCount = useMemo(() => items.filter((i) => i.unread).length, [items]);

  const hideCaughtUp = useCallback(() => {
    if (caughtUpTimerRef.current) {
      clearTimeout(caughtUpTimerRef.current);
      caughtUpTimerRef.current = null;
    }

    Animated.timing(caughtUpAnim, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start(() => setShowCaughtUp(false));
  }, [caughtUpAnim]);

  const showCaughtUpOnce = useCallback((list: NotifVM[]) => {
    if (caughtUpTimerRef.current) clearTimeout(caughtUpTimerRef.current);

    if (list.some((item) => item.unread)) {
      hideCaughtUp();
      return;
    }

    setShowCaughtUp(true);
    caughtUpAnim.stopAnimation();
    caughtUpAnim.setValue(0);
    Animated.timing(caughtUpAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    caughtUpTimerRef.current = setTimeout(() => {
      hideCaughtUp();
      caughtUpTimerRef.current = null;
    }, 1600);
  }, [caughtUpAnim, hideCaughtUp]);

  useEffect(() => {
    return () => {
      if (caughtUpTimerRef.current) clearTimeout(caughtUpTimerRef.current);
      caughtUpAnim.stopAnimation();
    };
  }, [caughtUpAnim]);

  const fetchReportStatusSnapshot = useCallback(async () => {
    try {
      const data: any = await requestJson({
        method: "GET",
        path: "/api/mobile/v1/reports/my",
        auth: true,
      });

      const rawList = Array.isArray(data) ? data : data?.incidents ?? [];
      if (!Array.isArray(rawList) || rawList.length === 0) return [];

      return rawList.map((doc: any) => ({
        id: String(doc?._id ?? doc?.id ?? "").trim(),
        title: String(doc?.incidentType ?? "Incident Report"),
        status: normalizeCaseStatus(
          doc?.caseStatus,
          doc?.currentProcessStage || doc?.status
        ),
        createdAt: doc?.createdAt ? String(doc.createdAt) : undefined,
        updatedAt: doc?.updatedAt ? String(doc.updatedAt) : undefined,
      }));
    } catch {
      return [];
    }
  }, []);

  const syncStatusesFromReports = useCallback(async (force = false) => {
    try {
      const now = Date.now();
      if (!force && now - lastReportSyncAtRef.current < 180000) return;

      const snapshot = await fetchReportStatusSnapshot();
      if (!Array.isArray(snapshot) || snapshot.length === 0) return;

      await syncLocalReportStatusNotifications(snapshot);
      lastReportSyncAtRef.current = now;
    } catch {
      // Keep Notifications screen usable even if report sync fails.
    }
  }, [fetchReportStatusSnapshot]);

  const load = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      setErrorMsg("");
      setLoading(true);
      await syncStatusesFromReports(true);
      const list = await fetchMyNotificationsCombined(80);

      const mapped: NotifVM[] = list.map((n) => {
        const d = new Date(n.time);
        const ts = Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
        return {
          ...n,
          timeLabel: formatTimeLabel(n.time),
          groupLabel: groupLabelFromDate(n.time),
          _ts: ts,
        };
      });

      mapped.sort((a, b) => b._ts - a._ts);
      setItems(mapped);
      showCaughtUpOnce(mapped);
    } catch (e: any) {
      setErrorMsg(e?.message ? String(e.message) : "Failed to load notifications.");
      setItems([]);
    } finally {
      setLoading(false);
      refreshInFlightRef.current = false;
    }
  }, [showCaughtUpOnce, syncStatusesFromReports]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async (opts?: { withStatusSync?: boolean }) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      setRefreshing(true);
      setErrorMsg("");
      setShowCaughtUp(false);
      if (opts?.withStatusSync !== false) {
        await syncStatusesFromReports();
      }
      const list = await fetchMyNotificationsCombined(80);

      const mapped: NotifVM[] = list.map((n) => {
        const d = new Date(n.time);
        const ts = Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
        return {
          ...n,
          timeLabel: formatTimeLabel(n.time),
          groupLabel: groupLabelFromDate(n.time),
          _ts: ts,
        };
      });

      mapped.sort((a, b) => b._ts - a._ts);
      setItems(mapped);
      showCaughtUpOnce(mapped);
    } catch (e: any) {
      setErrorMsg(e?.message ? String(e.message) : "Failed to refresh notifications.");
    } finally {
      setRefreshing(false);
      refreshInFlightRef.current = false;
    }
  }, [showCaughtUpOnce, syncStatusesFromReports]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(NOTIF_CHANGED_EVENT, () => {
      onRefresh({ withStatusSync: false }).catch(() => {});
    });
    return () => sub.remove();
  }, [onRefresh]);

  useEffect(() => {
    const id = setInterval(() => {
      onRefresh({ withStatusSync: false }).catch(() => {});
    }, 120000);
    return () => clearInterval(id);
  }, [onRefresh]);

  const applyFilter = useCallback(
    (list: NotifVM[]) => {
      let out = list;

      if (filter === "unread") out = out.filter((n) => n.unread);
      if (filter === "alert") out = out.filter((n) => n.type === "alert");
      if (filter === "report") out = out.filter((n) => n.type === "report");
      if (filter === "thread") out = out.filter((n) => n.type === "thread");
      if (filter === "info") out = out.filter((n) => n.type !== "alert" && n.type !== "report" && n.type !== "thread");

      const q = query.trim().toLowerCase();
      if (q) {
        out = out.filter((n) => `${n.title} ${n.message} ${n.timeLabel}`.toLowerCase().includes(q));
      }

      return out;
    },
    [filter, query]
  );

  const filtered = useMemo(() => applyFilter(items), [applyFilter, items]);

  const sections = useMemo(() => {
    const map = new Map<string, NotifVM[]>();
    for (const n of filtered) {
      const k = n.groupLabel || "Earlier";
      const arr = map.get(k) ?? [];
      arr.push(n);
      map.set(k, arr);
    }

    const toSortKey = (title: string) => {
      if (title === "Today") return 3;
      if (title === "Yesterday") return 2;
      return 1;
    };

    const secs: SectionT[] = Array.from(map.entries()).map(([title, data]) => {
      const sortKey = toSortKey(title);
      data.sort((a, b) => b._ts - a._ts);
      return { title, data, sortKey };
    });

    secs.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return b.sortKey - a.sortKey;
      const aNewest = a.data[0]?._ts ?? 0;
      const bNewest = b.data[0]?._ts ?? 0;
      return bNewest - aNewest;
    });

    return secs;
  }, [filtered]);

  // -------- Global actions --------
  const markAllRead = useCallback(async () => {
    setMenuOpen(false);
    try {
      setItems((prev) => prev.map((x) => ({ ...x, unread: false })));
      await markAllNotificationsReadCombined();
    } catch (e: any) {
      await load();
      setErrorMsg(e?.message ? String(e.message) : "Failed to mark all as read.");
    }
  }, [load]);

  const clearAll = useCallback(async () => {
    setMenuOpen(false);
    Alert.alert("Clear notifications", "This will remove all notifications from this device view.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: async () => {
          try {
            setItems([]);
            const snapshot = await fetchReportStatusSnapshot();
            await clearAllNotificationsCombined(snapshot);
          } catch (e: any) {
            await load();
            setErrorMsg(e?.message ? String(e.message) : "Failed to clear notifications.");
          }
        },
      },
    ]);
  }, [fetchReportStatusSnapshot, load]);

  // -------- Per-item actions (long press) --------
  const openItemMenu = useCallback((n: NotifVM) => {
    setItemMenu(n);
    setItemMenuOpen(true);
  }, []);

  const closeItemMenu = useCallback(() => {
    setItemMenuOpen(false);
    setTimeout(() => setItemMenu(null), 150);
  }, []);

  const setUnreadLocal = useCallback((id: string, unread: boolean) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, unread } : x)));
  }, []);

  const toggleReadFromMenu = useCallback(async () => {
    const n = itemMenu;
    if (!n) return;

    closeItemMenu();
    try {
      const nextUnread = !n.unread;
      setUnreadLocal(n.id, nextUnread);

      await toggleNotificationReadCombined(n.id);
    } catch (e: any) {
      await load();
      Alert.alert("Update failed", e?.message ? String(e.message) : "Failed to update notification.");
    }
  }, [closeItemMenu, itemMenu, load, setUnreadLocal]);

  // delete = remove locally + call deleteNotificationCombined (local/remote)
  const deleteSingleFromMenu = useCallback(async () => {
    const n = itemMenu;
    if (!n) return;

    closeItemMenu();

    Alert.alert("Delete notification", "Remove this notification from the list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const snapshot = items; // for rollback
          // optimistic remove
          setItems((prev) => prev.filter((x) => x.id !== n.id));

          try {
            await deleteNotificationCombined(n.id);
            // optional: re-sync quickly to reflect server truth
            // await load();
          } catch (e: any) {
            // rollback if API failed (so it won't "ghost delete")
            setItems(snapshot);
            Alert.alert(
              "Delete failed",
              e?.message ? String(e.message) : "Failed to delete notification. Please try again."
            );
          }
        },
      },
    ]);
  }, [closeItemMenu, itemMenu, items]);

  const openNotification = useCallback(
    async (n: NotifVM) => {
      try {
        if (openingId) return;
        setOpeningId(n.id);

        if (n.unread) {
          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
          try {
            await toggleNotificationReadCombined(n.id);
          } catch {
            // non-fatal
          }
        }

        if (!n.incidentId) return;

        const report = await fetchMyReportDetailAsReportItem(n.incidentId);
        navigation.navigate("Main", { openReport: report });
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : "Failed to open notification.";
        Alert.alert("Open failed", msg);
      } finally {
        setOpeningId(null);
      }
    },
    [navigation, openingId]
  );

  const bottomPad = Math.max(insets.bottom, vscale(10));
  const CONTENT_BOTTOM_PAD = bottomPad + vscale(18);

  const filterPills = useMemo(
    () =>
      [
        { key: "all" as const, label: "All" },
        { key: "unread" as const, label: "Unread" },
        { key: "alert" as const, label: "Alerts" },
        { key: "report" as const, label: "Reports" },
        { key: "thread" as const, label: "Replies" },
        { key: "info" as const, label: "Info" },
      ].map((p) => ({
        ...p,
        active: p.key === filter,
      })),
    [filter]
  );

  const listEmpty = !loading && !errorMsg && sections.length === 0;

  const selectedTitle = itemMenu?.title ?? "";
  const selectedMsg = itemMenu?.message ?? "";
  const selectedTime = itemMenu?.timeLabel ?? "";

  return (
    <View style={styles.safe}>
      <StatusBar barStyle={TC.statusBar} translucent backgroundColor="transparent" />

      <View style={styles.page}>
        <LinearGradient
          colors={TC.isDark ? [TC.surface, TC.screenBg] : ["#EAF3FF", "#F5FAFE"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.headerBg}
        />

        {/* Top Bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + vscale(8) }]}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={scale(22)} color={TC.primary} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <View style={styles.titleRowTop}>
              <Text style={styles.topTitle}>Notifications</Text>
              {unreadCount > 0 ? (
                <View style={styles.unreadPill}>
                  <Text style={styles.unreadPillText}>{unreadCount} new</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.subTitle}>Tap to open - Long press for actions</Text>
          </View>

          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={10}
            style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="ellipsis-horizontal" size={scale(18)} color={TC.muted} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={scale(18)} color={TC.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search notifications"
              placeholderTextColor={TC.placeholder}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.trim().length > 0 ? (
              <Pressable
                onPress={() => setQuery("")}
                hitSlop={10}
                style={({ pressed }) => [styles.clearQueryBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="close-circle" size={scale(18)} color={TC.muted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Filter notifications"
            hitSlop={8}
            style={({ pressed }) => [
              styles.filterBtn,
              filter !== "all" && styles.filterBtnActive,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Ionicons
              name="filter-outline"
              size={scale(19)}
              color={filter === "all" ? TC.muted : "#FFFFFF"}
            />
          </Pressable>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={TC.primary} />
            <Text style={styles.centerHint}>Loading Notifications</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Pressable onPress={load} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            alwaysBounceVertical
            bounces
            overScrollMode="always"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => onRefresh()}
                tintColor={TC.primary}
                colors={[TC.primary]}
              />
            }
            contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
            ListEmptyComponent={
              listEmpty ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="notifications-off-outline" size={scale(30)} color={TC.muted} />
                  <Text style={styles.emptyTitle}>No notifications</Text>
                  <Text style={styles.emptyText}>You don't have any notifications yet.</Text>
                </View>
              ) : null
            }
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeaderWrap}>
                <View style={styles.sectionPill}>
                  <Ionicons name="calendar-outline" size={scale(14)} color={TC.muted} />
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
              </View>
            )}
            renderItem={({ item: n }) => {
              const isBusy = openingId === n.id;
              const isUnread = !!n.unread;

              return (
                <Pressable
                  onPress={() => openNotification(n)}
                  onLongPress={() => openItemMenu(n)}
                  delayLongPress={280}
                  disabled={isBusy}
                  style={({ pressed }) => [
                    styles.card,
                    isUnread && styles.cardUnread,
                    pressed && { opacity: 0.96, transform: [{ scale: 0.996 }] },
                    isBusy && { opacity: 0.75 },
                  ]}
                >
                  <View style={[styles.leftRail, isUnread ? styles.leftRailUnread : styles.leftRailRead]} />
                  <View style={styles.cardInner}>
                    <View style={styles.iconWrap}>
                      <Ionicons name={iconForType(n.type)} size={scale(20)} color={TC.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]} numberOfLines={1}>
                          {n.title}
                        </Text>
                        {isUnread ? <View style={styles.dot} /> : null}
                      </View>

                      <Text style={styles.cardMsg} numberOfLines={2}>
                        {n.message}
                      </Text>

                      <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={scale(12)} color={TC.muted} />
                        <Text style={styles.cardTime}>{n.timeLabel}</Text>
                      </View>
                    </View>

                    {isBusy ? (
                      <ActivityIndicator size="small" color={TC.muted} />
                    ) : (
                      <Ionicons name="chevron-forward" size={scale(18)} color={TC.muted} />
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {showCaughtUp ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.caughtUpOverlay,
              {
                opacity: caughtUpAnim,
                transform: [
                  {
                    scale: caughtUpAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.caughtPill}>
              <Ionicons name="checkmark-circle-outline" size={scale(18)} color="#16A34A" />
              <Text style={styles.caughtPillText}>All caught up</Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Notification Filter Modal */}
        <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
          <Pressable style={styles.menuOverlay} onPress={() => setFilterOpen(false)}>
            <Pressable style={styles.menuSheet} onPress={() => {}}>
              <View style={styles.menuHandle} />
              <Text style={styles.menuTitle}>Filter notifications</Text>

              {filterPills.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    setFilter(option.key);
                    setFilterOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: option.active }}
                  style={({ pressed }) => [
                    styles.filterOption,
                    option.active && styles.filterOptionActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.filterOptionText, option.active && styles.filterOptionTextActive]}>
                    {option.label}
                  </Text>
                  <Ionicons
                    name={option.active ? "radio-button-on" : "radio-button-off"}
                    size={scale(20)}
                    color={option.active ? TC.primary : TC.muted}
                  />
                </Pressable>
              ))}

              <Pressable
                onPress={() => setFilterOpen(false)}
                style={({ pressed }) => [styles.menuCancel, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.menuCancelText}>Close</Text>
              </Pressable>

              <View style={{ height: Math.max(insets.bottom, vscale(10)) }} />
            </Pressable>
          </Pressable>
        </Modal>

        {/* Global Menu Modal */}
        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <View style={styles.quickModalRoot}>
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={() => setMenuOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close quick actions"
            />

            <View style={styles.quickModalCard}>
              <View style={styles.quickModalHeader}>
                <View style={styles.quickModalHeading}>
                  <Text style={styles.quickModalTitle}>Quick actions</Text>
                  <Text style={styles.quickModalSubtitle}>Manage all of your notifications.</Text>
                </View>
                <Pressable
                  onPress={() => setMenuOpen(false)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close quick actions"
                  style={({ pressed }) => [styles.quickModalClose, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="close" size={scale(22)} color={TC.muted} />
                </Pressable>
              </View>

              <Pressable
                onPress={markAllRead}
                style={({ pressed }) => [styles.quickActionItem, pressed && { opacity: 0.8 }]}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="checkmark-done-outline" size={scale(19)} color={TC.primary} />
                </View>
                <View style={styles.quickActionTextWrap}>
                  <Text style={styles.quickActionTitle}>Mark all as read</Text>
                  <Text style={styles.quickActionDescription}>Remove the unread status from every notification.</Text>
                </View>
                <Ionicons name="chevron-forward" size={scale(18)} color={TC.muted} />
              </Pressable>

              <Pressable
                onPress={clearAll}
                style={({ pressed }) => [styles.quickActionItem, pressed && { opacity: 0.8 }]}
              >
                <View style={[styles.quickActionIcon, styles.quickActionIconDanger]}>
                  <Ionicons name="trash-outline" size={scale(19)} color="#DC2626" />
                </View>
                <View style={styles.quickActionTextWrap}>
                  <Text style={[styles.quickActionTitle, { color: "#DC2626" }]}>Clear all</Text>
                  <Text style={styles.quickActionDescription}>Delete all notifications from this list.</Text>
                </View>
                <Ionicons name="chevron-forward" size={scale(18)} color={TC.muted} />
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Per-item Menu Modal (Long press) */}
        <Modal visible={itemMenuOpen} transparent animationType="fade" onRequestClose={closeItemMenu}>
          <Pressable style={styles.menuOverlay} onPress={closeItemMenu}>
            <Pressable style={styles.menuSheet} onPress={() => {}}>
              <View style={styles.menuHandle} />
              <Text style={styles.menuTitle}>Notification actions</Text>

              {/* Selected preview */}
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {selectedTitle}
                </Text>
                <Text style={styles.previewMsg} numberOfLines={2}>
                  {selectedMsg}
                </Text>
                <View style={styles.previewMeta}>
                  <Ionicons name="time-outline" size={scale(12)} color={TC.muted} />
                  <Text style={styles.previewTime}>{selectedTime}</Text>
                </View>
              </View>

              <Pressable
                onPress={toggleReadFromMenu}
                style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.8 }]}
                disabled={!itemMenu}
              >
                <Ionicons
                  name={itemMenu?.unread ? "mail-open-outline" : "mail-unread-outline"}
                  size={scale(18)}
                  color={TC.primary}
                />
                <Text style={styles.menuItemText}>{itemMenu?.unread ? "Mark as read" : "Mark as unread"}</Text>
              </Pressable>

              <Pressable
                onPress={deleteSingleFromMenu}
                style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.8 }]}
                disabled={!itemMenu}
              >
                <Ionicons name="trash-outline" size={scale(18)} color="#DC2626" />
                <Text style={[styles.menuItemText, { color: "#DC2626" }]}>Delete</Text>
              </Pressable>

              <View style={{ height: vscale(8) }} />

              <Pressable
                onPress={closeItemMenu}
                style={({ pressed }) => [styles.menuCancel, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.menuCancelText}>Close</Text>
              </Pressable>

              <View style={{ height: Math.max(insets.bottom, vscale(10)) }} />
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </View>
  );
}

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number, TC: ReturnType<typeof useColors>) {
  const type = createTypography(scale, vscale);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: TC.screenBg },
    page: { flex: 1, backgroundColor: TC.screenBg },

    headerBg: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: vscale(220),
    },

    topBar: {
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
      paddingHorizontal: scale(16),
      paddingTop: vscale(8),
      paddingBottom: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(12),
    },
    backBtn: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(12),
      alignItems: "center",
      justifyContent: "center",
    },

    titleRowTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
      flexWrap: "wrap",
    },
    topTitle: {
      ...type.screenTitle,
      color: TC.textDark,
    },
    subTitle: {
      ...type.caption,
      marginTop: vscale(4),
      color: TC.muted,
    },

    unreadPill: {
      paddingHorizontal: scale(10),
      paddingVertical: vscale(5),
      borderRadius: scale(999),
      backgroundColor: TC.chipBg,
      borderWidth: 1,
      borderColor: TC.divider,
    },
    unreadPillText: {
      ...type.badge,
      color: TC.primary,
    },

    caughtUpOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 20,
    },
    caughtPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(6),
      paddingHorizontal: scale(18),
      paddingVertical: vscale(12),
      borderRadius: scale(16),
      backgroundColor: TC.isDark ? "#064E3B" : "#ECFDF5",
      borderWidth: 1,
      borderColor: TC.isDark ? "#065F46" : "#BBF7D0",
      shadowColor: "#0F172A",
      shadowOpacity: 0.14,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 5,
    },
    caughtPillText: {
      ...type.label,
      color: TC.isDark ? "#6EE7B7" : "#166534",
    },

    menuBtn: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(12),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: TC.isDark ? TC.surface : "#F3F8FF",
      borderWidth: 1,
      borderColor: TC.isDark ? TC.divider : "#E7EEF7",
    },

    searchRow: {
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
      paddingHorizontal: scale(16),
      paddingTop: vscale(12),
      paddingBottom: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
    },
    searchBox: {
      flex: 1,
      height: vscale(44),
      backgroundColor: TC.isDark ? TC.surface : "#F8FBFF",
      borderRadius: scale(16),
      borderWidth: 1,
      borderColor: TC.isDark ? TC.divider : "#EEF4FF",
      paddingHorizontal: scale(12),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    searchInput: {
      ...type.input,
      flex: 1,
      color: TC.textDark,
      paddingVertical: 0,
    },
    clearQueryBtn: {
      alignItems: "center",
      justifyContent: "center",
    },
    filterBtn: {
      width: vscale(44),
      height: vscale(44),
      borderRadius: scale(16),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: TC.isDark ? TC.surface : "#F8FBFF",
      borderWidth: 1,
      borderColor: TC.isDark ? TC.divider : "#E1E8F0",
    },
    filterBtnActive: {
      backgroundColor: TC.primary,
      borderColor: TC.primary,
    },

    content: {
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
      gap: vscale(10),
      flexGrow: 1,
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
      borderColor: TC.isDark ? TC.divider : "#EEF4FF",
      backgroundColor: TC.surface,
      paddingHorizontal: scale(10),
      paddingVertical: vscale(6),
      borderRadius: scale(999),
    },
    sectionTitle: {
      ...type.overline,
      color: TC.muted,
    },

    card: {
      backgroundColor: TC.surface,
      borderWidth: 1,
      borderColor: TC.isDark ? TC.divider : "#D9DEE7",
      borderRadius: scale(14),
      overflow: "hidden",
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    cardUnread: {
      borderColor: TC.isDark ? TC.primary : "#D8E9FF",
      backgroundColor: TC.isDark ? "#1A2A3F" : "#FBFDFF",
    },
    leftRail: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: scale(4),
    },
    leftRailUnread: {
      backgroundColor: TC.primary,
    },
    leftRailRead: {
      backgroundColor: TC.divider,
    },
    cardInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
      paddingVertical: vscale(12),
      paddingHorizontal: scale(16),
      paddingLeft: scale(16) + scale(4),
    },

    iconWrap: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(14),
      backgroundColor: TC.chipBg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: TC.divider,
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    cardTitle: {
      ...type.cardTitle,
      flex: 1,
      color: TC.textDark,
    },
    cardTitleUnread: {
      color: TC.primary,
    },
    dot: {
      width: scale(8),
      height: scale(8),
      borderRadius: 999,
      backgroundColor: "#EF4444",
    },

    cardMsg: {
      ...type.caption,
      marginTop: vscale(3),
      fontStyle: "italic",
      color: TC.muted,
    },

    metaRow: {
      marginTop: vscale(7),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(6),
    },
    cardTime: {
      ...type.micro,
      color: TC.muted,
    },

    emptyCard: {
      backgroundColor: TC.surface,
      borderWidth: 1,
      borderColor: TC.isDark ? TC.divider : "#D9DEE7",
      borderRadius: scale(14),
      paddingVertical: vscale(24),
      paddingHorizontal: scale(16),
      alignItems: "center",
      justifyContent: "center",
      gap: vscale(6),
    },
    emptyTitle: {
      ...type.cardTitle,
      marginTop: vscale(6),
      color: TC.textDark,
    },
    emptyText: {
      ...type.microStrong,
      color: TC.muted,
      textAlign: "center",
    },

    centerBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(20),
      gap: vscale(10),
    },
    centerHint: {
      ...type.bodySmall,
      color: TC.muted,
      textAlign: "center",
    },
    smallHint: {
      ...type.microStrong,
      color: TC.muted,
      textAlign: "center",
    },
    errorText: {
      ...type.bodyStrong,
      color: "#B91C1C",
      textAlign: "center",
    },
    retryBtn: {
      marginTop: vscale(6),
      paddingVertical: vscale(10),
      paddingHorizontal: scale(18),
      backgroundColor: TC.actionPrimary,
      borderRadius: scale(999),
    },
    retryText: {
      ...type.captionStrong,
      color: "#FFFFFF",
    },

    quickModalRoot: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(22),
      backgroundColor: TC.overlay,
    },
    quickModalCard: {
      width: "100%",
      maxWidth: scale(360),
      borderRadius: scale(20),
      borderWidth: 1,
      borderColor: TC.divider,
      backgroundColor: TC.surface,
      paddingHorizontal: scale(18),
      paddingTop: vscale(18),
      paddingBottom: vscale(10),
      ...Platform.select({
        ios: {
          shadowColor: "#000000",
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
        },
        android: { elevation: 10 },
      }),
    },
    quickModalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: scale(12),
      marginBottom: vscale(16),
    },
    quickModalHeading: {
      flex: 1,
      minWidth: 0,
    },
    quickModalTitle: {
      ...type.sectionTitle,
      color: TC.textDark,
    },
    quickModalSubtitle: {
      ...type.caption,
      color: TC.muted,
      marginTop: vscale(4),
    },
    quickModalClose: {
      width: scale(34),
      height: scale(34),
      borderRadius: scale(11),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: TC.screenBg,
      borderWidth: 1,
      borderColor: TC.divider,
    },
    quickActionItem: {
      minHeight: vscale(62),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
      paddingHorizontal: scale(11),
      paddingVertical: vscale(10),
      borderRadius: scale(14),
      borderWidth: 1,
      borderColor: TC.divider,
      backgroundColor: TC.surface,
      marginBottom: vscale(10),
    },
    quickActionIcon: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(11),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: TC.chipBg,
    },
    quickActionIconDanger: {
      backgroundColor: TC.isDark ? "#3F1D24" : "#FEF2F2",
    },
    quickActionTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    quickActionTitle: {
      ...type.captionStrong,
      color: TC.textDark,
    },
    quickActionDescription: {
      ...type.micro,
      color: TC.muted,
      marginTop: vscale(2),
    },

    // Menu modal shared
    menuOverlay: {
      flex: 1,
      backgroundColor: TC.overlay,
      justifyContent: "flex-end",
    },
    menuSheet: {
      width: "100%",
      maxWidth: 600,
      alignSelf: "center",
      backgroundColor: TC.surface,
      borderTopLeftRadius: scale(18),
      borderTopRightRadius: scale(18),
      borderWidth: 1,
      borderColor: TC.divider,
      paddingHorizontal: scale(14),
      paddingTop: vscale(10),
    },
    menuHandle: {
      alignSelf: "center",
      width: scale(46),
      height: vscale(5),
      borderRadius: 999,
      backgroundColor: TC.divider,
      marginBottom: vscale(10),
    },
    menuTitle: {
      ...type.label,
      color: TC.textDark,
      marginBottom: vscale(10),
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
      paddingVertical: vscale(12),
      paddingHorizontal: scale(10),
      borderRadius: scale(12),
      borderWidth: 1,
      borderColor: TC.divider,
      backgroundColor: TC.surface,
      marginBottom: vscale(10),
    },
    menuItemText: {
      ...type.captionStrong,
      color: TC.textDark,
    },
    filterOption: {
      minHeight: vscale(48),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: scale(14),
      borderRadius: scale(12),
      borderWidth: 1,
      borderColor: TC.divider,
      backgroundColor: TC.surface,
      marginBottom: vscale(8),
    },
    filterOptionActive: {
      borderColor: TC.primary,
      backgroundColor: TC.chipBg,
    },
    filterOptionText: {
      ...type.captionStrong,
      color: TC.textDark,
    },
    filterOptionTextActive: {
      color: TC.primary,
    },
    menuCancel: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: vscale(12),
      borderRadius: scale(12),
      backgroundColor: TC.screenBg,
      borderWidth: 1,
      borderColor: TC.divider,
    },
    menuCancelText: {
      ...type.captionStrong,
      color: TC.muted,
    },

    // Selected notification preview inside item menu
    previewCard: {
      borderWidth: 1,
      borderColor: TC.divider,
      backgroundColor: TC.screenBg,
      borderRadius: scale(14),
      paddingVertical: vscale(12),
      paddingHorizontal: scale(12),
      marginBottom: vscale(10),
    },
    previewTitle: {
      ...type.captionStrong,
      color: TC.textDark,
    },
    previewMsg: {
      ...type.microStrong,
      marginTop: vscale(4),
      color: TC.muted,
    },
    previewMeta: {
      marginTop: vscale(8),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(6),
    },
    previewTime: {
      ...type.badge,
      color: TC.muted,
    },
  });
}
