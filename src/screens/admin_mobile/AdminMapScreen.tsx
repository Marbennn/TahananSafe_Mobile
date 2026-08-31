// src/screens/admin_mobile/AdminMapScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import {
  fetchMapOverview,
  type MapOverviewAlertDto,
  type MapOverviewReportDto,
  type MapOverviewResponse,
} from "../../api/map";
import AdminBotNav, {
  type TabKey,
} from "../../components/AdminComponents/AdminBotNav";
import {
  getFallbackMapStyle,
  getMapTilerStyleUrl,
  hasMapTilerApiKey,
} from "../../config/map";
import { Colors, useColors } from "../../theme/colors";
import { createTypography, Typography } from "../../theme/typography";

type Props = {
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
};

type RangeDays = 7 | 30 | 90 | 365;

type AlertPoint = MapOverviewAlertDto & {
  weight: number;
};

type WeightedMapReport = MapOverviewReportDto & {
  weight: number;
};

type ReportCluster = {
  key: string;
  lat: number;
  lng: number;
  location: string;
  reports: WeightedMapReport[];
};

const MAP_LIMIT = 320;
const DEFAULT_CENTER: [number, number] = [121.774, 12.8797];
const RANGE_OPTIONS: Array<{ label: string; value: RangeDays }> = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
  { label: "1Y", value: 365 },
];

function getAlertWeight(alert: MapOverviewAlertDto): number {
  const haystack = `${alert.title} ${alert.message}`.toLowerCase();
  if (
    haystack.includes("critical") ||
    haystack.includes("sos") ||
    haystack.includes("immediate")
  ) {
    return 1;
  }
  if (
    haystack.includes("high") ||
    haystack.includes("urgent") ||
    haystack.includes("escalat")
  ) {
    return 0.85;
  }
  if (haystack.includes("medium") || haystack.includes("moderate")) return 0.55;
  if (haystack.includes("low")) return 0.3;
  return 0.72;
}

function getReportWeight(report: MapOverviewReportDto): number {
  const risk = String(report.risk || "").trim().toLowerCase();
  if (risk === "high") return 0.95;
  if (risk === "medium") return 0.62;
  if (risk === "low") return 0.35;
  if (String(report.mode || "").trim().toLowerCase() === "emergency") return 0.9;
  return 0.45;
}

function isCoordinate(value: unknown, min: number, max: number): boolean {
  if (value === null || value === undefined || value === "") return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

function formatSyncTime(value?: string): string {
  if (!value) return "Not synced";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not synced";
  return parsed.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function jsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildMapHtml({
  alerts,
  reportClusters,
  showAlerts,
  showReports,
}: {
  alerts: AlertPoint[];
  reportClusters: ReportCluster[];
  showAlerts: boolean;
  showReports: boolean;
}): string {
  const mapStyle = hasMapTilerApiKey
    ? getMapTilerStyleUrl()
    : getFallbackMapStyle();
  const payload = jsonForInlineScript({
    alerts,
    reportClusters,
    showAlerts,
    showReports,
    mapStyle,
    defaultCenter: DEFAULT_CENTER,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.4.0/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@6.4.0/dist/maplibre-gl.js"><\/script>
  <style>
    * { box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body { font-family: ${jsonForInlineScript(Typography.body.fontFamily)}, system-ui, sans-serif; background: #e8eef5; }
    .maplibregl-map { font: inherit; }
    .maplibregl-ctrl-top-left { top: 8px; left: 8px; }
    .maplibregl-ctrl-group { border-radius: 12px; overflow: hidden; box-shadow: 0 3px 12px rgba(15, 23, 42, .22); }
    .maplibregl-popup-content { border-radius: 14px; padding: 12px 14px; box-shadow: 0 8px 28px rgba(15, 23, 42, .24); }
    .maplibregl-popup-close-button { width: 28px; height: 28px; font-size: 20px; color: #64748b; }
    .marker {
      display: flex; align-items: center; justify-content: center; padding: 0;
      border-radius: 999px; color: #fff; font-size: 10px; line-height: 1;
      font-weight: 800; box-shadow: 0 2px 9px rgba(15, 23, 42, .34);
    }
    .alert-marker { width: 16px; height: 16px; border: 3px solid #991b1b; background: #ef4444; }
    .report-marker { min-width: 20px; width: 20px; height: 20px; border: 3px solid #1e3a8a; background: #3b82f6; }
    .report-marker.clustered { width: 26px; height: 26px; }
    .popup { min-width: 190px; max-width: 270px; padding-right: 8px; }
    .popup-title { margin: 0 0 4px; color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 800; }
    .popup-subtitle { margin: 0 0 4px; color: #334155; font-size: 12px; line-height: 1.4; font-weight: 650; }
    .popup-meta { margin: 3px 0 0; color: #64748b; font-size: 11px; line-height: 1.45; }
    .report-entry { margin-top: 7px; padding: 7px 8px; border: 1px solid #e2e8f0; border-radius: 9px; background: #f8fafc; }
    .legend {
      position: absolute; z-index: 2; top: 10px; right: 10px; min-width: 112px;
      border: 1px solid rgba(226, 232, 240, .95); border-radius: 12px;
      padding: 9px 10px; background: rgba(255, 255, 255, .94);
      box-shadow: 0 3px 14px rgba(15, 23, 42, .18); backdrop-filter: blur(8px);
    }
    .legend-title { margin-bottom: 6px; color: #0f172a; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .legend-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; color: #475569; font-size: 10px; font-weight: 650; }
    .dot { width: 9px; height: 9px; flex: none; border-radius: 999px; }
    .heat { width: 24px; height: 8px; flex: none; border-radius: 999px; background: linear-gradient(90deg, #22d3ee, #10b981, #f59e0b, #ef4444); }
    .map-error {
      display: none; position: absolute; z-index: 5; inset: 0; align-items: center;
      justify-content: center; padding: 28px; color: #b91c1c; background: rgba(255,255,255,.94);
      text-align: center; font-size: 13px; font-weight: 700;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend">
    <div class="legend-title">Map layers</div>
    ${showAlerts ? '<div class="legend-row"><span class="dot" style="background:#ef4444"></span>SOS alerts</div>' : ""}
    ${showReports ? '<div class="legend-row"><span class="dot" style="background:#3b82f6"></span>Reports</div>' : ""}
    <div class="legend-row"><span class="heat"></span>Intensity</div>
  </div>
  <div id="mapError" class="map-error">Unable to load the MapLibre map.</div>
  <script>
    (function () {
      var data = ${payload};
      var reportedError = false;
      var styleErrorTimer = null;

      function post(type, message) {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, message: message || "" }));
      }

      function showError(message) {
        if (reportedError) return;
        reportedError = true;
        var overlay = document.getElementById("mapError");
        overlay.textContent = message || "Unable to load the MapLibre map.";
        overlay.style.display = "flex";
        post("error", overlay.textContent);
      }

      if (!window.maplibregl) {
        showError("MapLibre could not be loaded. Check this device's internet connection.");
        return;
      }

      var map;
      try {
        map = new maplibregl.Map({
          container: "map",
          style: data.mapStyle,
          center: data.defaultCenter,
          zoom: 6,
          minZoom: 3,
          maxZoom: 19,
          maxPitch: 60,
          dragRotate: true,
          pitchWithRotate: true,
          touchPitch: true,
          attributionControl: true
        });
      } catch (error) {
        showError("This device could not initialize the MapLibre renderer.");
        return;
      }

      map.addControl(new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true
      }), "top-left");

      function addText(parent, value, className) {
        var line = document.createElement("p");
        line.className = className;
        line.textContent = value || "";
        parent.appendChild(line);
        return line;
      }

      function formatTime(value) {
        if (!value) return "Unknown time";
        var parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return "Unknown time";
        return parsed.toLocaleString("en-PH", {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit", hour12: true
        });
      }

      function alertPopup(alert) {
        var root = document.createElement("div");
        root.className = "popup";
        addText(root, alert.senderName || "Unknown sender", "popup-title");
        addText(root, alert.title || "SOS alert", "popup-subtitle");
        if (alert.address) addText(root, alert.address, "popup-meta");
        addText(root, formatTime(alert.createdAt), "popup-meta");
        return root;
      }

      function reportPopup(cluster) {
        var root = document.createElement("div");
        root.className = "popup";
        addText(root, cluster.location || "Incident location", "popup-title");
        addText(root, cluster.reports.length + (cluster.reports.length === 1 ? " report" : " reports"), "popup-meta");
        cluster.reports.slice(0, 4).forEach(function (report) {
          var entry = document.createElement("div");
          entry.className = "report-entry";
          addText(entry, (report.caseId || "Report") + " • " + (report.incidentType || "Incident"), "popup-subtitle");
          addText(entry, (report.risk || "Unknown risk") + " • " + (report.status || "Unknown status"), "popup-meta");
          root.appendChild(entry);
        });
        return root;
      }

      function addHeatmap(id, points, colors, radius, opacity) {
        var sourceId = id + "-source";
        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: points.map(function (point) {
              return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [point.lng, point.lat] },
                properties: { weight: point.weight }
              };
            })
          }
        });
        map.addLayer({
          id: id,
          type: "heatmap",
          source: sourceId,
          paint: {
            "heatmap-weight": ["coalesce", ["get", "weight"], 0.5],
            "heatmap-intensity": 1,
            "heatmap-radius": radius,
            "heatmap-opacity": opacity,
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(0,0,0,0)",
              0.2, colors[0],
              0.45, colors[1],
              0.75, colors[2],
              1, colors[3]
            ]
          }
        });
      }

      map.once("load", function () {
        if (styleErrorTimer) window.clearTimeout(styleErrorTimer);
        document.getElementById("mapError").style.display = "none";
        var fitPoints = [];

        if (data.showAlerts) {
          addHeatmap("sos-alert-heat", data.alerts.map(function (alert) {
            return { lat: alert.latitude, lng: alert.longitude, weight: alert.weight };
          }), ["#22d3ee", "#10b981", "#f59e0b", "#ef4444"], 34, 0.58);

          data.alerts.forEach(function (alert) {
            var element = document.createElement("button");
            element.type = "button";
            element.className = "marker alert-marker";
            element.setAttribute("aria-label", (alert.senderName || "Resident") + ": " + (alert.title || "SOS alert"));
            new maplibregl.Marker({ element: element, anchor: "center" })
              .setLngLat([alert.longitude, alert.latitude])
              .setPopup(new maplibregl.Popup({ closeButton: true, offset: 14 }).setDOMContent(alertPopup(alert)))
              .addTo(map);
            fitPoints.push([alert.longitude, alert.latitude]);
          });
        }

        if (data.showReports) {
          var reportHeat = [];
          data.reportClusters.forEach(function (cluster) {
            cluster.reports.forEach(function (report) {
              reportHeat.push({ lat: cluster.lat, lng: cluster.lng, weight: report.weight });
            });
          });
          addHeatmap("report-heat", reportHeat, ["#93c5fd", "#3b82f6", "#1d4ed8", "#172554"], 30, 0.48);

          data.reportClusters.forEach(function (cluster) {
            var element = document.createElement("button");
            element.type = "button";
            element.className = "marker report-marker" + (cluster.reports.length > 1 ? " clustered" : "");
            element.textContent = cluster.reports.length > 1 ? String(cluster.reports.length) : "";
            element.setAttribute("aria-label", cluster.reports.length + " reports at " + cluster.location);
            new maplibregl.Marker({ element: element, anchor: "center" })
              .setLngLat([cluster.lng, cluster.lat])
              .setPopup(new maplibregl.Popup({ closeButton: true, offset: 16, maxWidth: "300px" }).setDOMContent(reportPopup(cluster)))
              .addTo(map);
            fitPoints.push([cluster.lng, cluster.lat]);
          });
        }

        if (fitPoints.length === 1) {
          map.jumpTo({ center: fitPoints[0], zoom: 15 });
        } else if (fitPoints.length > 1) {
          var bounds = new maplibregl.LngLatBounds(fitPoints[0], fitPoints[0]);
          fitPoints.slice(1).forEach(function (point) { bounds.extend(point); });
          map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
        }

        post("ready");
      });

      map.on("error", function () {
        if (map.isStyleLoaded() || styleErrorTimer) return;
        styleErrorTimer = window.setTimeout(function () {
          if (!map.isStyleLoaded()) {
            showError("Unable to load the map style. Check the MapTiler key or internet connection.");
          }
        }, 3500);
      });
    })();
  <\/script>
</body>
</html>`;
}

export default function AdminMapScreen({ onTabChange, initialTab = "Map" }: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const requestRef = useRef<AbortController | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [days, setDays] = useState<RangeDays>(90);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [overview, setOverview] = useState<MapOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [mapError, setMapError] = useState("");

  const NAV_BASE_HEIGHT = height < 500 ? 66 : 78;
  const FAB_SIZE = 62;
  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;
  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;
  const styles = useMemo(
    () => makeStyles(width, height, navHeight + 14),
    [height, navHeight, width]
  );

  const loadData = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setErrorMsg("");
    setMapError("");

    try {
      const data = await fetchMapOverview(days, MAP_LIMIT, "days", controller.signal);
      if (!controller.signal.aborted) setOverview(data);
    } catch (error: any) {
      if (!controller.signal.aborted) {
        setErrorMsg(error?.message || "Failed to load map overview.");
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [days]);

  useEffect(() => {
    void loadData();
    return () => requestRef.current?.abort();
  }, [loadData]);

  const alertPoints = useMemo<AlertPoint[]>(() => {
    return (overview?.alerts || [])
      .filter(
        (alert) =>
          isCoordinate(alert.latitude, -90, 90) &&
          isCoordinate(alert.longitude, -180, 180)
      )
      .map((alert) => ({
        ...alert,
        latitude: Number(alert.latitude),
        longitude: Number(alert.longitude),
        weight: getAlertWeight(alert),
      }));
  }, [overview]);

  const reportClusters = useMemo<ReportCluster[]>(() => {
    const grouped = new Map<string, ReportCluster>();

    for (const report of overview?.reports || []) {
      if (
        !isCoordinate(report.latitude, -90, 90) ||
        !isCoordinate(report.longitude, -180, 180)
      ) {
        continue;
      }
      const lat = Number(report.latitude);
      const lng = Number(report.longitude);

      const location =
        String(report.location || "").trim() || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      const key = `${lat.toFixed(5)}|${lng.toFixed(5)}|${location.toLowerCase()}`;
      const mapReport: WeightedMapReport = {
        ...report,
        weight: getReportWeight(report),
      };
      const existing = grouped.get(key);

      if (existing) {
        existing.reports.push(mapReport);
      } else {
        grouped.set(key, {
          key,
          lat,
          lng,
          location,
          reports: [mapReport],
        });
      }
    }

    return [...grouped.values()].sort((left, right) => right.reports.length - left.reports.length);
  }, [overview]);

  const mappedReportCount = useMemo(
    () => reportClusters.reduce((total, cluster) => total + cluster.reports.length, 0),
    [reportClusters]
  );
  const visiblePointCount =
    (showAlerts ? alertPoints.length : 0) +
    (showReports ? reportClusters.length : 0);

  const mapHtml = useMemo(
    () =>
      buildMapHtml({
        alerts: alertPoints,
        reportClusters,
        showAlerts,
        showReports,
      }),
    [alertPoints, reportClusters, showAlerts, showReports]
  );

  const handleMapMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message?.type === "ready") setMapError("");
      if (message?.type === "error") {
        setMapError(String(message.message || "Unable to load the MapLibre map."));
      }
    } catch {
      // Ignore unrelated WebView messages.
    }
  }, []);

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const hasInitialError = Boolean(errorMsg && !overview);
  const isInitialLoading = loading && !overview;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title} numberOfLines={1}>
                Geospatial Intelligence
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {loading
                  ? "Synchronizing MapLibre data..."
                  : `${alertPoints.length} SOS • ${overview?.reports.length || 0} reports • ${formatSyncTime(
                      overview?.generatedAt
                    )}`}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Refresh map data"
              disabled={loading}
              hitSlop={10}
              onPress={() => void loadData()}
              style={({ pressed }) => [
                styles.refreshBtn,
                loading && styles.refreshBtnDisabled,
                pressed && { opacity: 0.7 },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name="refresh" size={18} color={Colors.primary} />
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.controlPanel}>
          <ScrollView
            horizontal
            contentContainerStyle={styles.rangeRow}
            showsHorizontalScrollIndicator={false}
          >
            {RANGE_OPTIONS.map((option) => {
              const selected = option.value === days;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setDays(option.value)}
                  style={({ pressed }) => [
                    styles.rangeButton,
                    selected && styles.rangeButtonActive,
                    pressed && { opacity: 0.78 },
                  ]}
                >
                  <Text style={[styles.rangeText, selected && styles.rangeTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}

            <View style={styles.metricChip}>
              <Ionicons name="location" size={13} color="#047857" />
              <Text style={styles.metricText}>
                {mappedReportCount}/{overview?.reports.length || 0} mapped
              </Text>
            </View>
          </ScrollView>

          <View style={styles.layerRow}>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: showAlerts }}
              onPress={() => setShowAlerts((current) => !current)}
              style={({ pressed }) => [
                styles.layerButton,
                showAlerts && styles.alertLayerActive,
                pressed && { opacity: 0.78 },
              ]}
            >
              <Ionicons
                name="warning"
                size={14}
                color={showAlerts ? "#B91C1C" : "#94A3B8"}
              />
              <Text style={[styles.layerText, showAlerts && styles.alertLayerText]}>
                SOS layer
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: showReports }}
              onPress={() => setShowReports((current) => !current)}
              style={({ pressed }) => [
                styles.layerButton,
                showReports && styles.reportLayerActive,
                pressed && { opacity: 0.78 },
              ]}
            >
              <Ionicons
                name="document-text"
                size={14}
                color={showReports ? "#1D4ED8" : "#94A3B8"}
              />
              <Text style={[styles.layerText, showReports && styles.reportLayerText]}>
                Reports
              </Text>
            </Pressable>

            <View style={styles.engineChip}>
              <Ionicons name="layers" size={13} color="#475569" />
              <Text style={styles.engineText}>MapLibre</Text>
            </View>
          </View>
        </View>

        <View style={styles.mapContainer}>
          {isInitialLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading command center map...</Text>
            </View>
          ) : hasInitialError ? (
            <View style={styles.loadingWrap}>
              <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
              <Text style={[styles.loadingText, styles.errorText]}>{errorMsg}</Text>
              <Pressable
                onPress={() => void loadData()}
                style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <WebView
                key={`${days}-${showAlerts}-${showReports}-${overview?.generatedAt || "empty"}`}
                style={styles.webview}
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="never"
                onMessage={handleMapMessage}
                onError={(event) =>
                  setMapError(
                    event.nativeEvent.description || "Unable to open the MapLibre map."
                  )
                }
                source={{ html: mapHtml, baseUrl: "https://localhost/" }}
              />

              {!visiblePointCount ? (
                <View pointerEvents="none" style={styles.emptyOverlay}>
                  <View style={styles.emptyCard}>
                    <Ionicons name="layers-outline" size={24} color="#64748B" />
                    <Text style={styles.emptyTitle}>No visible map layers</Text>
                    <Text style={styles.emptyText}>
                      Turn on a layer or expand the date range.
                    </Text>
                  </View>
                </View>
              ) : null}

              {errorMsg || mapError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="warning-outline" size={16} color="#B91C1C" />
                  <Text style={styles.errorBannerText} numberOfLines={2}>
                    {mapError || errorMsg}
                  </Text>
                </View>
              ) : null}
            </>
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
  const compactType = createTypography(
    (value) => Math.round(value * 0.82),
    (value) => Math.round(value * 0.82)
  );

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
    headerCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
    title: {
      ...(compact ? compactType.screenTitle : Typography.screenTitle),
      color: "#0B2B45",
    },
    subtitle: { ...Typography.caption, marginTop: 2, color: "#6B7280" },
    refreshBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "#F0F7FF",
      alignItems: "center",
      justifyContent: "center",
    },
    refreshBtnDisabled: { opacity: 0.68 },
    controlPanel: {
      gap: 8,
      paddingHorizontal: compact ? 10 : 14,
      paddingVertical: compactHeight ? 7 : 9,
      backgroundColor: "#FFFFFF",
      borderBottomWidth: 1,
      borderBottomColor: "#E7EEF7",
    },
    rangeRow: { alignItems: "center", gap: 7, paddingRight: 4 },
    rangeButton: {
      minWidth: 43,
      height: 32,
      paddingHorizontal: 11,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F1F5F9",
      borderWidth: 1,
      borderColor: "#E2E8F0",
    },
    rangeButtonActive: { backgroundColor: "#001D3D", borderColor: "#001D3D" },
    rangeText: { ...Typography.badge, color: "#64748B" },
    rangeTextActive: { color: "#FFFFFF" },
    metricChip: {
      height: 32,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: "#ECFDF5",
      borderWidth: 1,
      borderColor: "#A7F3D0",
    },
    metricText: { ...Typography.badge, color: "#047857" },
    layerRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    layerButton: {
      minHeight: 32,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: compact ? 8 : 10,
      borderRadius: 10,
      backgroundColor: "#F8FAFC",
      borderWidth: 1,
      borderColor: "#E2E8F0",
    },
    alertLayerActive: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
    reportLayerActive: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
    layerText: { ...Typography.badge, color: "#94A3B8" },
    alertLayerText: { color: "#B91C1C" },
    reportLayerText: { color: "#1D4ED8" },
    engineChip: {
      minHeight: 32,
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingHorizontal: 7,
      borderRadius: 10,
      backgroundColor: "#F1F5F9",
    },
    engineText: { ...Typography.badge, color: "#475569" },
    mapContainer: { flex: 1, marginBottom: mapBottomInset, backgroundColor: "#E8EEF5" },
    webview: { flex: 1, backgroundColor: "#E8EEF5" },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    loadingText: {
      ...Typography.bodyStrong,
      marginTop: 12,
      color: "#6B7280",
      textAlign: "center",
    },
    errorText: { color: "#DC2626" },
    retryBtn: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: Colors.actionPrimary,
    },
    retryText: { ...Typography.button, color: "#FFFFFF" },
    emptyOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    emptyCard: {
      width: "100%",
      maxWidth: 290,
      alignItems: "center",
      paddingHorizontal: 22,
      paddingVertical: 18,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.95)",
      borderWidth: 1,
      borderColor: "#E2E8F0",
    },
    emptyTitle: { ...Typography.bodyStrong, marginTop: 8, color: "#0F172A" },
    emptyText: { ...Typography.caption, marginTop: 4, color: "#64748B", textAlign: "center" },
    errorBanner: {
      position: "absolute",
      left: 10,
      right: 10,
      bottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: "rgba(254,242,242,0.97)",
      borderWidth: 1,
      borderColor: "#FECACA",
    },
    errorBannerText: { ...Typography.captionStrong, flex: 1, color: "#B91C1C" },
  });
}
