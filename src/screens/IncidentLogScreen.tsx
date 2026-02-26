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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../theme/colors";

// ✅ Speech-to-text (voice input)
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

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

/* ===================== RATE LIMIT (10 seconds) ===================== */
const INCIDENT_SUBMIT_COOLDOWN_MS = 10_000;
const INCIDENT_LAST_SUBMIT_KEY = "tahanansafe_last_incident_submit_at_v1";

function formatSecondsCeil(ms: number) {
  const s = Math.ceil(ms / 1000);
  return s <= 0 ? 0 : s;
}
/* ============================================================ */

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

// Speech-to-text helpers
const SPEECH_LANG = "en-US";

function safeTrim(s: string) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function joinWithSpace(a: string, b: string) {
  const aa = safeTrim(a);
  const bb = safeTrim(b);
  if (!aa) return bb;
  if (!bb) return aa;
  return `${aa} ${bb}`;
}

/**
 * ✅ Fix: expo-speech-recognition usually returns:
 *   event.results[0]?.transcript
 * But some implementations may return nested arrays (web-ish):
 *   event.results[0][0]?.transcript
 * We support both.
 */
function extractTranscriptFromEvent(event: any): string {
  try {
    const results = event?.results;

    // ✅ common shape: [{ transcript: "..." }, ...]
    if (Array.isArray(results) && results.length > 0) {
      const r0 = results[0];

      if (r0 && typeof r0 === "object" && typeof r0.transcript === "string") {
        return r0.transcript;
      }

      // ✅ fallback: [[{ transcript: "..." }]]
      if (Array.isArray(r0) && r0.length > 0) {
        const alt0 = r0[0];
        if (alt0 && typeof alt0 === "object" && typeof alt0.transcript === "string") {
          return alt0.transcript;
        }
      }
    }

    // ✅ last fallback
    if (typeof event?.transcript === "string") return event.transcript;
  } catch {
    // ignore
  }
  return "";
}

export default function IncidentLogScreen({
  onBack,
  onProceedConfirm,
  onSubmitted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const s = useMemo(() => clamp(screenWidth / 375, 0.9, 1.2), [screenWidth]);

  // ✅ Mode still exists internally, but UI button is removed.
  const [mode, setMode] = useState<Mode>("complain");
  const [incidentType, setIncidentType] = useState<IncidentTypeValue>("Other");

  const [details, setDetails] = useState("");
  const [offenderName, setOffenderName] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [witnessType, setWitnessType] = useState("");

  const detailsInputRef = React.useRef<TextInput>(null);

  // ✅ REAL current date/time (LIVE update every 2 seconds)
  const [dateStr, setDateStr] = useState(() => formatDateMMDDYYYY(new Date()));
  const [timeStr, setTimeStr] = useState(() => formatTime12h(new Date()));

  // ✅ location string sent to backend (still used, but not shown in a box)
  const [locationStr, setLocationStr] = useState("Brgy. 12");

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  // ✅ Speech-to-text state
  const [recognizing, setRecognizing] = useState(false);
  const [speechPreview, setSpeechPreview] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Base text before we started speaking (so interim results append correctly)
  const speechBaseRef = React.useRef("");
  const lastFinalRef = React.useRef("");

  // ✅ rate limit cache (avoid reading AsyncStorage too often)
  const lastSubmitAtRef = React.useRef<number>(0);

  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(INCIDENT_LAST_SUBMIT_KEY);
        const parsed = raw ? Number(raw) : 0;
        if (Number.isFinite(parsed) && parsed > 0) lastSubmitAtRef.current = parsed;
      } catch {
        // ignore
      }
    })();
  }, []);

  const getRemainingCooldownMs = React.useCallback(async () => {
    const now = Date.now();

    // Use ref first
    let last = lastSubmitAtRef.current || 0;

    // If ref empty, try storage once
    if (!last) {
      try {
        const raw = await AsyncStorage.getItem(INCIDENT_LAST_SUBMIT_KEY);
        const parsed = raw ? Number(raw) : 0;
        if (Number.isFinite(parsed) && parsed > 0) {
          last = parsed;
          lastSubmitAtRef.current = parsed;
        }
      } catch {
        // ignore
      }
    }

    const elapsed = now - last;
    const remaining = INCIDENT_SUBMIT_COOLDOWN_MS - elapsed;
    return remaining > 0 ? remaining : 0;
  }, []);

  const blockIfCoolingDown = React.useCallback(
    async (actionLabel = "report") => {
      const remaining = await getRemainingCooldownMs();
      if (remaining > 0) {
        const secs = formatSecondsCeil(remaining);
        Alert.alert(
          "Please wait",
          `You can ${actionLabel} again in ${secs} second${secs === 1 ? "" : "s"}.`
        );
        return true; // blocked
      }
      return false;
    },
    [getRemainingCooldownMs]
  );

  const markSubmittedNow = React.useCallback(async () => {
    const now = Date.now();
    lastSubmitAtRef.current = now;
    try {
      await AsyncStorage.setItem(INCIDENT_LAST_SUBMIT_KEY, String(now));
    } catch {
      // ignore
    }
  }, []);

  // ✅ If you ever setMode("emergency") somewhere else, this keeps incidentType aligned.
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

  // Stop recognition on unmount
  React.useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  // Speech recognition events
  useSpeechRecognitionEvent("start", () => {
    setRecognizing(true);
    setSpeechError(null);
  });

  useSpeechRecognitionEvent("end", () => {
    setRecognizing(false);
    setSpeechPreview("");
    lastFinalRef.current = "";
  });

  useSpeechRecognitionEvent("result", (event: any) => {
    const t = safeTrim(extractTranscriptFromEvent(event));
    if (!t) return;

    const isFinal = event?.isFinal === true;

    if (isFinal) {
      // ✅ Commit final into base, so next speech continues from here
      const newBase = joinWithSpace(speechBaseRef.current, t);

      speechBaseRef.current = newBase;
      lastFinalRef.current = t;

      setDetails(newBase);
      setSpeechPreview("");
      return;
    }

    // interim
    setSpeechPreview(t);
    setDetails(joinWithSpace(speechBaseRef.current, t));
  });

  useSpeechRecognitionEvent("error", (event: any) => {
    const msg = event?.message || "Speech recognition error";
    log("Speech error", event);
    setRecognizing(false);
    setSpeechPreview("");
    setSpeechError(String(msg));
    Alert.alert("Voice Input Error", String(msg));
  });

  const startVoiceInput = async () => {
    try {
      setSpeechError(null);

      const available = ExpoSpeechRecognitionModule.isRecognitionAvailable?.();
      if (available === false) {
        Alert.alert(
          "Voice Input Unavailable",
          "Speech recognition is not available on this device."
        );
        return;
      }

      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm?.granted) {
        Alert.alert(
          "Permission Needed",
          "Please allow microphone and speech recognition permissions."
        );
        return;
      }

      // ✅ Focus the Incident Detail box so user sees text being inserted
      detailsInputRef.current?.focus?.();

      speechBaseRef.current = safeTrim(details);
      lastFinalRef.current = "";
      setSpeechPreview("");

      ExpoSpeechRecognitionModule.start({
        lang: SPEECH_LANG,
        interimResults: true,
        continuous: false,
      });
    } catch (e: any) {
      log("startVoiceInput ERROR", e);
      Alert.alert("Voice Input Error", e?.message || "Could not start voice input.");
    }
  };

  const stopVoiceInput = async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e: any) {
      log("stopVoiceInput ERROR", e);
      setRecognizing(false);
    }
  };

  const toggleVoiceInput = async () => {
    if (submitting) return;
    if (recognizing) await stopVoiceInput();
    else await startVoiceInput();
  };

  const FOOTER_H = 72 * s;
  const CONTENT_BOTTOM_PAD = Math.max(insets.bottom, 10) + FOOTER_H + 16;

  const [photos, setPhotos] = useState<string[]>([]);
  const MAX_PHOTOS = 3;

  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // ===================== PHOTO HELPERS (UPDATED) =====================
  const canAddMorePhotos = () => photos.length < MAX_PHOTOS;

  const mergeAndLimitPhotos = (newUris: string[]) => {
    if (!newUris || newUris.length === 0) return;

    setPhotos((prev) => {
      const merged = Array.from(new Set([...prev, ...newUris]));
      const sliced = merged.slice(0, MAX_PHOTOS);
      log("Photos state updated", { prevCount: prev.length, newCount: sliced.length });
      return sliced;
    });
  };

  const pickFromGallery = async () => {
    if (submitting) return;

    if (!canAddMorePhotos()) {
      Alert.alert("Max reached", `You can only add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    log("MediaLibrary permission result", perm);

    if (perm.status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access so you can upload images.");
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

    log("ImagePicker gallery canceled", result.canceled);
    if (result.canceled) return;

    const newUris = (result.assets ?? []).map((a) => a.uri).filter(Boolean);
    log("Picked gallery photo URIs count", newUris.length);

    mergeAndLimitPhotos(newUris);
  };

  const takePhoto = async () => {
    if (submitting) return;

    if (!canAddMorePhotos()) {
      Alert.alert("Max reached", `You can only add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    log("Camera permission result", camPerm);

    if (camPerm.status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access so you can take a photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    log("Camera canceled", result.canceled);
    if (result.canceled) return;

    const uri = result.assets?.[0]?.uri;
    if (!uri) return;

    mergeAndLimitPhotos([uri]);
  };

  // ✅ Now Add Photo shows option picker
  const onAddPhoto = async () => {
    try {
      if (submitting) return;

      if (!canAddMorePhotos()) {
        Alert.alert("Max reached", `You can only add up to ${MAX_PHOTOS} photos.`);
        return;
      }

      Alert.alert("Add Photo", "Choose a source:", [
        { text: "Take a Picture", onPress: () => void takePhoto() },
        { text: "Upload from Gallery", onPress: () => void pickFromGallery() },
        { text: "Cancel", style: "cancel" },
      ]);
    } catch (e) {
      log("onAddPhoto ERROR", e);
      Alert.alert("Error", "Could not open photo options. Please try again.");
    }
  };
  // ================================================================

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
    setSpeechPreview("");
    setSpeechError(null);
    speechBaseRef.current = "";
    lastFinalRef.current = "";
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

      // ✅ mark cooldown only AFTER successful submit
      await markSubmittedNow();

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

    if (recognizing) {
      Alert.alert("Voice input active", "Please stop voice input before submitting.");
      return;
    }

    if (!details.trim()) {
      Alert.alert("Incomplete", "Please fill in the required fields.");
      return;
    }

    // ✅ rate limit before allowing submit/preview flow
    const blocked = await blockIfCoolingDown("submit a report");
    if (blocked) return;

    if (mode === "emergency") {
      await submitToBackend();
      return;
    }

    // complain -> preview/confirm flow
    if (onProceedConfirm) {
      onProceedConfirm(buildPreviewData());
      return;
    }

    setShowPreview(true);
  };

  const onConfirmComplaint = async () => {
    if (submitting) return;

    // ✅ rate limit again here (covers cases where user stayed in preview, etc.)
    const blocked = await blockIfCoolingDown("submit a report");
    if (blocked) return null as any;

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

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_BOTTOM_PAD },
          ]}
        >
          <View style={styles.card}>
            <View style={styles.detailsHeaderRow}>
              <Text style={styles.sectionTitle}>
                {detailsLabel} <Text style={styles.required}>*</Text>
              </Text>

              <Pressable
                disabled={submitting}
                onPress={toggleVoiceInput}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.micBtn,
                  recognizing && styles.micBtnActive,
                  (pressed || submitting) && { opacity: 0.9 },
                ]}
              >
                <Ionicons
                  name={recognizing ? "mic" : "mic-outline"}
                  size={16}
                  color={recognizing ? "#FFFFFF" : Colors.primary}
                />
                <Text style={[styles.micText, recognizing && { color: "#FFFFFF" }]}>
                  {recognizing ? "Listening..." : "Voice"}
                </Text>
              </Pressable>
            </View>

            {!!speechError && (
              <Text style={styles.speechErrorText}>{speechError}</Text>
            )}

            {/* Details */}
            <View style={[styles.input, styles.textArea]}>
              <TextInput
                ref={detailsInputRef}
                editable={!submitting}
                value={details}
                onChangeText={(t) => {
                  setDetails(t);
                  if (!recognizing) {
                    speechBaseRef.current = safeTrim(t);
                    lastFinalRef.current = "";
                  }
                }}
                placeholder="A detailed explanation of what happened, including actions, sequence of events, and any relevant details observed during the incident."
                placeholderTextColor="#9AA7B5"
                multiline
                textAlignVertical="top"
                style={styles.textAreaInput}
              />
            </View>

            {recognizing && (
              <Text style={styles.speechHint}>
                Speak now. Tap “Listening...” to stop.
              </Text>
            )}

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

  detailsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: TEXT_DARK,
  },
  required: {
    color: "#E11D48",
    fontWeight: "900",
  },

  micBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 12,
  },
  micBtnActive: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },
  micText: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.primary,
  },
  speechHint: {
    marginTop: -4,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "800",
    color: "#52677A",
  },
  speechErrorText: {
    marginTop: -6,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "900",
    color: "#E11D48",
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