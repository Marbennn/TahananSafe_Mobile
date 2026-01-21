// src/components/IncidentLogConfirmationScreen/IncidentPreviewCard.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type IncidentPreviewData = {
  incidentType: string;
  details: string;
  witnessName: string;
  witnessType: string;
  dateStr: string;
  timeStr: string;
  locationStr: string;
  photoCount?: number;
};

type Props = {
  data: IncidentPreviewData;
};

export default function IncidentPreviewCard({ data }: Props) {
  const photoCount = Math.min(Math.max(data.photoCount ?? 3, 0), 3);

  const incidentType = data.incidentType?.trim() ? data.incidentType : "—";
  const details = data.details?.trim() ? data.details : "—";

  const witnessName = data.witnessName?.trim() ? data.witnessName : "—";
  const witnessType = data.witnessType?.trim() ? data.witnessType : "—";

  return (
    <View style={styles.card}>
      {/* Incident Detail */}
      <Text style={styles.sectionTitle}>Incident Detail</Text>

      <Text style={styles.smallLine}>{incidentType}</Text>

      <Text style={styles.detailsItalic}>{details}</Text>

      {/* Photos */}
      <View style={styles.photoRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.photoBox}>
            <Ionicons
              name="image-outline"
              size={22}
              color={i < photoCount ? "#A7B3C2" : "#E1E7F0"}
            />
          </View>
        ))}
      </View>

      {/* Witness */}
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Witness</Text>

      <Text style={styles.witnessName}>{witnessName}</Text>
      <Text style={styles.witnessType}>{witnessType}</Text>

      {/* Meta row: Date left, Time right */}
      <View style={styles.metaRow}>
        <View style={styles.metaPair}>
          <Text style={styles.metaLabel}>Date:</Text>
          <Text style={styles.metaValue}>{data.dateStr || "—"}</Text>
        </View>

        <View style={styles.metaPair}>
          <Text style={styles.metaLabel}>Time:</Text>
          <Text style={styles.metaValue}>{data.timeStr || "—"}</Text>
        </View>
      </View>

      {/* Location */}
      <View style={styles.locationRow}>
        <Text style={styles.metaLabel}>Location:</Text>
        <Text style={styles.metaValue}>{data.locationStr || "—"}</Text>
      </View>
    </View>
  );
}

const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";
const TEXT_MUTED = "#6B7280";

const styles = StyleSheet.create({
  // ✅ matches screenshot: not too tall, clean spacing
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: TEXT_DARK,
    marginBottom: 10,
  },

  // ✅ small gray line under Incident Detail
  smallLine: {
    fontSize: 11,
    fontWeight: "900",
    color: TEXT_MUTED,
    marginBottom: 8,
  },

  // ✅ italic body like the screenshot
  detailsItalic: {
    fontSize: 11,
    fontStyle: "italic",
    fontWeight: "700",
    color: TEXT_DARK,
    lineHeight: 16,
    marginBottom: 10,
  },

  // ✅ smaller photo boxes like screenshot
  photoRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  photoBox: {
    flex: 1,
    height: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F2F6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  witnessName: {
    fontSize: 11,
    fontWeight: "900",
    color: TEXT_DARK,
    marginBottom: 2,
  },
  witnessType: {
    fontSize: 10,
    fontWeight: "800",
    color: TEXT_MUTED,
  },

  // ✅ same line Date left / Time right
  metaRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaPair: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: TEXT_MUTED,
  },
  metaValue: {
    fontSize: 11,
    fontWeight: "900",
    color: TEXT_DARK,
  },

  // ✅ Location below
  locationRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
