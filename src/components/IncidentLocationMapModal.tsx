// src/components/IncidentLocationMapModal.tsx
import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { Typography } from "../theme/typography";

export type IncidentMapCoords = {
  latitude: number;
  longitude: number;
};

type Props = {
  visible: boolean;
  coords: IncidentMapCoords | null | undefined;
  label?: string;
  title?: string;
  onClose: () => void;
};

export function hasValidLocationCoords(
  coords: IncidentMapCoords | null | undefined
): coords is IncidentMapCoords {
  if (!coords) return false;
  const { latitude, longitude } = coords;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function escHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMapHtml(coords: IncidentMapCoords, label: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #F8FBFF; }
    .popup-title { font: 700 13px sans-serif; color: #0B2B45; margin-bottom: 4px; }
    .popup-text { font: 12px/1.45 sans-serif; color: #475569; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${coords.latitude}, ${coords.longitude}], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '\\u00a9 OpenStreetMap'
    }).addTo(map);

    L.circle([${coords.latitude}, ${coords.longitude}], {
      radius: 34,
      color: '#60A5FA',
      fillColor: '#93C5FD',
      fillOpacity: 0.24,
      weight: 1
    }).addTo(map);

    var marker = L.circleMarker([${coords.latitude}, ${coords.longitude}], {
      radius: 10,
      color: '#FFFFFF',
      weight: 3,
      fillColor: '#07519C',
      fillOpacity: 1
    }).addTo(map);

    marker.bindPopup(
      '<div class="popup-title">Incident location</div>' +
      '<div class="popup-text">${escHtml(label || "Selected location")}</div>'
    ).openPopup();
  <\/script>
</body>
</html>`;
}

export default function IncidentLocationMapModal({
  visible,
  coords,
  label,
  title = "Incident Location",
  onClose,
}: Props) {
  const validCoords = hasValidLocationCoords(coords) ? coords : null;
  const mapHtml = useMemo(
    () => (validCoords ? buildMapHtml(validCoords, label || "") : ""),
    [validCoords, label]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#00223E" />

        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title} allowFontScaling={false}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.mapFrame}>
          {validCoords ? (
            <WebView
              source={{ html: mapHtml }}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              style={styles.webview}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="location-outline" size={34} color="#8FA0B2" />
              <Text style={styles.emptyTitle}>No coordinates available</Text>
              <Text style={styles.emptyText}>
                Enable live location before reviewing the report to show it on a map.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.locationBar}>
          <Ionicons name="location" size={18} color="#00518D" />
          <Text style={styles.locationText} numberOfLines={3}>
            {label || "Selected location"}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    minHeight: 58,
    backgroundColor: "#00223E",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  closeBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...Typography.modalTitle,
    flex: 1,
    textAlign: "center",
    color: "#FFFFFF",
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },
  mapFrame: {
    flex: 1,
    backgroundColor: "#EAF2FC",
  },
  webview: {
    flex: 1,
    backgroundColor: "#EAF2FC",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyTitle: {
    ...Typography.sectionTitle,
    marginTop: 12,
    color: "#344052",
  },
  emptyText: {
    ...Typography.body,
    marginTop: 6,
    textAlign: "center",
    color: "#6B7280",
  },
  locationBar: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#D8DDE2",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  locationText: {
    ...Typography.bodyStrong,
    flex: 1,
    color: "#344052",
  },
});
