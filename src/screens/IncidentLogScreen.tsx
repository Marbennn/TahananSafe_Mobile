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
  TextInput,
  useWindowDimensions,
  Platform,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "../theme/colors";

// ✅ API
import { submitIncident } from "../api/incidents";

// ✅ preview screen
import IncidentLogConfirmScreen from "./IncidentLogConfirmationScreen";
// ✅ TYPE
import type { IncidentPreviewData } from "../components/IncidentLogConfirmationScreen/IncidentPreviewCard";
import type { TabKey } from "../components/BottomNavBar";

type IncidentSubmittedPayload = {
  incidentId: string;
  createdAt?: string;
};

type Props = {
  onBack?: () => void;

  // ✅ UPDATED: now returns real data from backend
  onSubmitted?: (payload: IncidentSubmittedPayload) => void;

  initialTab?: TabKey | string;
  onTabChange?: (tab: TabKey) => void;

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ✅ small logger helper (consistent tag)
function log(tag: string, data?: any) {
  const ts = new Date().toISOString();
  if (data !== undefined) console.log(`[IncidentLog] ${ts} ${tag}`, data);
  else console.log(`[IncidentLog] ${ts} ${tag}`);
}

// ✅ minimal type for the response you return from backend
type SubmitIncidentResponse = {
  message?: string;
  incident?: {
    _id: string;
    createdAt?: string;
  };
};

/* ===================== DATE/TIME HELPERS ===================== */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateMMDDYYYY(d: Date) {
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatTime12h(d: Date) {
  let h = d.getHours();
  const m = pad2(d.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m}${ampm}`;
}
/* ============================================================ */

export default function IncidentLogScreen({
  onBack,
  onProceedConfirm,
  onSubmitted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const s = useMemo(() => clamp(screenWidth / 375, 0.9, 1.2), [screenWidth]);

  const [mode, setMode] = useState<Mode>("complain");

  const [incidentType, setIncidentType] = useState("");
  const [details, setDetails] = useState("");

  // ✅ NEW: offender
  const [offenderName, setOffenderName] = useState("");

  const [witnessName, setWitnessName] = useState("");
  const [witnessType, setWitnessType] = useState("");

  // ✅ REAL current date/time (LIVE update every 2 seconds)
  const [dateStr, setDateStr] = useState(() => formatDateMMDDYYYY(new Date()));
  const [timeStr, setTimeStr] = useState(() => formatTime12h(new Date()));
  const [locationStr] = useState("Brgy. 12");

  React.useEffect(() => {
    const tick = () => {
      const now = new Date();
      setDateStr(formatDateMMDDYYYY(now));
      setTimeStr(formatTime12h(now));
    };

    // ✅ update immediately when screen mounts
    tick();

    // ✅ update every 2 seconds
    const id = setInterval(tick, 2000);

    return () => clearInterval(id);
  }, []);

  // ✅ selected photos (URIs)
  const [photos, setPhotos] = useState<string[]>([]);
  const MAX_PHOTOS = 3;

  // preview state
  const [showPreview, setShowPreview] = useState(false);

  // ✅ submitting state (used by preview confirm too)
  const [submitting, setSubmitting] = useState(false);

  // footer height used to pad scroll so it won't hide behind button
  const FOOTER_H = 72 * s;
  const CONTENT_BOTTOM_PAD = Math.max(insets.bottom, 10) + FOOTER_H + 16;

  const openModePicker = () => {
    if (submitting) return;
    Alert.alert("Mode", "Choose one:", [
      { text: "Complain", onPress: () => setMode("complain") },
      { text: "Emergency", onPress: () => setMode("emergency") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const openTypePicker = () => {
    if (submitting) return;
    Alert.alert("Type of Incident", "Choose one:", [
      ...INCIDENT_TYPES.map((t) => ({
        text: t,
        onPress: () => setIncidentType(t),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ✅ real Add Photo using Expo ImagePicker
  const onAddPhoto = async () => {
    try {
      if (submitting) return;

      if (photos.length >= MAX_PHOTOS) {
        Alert.alert("Max reached", `You can only add up to ${MAX_PHOTOS} photos.`);
        return;
      }

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      log("ImagePicker permission result", perm);

      if (perm.status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow photo access so you can upload images."
        );
        return;
      }

      const remaining = MAX_PHOTOS - photos.length;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remaining, // iOS supports; Android may ignore
      });

      log("ImagePicker result.canceled", result.canceled);

      if (result.canceled) return;

      const newUris = (result.assets ?? []).map((a) => a.uri).filter(Boolean);
      log("Picked photo URIs count", newUris.length);

      if (newUris.length === 0) return;

      setPhotos((prev) => {
        const merged = Array.from(new Set([...prev, ...newUris]));
        const sliced = merged.slice(0, MAX_PHOTOS);
        log("Photos state updated", { prevCount: prev.length, newCount: sliced.length });
        return sliced;
      });
    } catch (e) {
      log("onAddPhoto ERROR", e);
      Alert.alert("Error", "Could not open your gallery. Please try again.");
    }
  };

  const removePhotoAt = (index: number) => {
    if (submitting) return;
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      log("Removed photo", { index, before: prev.length, after: next.length });
      return next;
    });
  };

  // ✅ preview data: include photo URIs so preview can show actual thumbnails
  const buildPreviewData = (): IncidentPreviewData =>
    ({
      incidentType: mode === "emergency" ? "Emergency" : incidentType,
      details,
      offenderName, // ✅ NEW
      witnessName,
      witnessType,
      dateStr,
      timeStr,
      locationStr,
      photoCount: photos.length,
      photos,
      mode,
    } as any);

  const resetForm = () => {
    log("resetForm()");
    setIncidentType("");
    setDetails("");
    setOffenderName(""); // ✅ NEW
    setWitnessName("");
    setWitnessType("");
    setPhotos([]);
  };

  // ✅ Submit to backend ONLY when user confirms (for complain)
  const submitToBackend = async (): Promise<SubmitIncidentResponse> => {
    const payload = {
      mode,
      incidentType,
      details,
      offenderName, // ✅ NEW
      witnessName,
      witnessType,
      dateStr,
      timeStr,
      locationStr,
      photos,
    };

    log("SUBMIT:START", {
      mode,
      incidentType,
      detailsLen: details.trim().length,
      offenderNameLen: offenderName.trim().length, // ✅ NEW
      witnessNameLen: witnessName.trim().length,
      witnessTypeLen: witnessType.trim().length,
      dateStr,
      timeStr,
      locationStr,
      photosCount: photos.length,
      photosPreview: photos.slice(0, 3).map((u) => (u ? `${u.slice(0, 35)}...` : "")),
    });

    setSubmitting(true);

    const t0 = Date.now();
    try {
      const res = (await submitIncident(payload)) as SubmitIncidentResponse;

      const ms = Date.now() - t0;
      log("SUBMIT:SUCCESS", { tookMs: ms, response: res });

      Alert.alert(
        mode === "emergency" ? "Emergency Sent" : "Complaint Secured",
        "Your report has been submitted."
      );

      // ✅ reset so form is empty next time
      resetForm();

      return res;
    } catch (err: any) {
      const ms = Date.now() - t0;

      log("SUBMIT:FAILED", {
        tookMs: ms,
        message: err?.message,
        name: err?.name,
        status: err?.status,
        data: err?.data,
        raw: err,
      });

      Alert.alert("Submit failed", err?.message || "Something went wrong. Please try again.");
      throw err;
    } finally {
      setSubmitting(false);
      log("SUBMIT:END");
    }
  };

  const onSubmit = async () => {
    if (submitting) return;

    log("onSubmit pressed", {
      mode,
      incidentType,
      detailsLen: details.trim().length,
      photosCount: photos.length,
    });

    // ✅ emergency: send immediately (no preview)
    if (mode === "emergency") {
      if (!details.trim()) {
        Alert.alert("Incomplete", "Please fill in the required fields.");
        return;
      }
      await submitToBackend();
      return;
    }

    // ✅ complain: validate and go to preview first
    if (!incidentType.trim() || !details.trim()) {
      Alert.alert("Incomplete", "Please fill in the required fields.");
      return;
    }

    // if parent wants to handle preview navigation externally
    if (onProceedConfirm) {
      log("Delegating preview navigation to parent via onProceedConfirm()");
      onProceedConfirm(buildPreviewData());
      return;
    }

    log("Opening preview screen (local state)");
    setShowPreview(true);
  };

  // ✅ Confirm on preview sends to backend THEN calls onSubmitted(realData)
  const onConfirmComplaint = async () => {
    if (submitting) return;
    log("Preview Confirm pressed");

    const res = await submitToBackend();

    const incidentId = res?.incident?._id || "";
    const createdAt = res?.incident?.createdAt;

    // ✅ close preview first
    setShowPreview(false);

    // ✅ IMPORTANT: send real backend data up to App.tsx
    onSubmitted?.({ incidentId, createdAt });

    // keep returning for confirmation screen compatibility (safe)
    return { incidentId, createdAt };
  };

  const actionText = mode === "emergency" ? "Send Emergency" : "Secure Complaint";
  const detailsLabel = mode === "emergency" ? "Emergency Detail" : "Incident Detail";

  if (showPreview) {
    return (
      <IncidentLogConfirmScreen
        data={buildPreviewData()}
        submitting={submitting}
        onBack={() => (submitting ? null : setShowPreview(false))}
        onConfirm={onConfirmComplaint as any}
        onGoHome={() => setShowPreview(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <Pressable
            disabled={submitting}
            onPress={onBack ?? (() => Alert.alert("Back", "Wire onBack() to navigation"))}
            hitSlop={12}
            style={({ pressed }) => [
              styles.backBtn,
              (pressed || submitting) && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          </Pressable>

          <Text style={styles.topTitle}>Incident Log</Text>

          <View style={{ width: 36, height: 36 }} />
        </View>

        {/* mode pill */}
        <View style={styles.pillWrap}>
          <Pressable
            disabled={submitting}
            onPress={openModePicker}
            style={({ pressed }) => [
              styles.pillShadow,
              (pressed || submitting) && { opacity: 0.95 },
            ]}
          >
            <LinearGradient
              colors={Colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pill}
            >
              <Text style={styles.pillText}>
                {mode === "emergency" ? "Emergency" : "Complain"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Scrollable content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_BOTTOM_PAD },
          ]}
        >
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {detailsLabel} <Text style={styles.required}>*</Text>
            </Text>

            {/* Type (only complain) */}
            {mode === "complain" && (
              <Pressable
                disabled={submitting}
                onPress={openTypePicker}
                style={({ pressed }) => [(pressed || submitting) && { opacity: 0.95 }]}
              >
                <View style={styles.input}>
                  <Text style={[styles.inputText, !incidentType && styles.placeholder]}>
                    {incidentType || "Type of Incident"}
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Details */}
            <View style={[styles.input, styles.textArea]}>
              <TextInput
                editable={!submitting}
                value={details}
                onChangeText={setDetails}
                placeholder="A detailed explanation of what happened, including actions, sequence of events, and any relevant details observed during the incident."
                placeholderTextColor="#9AA7B5"
                multiline
                textAlignVertical="top"
                style={styles.textAreaInput}
              />
            </View>

            {/* Add Photo */}
            <View style={styles.photoRow}>
              <Pressable
                disabled={submitting}
                onPress={onAddPhoto}
                style={({ pressed }) => [
                  styles.photoBtn,
                  (pressed || submitting) && { opacity: 0.9 },
                ]}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Add Photo</Text>
              </Pressable>

              <Text style={styles.maxText}>(Max {MAX_PHOTOS})</Text>
            </View>

            {/* thumbs */}
            {photos.length > 0 && (
              <View style={styles.thumbRow}>
                {photos.map((uri, idx) => (
                  <Pressable
                    key={`${uri}-${idx}`}
                    disabled={submitting}
                    onPress={() => {
                      Alert.alert("Remove photo?", "Do you want to remove this photo?", [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => removePhotoAt(idx),
                        },
                      ]);
                    }}
                    style={({ pressed }) => [
                      styles.thumbBox,
                      (pressed || submitting) && { opacity: 0.92 },
                    ]}
                  >
                    <Image source={{ uri }} style={styles.thumbImg} />
                    <View style={styles.thumbX}>
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* ✅ NEW: Offender */}
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
              Offender (Optional)
            </Text>

            <View style={styles.input}>
              <TextInput
                editable={!submitting}
                value={offenderName}
                onChangeText={setOffenderName}
                placeholder="Name of Offender"
                placeholderTextColor="#9AA7B5"
                style={styles.textInput}
              />
            </View>

            {/* Witness */}
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Witness</Text>

            <View style={styles.input}>
              <TextInput
                editable={!submitting}
                value={witnessName}
                onChangeText={setWitnessName}
                placeholder="Name (Optional)"
                placeholderTextColor="#9AA7B5"
                style={styles.textInput}
              />
            </View>

            <View style={styles.input}>
              <TextInput
                editable={!submitting}
                value={witnessType}
                onChangeText={setWitnessType}
                placeholder="Type (Neighbor, Family, etc.)."
                placeholderTextColor="#9AA7B5"
                style={styles.textInput}
              />
            </View>

            {/* meta */}
            <View style={styles.metaRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.metaText}>
                  <Text style={styles.metaLabel}>Date:</Text> {dateStr}
                </Text>
                <Text style={[styles.metaText, { marginTop: 6 }]}>
                  <Text style={styles.metaLabel}>Location:</Text> {locationStr}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.metaText}>
                  <Text style={styles.metaLabel}>Time:</Text> {timeStr}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* bottom button */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable
            disabled={submitting}
            onPress={onSubmit}
            style={({ pressed }) => [
              styles.submitShadow,
              (pressed || submitting) && { opacity: 0.95 },
            ]}
          >
            <LinearGradient
              colors={Colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.submitBtn, { height: 56 * s }]}
            >
              {submitting ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.submitText}>Submitting...</Text>
                </View>
              ) : (
                <Text style={styles.submitText}>{actionText}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BG = "#F5FAFE";
const CARD_BG = "#F3F7FB";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";
const SHADOW = "#000";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  page: { flex: 1, backgroundColor: BG },

  topBar: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: TEXT_DARK,
    letterSpacing: 0.2,
  },

  pillWrap: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },
  pillShadow: {
    borderRadius: 24,
    shadowColor: SHADOW,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  pill: {
    height: 46,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 4,
    gap: 14,
  },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    shadowColor: SHADOW,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: TEXT_DARK,
    marginBottom: 10,
  },
  required: {
    color: "#E11D48",
    fontWeight: "900",
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    justifyContent: "center",
    marginBottom: 12,
  },
  inputText: {
    fontSize: 14,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  placeholder: {
    color: "#9AA7B5",
    fontWeight: "800",
  },
  textInput: {
    fontSize: 14,
    fontWeight: "800",
    color: TEXT_DARK,
    paddingVertical: Platform.OS === "android" ? 0 : 12,
  },

  textArea: {
    height: 140,
    paddingTop: 12,
    paddingBottom: 12,
  },
  textAreaInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_DARK,
    padding: 0,
    lineHeight: 20,
  },

  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 8,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 14,
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.primary,
  },
  maxText: {
    marginLeft: 12,
    fontSize: 12,
    fontWeight: "800",
    color: "#9AA7B5",
  },

  thumbRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    marginBottom: 10,
  },
  thumbBox: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  thumbX: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  metaText: {
    fontSize: 13,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  metaLabel: {
    fontWeight: "900",
    color: "#52677A",
  },

  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: BG,
    borderTopWidth: 0,
    borderTopColor: "rgba(227,232,239,0.9)",
  },

  submitShadow: {
    borderRadius: 28,
    shadowColor: SHADOW,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  submitBtn: {
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
