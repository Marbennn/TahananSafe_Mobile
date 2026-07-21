// src/screens/admin_mobile/AdminAlertsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import AdminBotNav, { TabKey } from "../../components/AdminComponents/AdminBotNav";
import { Colors, useColors } from "../../theme/colors";
import {
  fetchMyNotificationsCombined,
  toggleNotificationReadCombined,
  type NotificationItem,
} from "../../api/notifications";

const BG = "#F5FAFE";
const SURFACE = "#FFFFFF";
const BORDER = "#E7EEF7";
const TEXT = "#0B2B45";
const MUTED = "#6B7280";
const SUBTLE = "#9AA4B2";

type AlertSeverity = "Critical" | "High" | "Moderate" | "Low" | "Info";

type AlertItem = {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  time: string;
  date: string;
  read: boolean;
  source: string;
  ts: number;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  senderName?: string | null;
};

type FilterKey = "All" | "Unread" | "Critical";

type Props = {
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
  onFabPress?: () => void;
};

const FILTERS: FilterKey[] = ["All", "Unread", "Critical"];

function getSeverityColor(severity: AlertSeverity) {
  switch (severity) {
    case "Critical":
      return "#F04452";
    case "High":
      return "#F5B301";
    case "Moderate":
      return "#FB923C";
    case "Low":
      return "#35B56A";
    case "Info":
      return "#3B82F6";
  }
}

function getSeverityBg(severity: AlertSeverity) {
  switch (severity) {
    case "Critical":
      return "#FFF0F1";
    case "High":
      return "#FFFBEB";
    case "Moderate":
      return "#FFF7ED";
    case "Low":
      return "#F0FDF4";
    case "Info":
      return "#EFF6FF";
  }
}

function getSeverityIcon(severity: AlertSeverity): keyof typeof Ionicons.glyphMap {
  switch (severity) {
    case "Critical":
      return "alert-circle";
    case "High":
      return "warning";
    case "Moderate":
      return "alert";
    case "Low":
      return "information-circle-outline";
    case "Info":
      return "information-circle-outline";
  }
}

function getSeverityFromNotification(n: NotificationItem): AlertSeverity {
  const hay = `${n.title} ${n.message}`.toLowerCase();
  if (hay.includes("critical") || hay.includes("sos") || hay.includes("immediate")) return "Critical";
  if (hay.includes("high") || hay.includes("urgent") || hay.includes("escalat")) return "High";
  if (hay.includes("moderate") || hay.includes("medium")) return "Moderate";
  if (hay.includes("low")) return "Low";
  return "High";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function inferSource(n: NotificationItem) {
  if (n.incidentId) return `Incident #${n.incidentId.slice(-5)}`;
  return "Alert System";
}

function toAlertItem(n: NotificationItem): AlertItem {
  const d = new Date(n.time);
  const ts = Number.isNaN(d.getTime()) ? 0 : d.getTime();
  return {
    id: n.id,
    title: n.title || "Alert",
    description: n.message || "",
    severity: getSeverityFromNotification(n),
    time: formatTime(n.time),
    date: formatDate(n.time),
    read: !n.unread,
    source: inferSource(n),
    ts,
    latitude: n.meta?.latitude ?? null,
    longitude: n.meta?.longitude ?? null,
    address: n.meta?.address ?? null,
    senderName: n.meta?.senderName ?? null,
  };
}

// ── Leaflet map HTML builder (same as AdminHomeScreen) ──
function buildLeafletHtml(
  userLat: number | null,
  userLng: number | null,
  adminLat: number | null,
  adminLng: number | null,
  senderName: string,
  address: string,
): string {
  const hasUser = userLat != null && userLng != null;
  const hasAdmin = adminLat != null && adminLng != null;
  const hasBoth = hasUser && hasAdmin;

  let centerLat = 12.8797;
  let centerLng = 121.774;
  let zoom = 6;

  if (hasBoth) {
    centerLat = (userLat + adminLat) / 2;
    centerLng = (userLng + adminLng) / 2;
    zoom = 13;
  } else if (hasUser) {
    centerLat = userLat;
    centerLng = userLng;
    zoom = 16;
  } else if (hasAdmin) {
    centerLat = adminLat;
    centerLng = adminLng;
    zoom = 16;
  }

  // ✅ SECURITY FIX: Proper HTML entity encoding to prevent XSS
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;")
     .replace(/</g, "&lt;")
     .replace(/>/g, "&gt;")
     .replace(/"/g, "&quot;")
     .replace(/'/g, "&#39;");

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
    .legend {
      background: #fff; padding: 8px 12px; border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2); font: 13px/1.4 sans-serif;
    }
    .legend-row { display: flex; align-items: center; gap: 6px; margin: 3px 0; }
    .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    .dot-red { background: #DC2626; }
    .dot-blue { background: #2563EB; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLng}], ${zoom});
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '\\u00a9 OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    var redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    var blueIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });

    var bounds = [];

    ${hasUser ? `
    var userMarker = L.marker([${userLat}, ${userLng}], { icon: redIcon }).addTo(map);
    userMarker.bindPopup('<b>${esc(senderName)} (Alert)</b>${address ? "<br/>" + esc(address) : ""}').openPopup();
    bounds.push([${userLat}, ${userLng}]);
    ` : ""}

    ${hasAdmin ? `
    var adminMarker = L.marker([${adminLat}, ${adminLng}], { icon: blueIcon }).addTo(map);
    adminMarker.bindPopup('<b>You (Admin)</b><br/>Your current location');
    bounds.push([${adminLat}, ${adminLng}]);
    ` : ""}

    ${hasBoth ? `
    fetch('https://router.project-osrm.org/route/v1/driving/${adminLng},${adminLat};${userLng},${userLat}?overview=full&geometries=geojson')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.routes && data.routes.length > 0) {
          var coords = data.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
          L.polyline(coords, { color: '#07519C', weight: 4, opacity: 0.8 }).addTo(map);
          var dist = data.routes[0].distance;
          var dur = data.routes[0].duration;
          var distKm = (dist / 1000).toFixed(1);
          var durMin = Math.ceil(dur / 60);
          var info = L.control({ position: 'bottomleft' });
          info.onAdd = function() {
            var div = L.DomUtil.create('div', 'legend');
            div.innerHTML = '<b>' + distKm + ' km</b> &bull; ~' + durMin + ' min drive';
            return div;
          };
          info.addTo(map);
          map.fitBounds(coords, { padding: [50, 50], maxZoom: 16 });
        }
      })
      .catch(function() {
        L.polyline([[${userLat}, ${userLng}], [${adminLat}, ${adminLng}]], {
          color: '#07519C', weight: 3, opacity: 0.6, dashArray: '8, 8'
        }).addTo(map);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      });
    ` : ""}

    if (bounds.length === 2) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }

    var legend = L.control({ position: 'topright' });
    legend.onAdd = function() {
      var div = L.DomUtil.create('div', 'legend');
      div.innerHTML =
        '<div class="legend-row"><span class="dot dot-red"></span> Alert Location</div>' +
        '<div class="legend-row"><span class="dot dot-blue"></span> Your Location</div>';
      return div;
    };
    legend.addTo(map);
  <\/script>
</body>
</html>`;
}

export default function AdminAlertsScreen({
  onTabChange,
  initialTab = "Inbox",
  onFabPress,
}: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const wScale = Math.min(Math.max(Math.min(width / 375, height / 700), 0.86), 1.2);
  const hScale = Math.min(Math.max(height / 812, 0.76), 1.12);
  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [filter, setFilter] = useState<FilterKey>("All");
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Map modal state ──
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [adminCoords, setAdminCoords] = useState<{ lat: number; lng: number } | null>(null);

  const NAV_BASE_HEIGHT = height < 500 ? 66 : 78;
  const FAB_SIZE = 62;
  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;
  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;
  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + 6;

  const unreadCount = alerts.filter((a) => !a.read).length;

  const filtered = useMemo(() => {
    if (filter === "Unread") return alerts.filter((a) => !a.read);
    if (filter === "Critical") {
      return alerts.filter((a) => a.severity === "Critical" || a.severity === "High");
    }
    return alerts;
  }, [filter, alerts]);

  const loadAlerts = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg("");
    try {
      const list = await fetchMyNotificationsCombined(200);
      const mapped = list
        .filter((n) => n.type === "alert")
        .map(toAlertItem)
        .sort((a, b) => b.ts - a.ts);
      setAlerts(mapped);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load alerts.");
      setAlerts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAlerts(true);
  }, [loadAlerts]);

  const markAllRead = useCallback(async () => {
    const unreadIds = alerts.filter((a) => !a.read).map((a) => a.id);
    if (unreadIds.length === 0) return;

    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    try {
      await Promise.all(unreadIds.map((id) => toggleNotificationReadCombined(id)));
    } catch (e: any) {
      await loadAlerts(true);
      setErrorMsg(e?.message || "Failed to mark alerts as read.");
    }
  }, [alerts, loadAlerts]);

  const openAlert = useCallback(
    async (alertId: string, alreadyRead: boolean) => {
      // Mark as read
      if (!alreadyRead) {
        setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
        try {
          await toggleNotificationReadCombined(alertId);
        } catch (e: any) {
          await loadAlerts(true);
          setErrorMsg(e?.message || "Failed to update alert.");
        }
      }

      // Open map modal
      const alert = alerts.find((a) => a.id === alertId);
      if (alert) {
        setSelectedAlert(alert);
        // Fetch admin location
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setAdminCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          }
        } catch {
          // ignore location errors
        }
      }
    },
    [loadAlerts, alerts]
  );

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const styles = useMemo(
    () => makeStyles(scale, vscale, height),
    [width, height]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Alerts</Text>
              <Text style={styles.subtitle}>All alert notifications</Text>
            </View>
            {unreadCount > 0 && (
              <Pressable
                onPress={() => void markAllRead()}
                style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.7 }]}
                hitSlop={10}
              >
                <Text style={styles.markAllText}>Mark all read</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f;
            const badge = f === "Unread" ? unreadCount : undefined;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{f}</Text>
                {badge != null && badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {!loading && !!errorMsg && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText} numberOfLines={2}>
              {errorMsg}
            </Text>
            <Pressable onPress={() => void loadAlerts()} hitSlop={8}>
              <Text style={styles.errorRetry}>Retry</Text>
            </Pressable>
          </View>
        )}

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {loading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.emptyTitle}>Loading alerts</Text>
              <Text style={styles.emptyText}>Please wait while alerts are fetched.</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="notifications-off-outline" size={scale(36)} color={SUBTLE} />
              <Text style={styles.emptyTitle}>No alerts</Text>
              <Text style={styles.emptyText}>You are all caught up.</Text>
            </View>
          ) : (
            filtered.map((alert) => (
              <Pressable
                key={alert.id}
                style={({ pressed }) => [
                  styles.card,
                  !alert.read && styles.cardUnread,
                  pressed && { opacity: 0.88 },
                ]}
                onPress={() => void openAlert(alert.id, alert.read)}
              >
                {!alert.read && <View style={styles.unreadDot} />}

                <View
                  style={[
                    styles.severityIcon,
                    { backgroundColor: getSeverityBg(alert.severity) },
                  ]}
                >
                  <Ionicons
                    name={getSeverityIcon(alert.severity)}
                    size={scale(18)}
                    color={getSeverityColor(alert.severity)}
                  />
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text
                      style={[styles.cardTitle, !alert.read && styles.cardTitleUnread]}
                      numberOfLines={1}
                    >
                      {alert.title}
                    </Text>
                    <View
                      style={[
                        styles.severityPill,
                        { backgroundColor: getSeverityBg(alert.severity) },
                      ]}
                    >
                      <Text
                        style={[
                          styles.severityLabel,
                          { color: getSeverityColor(alert.severity) },
                        ]}
                      >
                        {alert.severity}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {alert.description}
                  </Text>

                  <View style={styles.cardMeta}>
                    <Ionicons name="location-outline" size={scale(11)} color={SUBTLE} />
                    <Text style={styles.metaText}>{alert.source}</Text>
                    <Text style={styles.metaDot}>|</Text>
                    <Text style={styles.metaText}>{alert.time || "-"}</Text>
                    <Text style={styles.metaDot}>|</Text>
                    <Text style={styles.metaText}>{alert.date}</Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>

        {/* ── Alert Detail Modal with Map ── */}
        <Modal
          visible={!!selectedAlert}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedAlert(null)}
          statusBarTranslucent
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}>
            {/* Top bar */}
            <SafeAreaView edges={["top"]} style={{ backgroundColor: Colors.primary }}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setSelectedAlert(null)} hitSlop={12} style={{ marginRight: 12 }}>
                  <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: "#FFFFFF" }} allowFontScaling={false} numberOfLines={1}>
                    {selectedAlert?.title ?? "SOS Alert"}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.8)", marginTop: 2 }} allowFontScaling={false}>
                    {selectedAlert?.date ?? ""} {selectedAlert?.time ? `• ${selectedAlert.time}` : ""}
                  </Text>
                </View>
              </View>
            </SafeAreaView>

            {/* Map via WebView + OpenStreetMap */}
            <View style={{ flex: 1 }}>
              <WebView
                style={{ flex: 1 }}
                originWhitelist={["https://*"]}
                javaScriptEnabled
                source={{ html: buildLeafletHtml(
                  selectedAlert?.latitude ?? null,
                  selectedAlert?.longitude ?? null,
                  adminCoords?.lat ?? null,
                  adminCoords?.lng ?? null,
                  selectedAlert?.senderName ?? "SOS Alert",
                  selectedAlert?.address ?? "",
                ) }}
              />
            </View>

            {/* Bottom info card */}
            <SafeAreaView edges={["bottom"]} style={styles.modalBottomSafe}>
              <ScrollView
                style={styles.modalInfoScroll}
                contentContainerStyle={styles.modalInfoContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="warning" size={20} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }} allowFontScaling={false} numberOfLines={1}>
                      {selectedAlert?.senderName ?? "Unknown Sender"}
                    </Text>
                    <Text
                      style={{ fontSize: 12, fontWeight: "500", color: "#64748B", marginTop: 2 }}
                      allowFontScaling={false}
                    >
                      {selectedAlert?.description ?? ""}
                    </Text>
                  </View>
                </View>

                {selectedAlert?.address ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Ionicons name="location" size={16} color={Colors.primary} />
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: "#334155" }} allowFontScaling={false} numberOfLines={2}>
                      {selectedAlert.address}
                    </Text>
                  </View>
                ) : null}

                {selectedAlert?.latitude == null || selectedAlert?.longitude == null ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10, backgroundColor: "#FEF3C7", borderRadius: 8, padding: 10 }}>
                    <Ionicons name="alert-circle" size={16} color="#D97706" />
                    <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: "#92400E" }} allowFontScaling={false}>
                      Location coordinates not available for this alert.
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => setSelectedAlert(null)}
                  style={({ pressed }) => [{
                    backgroundColor: Colors.primary,
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: "center" as const,
                    opacity: pressed ? 0.85 : 1,
                    marginTop: 4,
                  }]}
                >
                  <Text style={{ fontSize: 14, fontWeight: "800", color: "#FFFFFF" }} allowFontScaling={false}>
                    Dismiss
                  </Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>

        <AdminBotNav
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={onFabPress ?? (() => {})}
          centerLabel="Admin Menu"
          Chevron={undefined}
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number,
  height: number
) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    header: {
      width: "100%",
      maxWidth: 880,
      alignSelf: "center",
      paddingHorizontal: scale(16),
      paddingTop: vscale(8),
      paddingBottom: vscale(4),
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      fontSize: scale(28),
      fontWeight: "900",
      color: TEXT,
      letterSpacing: 0.2,
    },
    subtitle: {
      marginTop: vscale(3),
      fontSize: scale(13),
      fontWeight: "400",
      color: MUTED,
    },
    markAllBtn: {
      paddingHorizontal: scale(12),
      paddingVertical: vscale(7),
      borderRadius: scale(999),
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
    },
    markAllText: {
      fontSize: scale(12),
      fontWeight: "600",
      color: Colors.primary,
    },

    filterRow: {
      width: "100%",
      maxWidth: 880,
      alignSelf: "center",
      flexDirection: "row",
      paddingHorizontal: scale(16),
      paddingVertical: vscale(10),
      gap: scale(8),
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(5),
      paddingHorizontal: scale(14),
      paddingVertical: vscale(7),
      borderRadius: scale(999),
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
    },
    filterChipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    filterLabel: {
      fontSize: scale(13),
      fontWeight: "600",
      color: MUTED,
    },
    filterLabelActive: {
      color: "#FFFFFF",
    },
    badge: {
      minWidth: scale(18),
      height: scale(18),
      borderRadius: scale(9),
      backgroundColor: "#F04452",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(4),
    },
    badgeText: {
      fontSize: scale(10),
      fontWeight: "800",
      color: "#FFFFFF",
    },

    errorWrap: {
      width: "90%",
      maxWidth: 848,
      alignSelf: "center",
      marginTop: vscale(4),
      marginBottom: vscale(4),
      paddingHorizontal: scale(12),
      paddingVertical: vscale(10),
      borderRadius: scale(12),
      borderWidth: 1,
      borderColor: "#FECACA",
      backgroundColor: "#FFF1F2",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(10),
    },
    errorText: {
      flex: 1,
      fontSize: scale(11),
      fontWeight: "700",
      color: "#B91C1C",
    },
    errorRetry: {
      fontSize: scale(12),
      fontWeight: "800",
      color: "#B91C1C",
    },

    content: {
      width: "100%",
      maxWidth: 880,
      alignSelf: "center",
      paddingHorizontal: scale(16),
      paddingTop: vscale(2),
    },

    card: {
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: scale(14),
      paddingVertical: vscale(12),
      paddingHorizontal: scale(12),
      marginBottom: vscale(10),
      flexDirection: "row",
      alignItems: "flex-start",
      gap: scale(10),
      position: "relative",
    },
    cardUnread: {
      borderColor: "#C7D9F7",
      backgroundColor: "#F7FAFF",
    },

    unreadDot: {
      position: "absolute",
      top: scale(14),
      right: scale(14),
      width: scale(8),
      height: scale(8),
      borderRadius: scale(4),
      backgroundColor: Colors.primary,
    },

    severityIcon: {
      width: scale(38),
      height: scale(38),
      borderRadius: scale(12),
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },

    cardBody: {
      flex: 1,
      paddingRight: scale(16),
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
      marginBottom: vscale(3),
    },
    cardTitle: {
      flex: 1,
      fontSize: scale(14),
      fontWeight: "600",
      color: TEXT,
    },
    cardTitleUnread: {
      fontWeight: "800",
    },
    severityPill: {
      paddingHorizontal: scale(8),
      paddingVertical: vscale(3),
      borderRadius: scale(999),
      flexShrink: 0,
    },
    severityLabel: {
      fontSize: scale(10),
      fontWeight: "700",
    },
    cardDesc: {
      fontSize: scale(13),
      fontWeight: "400",
      color: MUTED,
      lineHeight: scale(18),
      marginBottom: vscale(6),
    },
    cardMeta: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: scale(4),
      marginTop: vscale(6),
    },
    metaText: {
      fontSize: scale(11),
      fontWeight: "400",
      color: SUBTLE,
    },
    metaDot: {
      fontSize: scale(11),
      color: SUBTLE,
    },

    emptyWrap: {
      marginTop: vscale(40),
      alignItems: "center",
      paddingHorizontal: scale(16),
      paddingVertical: vscale(24),
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: scale(14),
    },
    emptyTitle: {
      marginTop: vscale(10),
      fontSize: scale(16),
      fontWeight: "600",
      color: TEXT,
    },
    emptyText: {
      marginTop: vscale(4),
      fontSize: scale(13),
      fontWeight: "400",
      color: MUTED,
      textAlign: "center",
    },
    modalHeader: {
      width: "100%",
      maxWidth: 900,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: scale(16),
      paddingVertical: vscale(12),
      backgroundColor: Colors.primary,
    },
    modalBottomSafe: {
      backgroundColor: "#FFFFFF",
    },
    modalInfoScroll: {
      width: "100%",
      maxWidth: 720,
      maxHeight: Math.max(1, Math.min(320, height * 0.48)),
      alignSelf: "center",
      marginTop: -20,
      backgroundColor: "#FFFFFF",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    modalInfoContent: {
      paddingHorizontal: scale(20),
      paddingTop: vscale(16),
      paddingBottom: vscale(8),
    },
  });
}
