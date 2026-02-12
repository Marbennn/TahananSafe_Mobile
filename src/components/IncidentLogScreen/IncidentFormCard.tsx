// src/components/IncidentLog/IncidentFormCard.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from "react-native";
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
  const finalDetailsLabel = detailsLabel ?? "Incident Detail";

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>
        {finalDetailsLabel} <Text style={styles.req}>*</Text>
      </Text>

      {/* Dropdown */}
      <Pressable
        onPress={onPickIncidentType}
        style={({ pressed }) => [
          styles.inputShell,
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
        <Ionicons name="chevron-down" size={20} color="#9AA4B2" />
      </Pressable>

      {/* Description */}
      <View style={[styles.inputShell, styles.textAreaShell]}>
        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder="A detailed explanation of what happened, including actions, sequence of events, and any relevant details observed during the incident."
          placeholderTextColor="#9AA4B2"
          style={styles.textAreaInput}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Add photo row */}
      <View style={styles.photoRow}>
        <Pressable
          onPress={onAddPhoto}
          style={({ pressed }) => [
            styles.photoBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={Colors.primary} />
          <Text style={styles.photoText}>Add Photo</Text>
        </Pressable>

        <Text style={styles.photoLimit}>(Max 3)</Text>
      </View>

      {/* Witness */}
      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Witness</Text>

      <View style={styles.inputShell}>
        <TextInput
          value={witnessName}
          onChangeText={setWitnessName}
          placeholder="Name (Optional)"
          placeholderTextColor="#9AA4B2"
          style={styles.textInput}
        />
      </View>

      <View style={styles.inputShell}>
        <TextInput
          value={witnessType}
          onChangeText={setWitnessType}
          placeholder="Type (Neighbor, Family, etc.)"
          placeholderTextColor="#9AA4B2"
          style={styles.textInput}
        />
      </View>

      {/* Meta row */}
      <View style={styles.metaBox}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Date:</Text>
          <Text style={styles.metaValue}>{dateStr}</Text>

          <View style={{ width: 24 }} />

          <Text style={styles.metaLabel}>Time:</Text>
          <Text style={styles.metaValue}>{timeStr}</Text>
        </View>

        <View style={[styles.metaRow, { marginTop: 10 }]}>
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
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  // ✅ bigger labels
  sectionLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: TEXT_DARK,
    marginBottom: 12,
  },
  req: {
    color: "#EF4444",
    fontWeight: "900",
  },

  // ✅ input shell (bigger + nicer padding)
  inputShell: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FBFF",
    paddingHorizontal: 14,
    justifyContent: "center",
    marginBottom: 12,
  },

  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    paddingRight: 10,
  },
  placeholderText: {
    color: "#9AA4B2",
    fontWeight: "700",
  },

  // ✅ normal text input bigger
  textInput: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    paddingVertical: Platform.OS === "android" ? 0 : 12,
  },

  // ✅ textarea bigger
  textAreaShell: {
    height: 150,
    paddingTop: 12,
    paddingBottom: 12,
  },
  textAreaInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    padding: 0,
    lineHeight: 20,
  },

  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 2,
    marginBottom: 10,
  },

  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
  },
  // ✅ bigger photo text
  photoText: {
    fontSize: 13,
    fontWeight: "900",
    color: TEXT_DARK,
  },
  photoLimit: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9AA4B2",
  },

  // ✅ meta bigger
  metaBox: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FBFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#6B7280",
    marginRight: 6,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "900",
    color: TEXT_DARK,
  },
});
