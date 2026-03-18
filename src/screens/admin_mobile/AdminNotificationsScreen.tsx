// src/screens/admin_mobile/AdminNotificationsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  SectionList,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, useColors } from "../../theme/colors";

import {
  fetchMyNotificationsCombined,
  markAllNotificationsReadCombined,
  toggleNotificationReadCombined,
  clearAllNotificationsCombined,
  deleteNotificationCombined,
  type NotificationItem,
  type NotifType,
} from "../../api/notifications";

import { getAccessToken } from "../../auth/session";
import type { ReportItem } from "../ReportScreen";

type Props = {
  onBack: () => void;
  onOpenReport?: (report: ReportItem) => void;
};

const BG = "#F5FAFE";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";
const SUBTLE = "#64748B";

type FilterKey = "all" | "unread" | "alert" | "report" | "info";

function iconForType(t: NotifType): keyof typeof Ionicons.glyphMap {
  if (t === "alert") return "warning-outline";
  if (t === "report") return "document-text-outline";
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

  if (isSameDay) return `Today • ${time}`;
  if (isYesterday) return `Yesterday • ${time}`;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()} • ${time}`;
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
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.replace(/\/+$/, "");
  }
  if (Platform.OS === "android") return "http://10.0.2.2:8000";
  return "http://localhost:8000";
}

const API_BASE_URL = getApiBaseUrl();

function normalizeStatus(dbStatus?: string): ReportItem["status"] {
  const s = String(dbStatus ?? "").trim().toLowerCase();
  if (s === "submitted" || s === "pending") return "PENDING";
  if (s === "reviewing" || s === "ongoing" || s === "on going" || s === "in_progress" || s === "in progress")
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
  return "";
}

async function parseJsonSafe(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

async function fetchMyReportDetailAsReportItem(incidentId: string): Promise<ReportItem> {
  const token = await getAccessToken();
  if (!token) throw new Error("Please login again. (Missing access token)");

  const url = `${API_BASE_URL}/api/mobile/v1/reports/${encodeURIComponent(incidentId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);

  const doc = data?.report ?? data?.incident ?? data;
  if (!doc?._id && !doc?.id) throw new Error("Unexpected response: missing report");

  const id = String(doc?._id ?? doc?.id ?? "");
  const incidentType = String(doc?.incidentType ?? "") || "Incident Report";
  const details = String(doc?.details ?? "") || "—";
  const offenderName = String(doc?.offenderName ?? "");
  const dateLeft = String(doc?.dateStr ?? "") || "—";
  const timeLeft = String(doc?.timeStr ?? "") || "—";

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
    dateRight: "—",
    timeRight: "—",
    status: normalizeStatus(doc?.status),
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
  _ts: number;
};

type SectionT = { title: string; data: NotifVM[]; sortKey: number };

export default function AdminNotificationsScreen({ onBack, onOpenReport }: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<NotifVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>("all");

  const [menuOpen, setMenuOpen] = useState(false);

  const [itemMenuOpen, setItemMenuOpen] = useState(false);
  const [itemMenu, setItemMenu] = useState<NotifVM | null>(null);

  const unreadCount = useMemo(() => items.filter((i) => i.unread).length, [items]);

  const load = useCallback(async () => {
    try {
      setErrorMsg("");
      setLoading(true);
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
    } catch (e: any) {
      setErrorMsg(e?.message ? String(e.message) : "Failed to load notifications.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMsg("");
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
    } catch (e: any) {
      setErrorMsg(e?.message ? String(e.message) : "Failed to refresh notifications.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const applyFilter = useCallback(
    (list: NotifVM[]) => {
      let out = list;

      if (filter === "unread") out = out.filter((n) => n.unread);
      if (filter === "alert") out = out.filter((n) => n.type === "alert");
      if (filter === "report") out = out.filter((n) => n.type === "report");
      if (filter === "info") out = out.filter((n) => n.type !== "alert" && n.type !== "report");

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
            await clearAllNotificationsCombined();
          } catch (e: any) {
            await load();
            setErrorMsg(e?.message ? String(e.message) : "Failed to clear notifications.");
          }
        },
      },
    ]);
  }, [load]);

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
          const snapshot = items;
          setItems((prev) => prev.filter((x) => x.id !== n.id));

          try {
            await deleteNotificationCombined(n.id);
          } catch (e: any) {
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
        onOpenReport?.(report);
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : "Failed to open notification.";
        Alert.alert("Open failed", msg);
      } finally {
        setOpeningId(null);
      }
    },
    [onOpenReport, openingId]
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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

      <View style={styles.page}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={scale(22)} color={Colors.primary} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <View style={styles.titleRowTop}>
              <Text style={styles.topTitle}>Notifications</Text>
              {unreadCount > 0 ? (
                <View style={styles.unreadPill}>
                  <Text style={styles.unreadPillText}>{unreadCount} new</Text>
                </View>
              ) : (
                <View style={styles.caughtPill}>
                  <Ionicons name="checkmark-circle-outline" size={scale(14)} color="#16A34A" />
                  <Text style={styles.caughtPillText}>All caught up</Text>
                </View>
              )}
            </View>
            <Text style={styles.subTitle}>Tap to open • Long press for actions</Text>
          </View>

          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={10}
            style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="ellipsis-horizontal" size={scale(18)} color={SUBTLE} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={scale(18)} color="#9AA4B2" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search notifications"
              placeholderTextColor="#9AA4B2"
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
                <Ionicons name="close-circle" size={scale(18)} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersRow}>
          {filterPills.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setFilter(p.key)}
              style={({ pressed }) => [styles.pill, p.active && styles.pillActive, pressed && { opacity: 0.9 }]}
            >
              <Text style={[styles.pillText, p.active && styles.pillTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.centerHint}>Loading notifications…</Text>
            <Text style={styles.smallHint} numberOfLines={2}>
              {Platform.OS === "android" ? "Android" : "iOS"} • combined (local + backend)
            </Text>
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
            ListEmptyComponent={
              listEmpty ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="notifications-off-outline" size={scale(30)} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No notifications</Text>
                  <Text style={styles.emptyText}>You don't have any notifications yet.</Text>
                </View>
              ) : null
            }
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionLine} />
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
                      <Ionicons name={iconForType(n.type)} size={scale(20)} color={Colors.primary} />
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
                        <Ionicons name="time-outline" size={scale(12)} color="#94A3B8" />
                        <Text style={styles.cardTime}>{n.timeLabel}</Text>
                      </View>
                    </View>

                    {isBusy ? (
                      <ActivityIndicator size="small" color="#94A3B8" />
                    ) : (
                      <Ionicons name="chevron-forward" size={scale(18)} color="#94A3B8" />
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {/* Global Menu Modal */}
        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
            <Pressable style={styles.menuSheet} onPress={() => {}}>
              <View style={styles.menuHandle} />
              <Text style={styles.menuTitle}>Quick actions</Text>

              <Pressable onPress={markAllRead} style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.8 }]}>
                <Ionicons name="checkmark-done-outline" size={scale(18)} color={Colors.primary} />
                <Text style={styles.menuItemText}>Mark all as read</Text>
              </Pressable>

              <Pressable onPress={clearAll} style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.8 }]}>
                <Ionicons name="trash-outline" size={scale(18)} color="#DC2626" />
                <Text style={[styles.menuItemText, { color: "#DC2626" }]}>Clear all</Text>
              </Pressable>

              <View style={{ height: vscale(8) }} />

              <Pressable
                onPress={() => setMenuOpen(false)}
                style={({ pressed }) => [styles.menuCancel, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.menuCancelText}>Close</Text>
              </Pressable>

              <View style={{ height: Math.max(insets.bottom, vscale(10)) }} />
            </Pressable>
          </Pressable>
        </Modal>

        {/* Per-item Menu Modal (Long press) */}
        <Modal visible={itemMenuOpen} transparent animationType="fade" onRequestClose={closeItemMenu}>
          <Pressable style={styles.menuOverlay} onPress={closeItemMenu}>
            <Pressable style={styles.menuSheet} onPress={() => {}}>
              <View style={styles.menuHandle} />
              <Text style={styles.menuTitle}>Notification actions</Text>

              <View style={styles.previewCard}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {selectedTitle}
                </Text>
                <Text style={styles.previewMsg} numberOfLines={2}>
                  {selectedMsg}
                </Text>
                <View style={styles.previewMeta}>
                  <Ionicons name="time-outline" size={scale(12)} color="#94A3B8" />
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
                  color={Colors.primary}
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
    </SafeAreaView>
  );
}

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const SEARCH_H = vscale(40);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    topBar: {
      paddingHorizontal: scale(14),
      paddingTop: vscale(14),
      paddingBottom: vscale(18),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
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
      fontSize: scale(22),
      fontWeight: "900",
      color: TEXT_DARK,
    },
    subTitle: {
      marginTop: vscale(2),
      fontSize: scale(11),
      fontWeight: "700",
      color: "#94A3B8",
    },

    unreadPill: {
      paddingHorizontal: scale(10),
      paddingVertical: vscale(5),
      borderRadius: scale(999),
      backgroundColor: "#EEF6FF",
      borderWidth: 1,
      borderColor: "#D8E9FF",
    },
    unreadPillText: {
      fontSize: scale(10),
      fontWeight: "900",
      color: Colors.primary,
    },

    caughtPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(6),
      paddingHorizontal: scale(10),
      paddingVertical: vscale(5),
      borderRadius: scale(999),
      backgroundColor: "#ECFDF5",
      borderWidth: 1,
      borderColor: "#BBF7D0",
    },
    caughtPillText: {
      fontSize: scale(10),
      fontWeight: "900",
      color: "#166534",
    },

    menuBtn: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(12),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
    },

    searchRow: {
      paddingHorizontal: scale(14),
      paddingTop: vscale(2),
      paddingBottom: vscale(8),
    },
    searchBox: {
      height: SEARCH_H,
      backgroundColor: "#FFFFFF",
      borderRadius: Math.round(SEARCH_H / 2),
      borderWidth: 1,
      borderColor: BORDER,
      paddingHorizontal: scale(12),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    searchInput: {
      flex: 1,
      fontSize: scale(13),
      color: "#111827",
      paddingVertical: 0,
      fontWeight: "600",
    },
    clearQueryBtn: {
      alignItems: "center",
      justifyContent: "center",
    },

    filtersRow: {
      paddingHorizontal: scale(14),
      paddingBottom: vscale(10),
      flexDirection: "row",
      flexWrap: "wrap",
      gap: scale(8),
    },
    pill: {
      paddingHorizontal: scale(12),
      paddingVertical: vscale(7),
      borderRadius: scale(999),
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
    },
    pillActive: {
      backgroundColor: "#EEF6FF",
      borderColor: "#D8E9FF",
    },
    pillText: {
      fontSize: scale(11),
      fontWeight: "900",
      color: "#475569",
    },
    pillTextActive: {
      color: Colors.primary,
    },

    content: {
      paddingHorizontal: scale(14),
      paddingTop: vscale(2),
      gap: vscale(10),
    },

    sectionHeader: {
      paddingTop: vscale(6),
      paddingBottom: vscale(6),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
    },
    sectionTitle: {
      fontSize: scale(12),
      fontWeight: "900",
      color: "#334155",
    },
    sectionLine: {
      flex: 1,
      height: 1,
      backgroundColor: "#E2E8F0",
    },

    card: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: scale(16),
      overflow: "hidden",
    },
    cardUnread: {
      borderColor: "#D8E9FF",
      backgroundColor: "#FBFDFF",
    },
    leftRail: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: scale(4),
    },
    leftRailUnread: {
      backgroundColor: Colors.primary,
    },
    leftRailRead: {
      backgroundColor: "#E5E7EB",
    },
    cardInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
      paddingVertical: vscale(12),
      paddingHorizontal: scale(12),
      paddingLeft: scale(12) + scale(4),
    },

    iconWrap: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(14),
      backgroundColor: "#F2F6FF",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#E5EDFF",
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    cardTitle: {
      flex: 1,
      fontSize: scale(12),
      fontWeight: "900",
      color: "#1F2A37",
    },
    cardTitleUnread: {
      color: Colors.primary,
    },
    dot: {
      width: scale(8),
      height: scale(8),
      borderRadius: 999,
      backgroundColor: "#EF4444",
    },

    cardMsg: {
      marginTop: vscale(3),
      fontSize: scale(10),
      fontWeight: "700",
      color: "#6B7280",
      lineHeight: vscale(14),
    },

    metaRow: {
      marginTop: vscale(7),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(6),
    },
    cardTime: {
      fontSize: scale(9),
      fontWeight: "800",
      color: "#94A3B8",
    },

    emptyCard: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: scale(16),
      paddingVertical: vscale(24),
      paddingHorizontal: scale(16),
      alignItems: "center",
      justifyContent: "center",
      gap: vscale(6),
    },
    emptyTitle: {
      marginTop: vscale(6),
      fontSize: scale(14),
      fontWeight: "900",
      color: "#1F2A37",
    },
    emptyText: {
      fontSize: scale(11),
      fontWeight: "700",
      color: "#6B7280",
      textAlign: "center",
      lineHeight: vscale(16),
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

    menuOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.25)",
      justifyContent: "flex-end",
    },
    menuSheet: {
      backgroundColor: "#FFFFFF",
      borderTopLeftRadius: scale(18),
      borderTopRightRadius: scale(18),
      borderWidth: 1,
      borderColor: BORDER,
      paddingHorizontal: scale(14),
      paddingTop: vscale(10),
    },
    menuHandle: {
      alignSelf: "center",
      width: scale(46),
      height: vscale(5),
      borderRadius: 999,
      backgroundColor: "#E2E8F0",
      marginBottom: vscale(10),
    },
    menuTitle: {
      fontSize: scale(13),
      fontWeight: "900",
      color: "#0F172A",
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
      borderColor: BORDER,
      backgroundColor: "#FFFFFF",
      marginBottom: vscale(10),
    },
    menuItemText: {
      fontSize: scale(12),
      fontWeight: "900",
      color: "#0F172A",
    },
    menuCancel: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: vscale(12),
      borderRadius: scale(12),
      backgroundColor: "#F8FAFC",
      borderWidth: 1,
      borderColor: BORDER,
    },
    menuCancelText: {
      fontSize: scale(12),
      fontWeight: "900",
      color: "#334155",
    },

    previewCard: {
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: "#F8FAFC",
      borderRadius: scale(14),
      paddingVertical: vscale(12),
      paddingHorizontal: scale(12),
      marginBottom: vscale(10),
    },
    previewTitle: {
      fontSize: scale(12),
      fontWeight: "900",
      color: "#0F172A",
    },
    previewMsg: {
      marginTop: vscale(4),
      fontSize: scale(10),
      fontWeight: "700",
      color: "#475569",
      lineHeight: vscale(14),
    },
    previewMeta: {
      marginTop: vscale(8),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(6),
    },
    previewTime: {
      fontSize: scale(9),
      fontWeight: "800",
      color: "#94A3B8",
    },
  });
}
