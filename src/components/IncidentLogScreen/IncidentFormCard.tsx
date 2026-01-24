// src/components/IncidentLog/IncidentFormCard.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";

type Mode = "complain" | "emergency";

type Props = {
  mode?: Mode; // kept (so IncidentLogScreen won't error), but UI is the same either way
  detailsLabel?: string;

  incidentType: string;
  details: string;
  witnessName: string;
  witnessType: string;

  dateStr: string;
  timeStr: string;
  locationStr: string;

  onPickIncidentType: () => void;
  onAddPhoto: () => void;

  setDetails: (v: string) => void;
  setWitnessName: (v: string) => void;
  setWitnessType: (v: string) => void;
};

export default function IncidentFormCard({
  detailsLabel,

  incidentType,
  details,
  witnessName,
  witnessType,
  dateStr,
  timeStr,
  locationStr,
  onPickIncidentType,
  onAddPhoto,
  setDetails,
  setWitnessName,
  setWitnessType,
}: Props) {
  // ✅ Always keep same label (unless parent passes a custom label)
  const finalDetailsLabel = detailsLabel ?? "Incident Detail";

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>
        {finalDetailsLabel} <Text style={styles.req}>*</Text>
      </Text>

      {/* Dropdown (same for both modes) */}
      <Pressable
        onPress={onPickIncidentType}
        style={({ pressed }) => [
          styles.input,
          styles.dropdown,
          pressed && { opacity: 0.98 },
        ]}
      >
        <Text
          style={[styles.dropdownText, !incidentType && styles.placeholderText]}
          numberOfLines={1}
        >
          {incidentType || "Type of Incident"}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#9AA4B2" />
      </Pressable>

      {/* Description (same for both modes) */}
      <TextInput
        value={details}
        onChangeText={setDetails}
        placeholder="A detailed explanation of what happened, including actions, sequence of events, and any relevant details observed during the incident."
        placeholderTextColor="#9AA4B2"
        style={[styles.input, styles.textArea]}
        multiline
        textAlignVertical="top"
      />

      {/* Add photo row */}
      <View style={styles.photoRow}>
        <Pressable
          onPress={onAddPhoto}
          style={({ pressed }) => [
            styles.photoBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
        >
          <Ionicons name="add" size={16} color={Colors.primary} />
          <Text style={styles.photoText}>Add Photo</Text>
        </Pressable>

        <Text style={styles.photoLimit}>(Max 3)</Text>
      </View>

      {/* Witness (same for both modes) */}
      <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Witness</Text>

      <TextInput
        value={witnessName}
        onChangeText={setWitnessName}
        placeholder="Name (Optional)"
        placeholderTextColor="#9AA4B2"
        style={styles.input}
      />

      <TextInput
        value={witnessType}
        onChangeText={setWitnessType}
        placeholder="Type (Neighbor, Family, etc.)"
        placeholderTextColor="#9AA4B2"
        style={styles.input}
      />

      {/* Meta row */}
      <View style={styles.metaBox}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Date:</Text>
          <Text style={styles.metaValue}>{dateStr}</Text>

          <View style={{ width: 28 }} />

          <Text style={styles.metaLabel}>Time:</Text>
          <Text style={styles.metaValue}>{timeStr}</Text>
        </View>

        <View style={[styles.metaRow, { marginTop: 8 }]}>
          <Text style={styles.metaLabel}>Location:</Text>
          <Text style={styles.metaValue}>{locationStr}</Text>
        </View>
      </View>
    </View>
  );
}

const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";

const styles = StyleSheet.create({
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

  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: TEXT_DARK,
    marginBottom: 10,
  },
  req: {
    color: "#EF4444",
    fontWeight: "900",
  },

  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FBFF",
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },

  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    paddingRight: 10,
  },
  placeholderText: {
    color: "#9AA4B2",
    fontWeight: "700",
  },

  textArea: {
    height: 110,
    paddingTop: 12,
    paddingBottom: 12,
  },

  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },

  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
  },
  photoText: {
    fontSize: 12,
    fontWeight: "900",
    color: TEXT_DARK,
  },
  photoLimit: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9AA4B2",
  },

  metaBox: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FBFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#6B7280",
    marginRight: 6,
  },
  metaValue: {
    fontSize: 11,
    fontWeight: "900",
    color: TEXT_DARK,
  },
});
