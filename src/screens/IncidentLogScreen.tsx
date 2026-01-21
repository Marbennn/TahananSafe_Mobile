// src/screens/IncidentLogScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

import IncidentFormCard from "../components/IncidentLogScreen/IncidentFormCard";

// ✅ preview screen (fallback local preview)
import IncidentLogConfirmScreen from "./IncidentLogConfirmationScreen";

// ✅ import the TYPE from the preview card (correct source)
import type { IncidentPreviewData } from "../components/IncidentLogConfirmationScreen/IncidentPreviewCard";

// ✅ (optional) if you want to keep App.tsx passing tabs without errors:
import type { TabKey } from "../components/BottomNavBar";

type Props = {
  onBack?: () => void;

  // ✅ added so App.tsx props won't error
  initialTab?: TabKey | string;
  onTabChange?: (tab: TabKey) => void;

  // ✅ IMPORTANT: add this to fix your TS error from App.tsx
  onProceedConfirm?: (previewData: IncidentPreviewData) => void;
};

type Mode = "complain" | "emergency";

const INCIDENT_TYPES = [
  "Physical Abuse",
  "Verbal Abuse",
  "Threat / Harassment",
  "Domestic Violence",
  "Theft",
  "Other",
];

export default function IncidentLogScreen({ onBack, onProceedConfirm }: Props) {
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("complain");

  const [incidentType, setIncidentType] = useState<string>("");
  const [details, setDetails] = useState<string>("");

  const [witnessName, setWitnessName] = useState<string>("");
  const [witnessType, setWitnessType] = useState<string>("");

  // demo values (replace later with Date/Time pickers)
  const [dateStr] = useState<string>("01/15/2026");
  const [timeStr] = useState<string>("10:00PM");
  const [locationStr] = useState<string>("Brgy. 12");

  // ✅ simple local “navigation” to preview screen (fallback)
  const [showPreview, setShowPreview] = useState(false);

  // (optional) photo count placeholder
  const [photoCount] = useState<number>(3);

  // ✅ keep small bottom padding only (safe area + a bit)
  const CONTENT_BOTTOM_PAD = Math.max(insets.bottom, 10) + 10;

  const openTypePicker = () => {
    Alert.alert("Type of Incident", "Choose one:", [
      ...INCIDENT_TYPES.map((t) => ({
        text: t,
        onPress: () => setIncidentType(t),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const onAddPhoto = () => {
    Alert.alert("Add Photo", "Hook this to ImagePicker (Max 3).");
  };

  const buildPreviewData = (): IncidentPreviewData => ({
    incidentType,
    details,
    witnessName,
    witnessType,
    dateStr,
    timeStr,
    locationStr,
    photoCount,
  });

  const resetForm = () => {
    setIncidentType("");
    setDetails("");
    setWitnessName("");
    setWitnessType("");
  };

  const onSubmit = () => {
    if (!incidentType.trim() || !details.trim()) {
      Alert.alert("Incomplete", "Please fill in the required fields.");
      return;
    }

    if (mode === "emergency") {
      Alert.alert("Emergency Sent", "Your emergency report has been submitted.");
      resetForm();
      return;
    }

    // ✅ Complaint flow:
    // If App.tsx provided onProceedConfirm, use that (App will route to confirmation screen)
    if (onProceedConfirm) {
      onProceedConfirm(buildPreviewData());
      return;
    }

    // Otherwise fallback to local preview screen behavior
    setShowPreview(true);
  };

  const onConfirmComplaint = () => {
    Alert.alert("Complaint Secured", "Your complaint has been submitted.");
    setShowPreview(false);
    resetForm();
  };

  const actionText = useMemo(() => {
    return mode === "emergency" ? "Send Emergency" : "Secure Complaint";
  }, [mode]);

  // ✅ Show preview screen (fallback local)
  if (showPreview) {
    return (
      <IncidentLogConfirmScreen
        data={buildPreviewData()}
        onBack={() => setShowPreview(false)}
        onConfirm={onConfirmComplaint}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <Pressable
            onPress={
              onBack ?? (() => Alert.alert("Back", "Wire onBack() to navigation"))
            }
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </Pressable>

          <Text style={styles.topTitle}>Incident Log</Text>

          {/* right spacer for centered title */}
          <View style={{ width: 36, height: 36 }} />
        </View>

        {/* Segmented control */}
        <View style={styles.segmentWrap}>
          <View style={styles.segmentPill}>
            <Pressable
              onPress={() => setMode("complain")}
              style={({ pressed }) => [
                styles.segmentBtn,
                mode === "complain" && styles.segmentBtnActive,
                pressed && { transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === "complain" && styles.segmentTextActive,
                ]}
              >
                Complain
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setMode("emergency")}
              style={({ pressed }) => [
                styles.segmentBtn,
                mode === "emergency" && styles.segmentBtnActiveLight,
                pressed && { transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === "emergency" && styles.segmentTextActiveLight,
                ]}
              >
                Emergency
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Form */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_BOTTOM_PAD },
          ]}
        >
          <View style={styles.bodyFill}>
            <IncidentFormCard
              incidentType={incidentType}
              details={details}
              witnessName={witnessName}
              witnessType={witnessType}
              dateStr={dateStr}
              timeStr={timeStr}
              locationStr={locationStr}
              onPickIncidentType={openTypePicker}
              onAddPhoto={onAddPhoto}
              setDetails={setDetails}
              setWitnessName={setWitnessName}
              setWitnessType={setWitnessType}
            />

            <Pressable
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 },
              ]}
            >
              <Text style={styles.submitText}>{actionText}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const BG = "#F5FAFE";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  page: { flex: 1, backgroundColor: BG },

  topBar: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT_DARK,
  },

  segmentWrap: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  segmentPill: {
    height: 34,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  segmentBtnActiveLight: {
    backgroundColor: "#F2F6FF",
  },
  segmentText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  segmentTextActiveLight: {
    color: Colors.primary,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 6,
  },

  bodyFill: {
    flex: 1,
    justifyContent: "space-between",
    gap: 14,
  },

  submitBtn: {
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
