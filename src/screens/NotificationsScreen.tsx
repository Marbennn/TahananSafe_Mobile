// src/screens/NotificationsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { useNavigation } from "@react-navigation/native";

import {
  fetchMyNotifications,
  markAllNotificationsRead,
  toggleNotificationRead,
  clearAllNotifications,
  type NotificationItem,
  type NotifType,
} from "../api/notifications";

import { getAccessToken } from "../auth/session";
import type { ReportItem } from "./ReportScreen";

type Props = {
  onBack: () => void;
};

const BG = "#F5FAFE";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";

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

  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];
  return `${months[d.getMonth()]} ${d.getDate()} • ${time}`;
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

// ✅ Fetch report detail (owned by user) using your backend:
// GET /api/mobile/v1/reports/:id  -> { report: incident }
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

  // minimal mapping that ReportDetailScreen can display
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

export default function NotificationsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<any>();

  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  const unreadCount = useMemo(() => items.filter((i) => i.unread).length, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.title} ${i.message} ${i.time}`.toLowerCase().includes(q));
  }, [items, query]);

  const load = useCallback(async () => {
    try {
      setErrorMsg("");
      setLoading(true);
      const list = await fetchMyNotifications(80);
      const mapped = list.map((n) => ({ ...n, time: formatTimeLabel(n.time) }));
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
      const list = await fetchMyNotifications(80);
      setItems(list.map((n) => ({ ...n, time: formatTimeLabel(n.time) })));
    } catch (e: any) {
      setErrorMsg(e?.message ? String(e.message) : "Failed to refresh notifications.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      setItems((prev) => prev.map((x) => ({ ...x, unread: false })));
      await markAllNotificationsRead();
    } catch (e: any) {
      await load();
      setErrorMsg(e?.message ? String(e.message) : "Failed to mark all as read.");
    }
  }, [load]);

  const clearAll = useCallback(async () => {
    try {
      setItems([]);
      await clearAllNotifications();
    } catch (e: any) {
      await load();
      setErrorMsg(e?.message ? String(e.message) : "Failed to clear notifications.");
    }
  }, [load]);

  // ✅ When user taps a notification:
  // - mark as read (only if unread)
  // - if has incidentId -> fetch report detail -> navigate to Main with param openReport
  const openNotification = useCallback(
    async (n: NotificationItem) => {
      try {
        if (openingId) return;
        setOpeningId(n.id);

        // mark read only if unread (toggle endpoint)
        if (n.unread) {
          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
          try {
            await toggleNotificationRead(n.id);
          } catch {
            // non-fatal; continue
          }
        }

        if (!n.incidentId) {
          // if it's system notif, just do nothing
          return;
        }

        const report = await fetchMyReportDetailAsReportItem(n.incidentId);

        // ✅ Navigate back to Main and tell MainShell to open this report
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
  const CONTENT_BOTTOM_PAD = bottomPad + vscale(16);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={scale(22)} color={Colors.primary} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.topTitle}>Notifications</Text>
            {unreadCount > 0 ? (
              <Text style={styles.subTitle}>{unreadCount} unread</Text>
            ) : (
              <Text style={styles.subTitle}>All caught up</Text>
            )}
          </View>

          <Pressable
            onPress={markAllRead}
            hitSlop={10}
            style={({ pressed }) => [styles.markBtn, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.markText}>Mark all</Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={scale(18)} color="#9AA4B2" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor="#9AA4B2"
              style={styles.searchInput}
              returnKeyType="search"
            />
          </View>

          <Pressable
            onPress={clearAll}
            hitSlop={10}
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="trash-outline" size={scale(18)} color="#9AA4B2" />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.centerHint}>Loading notifications…</Text>
            <Text style={styles.smallHint} numberOfLines={2}>
              {Platform.OS === "android" ? "Android" : "iOS"} • using Bearer token
            </Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Pressable
              onPress={load}
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
          >
            {filtered.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="notifications-off-outline" size={scale(30)} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No notifications</Text>
                <Text style={styles.emptyText}>You don’t have any notifications yet.</Text>
              </View>
            ) : (
              filtered.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => openNotification(n)}
                  disabled={openingId === n.id}
                  style={({ pressed }) => [
                    styles.card,
                    pressed && { opacity: 0.96, transform: [{ scale: 0.995 }] },
                    openingId === n.id && { opacity: 0.75 },
                  ]}
                >
                  <View style={styles.iconWrap}>
                    <Ionicons name={iconForType(n.type)} size={scale(20)} color={Colors.primary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[styles.cardTitle, n.unread && styles.cardTitleUnread]}
                        numberOfLines={1}
                      >
                        {n.title}
                      </Text>
                      {n.unread ? <View style={styles.dot} /> : null}
                    </View>

                    <Text style={styles.cardMsg} numberOfLines={2}>
                      {n.message}
                    </Text>
                    <Text style={styles.cardTime}>{n.time}</Text>
                  </View>

                  {openingId === n.id ? (
                    <ActivityIndicator size="small" color="#94A3B8" />
                  ) : (
                    <Ionicons name="chevron-forward" size={scale(18)} color="#94A3B8" />
                  )}
                </Pressable>
              ))
            )}

            {filtered.length > 0 ? <View style={{ height: vscale(6) }} /> : null}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const SEARCH_H = vscale(36);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    topBar: {
      paddingHorizontal: scale(14),
      paddingTop: vscale(6),
      paddingBottom: vscale(10),
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
    topTitle: {
      fontSize: scale(22),
      fontWeight: "900",
      color: TEXT_DARK,
    },
    subTitle: {
      marginTop: vscale(1),
      fontSize: scale(11),
      fontWeight: "800",
      color: "#94A3B8",
    },
    markBtn: {
      height: scale(36),
      paddingHorizontal: scale(12),
      borderRadius: scale(12),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
    },
    markText: {
      fontSize: scale(11),
      fontWeight: "900",
      color: Colors.primary,
    },

    searchRow: {
      paddingHorizontal: scale(14),
      paddingTop: vscale(6),
      paddingBottom: vscale(8),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
    },
    searchBox: {
      flex: 1,
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
    clearBtn: {
      width: SEARCH_H,
      height: SEARCH_H,
      borderRadius: Math.round(SEARCH_H / 2),
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: "center",
      justifyContent: "center",
    },

    content: {
      paddingHorizontal: scale(14),
      paddingTop: vscale(6),
      gap: vscale(10),
    },

    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: scale(14),
      paddingVertical: vscale(12),
      paddingHorizontal: scale(12),
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    iconWrap: {
      width: scale(38),
      height: scale(38),
      borderRadius: scale(12),
      backgroundColor: "#F2F6FF",
      alignItems: "center",
      justifyContent: "center",
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
    cardTime: {
      marginTop: vscale(6),
      fontSize: scale(9),
      fontWeight: "800",
      color: "#94A3B8",
    },

    emptyCard: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: scale(14),
      paddingVertical: vscale(22),
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
  });
}