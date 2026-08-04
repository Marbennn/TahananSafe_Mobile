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
  Animated,
  Easing,
  Keyboard,
  Switch,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ✅ Speech-to-text (voice input)
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

// ✅ API
import { submitIncident } from "../api/incidents";

// ✅ AI API
import { analyzeIncident, type AiAnalyzeResponse } from "../api/ai";

// ✅ preview screen
import IncidentLogConfirmScreen from "./IncidentLogConfirmationScreen";
// ✅ TYPE
import type { IncidentPreviewData } from "../components/IncidentLogConfirmationScreen/IncidentPreviewCard";
import type { TabKey } from "../components/BottomNavBar";
import IncidentLocationMapModal from "../components/IncidentLocationMapModal";
import IncidentVideoPreviewModal from "../components/IncidentVideoPreviewModal";
import IncidentProgressHeader from "../components/IncidentLogScreen/IncidentProgressHeader";
import { showNativeAlert } from "../components/AppAlertProvider";
import { Colors, PRIMARY_ACTION_COLOR } from "../theme/colors";

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
type WitnessRelationship = "Neighbor" | "Parent" | "Friend" | "Other";

const WITNESS_RELATIONSHIPS: WitnessRelationship[] = [
  "Neighbor",
  "Parent",
  "Friend",
  "Other",
];

// ✅ Type picker removed, but keep a safe internal value for backend compatibility
type IncidentTypeValue = "Other" | "Emergency";
type LocationCoords = { latitude: number; longitude: number };

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

function extractTranscriptFromEvent(event: any): string {
  try {
    const results = event?.results;

    if (Array.isArray(results) && results.length > 0) {
      const r0 = results[0];

      if (r0 && typeof r0 === "object" && typeof r0.transcript === "string") {
        return r0.transcript;
      }

      if (Array.isArray(r0) && r0.length > 0) {
        const alt0 = r0[0];
        if (alt0 && typeof alt0 === "object" && typeof alt0.transcript === "string") {
          return alt0.transcript;
        }
      }
    }

    if (typeof event?.transcript === "string") return event.transcript;
  } catch {
    // ignore
  }
  return "";
}

/** ✅ Prefer AI incident type for display + saving */
function normalizeAiIncidentType(v: any) {
  const s = safeTrim(String(v ?? ""));
  return s || "";
}

export default function IncidentLogScreen({
  onBack,
  onProceedConfirm,
  onSubmitted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const s = useMemo(() => clamp(screenWidth / 375, 0.9, 1.2), [screenWidth]);
  const isCompact = screenWidth < 360;

  const [mode, setMode] = useState<Mode>("complain");
  const [incidentType, setIncidentType] = useState<IncidentTypeValue>("Other");

  const [details, setDetails] = useState("");
  const [offenderName, setOffenderName] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [witnessType, setWitnessType] = useState<WitnessRelationship | "">("");
  const [witnessOtherType, setWitnessOtherType] = useState("");
  const [witnessRelationshipOpen, setWitnessRelationshipOpen] = useState(false);
  const [witnessKeyboardHeight, setWitnessKeyboardHeight] = useState(0);

  const detailsInputRef = React.useRef<TextInput>(null);
  const formScrollRef = React.useRef<ScrollView>(null);
  const formScrollOffsetRef = React.useRef(0);
  const preWitnessFocusScrollOffsetRef = React.useRef<number | null>(null);
  const witnessFocusScrollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dateStr, setDateStr] = useState(() => formatDateMMDDYYYY(new Date()));
  const [timeStr, setTimeStr] = useState(() => formatTime12h(new Date()));

  const [shareLocation, setShareLocation] = useState(false);
  const [includeWitness, setIncludeWitness] = useState(false);
  const [locationStr, setLocationStr] = useState("");
  const [locationCoords, setLocationCoords] = useState<LocationCoords | null>(null);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  const [recognizing, setRecognizing] = useState(false);
  const [speechPreview, setSpeechPreview] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiAnalyzeResponse | null>(null);
  const lastAnalyzedTextRef = React.useRef<string>("");

  const [photos, setPhotos] = useState<string[]>([]);
  const MAX_PHOTOS = 3;
  const [videos, setVideos] = useState<string[]>([]);
  const MAX_VIDEOS = 1;
  const MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024;
  const [previewVideoUri, setPreviewVideoUri] = useState<string | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [previewHeaderActive, setPreviewHeaderActive] = useState(false);
  const [transitioningPreview, setTransitioningPreview] = useState(false);
  const previewSlideProgress = React.useRef(new Animated.Value(0)).current;
  const [submitting, setSubmitting] = useState(false);

  const resolvedWitnessType =
    witnessType === "Other"
      ? safeTrim(witnessOtherType) || "Other"
      : witnessType;

  const scrollWitnessFieldIntoView = React.useCallback(() => {
    if (preWitnessFocusScrollOffsetRef.current === null) {
      preWitnessFocusScrollOffsetRef.current = formScrollOffsetRef.current;
    }

    if (Platform.OS === "android") {
      const visibleKeyboardHeight = Math.max(
        0,
        Number(Keyboard.metrics()?.height || 0)
      );
      if (visibleKeyboardHeight > 0) {
        setWitnessKeyboardHeight(visibleKeyboardHeight);
      }
    }

    if (witnessFocusScrollTimerRef.current) {
      clearTimeout(witnessFocusScrollTimerRef.current);
    }

    const scrollToField = () => {
      formScrollRef.current?.scrollToEnd({ animated: true });
    };

    requestAnimationFrame(scrollToField);
    witnessFocusScrollTimerRef.current = setTimeout(
      scrollToField,
      Platform.OS === "android" ? 320 : 220
    );
  }, []);

  React.useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      if (preWitnessFocusScrollOffsetRef.current === null) return;

      const keyboardHeight = Math.max(
        0,
        Number(event?.endCoordinates?.height || 0)
      );
      setWitnessKeyboardHeight(keyboardHeight);

      if (witnessFocusScrollTimerRef.current) {
        clearTimeout(witnessFocusScrollTimerRef.current);
      }
      witnessFocusScrollTimerRef.current = setTimeout(() => {
        formScrollRef.current?.scrollToEnd({ animated: true });
      }, 80);
    });

    const keyboardHideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      if (witnessFocusScrollTimerRef.current) {
        clearTimeout(witnessFocusScrollTimerRef.current);
        witnessFocusScrollTimerRef.current = null;
      }

      setWitnessKeyboardHeight(0);

      const previousOffset = preWitnessFocusScrollOffsetRef.current;
      if (previousOffset === null) return;

      preWitnessFocusScrollOffsetRef.current = null;
      witnessFocusScrollTimerRef.current = setTimeout(() => {
        formScrollRef.current?.scrollTo({ y: previousOffset, animated: true });
        witnessFocusScrollTimerRef.current = null;
      }, 80);
    });

    return () => {
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
      if (witnessFocusScrollTimerRef.current) {
        clearTimeout(witnessFocusScrollTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!showPreview) return;

    const animation = Animated.timing(previewSlideProgress, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished) setTransitioningPreview(false);
    });

    return () => animation.stop();
  }, [previewSlideProgress, showPreview]);

  /** ✅ AI staleness */
  const aiIsStale = useMemo(() => {
    const cur = safeTrim(details);
    const last = safeTrim(lastAnalyzedTextRef.current);
    if (!aiResult) return false;
    if (!last) return true;
    return cur !== last;
  }, [details, aiResult]);

  /** ✅ NEW: incident type to use (AI first, fallback to internal) */
  const getDisplayIncidentType = React.useCallback(() => {
    if (mode === "emergency") return "Emergency";

    const aiType = normalizeAiIncidentType((aiResult as any)?.incident_type);
    if (aiType) return aiType;

    return incidentType || "Other";
  }, [aiResult, incidentType, mode]);

  /**
   * ✅ Auto-analyze when user clicks "Secure Complaint"
   * - Only runs for complain mode
   * - Only runs if no aiResult OR stale
   * - Retries automatically until AI responds (no failure alert)
   */
  const MAX_AI_RETRIES = 10;

  const autoAnalyzeIfNeeded = React.useCallback(async (): Promise<boolean> => {
    if (mode !== "complain") return true;
    if (submitting || aiLoading) return false;

    if (recognizing) {
      Alert.alert("Voice input active", "Please stop voice input before securing the complaint.");
      return false;
    }

    const text = safeTrim(details);
    if (!text) return true; // validation handled elsewhere

    // if we already have AI and it's not stale -> ok
    if (aiResult && !aiIsStale) return true;

    setAiLoading(true);
    setAiError(null);

    for (let attempt = 1; attempt <= MAX_AI_RETRIES; attempt++) {
      try {
        const res = await analyzeIncident(text);
        setAiResult(res);
        lastAnalyzedTextRef.current = text;
        setAiLoading(false);
        return true;
      } catch (e: any) {
        const msg = e?.message || "AI analyze failed.";
        setAiError(`Retrying analysis... (attempt ${attempt})`);
        log(`AI analyze attempt ${attempt} failed`, msg);

        if (attempt >= MAX_AI_RETRIES) {
          setAiResult(null);
          setAiError(msg);
          setAiLoading(false);
          Alert.alert("AI Analyze Failed", "Could not reach the AI after multiple attempts. Please try again later.");
          return false;
        }

        // Wait before retrying (2 seconds between attempts)
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    setAiLoading(false);
    return false;
  }, [mode, submitting, recognizing, details, aiResult, aiIsStale]);

  const speechBaseRef = React.useRef("");
  const lastFinalRef = React.useRef("");

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
    let last = lastSubmitAtRef.current || 0;

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
        return true;
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
    return () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore
      }
    };
  }, []);

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
      const newBase = joinWithSpace(speechBaseRef.current, t);

      speechBaseRef.current = newBase;
      lastFinalRef.current = t;

      setDetails(newBase);
      setSpeechPreview("");
      return;
    }

    setSpeechPreview(t);
    setDetails(joinWithSpace(speechBaseRef.current, t));
  });

  useSpeechRecognitionEvent("error", (event: any) => {
    const errorCode = String(event?.error ?? event?.code ?? "").toLowerCase();
    const isExpectedAbort =
      errorCode === "aborted" ||
      errorCode === "-1" ||
      String(event?.message || "").toLowerCase().includes("aborted");

    if (isExpectedAbort) {
      setRecognizing(false);
      setSpeechPreview("");
      setSpeechError(null);
      return;
    }

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
    if (submitting || aiLoading) return;
    if (recognizing) await stopVoiceInput();
    else await startVoiceInput();
  };

  const CONTENT_BOTTOM_PAD = 16 * s;
  const FOOTER_BOTTOM_PAD =
    Platform.OS === "android"
      ? Math.min(Math.max(insets.bottom, 24), 48)
      : Math.max(insets.bottom, 12);

  const requestAndSetCurrentLocation = async (
    opts?: { silent?: boolean }
  ): Promise<LocationCoords | null> => {
    if (submitting || aiLoading) return null;
    if (locationLoading) return null;

    setLocationLoading(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      log("Location permission", perm);

      const granted = perm.status === "granted";
      setLocationGranted(granted);

      if (!granted) {
        setLocationCoords(null);
        setShowLocationMap(false);
        if (!opts?.silent) {
          Alert.alert(
            "Location Permission Denied",
            "You denied location access. We will use the default location instead."
          );
        }
        return null;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const coordsStr = formatCoords(lat, lon);
      const nextCoords = { latitude: lat, longitude: lon };

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
      setLocationCoords(nextCoords);

      if (!opts?.silent) {
        Alert.alert("Location Updated", "We captured your current location.");
      }
      return nextCoords;
    } catch (e: any) {
      log("requestAndSetCurrentLocation ERROR", e);
      setLocationCoords(null);
      setShowLocationMap(false);
      if (!opts?.silent) {
        Alert.alert("Location Error", e?.message || "Could not fetch your location.");
      }
      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  const toggleShareLocation = async (value: boolean) => {
    if (submitting || aiLoading || locationLoading) return;

    setShareLocation(value);
    if (!value) {
      setLocationCoords(null);
      setLocationStr("");
      setShowLocationMap(false);
      setLocationGranted(null);
      return;
    }

    const coords = await requestAndSetCurrentLocation({ silent: false });
    if (!coords) {
      setShareLocation(false);
    }
  };

  const openLocationMap = async () => {
    if (submitting || aiLoading || locationLoading) return;

    let coords = locationCoords;
    if (!coords) {
      coords = await requestAndSetCurrentLocation({ silent: false });
    }

    if (!coords) return;

    setShareLocation(true);
    setShowLocationMap(true);
  };

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

  const takePhoto = async () => {
    if (submitting || aiLoading) return;

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

  const removePhotoAt = (index: number) => {
    if (submitting) return;
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const canAddMoreVideos = () => videos.length < MAX_VIDEOS;

  const videoSizeLabel = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)}MB`;

  const isVideoWithinSizeLimit = (asset: ImagePicker.ImagePickerAsset | undefined) => {
    const fileSize = asset?.fileSize;
    if (typeof fileSize !== "number" || !Number.isFinite(fileSize)) return true;

    if (fileSize <= MAX_VIDEO_SIZE_BYTES) return true;

    Alert.alert(
      "Video too large",
      `Please upload a video that is 10MB or smaller. Selected video is ${videoSizeLabel(fileSize)}.`
    );
    return false;
  };

  const addVideoUris = (newUris: string[]) => {
    if (!newUris || newUris.length === 0) return;

    setVideos((prev) => {
      const merged = Array.from(new Set([...prev, ...newUris]));
      return merged.slice(0, MAX_VIDEOS);
    });
  };

  const recordVideo = async () => {
    if (submitting || aiLoading) return;

    if (!canAddMoreVideos()) {
      Alert.alert("Max reached", `You can only add up to ${MAX_VIDEOS} video.`);
      return;
    }

    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (camPerm.status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access so you can record video evidence.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      videoMaxDuration: 60,
      quality: 0.7,
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!isVideoWithinSizeLimit(asset)) return;

    const uri = asset?.uri;
    if (uri) addVideoUris([uri]);
  };

  const getAttachmentType = (
    asset: ImagePicker.ImagePickerAsset
  ): "image" | "video" | null => {
    const assetType = String(asset.type || "").toLowerCase();
    const mimeType = String(asset.mimeType || "").toLowerCase();
    const sourceName = `${asset.fileName || ""} ${asset.uri || ""}`.toLowerCase();

    if (
      assetType.includes("video") ||
      mimeType.startsWith("video/") ||
      /\.(mp4|mov|m4v|3gp|webm|mkv|avi)(?:\?|$)/i.test(sourceName)
    ) {
      return "video";
    }

    if (
      assetType === "image" ||
      assetType === "livephoto" ||
      mimeType.startsWith("image/") ||
      /\.(jpe?g|png|gif|webp|bmp|heic|heif|dng)(?:\?|$)/i.test(sourceName)
    ) {
      return "image";
    }

    return null;
  };

  const pickAttachmentsFromGallery = async () => {
    if (submitting || aiLoading) return;

    const remainingPhotoSlots = MAX_PHOTOS - photos.length;
    const remainingVideoSlots = MAX_VIDEOS - videos.length;
    const remainingAttachmentSlots = remainingPhotoSlots + remainingVideoSlots;

    if (remainingAttachmentSlots <= 0) {
      Alert.alert(
        "Max reached",
        `You can only add up to ${MAX_PHOTOS} images and ${MAX_VIDEOS} video.`
      );
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    log("MediaLibrary permission result", perm);

    if (perm.status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow photo and video access so you can upload attachments."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: remainingAttachmentSlots > 1,
      selectionLimit: remainingAttachmentSlots,
      videoMaxDuration: 60,
    });

    if (result.canceled) return;

    const newPhotoUris: string[] = [];
    const newVideoUris: string[] = [];
    let availablePhotoSlots = remainingPhotoSlots;
    let availableVideoSlots = remainingVideoSlots;
    let skippedForLimit = false;
    let skippedUnsupported = false;

    for (const asset of result.assets ?? []) {
      const uri = asset.uri;
      if (!uri) continue;

      const attachmentType = getAttachmentType(asset);
      if (!attachmentType) {
        skippedUnsupported = true;
        continue;
      }

      if (attachmentType === "video") {
        if (videos.includes(uri) || newVideoUris.includes(uri)) continue;
        if (availableVideoSlots <= 0) {
          skippedForLimit = true;
          continue;
        }
        if (!isVideoWithinSizeLimit(asset)) continue;

        newVideoUris.push(uri);
        availableVideoSlots -= 1;
        continue;
      }

      if (photos.includes(uri) || newPhotoUris.includes(uri)) continue;
      if (availablePhotoSlots <= 0) {
        skippedForLimit = true;
        continue;
      }

      newPhotoUris.push(uri);
      availablePhotoSlots -= 1;
    }

    mergeAndLimitPhotos(newPhotoUris);
    addVideoUris(newVideoUris);

    if (skippedUnsupported) {
      Alert.alert("Unsupported attachment", "Only images and videos can be attached.");
    } else if (skippedForLimit) {
      Alert.alert(
        "Attachment limit",
        `Some files were not added. You can attach up to ${MAX_PHOTOS} images and ${MAX_VIDEOS} video.`
      );
    }
  };

  const showCameraAttachmentOptions = () => {
    showNativeAlert("Use Camera", "Choose an attachment type:", [
      { text: "Take Photo", onPress: () => void takePhoto() },
      { text: "Record Video", onPress: () => void recordVideo() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const onAddAttachment = async () => {
    try {
      if (submitting || aiLoading) return;

      if (!canAddMorePhotos() && !canAddMoreVideos()) {
        Alert.alert(
          "Max reached",
          `You can only add up to ${MAX_PHOTOS} images and ${MAX_VIDEOS} video.`
        );
        return;
      }

      showNativeAlert("Add Attachment", "Choose a source:", [
        { text: "Use Camera", onPress: showCameraAttachmentOptions },
        { text: "Upload from Gallery", onPress: () => void pickAttachmentsFromGallery() },
        { text: "Cancel", style: "cancel" },
      ]);
    } catch (e) {
      log("onAddAttachment ERROR", e);
      Alert.alert("Error", "Could not open attachment options. Please try again.");
    }
  };

  const removeVideoAt = (index: number) => {
    if (submitting || aiLoading) return;
    setVideos((prev) => {
      const removedUri = prev[index];
      if (removedUri && previewVideoUri === removedUri) {
        setPreviewVideoUri(null);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  /** ✅ UPDATED: preview uses AI incident type */
  const buildPreviewData = (): IncidentPreviewData =>
    ({
      incidentType: getDisplayIncidentType(),
      details,
      offenderName,
      witnessName: includeWitness ? witnessName : "",
      witnessType: includeWitness ? resolvedWitnessType : "",
      dateStr,
      timeStr,
      locationStr: shareLocation ? locationStr : "",
      latitude: shareLocation ? locationCoords?.latitude : undefined,
      longitude: shareLocation ? locationCoords?.longitude : undefined,
      photoCount: photos.length,
      photos,
      videoCount: videos.length,
      videos,
      mode,
      aiResult,
    } as any);

  const resetForm = () => {
    log("resetForm()");
    setIncidentType(mode === "emergency" ? "Emergency" : "Other");
    setDetails("");
    setOffenderName("");
    setWitnessName("");
    setWitnessType("");
    setWitnessOtherType("");
    setWitnessRelationshipOpen(false);
    setPhotos([]);
    setVideos([]);
    setPreviewVideoUri(null);
    setShareLocation(false);
    setIncludeWitness(false);
    setLocationStr("");
    setLocationCoords(null);
    setShowLocationMap(false);
    setLocationGranted(null);
    setSpeechPreview("");
    setSpeechError(null);
    speechBaseRef.current = "";
    lastFinalRef.current = "";

    setAiLoading(false);
    setAiError(null);
    setAiResult(null);
    lastAnalyzedTextRef.current = "";
  };

  const submitToBackend = async (): Promise<SubmitIncidentResponse> => {
    const exactCoords = shareLocation
      ? locationCoords ??
        (locationGranted !== false
          ? await requestAndSetCurrentLocation({ silent: true })
          : null)
      : null;

    const incidentTypeToSend = getDisplayIncidentType();

    const payload: any = {
      mode,
      incidentType: incidentTypeToSend,
      details,
      offenderName,
      witnessName: includeWitness ? witnessName : "",
      witnessType: includeWitness ? resolvedWitnessType : "",
      dateStr,
      timeStr,
      locationStr: shareLocation ? locationStr : "",
      latitude: exactCoords?.latitude,
      longitude: exactCoords?.longitude,
      photos,
      videos,
    };

    if (aiResult) {
      payload.ai_incident_type = aiResult.incident_type ?? "";
      payload.ai_language = aiResult.language ?? "";
      payload.ai_risk_level = aiResult.risk_level ?? "";
      payload.ai_risk_percentage =
        typeof aiResult.risk_percentage === "number" ? aiResult.risk_percentage : undefined;
      payload.ai_priority_level = aiResult.priority_level ?? "";
      payload.ai_children_involved = aiResult.children_involved ?? undefined;
      payload.ai_weapon_mentioned = aiResult.weapon_mentioned ?? undefined;
      payload.ai_confidence_score =
        typeof aiResult.confidence_score === "number" ? aiResult.confidence_score : undefined;

      payload.ai_processing_time_ms =
        typeof (aiResult as any).processing_time_ms === "number"
          ? (aiResult as any).processing_time_ms
          : undefined;
    }

    setSubmitting(true);
    try {
      const res = (await submitIncident(payload)) as SubmitIncidentResponse;

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

  /** Open review without running AI analysis. */
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

    if (onProceedConfirm) {
      onProceedConfirm(buildPreviewData());
      return;
    }

    Keyboard.dismiss();
    previewSlideProgress.stopAnimation();
    previewSlideProgress.setValue(0);
    setTransitioningPreview(true);
    setPreviewHeaderActive(true);
    setShowPreview(true);
  };

  const closePreview = React.useCallback(() => {
    if (submitting || transitioningPreview) return;

    setTransitioningPreview(true);
    setPreviewHeaderActive(false);

    Animated.timing(previewSlideProgress, {
      toValue: 0,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      setTransitioningPreview(false);
      if (finished) setShowPreview(false);
    });
  }, [previewSlideProgress, submitting, transitioningPreview]);

  const onConfirmComplaint = async () => {
    if (submitting || aiLoading) return;

    const blocked = await blockIfCoolingDown("submit a report");
    if (blocked) return null as any;

    const res = await submitToBackend();

    const incidentId = res?.incident?._id || "";
    const createdAt = res?.incident?.createdAt;

    previewSlideProgress.setValue(0);
    setPreviewHeaderActive(false);
    setShowPreview(false);

    onSubmitted?.({ incidentId, createdAt });
    return { incidentId, createdAt };
  };

  const primaryActionText = submitting ? "Submitting..." : "Review Details";

  const draftedLine = useMemo(
    () =>
      new Date().toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [dateStr, timeStr]
  );

  const formTranslateX = previewSlideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -screenWidth],
  });
  const previewTranslateX = previewSlideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [screenWidth, 0],
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <IncidentProgressHeader
          screenTitle={previewHeaderActive ? "Incident Log Preview" : "New Report"}
          step={previewHeaderActive ? 2 : 1}
          stepTitle={previewHeaderActive ? "Details" : "Report"}
          navigationIcon={previewHeaderActive ? "chevron-back" : "close"}
          navigationDisabled={submitting || aiLoading || transitioningPreview}
          onNavigationPress={
            previewHeaderActive
              ? closePreview
              : onBack ?? (() => Alert.alert("Back", "Wire onBack() to navigation"))
          }
        />

        <View style={styles.transitionViewport}>
          <Animated.View
            pointerEvents={showPreview ? "none" : "auto"}
            style={[
              styles.transitionPane,
              { transform: [{ translateX: formTranslateX }] },
            ]}
          >
            <ScrollView
              ref={formScrollRef}
              style={styles.formScroll}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(event) => {
                formScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
              }}
              onContentSizeChange={() => {
                if (
                  witnessKeyboardHeight > 0 &&
                  preWitnessFocusScrollOffsetRef.current !== null
                ) {
                  formScrollRef.current?.scrollToEnd({ animated: true });
                }
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              contentContainerStyle={[
                styles.scrollContent,
                {
                  paddingBottom:
                    CONTENT_BOTTOM_PAD +
                    (Platform.OS === "android" && witnessKeyboardHeight > 0
                      ? witnessKeyboardHeight + 24
                      : 0),
                },
              ]}
        >
          <View style={styles.card}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel} allowFontScaling={false}>
                Incident Description<Text style={styles.required}>*</Text>
              </Text>
              <Pressable
                disabled={submitting || aiLoading}
                onPress={toggleVoiceInput}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.voiceBtn,
                  recognizing && styles.voiceBtnActive,
                  (pressed || submitting || aiLoading) && { opacity: 0.8 },
                ]}
              >
                <Ionicons name={recognizing ? "mic" : "mic-outline"} size={15} color={recognizing ? "#FFFFFF" : "#344052"} />
              </Pressable>
            </View>

            {!!speechError && <Text style={styles.errorText}>{speechError}</Text>}
            {!!aiError && <Text style={styles.errorText}>{aiError}</Text>}

            <View style={[styles.inputBox, styles.descriptionBox]}>
              <TextInput
                ref={detailsInputRef}
                editable={!submitting && !aiLoading}
                value={details}
                onChangeText={(t) => {
                  setDetails(t);
                  if (!recognizing) {
                    speechBaseRef.current = safeTrim(t);
                    lastFinalRef.current = "";
                  }
                  setAiError(null);
                }}
                placeholder="Describe what happened in detail....."
                placeholderTextColor="#A9A9A9"
                multiline
                textAlignVertical="top"
                style={styles.descriptionInput}
              />
            </View>

            {recognizing && (
              <Text style={styles.helperText} allowFontScaling={false}>Listening. Tap the mic to stop.</Text>
            )}

            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel} allowFontScaling={false}>Complaint</Text>
              <Text style={styles.optionalText} allowFontScaling={false}>(Optional)</Text>
            </View>

            <View style={styles.inputBox}>
              <TextInput
                editable={!submitting && !aiLoading}
                value={offenderName}
                onChangeText={setOffenderName}
                placeholder="Enter reported person name"
                placeholderTextColor="#A9A9A9"
                style={styles.textInput}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel} allowFontScaling={false}>Evidence</Text>
              <Text style={styles.optionalText} allowFontScaling={false}>(Optional)</Text>
            </View>

            <View style={styles.evidenceRow}>
              <Pressable
                disabled={submitting || aiLoading}
                onPress={onAddAttachment}
                style={({ pressed }) => [styles.evidenceTile, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="attach-outline" size={25} color="#344052" />
                <Text style={styles.evidenceText} allowFontScaling={false}>Add Attachment</Text>
              </Pressable>
            </View>

            {(photos.length > 0 || videos.length > 0) && (
              <View style={[styles.attachmentWrap, isCompact && styles.attachmentWrapCompact]}>
                {photos.map((uri, idx) => (
                  <Pressable
                    key={`${uri}-${idx}`}
                    disabled={submitting || aiLoading}
                    onPress={() => {
                      Alert.alert("Remove photo?", "Do you want to remove this photo?", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => removePhotoAt(idx) },
                      ]);
                    }}
                    style={styles.photoPreview}
                  >
                    <Image source={{ uri }} style={styles.photoPreviewImage} />
                    <View style={styles.removeBadge}>
                      <Ionicons name="close" size={12} color="#FFFFFF" />
                    </View>
                  </Pressable>
                ))}

                {videos.map((uri, idx) => (
                  <Pressable
                    key={`${uri}-${idx}`}
                    disabled={submitting || aiLoading}
                    onPress={() => setPreviewVideoUri(uri)}
                    style={styles.videoPreview}
                  >
                    <View style={styles.videoPreviewInner}>
                      <Ionicons name="play-circle-outline" size={23} color="#344052" />
                      <Text style={styles.videoPreviewText} numberOfLines={1}>Video</Text>
                    </View>
                    <Pressable
                      disabled={submitting || aiLoading}
                      onPress={(event) => {
                        event.stopPropagation();
                        Alert.alert("Remove video?", "Do you want to remove this video?", [
                          { text: "Cancel", style: "cancel" },
                          { text: "Remove", style: "destructive", onPress: () => removeVideoAt(idx) },
                        ]);
                      }}
                      hitSlop={8}
                      style={styles.removeBadge}
                    >
                      <Ionicons name="close" size={12} color="#FFFFFF" />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.cardCompact}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleTitle} allowFontScaling={false}>Share Live Location</Text>
                <Text style={styles.toggleSubtitle} allowFontScaling={false}>Help responders find you</Text>
              </View>
              <Switch
                value={shareLocation}
                disabled={submitting || aiLoading || locationLoading}
                onValueChange={(value) => void toggleShareLocation(value)}
                trackColor={{ false: "#D8DEE7", true: "#111827" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {shareLocation && (
              <View style={styles.locationBlock}>
                <Text style={styles.locationStatus} numberOfLines={2}>
                  {locationLoading ? "Getting current location..." : locationStr || "Location unavailable"}
                </Text>
                <Pressable
                  disabled={submitting || aiLoading || locationLoading}
                  onPress={openLocationMap}
                  style={({ pressed }) => [
                    styles.showMapBtn,
                    (pressed || submitting || aiLoading || locationLoading) && { opacity: 0.78 },
                    locationLoading && styles.showMapBtnDisabled,
                  ]}
                >
                  <Ionicons
                    name="map-outline"
                    size={16}
                    color={locationLoading ? "#94A3B8" : "#00518D"}
                  />
                  <Text
                    style={[
                      styles.showMapText,
                      locationLoading && styles.showMapTextDisabled,
                    ]}
                    allowFontScaling={false}
                  >
                    Show in Map
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleTitle} allowFontScaling={false}>Add Witness</Text>
                <Text style={styles.toggleSubtitle} allowFontScaling={false}>Include contact details</Text>
              </View>
              <Switch
                value={includeWitness}
                disabled={submitting || aiLoading}
                onValueChange={(value) => {
                  setIncludeWitness(value);
                  if (!value) {
                    setWitnessName("");
                    setWitnessType("");
                    setWitnessOtherType("");
                    setWitnessRelationshipOpen(false);
                  }
                }}
                trackColor={{ false: "#D8DEE7", true: "#111827" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {includeWitness && (
              <View style={styles.witnessFields}>
                <View style={[styles.inputBox, styles.witnessInputBox]}>
                  <TextInput
                    editable={!submitting && !aiLoading}
                    value={witnessName}
                    onChangeText={setWitnessName}
                    placeholder="Witness name"
                    placeholderTextColor="#A9A9A9"
                    style={styles.textInput}
                  />
                </View>

                <Pressable
                  disabled={submitting || aiLoading}
                  onPress={() => {
                    Keyboard.dismiss();
                    setWitnessRelationshipOpen((open) => !open);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Witness relationship"
                  accessibilityState={{
                    disabled: submitting || aiLoading,
                    expanded: witnessRelationshipOpen,
                  }}
                  style={({ pressed }) => [
                    styles.inputBox,
                    styles.witnessInputBox,
                    styles.witnessDropdownTrigger,
                    witnessRelationshipOpen && styles.witnessDropdownTriggerOpen,
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Text
                    style={[
                      styles.witnessDropdownText,
                      !witnessType && styles.witnessDropdownPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {witnessType || "Select relationship"}
                  </Text>
                  <Ionicons
                    name={witnessRelationshipOpen ? "chevron-up" : "chevron-down"}
                    size={19}
                    color="#7B7F86"
                  />
                </Pressable>

                {witnessRelationshipOpen ? (
                  <View style={styles.witnessDropdownMenu}>
                    {WITNESS_RELATIONSHIPS.map((relationship, index) => {
                      const selected = witnessType === relationship;
                      return (
                        <Pressable
                          key={relationship}
                          onPress={() => {
                            setWitnessType(relationship);
                            setWitnessRelationshipOpen(false);
                            if (relationship !== "Other") setWitnessOtherType("");
                          }}
                          accessibilityRole="menuitem"
                          accessibilityState={{ selected }}
                          style={({ pressed }) => [
                            styles.witnessDropdownOption,
                            index < WITNESS_RELATIONSHIPS.length - 1 &&
                              styles.witnessDropdownOptionBorder,
                            selected && styles.witnessDropdownOptionSelected,
                            pressed && { opacity: 0.82 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.witnessDropdownOptionText,
                              selected && styles.witnessDropdownOptionTextSelected,
                            ]}
                          >
                            {relationship}
                          </Text>
                          {selected ? (
                            <Ionicons name="checkmark" size={18} color={Colors.primary} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {witnessType === "Other" ? (
                  <View style={[styles.inputBox, styles.witnessInputBox]}>
                    <TextInput
                      editable={!submitting && !aiLoading}
                      value={witnessOtherType}
                      onChangeText={setWitnessOtherType}
                      placeholder="Please specify"
                      placeholderTextColor="#A9A9A9"
                      style={styles.textInput}
                      autoCapitalize="words"
                      onFocus={scrollWitnessFieldIntoView}
                    />
                  </View>
                ) : null}
              </View>
            )}
          </View>

          <Text style={styles.draftedText} allowFontScaling={false}>Drafted: {draftedLine}</Text>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: FOOTER_BOTTOM_PAD }]}>
              <Pressable
                disabled={submitting || aiLoading}
                onPress={onSubmit}
                style={({ pressed }) => [styles.submitBtn, (pressed || submitting || aiLoading) && { opacity: 0.88 }]}
              >
                {submitting || aiLoading ? <ActivityIndicator color="#FFFFFF" /> : null}
                <Text style={styles.submitText} allowFontScaling={false}>{primaryActionText}</Text>
              </Pressable>
            </View>
          </Animated.View>

          {showPreview ? (
            <Animated.View
              pointerEvents={transitioningPreview ? "none" : "auto"}
              style={[
                styles.transitionPane,
                styles.previewTransitionPane,
                { transform: [{ translateX: previewTranslateX }] },
              ]}
            >
              <IncidentLogConfirmScreen
                embedded
                data={buildPreviewData()}
                submitting={submitting}
                onBack={closePreview}
                onConfirm={onConfirmComplaint as any}
                onGoHome={closePreview}
              />
            </Animated.View>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <IncidentLocationMapModal
        visible={showLocationMap}
        coords={locationCoords}
        label={locationStr || "Current location"}
        title="Live Location"
        onClose={() => setShowLocationMap(false)}
      />
      <IncidentVideoPreviewModal
        visible={!!previewVideoUri}
        uri={previewVideoUri}
        onClose={() => setPreviewVideoUri(null)}
      />
    </SafeAreaView>
  );
}

const BG = "#F5F7FA";
const CARD_BG = "#FFFFFF";
const BORDER = "#D9DEE5";
const TEXT_DARK = "#344052";
const TEXT_MUTED = "#7B7F86";
const NAVY = PRIMARY_ACTION_COLOR;
const SHADOW = "#000";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  page: { flex: 1, backgroundColor: BG },
  transitionViewport: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: BG,
  },
  transitionPane: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
  },
  previewTransitionPane: {
    zIndex: 1,
    elevation: 1,
  },
  formScroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
    alignItems: "center",
  },

  card: {
    width: "100%",
    maxWidth: 680,
    backgroundColor: CARD_BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 17,
    shadowColor: SHADOW,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
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
  fieldHeaderRow: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 9,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  required: {
    color: "#E11D48",
    fontWeight: "900",
  },
  optionalText: {
    fontSize: 16,
    fontWeight: "500",
    color: TEXT_MUTED,
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
    color: "#0B5C94",
  },
  voiceBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  voiceBtnActive: {
    backgroundColor: "#E11D48",
  },
  errorText: {
    marginTop: -4,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#E11D48",
  },
  helperText: {
    marginTop: 8,
    marginBottom: 13,
    fontSize: 12,
    fontWeight: "600",
    color: "#677586",
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
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 58,
    justifyContent: "center",
    marginBottom: 12,
  },
  inputBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6D6D6",
    borderRadius: 10,
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: 13,
    marginBottom: 14,
  },

  textInput: {
    fontSize: 15,
    fontWeight: "500",
    color: TEXT_DARK,
    paddingVertical: Platform.OS === "android" ? 0 : 13,
  },
  descriptionBox: {
    height: 131,
    paddingTop: 13,
    paddingBottom: 13,
  },
  descriptionInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 21,
    color: TEXT_DARK,
    padding: 0,
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

  aiErrorText: {
    marginTop: -4,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "900",
    color: "#E11D48",
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
    color: "#0B5C94",
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
  evidenceRow: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 21,
    paddingTop: 7,
    paddingBottom: 4,
  },
  evidenceTile: {
    flex: 1,
    height: 100,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#D9DEE5",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
  },
  evidenceText: {
    fontSize: 13,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  attachmentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 10,
    paddingHorizontal: 21,
    paddingTop: 14,
  },
  attachmentWrapCompact: {
    columnGap: 8,
    paddingHorizontal: 8,
  },
  photoPreview: {
    width: "29.8%",
    height: 58,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#EEF4FB",
  },
  photoPreviewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  videoPreview: {
    width: "29.8%",
    height: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  videoPreviewInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 6,
  },
  videoPreviewText: {
    fontSize: 10,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  removeBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },

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
  locationActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  locationBtnSplit: {
    flex: 1,
  },
  locationBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0B5C94",
  },
  locationHintSolo: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "800",
    color: "#9AA7B5",
  },
  locationMapCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  locationMapHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  locationMapTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: TEXT_DARK,
  },
  locationMapFrame: {
    height: 220,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "#EAF2FC",
  },
  locationMapWebview: {
    flex: 1,
    backgroundColor: "transparent",
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
  cardCompact: {
    width: "100%",
    maxWidth: 680,
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 17,
    paddingVertical: 17,
    shadowColor: SHADOW,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    gap: 14,
  },
  toggleRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  toggleSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
    color: TEXT_MUTED,
  },
  locationStatus: {
    marginTop: 0,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    color: "#5C6673",
  },
  locationBlock: {
    marginTop: -6,
    gap: 10,
  },
  showMapBtn: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#CFE0EF",
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  showMapBtnDisabled: {
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },
  showMapText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#00518D",
  },
  showMapTextDisabled: {
    color: "#94A3B8",
  },
  witnessFields: {
    gap: 10,
    marginTop: -4,
  },
  witnessInputBox: {
    marginBottom: 0,
  },
  witnessDropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  witnessDropdownTriggerOpen: {
    borderColor: Colors.primary,
  },
  witnessDropdownText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: TEXT_DARK,
  },
  witnessDropdownPlaceholder: {
    color: "#A9A9A9",
  },
  witnessDropdownMenu: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D6D6D6",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    shadowColor: SHADOW,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  witnessDropdownOption: {
    minHeight: 48,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  witnessDropdownOptionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  witnessDropdownOptionSelected: {
    backgroundColor: "#EEF6FF",
  },
  witnessDropdownOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  witnessDropdownOptionTextSelected: {
    color: Colors.primary,
    fontWeight: "800",
  },
  draftedText: {
    width: "100%",
    maxWidth: 680,
    marginTop: -6,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    color: "#858585",
  },

  footer: {
    paddingHorizontal: 29,
    paddingTop: 8,
    alignItems: "center",
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
    width: "100%",
    maxWidth: 680,
    minHeight: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    backgroundColor: NAVY,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "500",
  },
});
