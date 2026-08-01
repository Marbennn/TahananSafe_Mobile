// src/screens/admin_mobile/AdminMapScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import AdminBotNav, { TabKey } from "../../components/AdminComponents/AdminBotNav";
import { Colors, useColors } from "../../theme/colors";
import { fetchMyNotificationsCombined } from "../../api/notifications";

type Props = {
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
};

type AlertPoint = {
  lat: number;
  lng: number;
  severity: string;
  title: string;
  senderName: string;
  address: string;
  time: string;
};

function getSeverityWeight(title: string, message: string): number {
  const hay = `${title} ${message}`.toLowerCase();
  if (hay.includes("critical") || hay.includes("sos") || hay.includes("immediate")) return 1.0;
  if (hay.includes("high") || hay.includes("urgent") || hay.includes("escalat")) return 0.8;
  if (hay.includes("moderate") || hay.includes("medium")) return 0.5;
  if (hay.includes("low")) return 0.3;
  return 0.7;
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHeatmapHtml(points: AlertPoint[]): string {
  // Default center: Philippines
  let centerLat = 12.8797;
  let centerLng = 121.774;
  let zoom = 6;

  if (points.length > 0) {
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    zoom = 13;
  }

  const heatData = points
    .map((p) => `[${p.lat}, ${p.lng}, ${getSeverityWeight(p.title, "")}]`)
    .join(",\n      ");

  const markerData = points
    .map(
      (p) =>
        `{ lat: ${p.lat}, lng: ${p.lng}, title: "${esc(p.title)}", sender: "${esc(p.senderName)}", address: "${esc(p.address)}", time: "${esc(p.time)}" }`,
    )
    .join(",\n      ");

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .legend {
      background: #fff; padding: 10px 14px; border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18); font: 13px/1.5 sans-serif;
    }
    .legend-title { font-weight: 800; margin-bottom: 4px; font-size: 13px; }
    .legend-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
    .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    .gradient-bar {
      width: 120px; height: 12px; border-radius: 6px;
      background: linear-gradient(to right, #00f, #0ff, #0f0, #ff0, #f00);
    }
    .gradient-labels { display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-top: 2px; }
    .info-popup { max-width: 220px; }
    .info-popup b { display: block; margin-bottom: 2px; }
    .info-popup .meta { color: #666; font-size: 11px; margin-top: 4px; }
    @media (max-width: 360px), (max-height: 480px) {
      .legend { padding: 7px 9px; border-radius: 8px; font-size: 11px; }
      .legend-title { font-size: 11px; }
      .gradient-bar { width: 88px; height: 9px; }
      .legend-row { gap: 5px; margin: 2px 0; }
      .dot { width: 9px; height: 9px; }
    }
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

    // Heatmap layer
    var heatPoints = [
      ${heatData}
    ];
    if (heatPoints.length > 0) {
      var heat = L.heatLayer(heatPoints, {
        radius: 35,
        blur: 25,
        maxZoom: 17,
        max: 1.0,
        gradient: { 0.2: '#2563EB', 0.4: '#06B6D4', 0.6: '#10B981', 0.8: '#F59E0B', 1.0: '#EF4444' }
      }).addTo(map);
    }

    // Alert markers
    var alertData = [
      ${markerData}
    ];
    var redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });

    alertData.forEach(function(a) {
      var popup = '<div class="info-popup"><b>' + a.sender + '</b>' + a.title +
        (a.address ? '<br/><span class="meta">' + a.address + '</span>' : '') +
        '<div class="meta">' + a.time + '</div></div>';
      L.marker([a.lat, a.lng], { icon: redIcon }).addTo(map).bindPopup(popup);
    });

    // Fit bounds
    var allPts = heatPoints.map(function(p) { return [p[0], p[1]]; });
    if (allPts.length > 1) {
      map.fitBounds(allPts, { padding: [40, 40], maxZoom: 16 });
    } else if (allPts.length === 1) {
      map.setView(allPts[0], 15);
    }

    // Legend
    var legend = L.control({ position: 'topright' });
    legend.onAdd = function() {
      var div = L.DomUtil.create('div', 'legend');
      div.innerHTML =
        '<div class="legend-title">Alert Heatmap</div>' +
        '<div class="gradient-bar"></div>' +
        '<div class="gradient-labels"><span>Low</span><span>High</span></div>' +
        '<div style="margin-top:8px">' +
        '<div class="legend-row"><span class="dot" style="background:#DC2626"></span> Alert Location</div>' +
        '<div class="legend-row" style="color:#888;font-size:11px">' + alertData.length + ' alerts total</div>' +
        '</div>';
      return div;
    };
    legend.addTo(map);
  <\/script>
</body>
</html>`;
}

export default function AdminMapScreen({ onTabChange, initialTab = "Map" }: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [points, setPoints] = useState<AlertPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const NAV_BASE_HEIGHT = height < 500 ? 66 : 78;
  const FAB_SIZE = 62;
  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;
  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;
  const styles = useMemo(
    () => makeStyles(width, height, navHeight + 14),
    [width, height, navHeight]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const notifications = await fetchMyNotificationsCombined(500);

      const alertPoints: AlertPoint[] = [];
      for (const n of notifications) {
        if (n.type !== "alert") continue;
        const lat = n.meta?.latitude;
        const lng = n.meta?.longitude;
        if (lat == null || lng == null) continue;
        if (typeof lat !== "number" || typeof lng !== "number") continue;

        const d = new Date(n.time);
        const timeStr = Number.isNaN(d.getTime())
          ? ""
          : d.toLocaleString("en-PH", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });

        alertPoints.push({
          lat,
          lng,
          severity: "",
          title: n.title || "Alert",
          senderName: n.meta?.senderName ?? "Unknown",
          address: n.meta?.address ?? "",
          time: timeStr,
        });
      }
      setPoints(alertPoints);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load alert data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const mapHtml = useMemo(() => buildHeatmapHtml(points), [points]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

      <View style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title} numberOfLines={1}>Alert Map</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {loading
                  ? "Loading alerts..."
                  : `${points.length} alert${points.length !== 1 ? "s" : ""} with location data`}
              </Text>
            </View>
            <Pressable
              onPress={() => void loadData()}
              style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
              hitSlop={10}
            >
              <Ionicons name="refresh" size={18} color={Colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* Map area */}
        <View style={styles.mapContainer}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading alert heatmap...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.loadingWrap}>
              <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
              <Text style={[styles.loadingText, { color: "#DC2626" }]}>{errorMsg}</Text>
              <Pressable
                onPress={() => void loadData()}
                style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <WebView
              style={styles.webview}
              originWhitelist={["https://*"]}
              javaScriptEnabled
              source={{ html: mapHtml }}
            />
          )}
        </View>

        <AdminBotNav
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={() => {}}
          centerLabel="Admin Menu"
          Chevron={undefined}
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(width: number, height: number, mapBottomInset: number) {
  const compact = width < 360;
  const compactHeight = height < 500;
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5FAFE" },
  page: { flex: 1, backgroundColor: "#F5FAFE" },

  header: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: compact ? 12 : 16,
    paddingTop: compactHeight ? 5 : 8,
    paddingBottom: compactHeight ? 5 : 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E7EEF7",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  title: {
    fontSize: compact ? 19 : 22,
    fontWeight: "900",
    color: "#0B2B45",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: compact ? 11 : 13,
    fontWeight: "400",
    color: "#6B7280",
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F0F7FF",
    alignItems: "center",
    justifyContent: "center",
  },

  mapContainer: {
    flex: 1,
    marginBottom: mapBottomInset,
  },
  webview: {
    flex: 1,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.actionPrimary,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  });
}
