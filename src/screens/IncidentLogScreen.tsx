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
import * as Location from "expo-location";
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

// ✅ Type picker removed, but keep a safe internal value for backend compatibility
type IncidentTypeValue = "Other" | "Emergency";

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

/* ===================== LOCATION HELPERS ===================== */
function formatCoords(lat: number, lon: number) {
  const la = Number.isFinite(lat) ? lat.toFixed(6) : "0.000000";
  const lo = Number.isFinite(lon) ? lon.toFixed(6) : "0.000000";
  return `${la}, ${lo}`;
}

function formatAddressFromReverseGeocode(
  geo: Partial<Location.LocationGeocodedAddress> | undefined,
  fallbackCoords: string
) {
  if (!geo) return `GPS: ${fallbackCoords}`;

  const parts = [
    geo.name,
    geo.street,
    geo.district,
    geo.city,
    geo.region,
    geo.postalCode,
    geo.country,
  ]
    .filter(Boolean)
    .map(String);

  if (parts.length === 0) return `GPS: ${fallbackCoords}`;

  const cleaned: string[] = [];
  for (const p of parts) {
    if (cleaned.length === 0 || cleaned[cleaned.length - 1] !== p) cleaned.push(p);
  }

  return cleaned.join(", ");
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

  const [incidentType, setIncidentType] = useState<IncidentTypeValue>("Other");

  const [details, setDetails] = useState("");

  const [offenderName, setOffenderName] = useState("");

  const [witnessName, setWitnessName] = useState("");
  const [witnessType, setWitnessType] = useState("");

  // ✅ REAL current date/time (LIVE update every 2 seconds)
  const [dateStr, setDateStr] = useState(() => formatDateMMDDYYYY(new Date()));
  const [timeStr, setTimeStr] = useState(() => formatTime12h(new Date()));

  // ✅ location string sent to backend (still used, but not shown in a box)
  const [locationStr, setLocationStr] = useState("Brgy. 12");

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  React.useEffect(() => {
    if (mode === "emergency") setIncidentType("Emergency");
    else setIncidentType("Other");
  }, [mode]);

  React.useEffect(() => {
    const tick = () => {
      const now = new Date();
      setDateStr(formatDateMMDDYYYY(now));
      setTimeStr(formatTime12h(now));
    };

    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    (async () => {
      await requestAndSetCurrentLocation({ silent: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const FOOTER_H = 72 * s;
  const CONTENT_BOTTOM_PAD = Math.max(insets.bottom, 10) + FOOTER_H + 16;

  const [photos, setPhotos] = useState<string[]>([]);
  const MAX_PHOTOS = 3;

  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const openModePicker = () => {
    if (submitting) return;
    Alert.alert("Mode", "Choose one:", [
      { text: "Complain", onPress: () => setMode("complain") },
      { text: "Emergency", onPress: () => setMode("emergency") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const requestAndSetCurrentLocation = async (opts?: { silent?: boolean }) => {
    if (submitting) return;
    if (locationLoading) return;

    setLocationLoading(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      log("Location permission", perm);

      const granted = perm.status === "granted";
      setLocationGranted(granted);

      if (!granted) {
        if (!opts?.silent) {
          Alert.alert(
            "Location Permission Denied",
            "You denied location access. We will use the default location instead."
          );
        }
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const coordsStr = formatCoords(lat, lon);

      let pretty = `GPS: ${coordsStr}`;
      try {
        const rev = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lon,
        });
        const first = rev?.[0];
        pretty = formatAddressFromReverseGeocode(first, coordsStr);
      } catch (e) {
        log("reverseGeocode failed", e);
        pretty = `GPS: ${coordsStr}`;
      }

      setLocationStr(pretty);

      if (!opts?.silent) {
        Alert.alert("Location Updated", "We captured your current location.");
      }
    } catch (e: any) {
      log("requestAndSetCurrentLocation ERROR", e);
      if (!opts?.silent) {
        Alert.alert("Location Error", e?.message || "Could not fetch your location.");
      }
    } finally {
      setLocationLoading(false);
    }
  };

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
        selectionLimit: remaining,
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
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPreviewData = (): IncidentPreviewData =>
    ({
      incidentType,
      details,
      offenderName,
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
    setIncidentType(mode === "emergency" ? "Emergency" : "Other");
    setDetails("");
    setOffenderName("");
    setWitnessName("");
    setWitnessType("");
    setPhotos([]);
  };

  const submitToBackend = async (): Promise<SubmitIncidentResponse> => {
    const payload = {
      mode,
      incidentType,
      details,
      offenderName,
      witnessName,
      witnessType,
      dateStr,
      timeStr,
      locationStr,
      photos,
    };

    setSubmitting(true);
    try {
      const res = (await submitIncident(payload as any)) as SubmitIncidentResponse;

      Alert.alert(
        mode === "emergency" ? "Emergency Sent" : "Complaint Secured",
        "Your report has been submitted."
      );

      resetForm();
      return res;
    } catch (err: any) {
      Alert.alert("Submit failed", err?.message || "Something went wrong. Please try again.");
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async () => {
    if (submitting) return;

    if (mode === "emergency") {
      if (!details.trim()) {
        Alert.alert("Incomplete", "Please fill in the required fields.");
        return;
      }
      await submitToBackend();
      return;
    }

    if (!details.trim()) {
      Alert.alert("Incomplete", "Please fill in the required fields.");
      return;
    }

    if (onProceedConfirm) {
      onProceedConfirm(buildPreviewData());
      return;
    }

    setShowPreview(true);
  };

  const onConfirmComplaint = async () => {
    if (submitting) return;

    const res = await submitToBackend();

    const incidentId = res?.incident?._id || "";
    const createdAt = res?.incident?.createdAt;

    setShowPreview(false);

    onSubmitted?.({ incidentId, createdAt });
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

            {/* Offender */}
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

            {/* ✅ Location label + button ONLY (box removed) */}
            <View style={{ marginTop: 6, marginBottom: 6 }}>
              <Text style={styles.sectionTitle}>Location</Text>

              <Pressable
                disabled={submitting || locationLoading}
                onPress={() => requestAndSetCurrentLocation({ silent: false })}
                style={({ pressed }) => [
                  styles.locationBtnSolo,
                  (pressed || locationLoading || submitting) && { opacity: 0.9 },
                ]}
              >
                {locationLoading ? (
                  <ActivityIndicator />
                ) : (
                  <Ionicons name="locate-outline" size={16} color={Colors.primary} />
                )}
                <Text style={styles.locationBtnText}>
                  {locationLoading ? "Updating..." : "Use Current Location"}
                </Text>
              </Pressable>

              {locationGranted === false && (
                <Text style={styles.locationHintSolo}>
                  Permission denied (using default location)
                </Text>
              )}
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

  // ✅ location button only
  locationBtnSolo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 14,
  },
  locationBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.primary,
  },
  locationHintSolo: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "800",
    color: "#9AA7B5",
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
