// src/screens/SettingsScreen.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  StatusBar,
  Platform,
  useWindowDimensions,
  Alert,
  Switch,
  Modal,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Device from "expo-device";
import * as Location from "expo-location";

import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors } from "../theme/colors";
import { createTypography, FontWeight } from "../theme/typography";
import { useTheme, ThemeMode } from "../theme/ThemeContext";

// ✅ Auth context (for current account email)
import { useAuth } from "../auth/AuthContext";

// ✅ SecureStore for per-account flags/tokens
import * as SecureStore from "expo-secure-store";

// ✅ Needed to talk to backend and keep App.tsx routing correct
import { getAccessToken, setHasPin, setPinSkippedForUser } from "../auth/session";
import { setPinApi, getMeApi } from "../api/pin";
import { saveProfileSettings } from "../api/user";

// ✅ NEW: Verify Account card component
import LogoutModal from "../components/LogoutModal";

type Props = {
  onAccountPress?: () => void;
  onHelpPress?: () => void;
  onTermsPress?: () => void;

  onAboutPress?: () => void;
  onContactPress?: () => void;
  onFeedbackPress?: () => void;

  onLogout?: () => void;
  onQuickExit?: () => void;

  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;

  onFabPress?: () => void;
};

const BG = "#F5FAFE";

/** SecureStore keys must only contain: A-Z a-z 0-9 . - _ */
function safeKeyPart(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
}

function bioOptInKeyForEmail(email: string) {
  return `tahanansafe_bio_optin_${safeKeyPart(email)}`;
}

const BIO_LAST_EMAIL_KEY = "tahanansafe_bio_last_email";

function bioCredentialsKeyForEmail(email: string) {
  return `tahanansafe_bio_credentials_${safeKeyPart(email)}`;
}

function pinEnabledKeyForEmail(email: string) {
  return `tahanansafe_pin_enabled_${safeKeyPart(email)}`;
}

function pinValueKeyForEmail(email: string) {
  return `tahanansafe_pin_value_${safeKeyPart(email)}`;
}

// ✅ Personalization (AsyncStorage) keys (per-account)
function prefKey(email: string, suffix: string) {
  const who = email ? safeKeyPart(email) : "guest";
  return `tahanansafe_pref_${who}_${suffix}`;
}

async function getBioOptInForEmail(email: string): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(bioOptInKeyForEmail(email));
    return v === "1";
  } catch {
    return false;
  }
}

async function setBioOptInForEmail(email: string, enabled: boolean) {
  try {
    await SecureStore.setItemAsync(bioOptInKeyForEmail(email), enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

async function deleteBioCredentialsForEmail(email: string) {
  try {
    await SecureStore.deleteItemAsync(bioCredentialsKeyForEmail(email));
    const lastEmail = await SecureStore.getItemAsync(BIO_LAST_EMAIL_KEY);
    if (String(lastEmail || "").trim().toLowerCase() === String(email || "").trim().toLowerCase()) {
      await SecureStore.deleteItemAsync(BIO_LAST_EMAIL_KEY);
    }
  } catch {
    // ignore
  }
}

async function getPinEnabledForEmail(email: string): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(pinEnabledKeyForEmail(email));
    return v === "1";
  } catch {
    return false;
  }
}

async function setPinEnabledForEmail(email: string, enabled: boolean) {
  try {
    await SecureStore.setItemAsync(pinEnabledKeyForEmail(email), enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

/**
 * ✅ SECURITY FIX: Store only a flag that PIN exists, NOT the raw PIN value.
 * PIN verification happens server-side via /api/mobile/v1/verify-pin.
 */
async function savePinForEmail(email: string, _pin: string) {
  try {
    // Store "1" as a flag that PIN is set, never store the actual PIN value
    await SecureStore.setItemAsync(pinValueKeyForEmail(email), "1");
  } catch {
    // ignore
  }
}

function maskEmail(email: string) {
  const e = String(email || "").trim();
  if (!e.includes("@")) return e;
  const [name, domain] = e.split("@");
  if (name.length <= 2) return `${name[0] ?? ""}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

function statusPillText(enabled?: boolean, loading?: boolean) {
  if (loading) return "Loading";
  return enabled ? "Enabled" : "Disabled";
}

function normalizeName(value: string) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  const raw = String(value || "").trim();
  if (raw.startsWith("+")) return `+${raw.slice(1).replace(/\D/g, "")}`;
  return raw.replace(/\D/g, "");
}

function isValidProfilePhone(value: string) {
  const phone = normalizePhone(value);
  return /^09\d{9}$/.test(phone) || /^\+639\d{9}$/.test(phone);
}

const PROFILE_PHONE_PREFIX = "+63";

function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeToProfileLocal10(value: string) {
  const raw = String(value || "").trim();
  const digits = digitsOnly(raw);

  if (digits.startsWith("63")) return digits.slice(2).slice(0, 10);
  if (digits.startsWith("0")) return digits.slice(1).slice(0, 10);
  return digits.slice(0, 10);
}

function formatProfilePhone(local10: string) {
  return `${PROFILE_PHONE_PREFIX} ${local10}`;
}

function isValidProfileLocalMobile10(local10: string) {
  return /^9\d{9}$/.test(String(local10 || ""));
}

function getStoredProfilePhone(user: any) {
  return String(
    user?.phoneNumber ||
    user?.contactNumber ||
    user?.personalInfo?.contactNumber ||
    user?.personalInfo?.phoneNumber ||
    user?.profile?.contactNumber ||
    user?.profile?.phoneNumber ||
    ""
  ).trim();
}

function formatSettingsPhone(value: string) {
  const digits = digitsOnly(value);
  let local = "";

  if (digits.startsWith("63")) local = `0${digits.slice(2, 12)}`;
  else if (digits.startsWith("9")) local = `0${digits.slice(0, 10)}`;
  else if (digits.startsWith("09")) local = digits.slice(0, 11);

  if (/^09\d{9}$/.test(local)) {
    return `${local.slice(0, 4)}-${local.slice(4, 7)}-${local.slice(7)}`;
  }

  return String(value || "").trim();
}

function getSettingsBarangay(user: any) {
  return (
    String(
      user?.barangay ||
        user?.barangayName ||
        user?.profile?.barangay ||
        user?.personalInfo?.barangay ||
        user?.address?.barangay ||
        ""
    ).trim() || "Barangay 742"
  );
}

function getSettingsCitizenId(user: any) {
  return (
    String(
      user?.citizenshipId ||
        user?.residentId ||
        user?.residentNumber ||
        user?.profile?.citizenshipId ||
        user?.personalInfo?.citizenshipId ||
        ""
    ).trim() || "BC-742-2023-8891"
  );
}

function getUserInitials(user: any) {
  const first = String(user?.firstName || "").trim();
  const last = String(user?.lastName || "").trim();
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase() || "U";
}

function sanitizeAvatarUri(value: any) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (clean === "null" || clean === "undefined") return "";
  return clean;
}

function decodeJwtPayload(token: string | null) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    if (typeof globalThis.atob !== "function") return null;
    return JSON.parse(globalThis.atob(padded));
  } catch {
    return null;
  }
}

function formatSessionDate(value: number | null) {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "Unknown";
  }
}

export default function SettingsScreen({
  onAccountPress,
  onHelpPress,
  onTermsPress,
  onAboutPress, // kept for compatibility (not used)
  onContactPress, // kept for compatibility (not used)
  onFeedbackPress, // kept for compatibility (not used)
  onLogout,
  onQuickExit, // kept in props for compatibility; not shown in UI
  onTabChange,
  initialTab = "Settings",
  onFabPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const compactHeight = height < 500;
  const designWidth = Math.min(width, compactHeight ? 390 : 430);
  const wScale = Math.min(Math.max(designWidth / 375, 0.9), 1.12);
  const hScale = Math.min(Math.max(height / 812, 0.9), compactHeight ? 1 : 1.12);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);
  const compactScale = (n: number) => Math.min(scale(n), vscale(n));

  const iconSize = compactScale(20);
  const smallIcon = compactScale(16);

  const { mode: themeMode, isDark, setMode: setThemeMode } = useTheme();

  const styles = useMemo(() => makeStyles(scale, vscale, compactScale, compactHeight), [width, height]);
  const C = Colors as any;
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const NAV_BASE_HEIGHT = compactHeight ? 66 : 78;
  const FAB_SIZE = compactHeight ? 60 : 68;
  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;
  const chevronBottom = navHeight + (compactHeight ? 70 : 90);
  const fabBottom = navHeight - FAB_SIZE / 2 - (compactHeight ? 6 : 10);
  const settingsBottomClearance = navHeight + FAB_SIZE / 2 + vscale(compactHeight ? 20 : 28);









  const screenBg = isDark ? "#0F172A" : (C.screenBg ?? "#F5FAFE");
  const surface = isDark ? "#1E293B" : (C.surface ?? C.card ?? "#FFFFFF");
  const textDark = isDark ? "#F1F5F9" : "#0F172A";
  const muted = isDark ? "#94A3B8" : (C.mutedText ?? C.muted ?? "#64748B");
  const primary = isDark ? "#4A9EF5" : (C.primary ?? Colors.primary ?? "#1E63D0");
  const divider = isDark ? "#334155" : (C.divider ?? "#E7EEF7");
  const chipBg = isDark ? "#1E3A5F" : "#EEF6FF";
  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const cardBorder = isDark ? "#334155" : "#E7EEF7";

  const handleTab = (tab: TabKey) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };



  // ==========================
  // ✅ Per-account security UI
  // ==========================
  const { user, refreshMe, setUser, logout: authLogout, ensureValidAccessToken } = useAuth() as any;
  const userEmail: string = (user?.email ? String(user.email) : "").trim().toLowerCase();
  const [settingsSearch, setSettingsSearch] = useState("");
  const [caseUpdatesEnabled, setCaseUpdatesEnabled] = useState(true);
  const [emergencyAlertsEnabled, setEmergencyAlertsEnabled] = useState(true);
  const [locationServicesEnabled, setLocationServicesEnabled] = useState(true);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [settingsAvatarLoadFailed, setSettingsAvatarLoadFailed] = useState(false);

  const settingsSearchQuery = settingsSearch.trim().toLowerCase();
  const matchesSettingsSearch = useCallback(
    (...terms: string[]) => {
      if (!settingsSearchQuery) return true;
      return terms.join(" ").toLowerCase().includes(settingsSearchQuery);
    },
    [settingsSearchQuery]
  );

  const saveSettingsPreference = useCallback(
    async (suffix: string, enabled: boolean) => {
      try {
        await AsyncStorage.setItem(prefKey(userEmail, suffix), enabled ? "1" : "0");
      } catch {
        // ignore local preference write failures
      }
    },
    [userEmail]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [casePref, emergencyPref, locationPref] = await Promise.all([
          AsyncStorage.getItem(prefKey(userEmail, "case_updates")),
          AsyncStorage.getItem(prefKey(userEmail, "emergency_alerts")),
          AsyncStorage.getItem(prefKey(userEmail, "location_services")),
        ]);

        if (cancelled) return;

        setCaseUpdatesEnabled(casePref !== "0");
        setEmergencyAlertsEnabled(emergencyPref !== "0");
        setLocationServicesEnabled(locationPref !== "0");
      } catch {
        // keep defaults
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  const onToggleCaseUpdates = useCallback(
    async (next: boolean) => {
      setCaseUpdatesEnabled(next);
      await saveSettingsPreference("case_updates", next);
    },
    [saveSettingsPreference]
  );

  const onToggleEmergencyAlerts = useCallback(
    async (next: boolean) => {
      setEmergencyAlertsEnabled(next);
      await saveSettingsPreference("emergency_alerts", next);
    },
    [saveSettingsPreference]
  );

  const onToggleLocationServices = useCallback(
    async (next: boolean) => {
      if (!next) {
        setLocationServicesEnabled(false);
        await saveSettingsPreference("location_services", false);
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationServicesEnabled(false);
        await saveSettingsPreference("location_services", false);
        Alert.alert("Location disabled", "Allow location access to use location services in TahananSafe.");
        return;
      }

      setLocationServicesEnabled(true);
      await saveSettingsPreference("location_services", true);
    },
    [saveSettingsPreference]
  );

  // ✅ Account modal
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const openAccountModal = () => setAccountModalVisible(true);
  const closeAccountModal = () => setAccountModalVisible(false);
  const [sessionsModalVisible, setSessionsModalVisible] = useState(false);
  const [sessionTokenLoading, setSessionTokenLoading] = useState(false);
  const [sessionIssuedAt, setSessionIssuedAt] = useState<number | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState("");
  const [profilePickedImageUri, setProfilePickedImageUri] = useState<string | null>(null);
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [profileContactNumber, setProfileContactNumber] = useState("");
  const [profileContactFocused, setProfileContactFocused] = useState(false);
  const [profileContactTouched, setProfileContactTouched] = useState(false);
  const [profileAvatarLoadFailed, setProfileAvatarLoadFailed] = useState(false);
  const [profileKeyboardHeight, setProfileKeyboardHeight] = useState(0);
  const profileScrollRef = useRef<ScrollView | null>(null);
  const profileFieldOffsets = useRef({
    firstName: 0,
    lastName: 0,
    contactNumber: 0,
  });

  // ✅ Privacy & Security modal
  const [psModalVisible, setPsModalVisible] = useState(false);
  const openPrivacySecurity = () => setPsModalVisible(true);
  const closePrivacySecurity = () => setPsModalVisible(false);

  // ✅ Personalization modal (NEW)
  const [persModalVisible, setPersModalVisible] = useState(false);
  const openPersonalizationModal = () => setPersModalVisible(true);
  const closePersonalizationModal = () => setPersModalVisible(false);

  // ✅ Help & Support modal
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const openHelpModal = () => setHelpModalVisible(true);
  const closeHelpModal = () => setHelpModalVisible(false);

  // ✅ Terms modal
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const openTermsModal = () => setTermsModalVisible(true);
  const closeTermsModal = () => setTermsModalVisible(false);

  const hydrateProfileForm = useCallback(() => {
    setProfileFirstName(String(user?.firstName || ""));
    setProfileLastName(String(user?.lastName || ""));
    setProfileContactNumber(normalizeToProfileLocal10(getStoredProfilePhone(user)));
    setProfileImageUri(sanitizeAvatarUri(user?.profileImage));
    setProfilePickedImageUri(null);
    setProfileContactFocused(false);
    setProfileContactTouched(false);
  }, [user]);

  const safeProfileImageUri = useMemo(
    () => sanitizeAvatarUri(profileImageUri),
    [profileImageUri]
  );
  const savedProfileHeroName = useMemo(
    () => normalizeName(`${user?.firstName || ""} ${user?.lastName || ""}`) || "Your profile",
    [user?.firstName, user?.lastName]
  );
  const savedProfileHeroInitials = useMemo(
    () => getUserInitials({ firstName: user?.firstName, lastName: user?.lastName }),
    [user?.firstName, user?.lastName]
  );
  const settingsProfileName = savedProfileHeroName === "Your profile" ? "Ricardo San Juan" : savedProfileHeroName;
  const settingsPhoneNumber = formatSettingsPhone(getStoredProfilePhone(user)) || "0917-555-0123";
  const settingsBarangay = getSettingsBarangay(user);
  const settingsCitizenId = getSettingsCitizenId(user);
  const settingsAvatarUri = useMemo(() => sanitizeAvatarUri(user?.profileImage), [user?.profileImage]);

  useEffect(() => {
    setSettingsAvatarLoadFailed(false);
  }, [settingsAvatarUri]);

  const openCitizenshipDetails = useCallback(() => {
    Alert.alert("Citizenship Details", `${settingsBarangay}\nID: ${settingsCitizenId}\nStatus: Verified`);
  }, [settingsBarangay, settingsCitizenId]);

  const openPrivacyPolicy = useCallback(() => {
    Alert.alert(
      "Privacy Policy",
      "TahananSafe uses account, location, report, and evidence data to support verified barangay safety workflows."
    );
  }, []);

  const openAiTransparencyNotice = useCallback(() => {
    Alert.alert(
      "AI Transparency Notice",
      "Insights are generated by AI to support review. Official decisions remain with barangay authorities."
    );
  }, []);

  const onSendFeedback = useCallback(() => {
    setFeedbackText("");
    setFeedbackRating(0);
    Alert.alert("Feedback", "Feedback submission is temporarily mocked.");
  }, []);

  useEffect(() => {
    setProfileAvatarLoadFailed(false);
  }, [safeProfileImageUri]);

  useEffect(() => {
    if (!sessionsModalVisible) return;

    let cancelled = false;

    (async () => {
      setSessionTokenLoading(true);
      try {
        const token =
          (await ensureValidAccessToken?.().catch(() => null)) ||
          (await getAccessToken().catch(() => null));
        const payload = decodeJwtPayload(token);

        if (cancelled) return;

        const issuedAt = Number(payload?.iat);
        const expiresAt = Number(payload?.exp);

        setSessionIssuedAt(Number.isFinite(issuedAt) && issuedAt > 0 ? issuedAt * 1000 : null);
        setSessionExpiresAt(Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt * 1000 : null);
      } finally {
        if (!cancelled) setSessionTokenLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureValidAccessToken, sessionsModalVisible]);

  const sessionDeviceName = useMemo(() => {
    const name = String(Device.deviceName || "").trim();
    const model = String(Device.modelName || "").trim();
    return name || model || (Platform.OS === "android" ? "Android device" : "iPhone");
  }, []);

  const sessionPlatformLabel = useMemo(() => {
    const osName =
      String(Device.osName || "").trim() || (Platform.OS === "android" ? "Android" : "iOS");
    const osVersion = String(Device.osVersion || Platform.Version || "").trim();
    return osVersion ? `${osName} ${osVersion}` : osName;
  }, []);

  const sessionHardwareLabel = useMemo(() => {
    const brand = String(Device.brand || "").trim();
    const model = String(Device.modelName || "").trim();
    return [brand, model].filter(Boolean).join(" ") || sessionDeviceName;
  }, [sessionDeviceName]);

  useEffect(() => {
    if (!profileModalVisible) {
      setProfileKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setProfileKeyboardHeight(Math.max(0, Number(event?.endCoordinates?.height || 0)));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setProfileKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [profileModalVisible]);

  const scrollProfileFieldIntoView = useCallback(
    (field: "firstName" | "lastName" | "contactNumber") => {
      setTimeout(() => {
        const y = profileFieldOffsets.current[field] || 0;
        profileScrollRef.current?.scrollTo({
          y: Math.max(0, y - vscale(18)),
          animated: true,
        });
      }, Platform.OS === "android" ? 120 : 40);
    },
    [vscale]
  );

  const openProfileModal = useCallback(() => {
    closeAccountModal();
    hydrateProfileForm();
    setTimeout(() => setProfileModalVisible(true), 140);
  }, [hydrateProfileForm]);

  const openSessionsModal = useCallback(() => {
    closeAccountModal();
    setTimeout(() => setSessionsModalVisible(true), 140);
  }, []);

  const closeSessionsModal = useCallback(() => {
    setSessionsModalVisible(false);
  }, []);

  const closeProfileModal = useCallback(() => {
    if (profileSaving) return;
    setProfileModalVisible(false);
  }, [profileSaving]);

  const handleSignOutCurrentSession = useCallback(async () => {
    setSessionsModalVisible(false);

    if (onLogout) {
      onLogout();
      return;
    }

    await authLogout?.().catch(() => {});
  }, [authLogout, onLogout]);

  const requestProfileCameraPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take a profile picture.");
      return false;
    }
    return true;
  }, []);

  const requestProfileLibraryPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library permission is required to upload a profile picture.");
      return false;
    }
    return true;
  }, []);

  const pickProfileFromGallery = useCallback(async () => {
    const ok = await requestProfileLibraryPermission();
    if (!ok) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });

    const uri = res.canceled ? "" : String(res.assets?.[0]?.uri || "");
    if (!uri) return;

    setProfileImageUri(uri);
    setProfilePickedImageUri(uri);
  }, [requestProfileLibraryPermission]);

  const takeProfilePhoto = useCallback(async () => {
    const ok = await requestProfileCameraPermission();
    if (!ok) return;

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
      cameraType: ImagePicker.CameraType.front,
    });

    const uri = res.canceled ? "" : String(res.assets?.[0]?.uri || "");
    if (!uri) return;

    setProfileImageUri(uri);
    setProfilePickedImageUri(uri);
  }, [requestProfileCameraPermission]);

  const onChangeProfilePhoto = useCallback(() => {
    Alert.alert("Profile picture", "Choose a source:", [
      { text: "Take a Picture", onPress: () => void takeProfilePhoto() },
      { text: "Upload from Gallery", onPress: () => void pickProfileFromGallery() },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [pickProfileFromGallery, takeProfilePhoto]);

  const onSaveProfile = useCallback(async () => {
    const firstName = normalizeName(profileFirstName);
    const lastName = normalizeName(profileLastName);
    const contactNumber = String(profileContactNumber || "").trim();

    if (!firstName) {
      Alert.alert("Invalid", "First name is required.");
      return;
    }
    if (!lastName) {
      Alert.alert("Invalid", "Last name is required.");
      return;
    }
    if (contactNumber && !isValidProfileLocalMobile10(contactNumber)) {
      Alert.alert("Invalid", "Please enter a valid mobile number.");
      return;
    }

    try {
      setProfileSaving(true);
      const response = await saveProfileSettings(
        {
          firstName,
          lastName,
          contactNumber: contactNumber ? formatProfilePhone(contactNumber) : undefined,
        },
        profilePickedImageUri || undefined,
      );

      if (response?.user) {
        setUser?.({
          ...response.user,
          phoneNumber:
            String(response.user?.phoneNumber || response.user?.contactNumber || "").trim() ||
            getStoredProfilePhone(user),
        });
      }
      await refreshMe?.().catch(() => {});

      setProfileModalVisible(false);
      Alert.alert("Profile updated", "Your profile details have been saved.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Unable to update your profile right now.");
    } finally {
      setProfileSaving(false);
    }
  }, [
    profileFirstName,
    profileLastName,
    profileContactNumber,
    profilePickedImageUri,
    refreshMe,
    user,
    setUser,
  ]);

  // Biometrics
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLoading, setBioLoading] = useState(true);

  const loadBioState = useCallback(async () => {
    if (!userEmail) {
      setBioEnabled(false);
      setBioLoading(false);
      return;
    }
    setBioLoading(true);
    const enabled = await getBioOptInForEmail(userEmail);
    setBioEnabled(enabled);
    setBioLoading(false);
  }, [userEmail]);

  useEffect(() => {
    loadBioState();
  }, [loadBioState]);

  const onToggleBiometrics = async (next: boolean) => {
    if (!userEmail) return;

    setBioEnabled(next);
    await setBioOptInForEmail(userEmail, next);

    if (!next) {
      await deleteBioCredentialsForEmail(userEmail);
      Alert.alert("Biometrics disabled", "Biometric login autofill is turned off for this account on this device.");
    }
  };

  // PIN
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinLoading, setPinLoading] = useState(true);

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [pinDraft, setPinDraft] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const resetPinModal = () => {
    setPinDraft("");
    setPinConfirm("");
  };

  const loadPinState = useCallback(async () => {
    if (!userEmail) {
      setPinEnabled(false);
      setPinLoading(false);
      return;
    }
    setPinLoading(true);
    const enabled = await getPinEnabledForEmail(userEmail);
    setPinEnabled(enabled);
    setPinLoading(false);
  }, [userEmail]);

  useEffect(() => {
    loadPinState();
  }, [loadPinState]);

  const openPinSetup = () => {
    resetPinModal();
    setPinModalVisible(true);
  };

  const closePinSetup = () => {
    setPinModalVisible(false);
    resetPinModal();
  };

  // ✅ 4-digit PIN
  const validatePin = (pin: string) => {
    const trimmed = pin.trim();
    if (!/^\d+$/.test(trimmed)) return { ok: false, msg: "PIN must be numbers only." as const };
    if (trimmed.length !== 4) return { ok: false, msg: "PIN must be exactly 4 digits." as const };
    return { ok: true, msg: "" as const };
  };

  /**
   * ✅ IMPORTANT:
   * - When enabling PIN, your App.tsx will ONLY show PinScreen if BACKEND hasPin === true.
   * - So if server hasPin === false, we must force PIN setup (call setPinApi).
   */
  const onTogglePin = async (next: boolean) => {
    if (!userEmail) return;

    if (next) {
      try {
        const token = await getAccessToken();
        if (token) {
          const me = await getMeApi();
          if (me?.user?.hasPin) {
            await setPinEnabledForEmail(userEmail, true);
            setPinEnabled(true);
            await setHasPin(true);
            await refreshMe?.().catch(() => {});

            try {
              const userId = String(me.user._id);
              await setPinSkippedForUser(userId, false);
            } catch {
              // ignore
            }

            Alert.alert("PIN enabled", "PIN login is now enabled for this account on this device.");
            return;
          }
        }
      } catch {
        // ignore
      }

      openPinSetup();
      return;
    }

    setPinEnabled(false);
    await setPinEnabledForEmail(userEmail, false);
    Alert.alert("PIN disabled", "PIN login is turned off for this account on this device.");
  };

  /**
   * ✅ When saving a PIN from Settings, we MUST call setPinApi so backend sets hasPin=true.
   */
  const onSavePin = async () => {
    if (!userEmail) return;

    const a = validatePin(pinDraft);
    if (!a.ok) {
      Alert.alert("Invalid PIN", a.msg);
      return;
    }
    const b = validatePin(pinConfirm);
    if (!b.ok) {
      Alert.alert("Invalid PIN", b.msg);
      return;
    }
    if (pinDraft.trim() !== pinConfirm.trim()) {
      Alert.alert("PIN mismatch", "PIN and confirmation do not match.");
      return;
    }

    try {
      setPinLoading(true);

      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Session missing. Please login again.");

      await setPinApi({ pin: pinDraft.trim() });
      await setHasPin(true);
      await refreshMe?.().catch(() => {});

      try {
        const me = await getMeApi();
        const userId = String(me.user._id);
        await setPinSkippedForUser(userId, false);
      } catch {
        // ignore
      }

      await setPinEnabledForEmail(userEmail, true);
      setPinEnabled(true);

      // keep existing behavior (not recommended, but consistent with your current code)
      await savePinForEmail(userEmail, pinDraft.trim());

      closePinSetup();
      Alert.alert("PIN enabled", "PIN login is now enabled for this account on this device.");
    } catch (e: any) {
      Alert.alert("PIN Setup Failed", e?.message || "Something went wrong.");
    } finally {
      setPinLoading(false);
    }
  };

  // ==========================
  // ✅ Personalization settings (local-only)
  // ==========================
  const [prefCompact, setPrefCompact] = useState(false);
  const [prefHaptics, setPrefHaptics] = useState(true);
  const [prefSounds, setPrefSounds] = useState(true);

  const loadPrefs = useCallback(async () => {
    try {
      const k1 = prefKey(userEmail, "compact");
      const k2 = prefKey(userEmail, "haptics");
      const k3 = prefKey(userEmail, "sounds");

      const [a, b, c] = await Promise.all([
        AsyncStorage.getItem(k1),
        AsyncStorage.getItem(k2),
        AsyncStorage.getItem(k3),
      ]);

      setPrefCompact(a === "1");
      setPrefHaptics(b !== "0"); // default ON
      setPrefSounds(c !== "0"); // default ON
    } catch {
      // ignore
    }
  }, [userEmail]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  const savePref = useCallback(
    async (suffix: string, val: boolean) => {
      try {
        await AsyncStorage.setItem(prefKey(userEmail, suffix), val ? "1" : "0");
      } catch {
        // ignore
      }
    },
    [userEmail]
  );

  const onToggleCompact = async (next: boolean) => {
    setPrefCompact(next);
    await savePref("compact", next);
  };

  const onToggleHaptics = async (next: boolean) => {
    setPrefHaptics(next);
    await savePref("haptics", next);
  };

  const onToggleSounds = async (next: boolean) => {
    setPrefSounds(next);
    await savePref("sounds", next);
  };

  const onResetPersonalization = async () => {
    try {
      setPrefCompact(false);
      setPrefHaptics(true);
      setPrefSounds(true);
      await Promise.all([
        AsyncStorage.setItem(prefKey(userEmail, "compact"), "0"),
        AsyncStorage.setItem(prefKey(userEmail, "haptics"), "1"),
        AsyncStorage.setItem(prefKey(userEmail, "sounds"), "1"),
      ]);
      Alert.alert("Reset done", "Personalization settings were reset for this account on this device.");
    } catch {
      Alert.alert("Reset failed", "Could not reset settings. Please try again.");
    }
  };

  // ==========================
  // ✅ Main list rows (General)
  // ==========================
  const mainItems = useMemo(
    () => [
      {
        key: "account",
        label: "Account",
        subtitle: "Profile, sessions",
        icon: "person-circle-outline",
        onPress: openAccountModal,
      },
      {
        key: "privacy_security",
        label: "Privacy and Security",
        subtitle: "Permissions, biometrics, PIN",
        icon: "lock-closed-outline",
        onPress: openPrivacySecurity,
      },
      {
        key: "help",
        label: "Help and Support",
        subtitle: "FAQs, contact support",
        icon: "help-circle-outline",
        onPress: openHelpModal,
      },
      {
        key: "terms",
        label: "Terms and Conditions",
        subtitle: "Policies & agreements",
        icon: "document-text-outline",
        onPress: openTermsModal,
      },
      // ✅ Personalization now opens a modal (like Account)
      {
        key: "personalization",
        label: "Personalization",
        subtitle: "Theme, layout, haptics, sounds",
        icon: "color-palette-outline",
        onPress: openPersonalizationModal,
      },
    ],
    [openHelpModal, openTermsModal]
  );

  const canManageSecurity = !!userEmail;
  const currentStatusLabel = userEmail ? "Active" : "Guest";
  const currentStatusIcon = userEmail ? "checkmark-circle-outline" : "alert-circle-outline";
  const showProfileCard = matchesSettingsSearch("profile", "account", settingsProfileName, settingsBarangay, userEmail);
  const showPersonalInfo = matchesSettingsSearch("personal information", "phone", settingsPhoneNumber, settingsProfileName);
  const showCitizenship = matchesSettingsSearch("citizenship details", "resident id", settingsCitizenId, settingsBarangay);
  const showPasswordSecurity = matchesSettingsSearch("password security pin", "privacy", "security");
  const showBiometrics = matchesSettingsSearch("biometric login", "fingerprint", "face id");
  const showLocationServices = matchesSettingsSearch("location services", "location");
  const showPrivacyPolicy = matchesSettingsSearch("privacy policy", "policy");
  const showCaseUpdates = matchesSettingsSearch("case updates", "notifications");
  const showEmergencyAlerts = matchesSettingsSearch("emergency alerts", "alert");
  const showTutorials = matchesSettingsSearch("tutorials", "help");
  const showFaqs = matchesSettingsSearch("faqs", "questions", "help");
  const showAiNotice = matchesSettingsSearch("ai transparency notice", "ai", "transparency");
  const showFeedback = matchesSettingsSearch("feedback", "rate", "suggestions");
  const showSignOut = matchesSettingsSearch("sign out", "logout", "log out");
  const showAccountSection = showPersonalInfo || showCitizenship;
  const showSecuritySection = showPasswordSecurity || showBiometrics || showLocationServices || showPrivacyPolicy;
  const showPreferencesSection = showCaseUpdates || showEmergencyAlerts;
  const showHelpSection = showTutorials || showFaqs;
  const hasSettingsResult =
    showProfileCard ||
    showAccountSection ||
    showSecuritySection ||
    showPreferencesSection ||
    showHelpSection ||
    showAiNotice ||
    showFeedback ||
    showSignOut;

  const renderModalHeader = (
    title: string,
    subtitle: string,
    icon: React.ComponentProps<typeof Ionicons>["name"],
    onClose: () => void
  ) => (
    <View style={[styles.accountModalHeader, { borderBottomColor: divider }]}>
      <View style={styles.accountModalHeaderLead}>
        <View style={[styles.accountModalHeaderIcon, { backgroundColor: chipBg }]}>
          <Ionicons name={icon} size={scale(21)} color={primary} />
        </View>
        <View style={styles.accountModalHeaderCopy}>
          <Text style={[styles.accountModalTitle, { color: textDark }]}>{title}</Text>
          <Text style={[styles.accountModalSubtitle, { color: muted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Close ${title}`}
        style={({ pressed }) => [
          styles.accountModalClose,
          { backgroundColor: chipBg },
          pressed && styles.modalPressed,
        ]}
      >
        <Ionicons name="close" size={scale(20)} color={muted} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: screenBg }]} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* ✅ Account Modal */}
      <Modal visible={accountModalVisible} transparent animationType="fade" onRequestClose={closeAccountModal}>
        <View style={styles.accountModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAccountModal} />
          <View style={[styles.accountModalSheet, { backgroundColor: surface, borderColor: divider }]}>
            {renderModalHeader(
              "Account",
              "Manage your profile and active sessions",
              "person-circle-outline",
              closeAccountModal
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountModalContent}>
              <Pressable
                onPress={openProfileModal}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={[styles.accountModalItem, { backgroundColor: cardBg, borderColor: cardBorder }]}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                    <Ionicons name="person-outline" size={iconSize} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitleInner, { color: textDark }]}>Profile</Text>
                    <Text style={[styles.settingSub, { color: muted }]}>Name, personal info</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={iconSize} color={primary} />
              </Pressable>

              <Pressable
                onPress={openSessionsModal}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={[styles.accountModalItem, { backgroundColor: cardBg, borderColor: cardBorder }]}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                    <Ionicons name="shield-checkmark-outline" size={iconSize} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitleInner, { color: textDark }]}>Sessions</Text>
                    <Text style={[styles.settingSub, { color: muted }]}>Logged-in devices</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={iconSize} color={primary} />
              </Pressable>

              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={sessionsModalVisible} transparent animationType="fade" onRequestClose={closeSessionsModal}>
        <View style={styles.accountModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSessionsModal} />
          <View style={[styles.accountModalSheet, { backgroundColor: surface, borderColor: divider }]}>
            {renderModalHeader(
              "Sessions",
              "Review this device and sign-in details",
              "phone-portrait-outline",
              closeSessionsModal
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountModalContent}>
              <View style={[styles.sessionCard, { backgroundColor: cardBg, borderColor: divider }]}>
                <View style={styles.sessionTopRow}>
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                      <Ionicons
                        name={Platform.OS === "android" ? "phone-portrait-outline" : "phone-portrait-outline"}
                        size={iconSize}
                        color={primary}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingTitleInner, { color: textDark }]}>This device</Text>
                      <Text style={[styles.settingSub, { color: muted }]}>{sessionDeviceName}</Text>
                    </View>
                  </View>

                  <View style={[styles.sessionBadge, { backgroundColor: chipBg }]}>
                    <Text style={[styles.sessionBadgeText, { color: primary }]}>Current</Text>
                  </View>
                </View>

                <View style={styles.sessionDetails}>
                  <View style={styles.sessionDetailRow}>
                    <Text style={[styles.sessionDetailLabel, { color: muted }]}>Device</Text>
                    <Text style={[styles.sessionDetailValue, { color: textDark }]}>{sessionHardwareLabel}</Text>
                  </View>

                  <View style={styles.sessionDetailRow}>
                    <Text style={[styles.sessionDetailLabel, { color: muted }]}>Platform</Text>
                    <Text style={[styles.sessionDetailValue, { color: textDark }]}>{sessionPlatformLabel}</Text>
                  </View>

                  <View style={styles.sessionDetailRow}>
                    <Text style={[styles.sessionDetailLabel, { color: muted }]}>Account</Text>
                    <Text style={[styles.sessionDetailValue, { color: textDark }]}>
                      {userEmail ? maskEmail(userEmail) : "Guest"}
                    </Text>
                  </View>

                  <View style={styles.sessionDetailRow}>
                    <Text style={[styles.sessionDetailLabel, { color: muted }]}>Signed in</Text>
                    <Text style={[styles.sessionDetailValue, { color: textDark }]}>
                      {sessionTokenLoading ? "Checking..." : formatSessionDate(sessionIssuedAt)}
                    </Text>
                  </View>

                  <View style={styles.sessionDetailRow}>
                    <Text style={[styles.sessionDetailLabel, { color: muted }]}>Access token</Text>
                    <Text style={[styles.sessionDetailValue, { color: textDark }]}>
                      {sessionTokenLoading ? "Checking..." : formatSessionDate(sessionExpiresAt)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.sessionHintCard, { backgroundColor: cardBg, borderColor: divider }]}>
                <Text style={[styles.sessionHintTitle, { color: textDark }]}>About mobile sessions</Text>
                <Text style={[styles.sessionHintText, { color: muted }]}>
                  This mobile app currently keeps one active session per account on this device. Signing out here will
                  log out this device.
                </Text>
              </View>

              <View style={styles.profileModalActions}>
                <Pressable
                  onPress={closeSessionsModal}
                  style={({ pressed }) => [
                    styles.profileActionBtn,
                    { backgroundColor: isDark ? "#334155" : "#F3F4F6" },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.profileActionBtnText, { color: textDark }]}>Close</Text>
                </Pressable>

                <Pressable
                  onPress={() => void handleSignOutCurrentSession()}
                  style={({ pressed }) => [
                    styles.profileActionBtn,
                    { backgroundColor: Colors.actionPrimary },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.profileActionPrimaryText}>Sign out</Text>
                </Pressable>
              </View>

              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={profileModalVisible} transparent animationType="fade" onRequestClose={closeProfileModal}>
        <View style={styles.accountModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeProfileModal} />
          <KeyboardAvoidingView
            style={styles.profileModalKeyboard}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
          >
            <View style={[styles.profileModalSheet, { backgroundColor: surface, borderColor: divider }]}>
              {renderModalHeader(
                "Profile",
                "Update your personal information",
                "person-outline",
                closeProfileModal
              )}

              <ScrollView
                ref={profileScrollRef}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.profileModalContent,
                  {
                    paddingBottom:
                      vscale(10) +
                      (Platform.OS === "android"
                        ? Math.max(profileKeyboardHeight - insets.bottom, 0)
                        : 0),
                  },
                ]}
              >
                <View style={styles.profileModalSections}>
                  <View style={[styles.profileHeroCard, { backgroundColor: cardBg, borderColor: divider }]}>
                    <View style={styles.profileAvatarWrap}>
                      {safeProfileImageUri && !profileAvatarLoadFailed ? (
                        <Image
                          source={{ uri: safeProfileImageUri }}
                          style={styles.profileAvatarImage}
                          onError={() => setProfileAvatarLoadFailed(true)}
                        />
                      ) : (
                        <View style={[styles.profileAvatarFallback, { backgroundColor: chipBg }]}>
                          <Text style={[styles.profileAvatarFallbackText, { color: primary }]}>
                            {savedProfileHeroInitials}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.profileHeroTitle, { color: textDark }]}>
                      {savedProfileHeroName}
                    </Text>
                    <Text style={[styles.profileHeroSub, { color: muted }]}>
                      {userEmail || "Update your personal details and profile picture."}
                    </Text>

                    <Pressable
                      onPress={onChangeProfilePhoto}
                      style={({ pressed }) => [
                        styles.profilePhotoBtn,
                        { borderColor: divider, backgroundColor: chipBg },
                        pressed && { opacity: 0.82 },
                      ]}
                    >
                      <Ionicons name="camera-outline" size={smallIcon} color={primary} />
                      <Text style={[styles.profilePhotoBtnText, { color: primary }]}>Change photo</Text>
                    </Pressable>
                  </View>

                  <View style={[styles.profileFormCard, { backgroundColor: cardBg, borderColor: divider }]}>
                    <View
                      style={styles.profileFieldBlock}
                      onLayout={(event) => {
                        profileFieldOffsets.current.firstName = event.nativeEvent.layout.y;
                      }}
                    >
                      <Text style={[styles.profileFieldLabel, { color: textDark }]}>First Name</Text>
                      <TextInput
                        value={profileFirstName}
                        onChangeText={setProfileFirstName}
                        placeholder="Enter your first name"
                        placeholderTextColor={muted}
                        style={[styles.profileInput, { borderColor: divider, color: textDark, backgroundColor: surface }]}
                        onFocus={() => scrollProfileFieldIntoView("firstName")}
                      />
                    </View>

                    <View
                      style={styles.profileFieldBlock}
                      onLayout={(event) => {
                        profileFieldOffsets.current.lastName = event.nativeEvent.layout.y;
                      }}
                    >
                      <Text style={[styles.profileFieldLabel, { color: textDark }]}>Last Name</Text>
                      <TextInput
                        value={profileLastName}
                        onChangeText={setProfileLastName}
                        placeholder="Enter your last name"
                        placeholderTextColor={muted}
                        style={[styles.profileInput, { borderColor: divider, color: textDark, backgroundColor: surface }]}
                        onFocus={() => scrollProfileFieldIntoView("lastName")}
                      />
                    </View>

                    <View
                      style={styles.profileFieldBlock}
                      onLayout={(event) => {
                        profileFieldOffsets.current.contactNumber = event.nativeEvent.layout.y;
                      }}
                    >
                      <Text style={[styles.profileFieldLabel, { color: textDark }]}>Contact Number</Text>
                      <View
                        style={[
                          styles.profileInput,
                          styles.profilePhoneInputWrap,
                          { borderColor: divider, backgroundColor: surface },
                          profileContactFocused && { borderColor: primary },
                        ]}
                      >
                        <Text style={[styles.profilePhonePrefix, { color: textDark }]}>
                          {PROFILE_PHONE_PREFIX}
                        </Text>

                        <TextInput
                          value={profileContactNumber}
                          onChangeText={(value) => setProfileContactNumber(digitsOnly(value).slice(0, 10))}
                          placeholder="9XXXXXXXXX"
                          placeholderTextColor={muted}
                          keyboardType="number-pad"
                          style={[styles.profilePhoneInput, { color: textDark }]}
                          onFocus={() => {
                            setProfileContactFocused(true);
                            scrollProfileFieldIntoView("contactNumber");
                          }}
                          onBlur={() => {
                            setProfileContactFocused(false);
                            setProfileContactTouched(true);
                          }}
                          maxLength={10}
                        />
                      </View>

                      {profileContactTouched &&
                      profileContactNumber.length > 0 &&
                      !isValidProfileLocalMobile10(profileContactNumber) ? (
                        <Text style={styles.profileFieldError}>Please enter a valid mobile number</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.profileModalActions}>
                    <Pressable
                      onPress={closeProfileModal}
                      disabled={profileSaving}
                      style={({ pressed }) => [
                        styles.profileActionBtn,
                        { backgroundColor: isDark ? "#334155" : "#F3F4F6" },
                        pressed && !profileSaving && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.profileActionBtnText, { color: textDark }]}>Cancel</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => void onSaveProfile()}
                      disabled={profileSaving}
                      style={({ pressed }) => [
                        styles.profileActionBtn,
                        { backgroundColor: Colors.actionPrimary },
                        pressed && !profileSaving && { opacity: 0.85 },
                      ]}
                    >
                      {profileSaving ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.profileActionPrimaryText}>Save Profile</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ✅ Privacy & Security Modal */}
      <Modal visible={psModalVisible} transparent animationType="fade" onRequestClose={closePrivacySecurity}>
        <View style={styles.accountModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePrivacySecurity} />
          <View style={[styles.psModalSheet, { backgroundColor: surface, borderColor: divider }]}>
            {renderModalHeader(
              "Privacy and Security",
              "Protect access to your account",
              "shield-checkmark-outline",
              closePrivacySecurity
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountModalContent}>
              {/* Biometrics */}
              <View
                style={[
                  styles.accountModalItem,
                  styles.psExpandedCard,
                  { backgroundColor: cardBg, borderColor: cardBorder },
                ]}
              >
                <View style={styles.psTopRow}>
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                      <Ionicons name="finger-print-outline" size={iconSize} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingTitleInner, { color: textDark }]}>Biometrics</Text>
                      <Text style={[styles.settingSub, { color: muted }]}>Face ID / fingerprint login autofill</Text>
                    </View>
                  </View>

                  <View style={[styles.statusChip, { backgroundColor: chipBg }]}>
                    <Text style={[styles.statusChipText, { color: primary }]}>
                      {statusPillText(bioEnabled, bioLoading)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.line, { backgroundColor: divider }]} />

                {!canManageSecurity ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="alert-circle-outline" size={scale(18)} color={muted} />
                    <Text style={[styles.emptyText, { color: muted }]}>
                      Log in first to manage biometrics and PIN per account.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.toggleWrap}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.toggleTitle, { color: textDark }]}>Use biometrics to autofill login</Text>
                      <Text style={[styles.toggleSub, { color: muted }]}>
                        Fills your saved login details on this device. OTP is still required.
                      </Text>
                    </View>

                    <Switch
                      value={bioEnabled}
                      onValueChange={onToggleBiometrics}
                      disabled={bioLoading}
                      trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                      thumbColor={bioEnabled ? primary : "#F3F4F6"}
                    />
                  </View>
                )}
              </View>

              {/* PIN */}
              <View
                style={[
                  styles.accountModalItem,
                  styles.psExpandedCard,
                  { backgroundColor: cardBg, borderColor: cardBorder },
                ]}
              >
                <View style={styles.psTopRow}>
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                      <Ionicons name="keypad-outline" size={iconSize} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingTitleInner, { color: textDark }]}>PIN</Text>
                      <Text style={[styles.settingSub, { color: muted }]}>4-digit PIN as extra login option</Text>
                    </View>
                  </View>

                  <View style={[styles.statusChip, { backgroundColor: chipBg }]}>
                    <Text style={[styles.statusChipText, { color: primary }]}>
                      {statusPillText(pinEnabled, pinLoading)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.line, { backgroundColor: divider }]} />

                {!canManageSecurity ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="alert-circle-outline" size={scale(18)} color={muted} />
                    <Text style={[styles.emptyText, { color: muted }]}>Log in first to enable PIN for your account.</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.toggleWrap}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.toggleTitle, { color: textDark }]}>Enable PIN login</Text>
                        <Text style={[styles.toggleSub, { color: muted }]}>
                          Adds an extra security step for this account on this device.
                        </Text>
                      </View>

                      <Switch
                        value={pinEnabled}
                        onValueChange={onTogglePin}
                        disabled={pinLoading}
                        trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                        thumbColor={pinEnabled ? primary : "#F3F4F6"}
                      />
                    </View>
                  </>
                )}
              </View>

              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ✅ Personalization Modal (NEW - behaves like Account modal) */}
      <Modal visible={persModalVisible} transparent animationType="fade" onRequestClose={closePersonalizationModal}>
        <View style={styles.accountModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePersonalizationModal} />
          <View style={[styles.persModalSheet, { backgroundColor: surface, borderColor: divider }]}>
            {renderModalHeader(
              "Personalization",
              "Choose how TahananSafe looks and feels",
              "color-palette-outline",
              closePersonalizationModal
            )}

            <View style={[styles.currentAccountRow, { borderColor: divider }]}>
              <View style={[styles.currentAvatar, { backgroundColor: chipBg }]}>
                <Ionicons name="color-palette" size={scale(18)} color={primary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.currentTitle, { color: textDark }]}>Applies to</Text>
                <Text style={[styles.currentSub, { color: muted }]}>
                  {userEmail ? maskEmail(userEmail) : "Guest (this device)"}
                </Text>
              </View>

              <View style={[styles.currentPill, { backgroundColor: chipBg }]}>
                <Ionicons name={currentStatusIcon as any} size={smallIcon} color={primary} />
                <Text style={[styles.currentPillText, { color: primary }]}>{currentStatusLabel}</Text>
              </View>
            </View>

            <View style={[styles.line, { backgroundColor: divider }]} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountModalContent}>
              {/* Theme / Dark mode selector */}
              <View style={[styles.accountModalItem, styles.persExpandedCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.persTopRow}>
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                      <Ionicons name={isDark ? "moon" : "sunny"} size={iconSize} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingTitleInner, { color: textDark, fontWeight: FontWeight.semibold }]}>Appearance</Text>
                      <Text style={[styles.settingSub, { color: muted }]}>Choose your preferred theme</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.line, { backgroundColor: divider }]} />

                <View style={styles.themePickerWrap}>
                  {([
                    { key: "light" as ThemeMode, icon: "sunny-outline" as const, label: "Light" },
                    { key: "dark" as ThemeMode, icon: "moon-outline" as const, label: "Dark" },
                    { key: "system" as ThemeMode, icon: "phone-portrait-outline" as const, label: "System" },
                  ]).map((opt) => {
                    const isActive = themeMode === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => setThemeMode(opt.key)}
                        style={[
                          styles.themeOption,
                          {
                            backgroundColor: isActive ? (isDark ? "#2563EB22" : "#EEF6FF") : "transparent",
                            borderColor: isActive ? primary : (isDark ? "#334155" : "#E7EEF7"),
                            borderWidth: isActive ? 2 : 1,
                          },
                        ]}
                      >
                        <View style={[
                          styles.themeOptionIcon,
                          { backgroundColor: isActive ? (isDark ? "#1E3A5F" : "#DBEAFE") : (isDark ? "#334155" : "#F1F5F9") },
                        ]}>
                          <Ionicons
                            name={opt.icon}
                            size={scale(22)}
                            color={isActive ? primary : muted}
                          />
                        </View>
                        <Text style={[
                          styles.themeOptionLabel,
                          {
                            color: isActive ? primary : textDark,
                            fontWeight: isActive ? FontWeight.bold : FontWeight.regular,
                          },
                        ]}>
                          {opt.label}
                        </Text>
                        {isActive && (
                          <View style={[styles.themeCheckBadge, { backgroundColor: primary }]}>
                            <Ionicons name="checkmark" size={scale(10)} color="#fff" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Compact layout */}
              <View style={[styles.accountModalItem, styles.persExpandedCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.persTopRow}>
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                      <Ionicons name="contract-outline" size={iconSize} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingTitleInner, { color: textDark }]}>Compact layout</Text>
                      <Text style={[styles.settingSub, { color: muted }]}>Tighter spacing for lists and cards</Text>
                    </View>
                  </View>

                  <Switch
                    value={prefCompact}
                    onValueChange={onToggleCompact}
                    trackColor={{ false: isDark ? "#475569" : "#D1D5DB", true: "#93C5FD" }}
                    thumbColor={prefCompact ? primary : (isDark ? "#94A3B8" : "#F3F4F6")}
                  />
                </View>

                <View style={[styles.line, { backgroundColor: divider }]} />

                {/* Haptics */}
                <View style={styles.persTopRow}>
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                      <Ionicons name="phone-portrait-outline" size={iconSize} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingTitleInner, { color: textDark }]}>Haptic feedback</Text>
                      <Text style={[styles.settingSub, { color: muted }]}>Vibration feedback on key actions</Text>
                    </View>
                  </View>

                  <Switch
                    value={prefHaptics}
                    onValueChange={onToggleHaptics}
                    trackColor={{ false: isDark ? "#475569" : "#D1D5DB", true: "#93C5FD" }}
                    thumbColor={prefHaptics ? primary : (isDark ? "#94A3B8" : "#F3F4F6")}
                  />
                </View>

                <View style={[styles.line, { backgroundColor: divider }]} />

                {/* Sounds */}
                <View style={styles.persTopRow}>
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                      <Ionicons name="volume-high-outline" size={iconSize} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingTitleInner, { color: textDark }]}>App sounds</Text>
                      <Text style={[styles.settingSub, { color: muted }]}>Sound cues for notifications and actions</Text>
                    </View>
                  </View>

                  <Switch
                    value={prefSounds}
                    onValueChange={onToggleSounds}
                    trackColor={{ false: isDark ? "#475569" : "#D1D5DB", true: "#93C5FD" }}
                    thumbColor={prefSounds ? primary : (isDark ? "#94A3B8" : "#F3F4F6")}
                  />
                </View>
              </View>

              {/* Reset */}
              <Pressable
                onPress={onResetPersonalization}
                android_ripple={{ color: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                style={[styles.accountModalItem, { backgroundColor: cardBg, borderColor: cardBorder }]}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                    <Ionicons name="refresh-outline" size={iconSize} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitleInner, { color: textDark }]}>Reset personalization</Text>
                    <Text style={[styles.settingSub, { color: muted }]}>Restore default preferences for this account</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={iconSize} color={primary} />
              </Pressable>

              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={helpModalVisible} transparent animationType="fade" onRequestClose={closeHelpModal}>
        <View style={styles.accountModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeHelpModal} />
          <View style={[styles.accountModalSheet, { backgroundColor: surface, borderColor: divider }]}>
            {renderModalHeader(
              "Help and Support",
              "Quick guidance and support",
              "help-buoy-outline",
              closeHelpModal
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountModalContent}>
              <View style={[styles.helpIntroCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={[styles.helpIntroIcon, { backgroundColor: chipBg }]}>
                  <Ionicons name="help-buoy-outline" size={scale(20)} color={primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.helpIntroTitle, { color: textDark }]}>Need help using TahananSafe?</Text>
                  <Text style={[styles.helpIntroSub, { color: muted }]}>
                    Find quick guidance for incidents, account security, and urgent assistance.
                  </Text>
                </View>
              </View>

              <View style={[styles.helpInfoCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                  <Ionicons name="document-text-outline" size={iconSize} color={primary} />
                </View>
                <View style={styles.helpInfoBody}>
                  <Text style={[styles.helpInfoTitle, { color: textDark }]}>Reporting help</Text>
                  <Text style={[styles.helpInfoSub, { color: muted }]}>
                    Use Incident Log to describe the situation, attach photos, and submit your report.
                  </Text>
                </View>
              </View>

              <View style={[styles.helpInfoCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                  <Ionicons name="shield-checkmark-outline" size={iconSize} color={primary} />
                </View>
                <View style={styles.helpInfoBody}>
                  <Text style={[styles.helpInfoTitle, { color: textDark }]}>Security help</Text>
                  <Text style={[styles.helpInfoSub, { color: muted }]}>
                    Open Privacy and Security to manage biometrics and PIN protection for this device.
                  </Text>
                </View>
              </View>

              <View style={[styles.helpInfoCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                  <Ionicons name="call-outline" size={iconSize} color={primary} />
                </View>
                <View style={styles.helpInfoBody}>
                  <Text style={[styles.helpInfoTitle, { color: textDark }]}>Emergency help</Text>
                  <Text style={[styles.helpInfoSub, { color: muted }]}>
                    For urgent situations, use the Hotlines tab or the SOS Alert action from the Home screen.
                  </Text>
                </View>
              </View>

              {onHelpPress ? (
                <Pressable
                  onPress={() => {
                    closeHelpModal();
                    onHelpPress();
                  }}
                  android_ripple={{ color: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                  style={[styles.accountModalItem, { backgroundColor: cardBg, borderColor: cardBorder }]}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={iconSize} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingTitleInner, { color: textDark }]}>Contact support</Text>
                      <Text style={[styles.settingSub, { color: muted }]}>Open the support channel</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={iconSize} color={primary} />
                </Pressable>
              ) : null}

              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={termsModalVisible} transparent animationType="fade" onRequestClose={closeTermsModal}>
        <View style={styles.accountModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeTermsModal} />
          <View style={[styles.accountModalSheet, { backgroundColor: surface, borderColor: divider }]}>
            {renderModalHeader(
              "Terms and Conditions",
              "Important information about using the app",
              "document-text-outline",
              closeTermsModal
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountModalContent}>
              <View style={[styles.helpIntroCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={[styles.helpIntroIcon, { backgroundColor: chipBg }]}>
                  <Ionicons name="document-text-outline" size={scale(20)} color={primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.helpIntroTitle, { color: textDark }]}>Using TahananSafe responsibly</Text>
                  <Text style={[styles.helpIntroSub, { color: muted }]}>
                    By using the app, you agree to provide truthful information and use community and reporting tools properly.
                  </Text>
                </View>
              </View>

              <View style={[styles.helpInfoCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                  <Ionicons name="person-outline" size={iconSize} color={primary} />
                </View>
                <View style={styles.helpInfoBody}>
                  <Text style={[styles.helpInfoTitle, { color: textDark }]}>Account responsibility</Text>
                  <Text style={[styles.helpInfoSub, { color: muted }]}>
                    Keep your login credentials, biometrics, and PIN secure and do not share access with others.
                  </Text>
                </View>
              </View>

              <View style={[styles.helpInfoCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                  <Ionicons name="warning-outline" size={iconSize} color={primary} />
                </View>
                <View style={styles.helpInfoBody}>
                  <Text style={[styles.helpInfoTitle, { color: textDark }]}>Responsible reporting</Text>
                  <Text style={[styles.helpInfoSub, { color: muted }]}>
                    Incident reports and SOS alerts should only be used for legitimate concerns and emergencies.
                  </Text>
                </View>
              </View>

              <View style={[styles.helpInfoCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                  <Ionicons name="shield-checkmark-outline" size={iconSize} color={primary} />
                </View>
                <View style={styles.helpInfoBody}>
                  <Text style={[styles.helpInfoTitle, { color: textDark }]}>Data and safety</Text>
                  <Text style={[styles.helpInfoSub, { color: muted }]}>
                    Submitted information may be reviewed to support response, safety, and account security workflows.
                  </Text>
                </View>
              </View>

              {onTermsPress ? (
                <Pressable
                  onPress={() => {
                    closeTermsModal();
                    onTermsPress();
                  }}
                  android_ripple={{ color: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                  style={[styles.accountModalItem, { backgroundColor: cardBg, borderColor: cardBorder }]}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                      <Ionicons name="open-outline" size={iconSize} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingTitleInner, { color: textDark }]}>View full terms</Text>
                      <Text style={[styles.settingSub, { color: muted }]}>Open the complete terms document</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={iconSize} color={primary} />
                </Pressable>
              ) : null}

              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={[styles.page, { backgroundColor: screenBg }]}>
        <View style={styles.headerWrap}>
          <View style={styles.headerTopRow}>
            <Text style={[styles.title, { color: isDark ? textDark : (C.heading ?? "#374151") }]}>Settings</Text>
          </View>

          <View style={styles.settingsSearchRow}>
            <View style={[styles.settingsSearchBox, { backgroundColor: surface, borderColor: divider }]}>
              <Ionicons name="search-outline" size={smallIcon} color={muted} />
              <TextInput
                value={settingsSearch}
                onChangeText={setSettingsSearch}
                placeholder="Search"
                placeholderTextColor={muted}
                style={[styles.settingsSearchInput, { color: textDark }]}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {!!settingsSearch && (
                <Pressable
                  onPress={() => setSettingsSearch("")}
                  style={({ pressed }) => [styles.settingsSearchClear, pressed && { opacity: 0.65 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Clear settings search"
                >
                  <Ionicons name="close" size={smallIcon} color={muted} />
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={openPersonalizationModal}
              style={({ pressed }) => [
                styles.settingsFilterButton,
                { backgroundColor: surface, borderColor: divider },
                pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open personalization settings"
            >
              <Ionicons name="options-outline" size={compactScale(21)} color={muted} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.settingsContent, { paddingBottom: settingsBottomClearance }]}
          scrollIndicatorInsets={{ bottom: settingsBottomClearance }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          bounces
        >
          {!hasSettingsResult ? (
            <View style={[styles.settingsEmptyCard, { backgroundColor: surface, borderColor: divider }]}>
              <Ionicons name="search-outline" size={iconSize} color={muted} />
              <Text style={[styles.settingsEmptyText, { color: muted }]}>No settings found.</Text>
            </View>
          ) : null}

          {showProfileCard ? (
            <Pressable
              onPress={openAccountModal}
              style={({ pressed }) => [
                styles.settingsProfileCard,
                { backgroundColor: surface, borderColor: divider },
                pressed && { opacity: 0.84 },
              ]}
            >
              <View style={styles.settingsAvatarWrap}>
                {settingsAvatarUri && !settingsAvatarLoadFailed ? (
                  <Image
                    source={{ uri: settingsAvatarUri }}
                    style={styles.settingsAvatarImage}
                    onError={() => setSettingsAvatarLoadFailed(true)}
                  />
                ) : (
                  <View style={styles.settingsAvatarFallback}>
                    <Text style={styles.settingsAvatarInitials}>{savedProfileHeroInitials}</Text>
                  </View>
                )}
                <View style={styles.settingsVerifiedBadge}>
                  <Ionicons name="checkmark" size={scale(10)} color="#FFFFFF" />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.settingsProfileName, { color: textDark }]}>{settingsProfileName}</Text>
                <Text style={[styles.settingsProfileMeta, { color: muted }]}>{settingsBarangay} • Verified</Text>
              </View>

              <Ionicons name="chevron-forward" size={iconSize} color={muted} />
            </Pressable>
          ) : null}

          {showAccountSection ? (
            <>
              <Text style={[styles.settingsSectionLabel, { color: muted }]}>ACCOUNT</Text>
              <View style={[styles.settingsCard, { backgroundColor: surface, borderColor: divider }]}>
                {showPersonalInfo ? (
                  <Pressable onPress={openProfileModal} style={[styles.settingsRow, styles.settingsRowDetailed]}>
                    <View style={styles.settingsRowLeft}>
                      <Ionicons name="person-outline" size={smallIcon} color={muted} style={styles.settingsRowIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settingsRowTitle, { color: textDark }]}>Personal Information</Text>
                        <Text style={[styles.settingsRowSubtitle, { color: muted }]}>{settingsPhoneNumber}</Text>
                      </View>
                    </View>
                    <Ionicons name="pencil-outline" size={smallIcon} color={muted} />
                  </Pressable>
                ) : null}

                {showPersonalInfo && showCitizenship ? <View style={[styles.settingsDivider, { backgroundColor: divider }]} /> : null}

                {showCitizenship ? (
                  <Pressable onPress={openCitizenshipDetails} style={[styles.settingsRow, styles.settingsRowDetailed]}>
                    <View style={styles.settingsRowLeft}>
                      <Ionicons name="id-card-outline" size={smallIcon} color={muted} style={styles.settingsRowIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settingsRowTitle, { color: textDark }]}>Citizenship Details</Text>
                        <Text style={[styles.settingsRowSubtitle, { color: muted }]}>ID: {settingsCitizenId}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={smallIcon} color={muted} />
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : null}

          {showSecuritySection ? (
            <>
              <Text style={[styles.settingsSectionLabel, { color: muted }]}>SECURITY & PRIVACY</Text>
              <View style={[styles.settingsCard, { backgroundColor: surface, borderColor: divider }]}>
                {showPasswordSecurity ? (
                  <Pressable onPress={openPrivacySecurity} style={styles.settingsRow}>
                    <View style={styles.settingsRowLeft}>
                      <Ionicons name="lock-closed-outline" size={smallIcon} color={muted} style={styles.settingsRowIcon} />
                      <Text style={[styles.settingsRowTitle, { color: textDark }]}>Password & Security PIN</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={smallIcon} color={muted} />
                  </Pressable>
                ) : null}

                {showPasswordSecurity && (showBiometrics || showLocationServices || showPrivacyPolicy) ? (
                  <View style={[styles.settingsDivider, { backgroundColor: divider }]} />
                ) : null}

                {showBiometrics ? (
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowLeft}>
                      <Ionicons name="finger-print-outline" size={smallIcon} color={muted} style={styles.settingsRowIcon} />
                      <Text style={[styles.settingsRowTitle, { color: textDark }]}>Biometric Login</Text>
                    </View>
                    <Switch
                      value={bioEnabled}
                      onValueChange={onToggleBiometrics}
                      disabled={bioLoading || !canManageSecurity}
                      trackColor={{ false: "#D8DEE7", true: "#111827" }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                ) : null}

                {showBiometrics && (showLocationServices || showPrivacyPolicy) ? (
                  <View style={[styles.settingsDivider, { backgroundColor: divider }]} />
                ) : null}

                {showLocationServices ? (
                  <View style={[styles.settingsRow, styles.settingsRowCompact]}>
                    <Text style={[styles.settingsRowTitle, { color: textDark }]}>Location Services</Text>
                    <Switch
                      value={locationServicesEnabled}
                      onValueChange={(next) => void onToggleLocationServices(next)}
                      trackColor={{ false: "#D8DEE7", true: "#111827" }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                ) : null}

                {showLocationServices && showPrivacyPolicy ? (
                  <View style={[styles.settingsDivider, { backgroundColor: divider }]} />
                ) : null}

                {showPrivacyPolicy ? (
                  <Pressable onPress={openPrivacyPolicy} style={[styles.settingsRow, styles.settingsRowCompact]}>
                    <Text style={[styles.settingsRowTitle, { color: textDark }]}>Privacy Policy</Text>
                    <Ionicons name="open-outline" size={smallIcon} color={muted} />
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : null}

          {showPreferencesSection ? (
            <>
              <Text style={[styles.settingsSectionLabel, { color: muted }]}>PREFERENCES</Text>
              <View style={[styles.settingsCard, { backgroundColor: surface, borderColor: divider }]}>
                {showCaseUpdates ? (
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowLeft}>
                      <Ionicons name="notifications-outline" size={smallIcon} color={muted} style={styles.settingsRowIcon} />
                      <Text style={[styles.settingsRowTitle, { color: textDark }]}>Case Updates</Text>
                    </View>
                    <Switch
                      value={caseUpdatesEnabled}
                      onValueChange={(next) => void onToggleCaseUpdates(next)}
                      trackColor={{ false: "#D8DEE7", true: "#111827" }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                ) : null}

                {showCaseUpdates && showEmergencyAlerts ? <View style={[styles.settingsDivider, { backgroundColor: divider }]} /> : null}

                {showEmergencyAlerts ? (
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowLeft}>
                      <MaterialCommunityIcons
                        name="alert-rhombus-outline"
                        size={smallIcon}
                        color="#EF4444"
                        style={styles.settingsRowIcon}
                      />
                      <Text style={[styles.settingsRowTitle, { color: textDark, fontWeight: FontWeight.semibold }]}>Emergency Alerts</Text>
                    </View>
                    <Switch
                      value={emergencyAlertsEnabled}
                      onValueChange={(next) => void onToggleEmergencyAlerts(next)}
                      trackColor={{ false: "#D8DEE7", true: "#EF4444" }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          {showHelpSection ? (
            <>
              <Text style={[styles.settingsSectionLabel, { color: muted }]}>HELP & LEGAL</Text>
              <View style={styles.settingsHelpGrid}>
                {showTutorials ? (
                  <Pressable
                    onPress={openHelpModal}
                    style={({ pressed }) => [
                      styles.settingsHelpButton,
                      { backgroundColor: surface, borderColor: divider },
                      pressed && { opacity: 0.78 },
                    ]}
                  >
                    <Ionicons name="school-outline" size={smallIcon} color={textDark} />
                    <Text style={[styles.settingsHelpText, { color: textDark }]}>Tutorials</Text>
                  </Pressable>
                ) : null}

                {showFaqs ? (
                  <Pressable
                    onPress={openHelpModal}
                    style={({ pressed }) => [
                      styles.settingsHelpButton,
                      { backgroundColor: surface, borderColor: divider },
                      pressed && { opacity: 0.78 },
                    ]}
                  >
                    <Ionicons name="documents-outline" size={smallIcon} color={textDark} />
                    <Text style={[styles.settingsHelpText, { color: textDark }]}>FAQs</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : null}

          {showAiNotice ? (
            <Pressable onPress={openAiTransparencyNotice} style={styles.settingsAiCard}>
              <View style={styles.settingsAiHeader}>
                <Ionicons name="bulb-outline" size={smallIcon} color="#67E8F9" />
                <Text style={styles.settingsAiTitle}>AI Transparency Notice</Text>
              </View>
              <Text style={styles.settingsAiBody}>
                Insights are generated by AI. Official decisions remain with barangay authorities.
              </Text>
            </Pressable>
          ) : null}

          {showFeedback ? (
            <>
              <Text style={[styles.settingsSectionLabel, { color: muted }]}>FEEDBACK</Text>
              <View style={[styles.settingsFeedbackCard, { backgroundColor: surface, borderColor: divider }]}>
                <View style={styles.settingsFeedbackHeader}>
                  <Text style={[styles.settingsFeedbackTitle, { color: textDark }]}>Rate your experience</Text>
                  <View style={styles.settingsStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Pressable key={star} onPress={() => setFeedbackRating(star)} hitSlop={6}>
                        <Ionicons
                          name={feedbackRating >= star ? "star" : "star-outline"}
                          size={iconSize}
                          color={feedbackRating >= star ? "#F59E0B" : "#C8CED8"}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>

                <TextInput
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder="Any suggestions for us?"
                  placeholderTextColor={muted}
                  multiline
                  style={[
                    styles.settingsFeedbackInput,
                    { color: textDark, borderColor: divider, backgroundColor: isDark ? "#0F172A" : "#F1F3F6" },
                  ]}
                  textAlignVertical="top"
                />

                <Pressable
                  onPress={onSendFeedback}
                  style={({ pressed }) => [styles.settingsFeedbackButton, pressed && { opacity: 0.82 }]}
                >
                  <Text style={styles.settingsFeedbackButtonText}>Send Feedback</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {showSignOut ? (
            <Pressable
              onPress={() => setLogoutModalVisible(true)}
              style={({ pressed }) => [styles.settingsSignOutButton, pressed && { opacity: 0.72 }]}
            >
              <Ionicons name="log-out-outline" size={smallIcon} color="#EF4444" />
              <Text style={styles.settingsSignOutText}>Sign Out</Text>
            </Pressable>
          ) : null}
          {/* ✅ Verify Account Card */}
          {/* ✅ ONE continuous card list */}
          {/* ✅ Logout card */}
        </ScrollView>

        {/* ✅ PIN setup modal (unchanged) */}
        <Modal visible={pinModalVisible} transparent animationType="fade" onRequestClose={closePinSetup}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              style={[styles.modalCard, { backgroundColor: surface, borderColor: divider }]}
              contentContainerStyle={styles.modalCardContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <View style={[styles.modalBadge, { backgroundColor: chipBg }]}>
                    <Ionicons name="keypad-outline" size={iconSize} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: textDark }]}>Set your PIN</Text>
                    <Text style={[styles.modalHint, { color: muted }]}>Create a 4-digit PIN (numbers only).</Text>
                  </View>
                </View>

                <Pressable
                  onPress={closePinSetup}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close PIN setup"
                  style={({ pressed }) => [
                    styles.modalCloseBtn,
                    { backgroundColor: chipBg },
                    pressed && styles.modalPressed,
                  ]}
                >
                  <Ionicons name="close" size={iconSize} color={muted} />
                </Pressable>
              </View>

              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: textDark }]}>PIN</Text>
                <TextInput
                  value={pinDraft}
                  onChangeText={(t) => setPinDraft(t.replace(/[^\d]/g, ""))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  placeholder="Enter PIN"
                  placeholderTextColor={muted}
                  style={[
                    styles.modalInput,
                    { borderColor: divider, color: textDark, backgroundColor: cardBg },
                  ]}
                />
              </View>

              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: textDark }]}>Confirm PIN</Text>
                <TextInput
                  value={pinConfirm}
                  onChangeText={(t) => setPinConfirm(t.replace(/[^\d]/g, ""))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  placeholder="Confirm PIN"
                  placeholderTextColor={muted}
                  style={[
                    styles.modalInput,
                    { borderColor: divider, color: textDark, backgroundColor: cardBg },
                  ]}
                />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  onPress={closePinSetup}
                  style={[styles.modalBtn, styles.modalBtnGhost, { borderColor: divider }]}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                >
                  <Text style={[styles.modalBtnText, { color: textDark }]}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={onSavePin}
                  style={[
                    styles.modalBtn,
                    {
                      backgroundColor: Colors.actionPrimary,
                      borderColor: Colors.actionPrimary,
                    },
                  ]}
                  android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                >
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>Save</Text>
                </Pressable>
              </View>

              {!!userEmail && (
                <View style={styles.modalFoot}>
                  <Ionicons name="mail-outline" size={smallIcon} color={muted} />
                  <Text style={[styles.modalFootText, { color: muted }]}>Account: {userEmail}</Text>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          centerLabel="Services"
          fabQuickActions
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={onFabPress ?? (() => handleTab("Incident"))}
          onQuickExit={onQuickExit}
        />
      </View>

      <LogoutModal
        visible={logoutModalVisible}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={() => {
          setLogoutModalVisible(false);
          void handleSignOutCurrentSession();
        }}
      />
    </SafeAreaView>
  );
}

/** ---------- UI helpers ---------- */
function SettingRow({
  label,
  subtitle,
  icon,
  onPress,
  primary,
  muted,
  textDark,
  divider,
  iconSize,
  styles,
  isDark,
  chipBg,
}: {
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  primary: string;
  muted: string;
  textDark: string;
  divider: string;
  iconSize: number;
  styles: any;
  isDark?: boolean;
  chipBg?: string;
}) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }} style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIconWrap, { backgroundColor: chipBg || "#EEF6FF" }]}>
          <Ionicons name={icon} size={iconSize} color={primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingTitle, { color: textDark }]}>{label}</Text>
          {!!subtitle && <Text style={[styles.settingSub, { color: muted }]}>{subtitle}</Text>}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={iconSize} color={primary} />
    </Pressable>
  );
}

function makeStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number,
  compactScale: (n: number) => number,
  compactHeight: boolean
) {
  const type = createTypography(scale, vscale);
  const CARD_R = compactScale(14);
  const SEARCH_CONTROL_SIZE = compactScale(40);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },
    settingsContent: {
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
      paddingHorizontal: scale(18),
      paddingTop: vscale(6),
      gap: vscale(10),
    },
    settingsSearchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(9),
    },
    settingsSearchBox: {
      flex: 1,
      minWidth: 0,
      height: SEARCH_CONTROL_SIZE,
      borderRadius: SEARCH_CONTROL_SIZE / 2,
      borderWidth: 1,
      paddingHorizontal: scale(14),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    settingsSearchInput: {
      ...type.input,
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
    },
    settingsSearchClear: {
      width: compactScale(28),
      height: compactScale(28),
      borderRadius: compactScale(14),
      alignItems: "center",
      justifyContent: "center",
    },
    settingsFilterButton: {
      width: SEARCH_CONTROL_SIZE,
      height: SEARCH_CONTROL_SIZE,
      borderRadius: SEARCH_CONTROL_SIZE / 2,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#64748B",
      shadowOpacity: 0.13,
      shadowRadius: scale(5),
      shadowOffset: { width: 0, height: vscale(2) },
      elevation: 2,
    },
    settingsEmptyCard: {
      minHeight: vscale(74),
      borderRadius: compactScale(13),
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: vscale(6),
    },
    settingsEmptyText: {
      ...type.bodyStrong,
    },
    settingsProfileCard: {
      minHeight: vscale(88),
      borderRadius: compactScale(12),
      borderWidth: 1,
      paddingHorizontal: scale(14),
      paddingVertical: vscale(14),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(12),
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    settingsAvatarWrap: {
      width: compactScale(52),
      height: compactScale(52),
      borderRadius: scale(14),
      position: "relative",
      justifyContent: "center",
      alignItems: "center",
    },
    settingsAvatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: scale(14),
      backgroundColor: "#E5E7EB",
    },
    settingsAvatarFallback: {
      width: "100%",
      height: "100%",
      borderRadius: scale(14),
      backgroundColor: "#E5EEF7",
      alignItems: "center",
      justifyContent: "center",
    },
    settingsAvatarInitials: {
      ...type.modalTitle,
      color: "#0B4F7A",
    },
    settingsVerifiedBadge: {
      position: "absolute",
      right: -scale(4),
      bottom: scale(5),
      width: compactScale(18),
      height: compactScale(18),
      borderRadius: compactScale(9),
      backgroundColor: "#18A999",
      borderWidth: 2,
      borderColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
    settingsProfileName: {
      ...type.sectionTitle,
    },
    settingsProfileMeta: {
      ...type.captionStrong,
      marginTop: vscale(2),
    },
    settingsSectionLabel: {
      ...type.overline,
      marginTop: vscale(2),
      marginLeft: scale(4),
    },
    settingsCard: {
      borderRadius: compactScale(12),
      borderWidth: 1,
      overflow: "hidden",
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    settingsRow: {
      minHeight: vscale(56),
      paddingHorizontal: scale(14),
      paddingVertical: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(12),
    },
    settingsRowDetailed: {
      minHeight: vscale(78),
    },
    settingsRowCompact: {
      minHeight: vscale(46),
      paddingVertical: vscale(8),
    },
    settingsRowLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: scale(12),
    },
    settingsRowIcon: {
      width: scale(22),
      textAlign: "center",
    },
    settingsRowTitle: {
      ...type.body,
      flexShrink: 1,
    },
    settingsRowSubtitle: {
      ...type.bodySmall,
      marginTop: vscale(2),
    },
    settingsDivider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 0,
    },
    settingsHelpGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: scale(14),
    },
    settingsHelpButton: {
      flex: 1,
      minWidth: scale(130),
      minHeight: vscale(46),
      borderRadius: compactScale(12),
      borderWidth: 1,
      paddingHorizontal: scale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: scale(8),
    },
    settingsHelpText: {
      ...type.bodySmall,
    },
    settingsAiCard: {
      minHeight: vscale(98),
      borderRadius: compactScale(12),
      backgroundColor: "#111827",
      paddingHorizontal: scale(14),
      paddingVertical: vscale(14),
      gap: vscale(8),
      justifyContent: "center",
    },
    settingsAiHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    settingsAiTitle: {
      ...type.bodyLarge,
      color: "#E5F4FF",
    },
    settingsAiBody: {
      ...type.micro,
      color: "#B9C5D3",
    },
    settingsFeedbackCard: {
      minHeight: vscale(210),
      borderRadius: compactScale(12),
      borderWidth: 1,
      paddingHorizontal: scale(14),
      paddingVertical: vscale(16),
      gap: vscale(16),
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    settingsFeedbackHeader: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(8),
    },
    settingsFeedbackTitle: {
      ...type.body,
      flex: 1,
    },
    settingsStars: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(3),
    },
    settingsFeedbackInput: {
      ...type.input,
      minHeight: vscale(76),
      borderWidth: 1,
      borderRadius: compactScale(10),
      backgroundColor: "#F1F3F6",
      paddingHorizontal: scale(12),
      paddingVertical: vscale(10),
    },
    settingsFeedbackButton: {
      minHeight: vscale(44),
      borderRadius: compactScale(8),
      backgroundColor: Colors.actionPrimary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(14),
    },
    settingsFeedbackButtonText: {
      ...type.button,
      color: "#FFFFFF",
    },
    settingsSignOutButton: {
      minHeight: vscale(48),
      borderRadius: compactScale(11),
      borderWidth: 1,
      borderColor: "#F3A8A8",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: scale(8),
      marginTop: vscale(4),
      marginHorizontal: scale(4),
    },
    settingsSignOutText: {
      ...type.button,
      color: "#EF4444",
    },
    headerWrap: {
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
      paddingHorizontal: scale(18),
      paddingTop: vscale(compactHeight ? 10 : 18),
      paddingBottom: vscale(compactHeight ? 7 : 10),
      zIndex: 30,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: scale(10),
      paddingHorizontal: scale(6),
      marginBottom: vscale(compactHeight ? 12 : 16),
    },
    // ✅ CHANGED: from scale(30) -> scale(28) to match Hotlines + Reports
    title: { ...type.screenTitle },

    content: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
    },

    oneCard: {
      borderRadius: CARD_R,
      borderWidth: 1,
      overflow: "hidden",
      marginTop: vscale(12),
    },

    logoutCard: {
      borderRadius: CARD_R,
      borderWidth: 1,
      overflow: "hidden",
      marginTop: vscale(12),
    },

    line: { height: StyleSheet.hairlineWidth, opacity: 1 },

    settingRow: {
      paddingHorizontal: scale(14),
      paddingVertical: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(12),
    },

    settingLeft: { flexDirection: "row", alignItems: "center", gap: scale(10), flex: 1 },
    settingIconWrap: {
      width: vscale(40),
      height: vscale(40),
      borderRadius: vscale(14),
      alignItems: "center",
      justifyContent: "center",
    },

    settingTitle: { ...type.bodyStrong },
    settingTitleInner: { ...type.body },

    settingSub: {
      ...type.micro,
      marginTop: vscale(2),
    },

    // Status chip used in modal cards
    statusChip: {
      paddingHorizontal: scale(10),
      paddingVertical: vscale(6),
      borderRadius: vscale(14),
      alignItems: "center",
      justifyContent: "center",
      minWidth: scale(82),
    },
    statusChipText: { ...type.captionStrong },

    toggleWrap: {
      paddingHorizontal: scale(14),
      paddingVertical: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(12),
    },
    toggleTitle: { ...type.cardTitle },
    toggleSub: {
      ...type.micro,
      marginTop: vscale(4),
    },

    emptyState: {
      paddingHorizontal: scale(14),
      paddingVertical: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
    },
    emptyText: { ...type.caption, flex: 1 },

    accountFoot: {
      paddingHorizontal: scale(14),
      paddingBottom: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    accountFootText: { ...type.micro },

    // PIN Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(2, 15, 32, 0.56)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(20),
      paddingVertical: vscale(24),
    },
    modalCard: {
      width: "100%",
      maxWidth: 480,
      maxHeight: "92%",
      borderRadius: scale(24),
      borderWidth: 1,
      shadowColor: "#020F20",
      shadowOpacity: 0.2,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
    modalCardContent: {
      padding: scale(18),
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: scale(10),
    },
    modalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: scale(10), flex: 1 },
    modalBadge: {
      width: vscale(40),
      height: vscale(40),
      borderRadius: vscale(14),
      alignItems: "center",
      justifyContent: "center",
    },
    modalTitle: { ...type.sectionTitle },
    modalHint: { ...type.micro, marginTop: vscale(3) },
    modalCloseBtn: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(14),
      alignItems: "center",
      justifyContent: "center",
    },
    modalField: { marginTop: vscale(12) },
    modalLabel: { ...type.captionStrong, marginBottom: vscale(6) },
    modalInput: {
      ...type.input,
      height: vscale(48),
      borderWidth: 1,
      borderRadius: scale(12),
      paddingHorizontal: scale(12),
    },
    modalActions: {
      marginTop: vscale(14),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: scale(10),
    },
    modalBtn: {
      minWidth: scale(110),
      height: vscale(46),
      borderRadius: scale(12),
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(14),
    },
    modalBtnGhost: { backgroundColor: "transparent" },
    modalBtnText: { ...type.button },
    modalFoot: {
      marginTop: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    modalFootText: { ...type.micro },

    // Centered settings dialogs
    accountModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(2, 15, 32, 0.56)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(20),
      paddingVertical: vscale(24),
    },
    accountModalSheet: {
      width: "100%",
      maxWidth: 480,
      borderRadius: scale(24),
      borderWidth: 1,
      overflow: "hidden",
      paddingBottom: Platform.OS === "ios" ? vscale(12) : vscale(10),
      maxHeight: "84%",
      shadowColor: "#020F20",
      shadowOpacity: 0.22,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 14,
    },
    psModalSheet: {
      width: "100%",
      maxWidth: 480,
      borderRadius: scale(24),
      borderWidth: 1,
      overflow: "hidden",
      paddingBottom: Platform.OS === "ios" ? vscale(12) : vscale(10),
      maxHeight: "88%",
      shadowColor: "#020F20",
      shadowOpacity: 0.22,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 14,
    },
    // ✅ NEW: Personalization modal sizing
    persModalSheet: {
      width: "100%",
      maxWidth: 480,
      borderRadius: scale(24),
      borderWidth: 1,
      overflow: "hidden",
      paddingBottom: Platform.OS === "ios" ? vscale(12) : vscale(10),
      maxHeight: "88%",
      shadowColor: "#020F20",
      shadowOpacity: 0.22,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 14,
    },
    profileModalKeyboard: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    },
    profileModalSheet: {
      borderRadius: scale(24),
      borderWidth: 1,
      overflow: "hidden",
      width: "100%",
      maxWidth: 480,
      paddingBottom: 0,
      maxHeight: "88%",
      shadowColor: "#020F20",
      shadowOpacity: 0.22,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 14,
    },

    accountModalHeader: {
      minHeight: vscale(76),
      paddingHorizontal: scale(18),
      paddingVertical: vscale(14),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(12),
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    accountModalHeaderLead: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: scale(12),
    },
    accountModalHeaderIcon: {
      width: scale(44),
      height: scale(44),
      borderRadius: scale(14),
      alignItems: "center",
      justifyContent: "center",
    },
    accountModalHeaderCopy: { flex: 1 },
    accountModalTitle: { ...type.sectionTitle },
    accountModalSubtitle: {
      ...type.micro,
      marginTop: vscale(3),
    },
    accountModalClose: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(14),
      alignItems: "center",
      justifyContent: "center",
    },
    modalPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },

    currentAccountRow: {
      marginHorizontal: scale(14),
      marginTop: vscale(14),
      marginBottom: vscale(10),
      borderRadius: scale(16),
      borderWidth: 1,
      paddingHorizontal: scale(12),
      paddingVertical: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
    },
    currentAvatar: {
      width: vscale(40),
      height: vscale(40),
      borderRadius: vscale(20),
      alignItems: "center",
      justifyContent: "center",
    },
    currentTitle: { ...type.captionStrong },
    currentSub: { ...type.caption, marginTop: vscale(2) },

    currentPill: {
      paddingHorizontal: scale(10),
      paddingVertical: vscale(6),
      borderRadius: vscale(14),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(6),
    },
    currentPillText: { ...type.captionStrong },

    accountModalContent: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(16),
      paddingBottom: vscale(18),
      gap: vscale(12),
    },
    profileModalContent: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(16),
      paddingBottom: vscale(14),
    },
    profileModalSections: {
      gap: vscale(12),
    },
    accountModalItem: {
      borderRadius: scale(16),
      borderWidth: 1,
      borderColor: "#E7EEF7",
      backgroundColor: "#FFFFFF",
      paddingHorizontal: scale(14),
      paddingVertical: vscale(14),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(12),
      overflow: "hidden",
      shadowColor: "#0A2848",
      shadowOpacity: 0.045,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    profileHeroCard: {
      borderRadius: scale(18),
      borderWidth: 1,
      paddingHorizontal: scale(14),
      paddingVertical: vscale(16),
      alignItems: "center",
    },
    profileAvatarWrap: {
      width: scale(82),
      height: scale(82),
      borderRadius: scale(41),
      overflow: "hidden",
      marginBottom: vscale(12),
    },
    profileAvatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: scale(41),
    },
    profileAvatarFallback: {
      width: "100%",
      height: "100%",
      borderRadius: scale(41),
      alignItems: "center",
      justifyContent: "center",
    },
    profileAvatarFallbackText: {
      ...type.screenTitle,
    },
    profileHeroTitle: {
      ...type.sectionTitle,
      textAlign: "center",
    },
    profileHeroSub: {
      ...type.caption,
      marginTop: vscale(4),
      textAlign: "center",
    },
    profilePhotoBtn: {
      marginTop: vscale(12),
      borderWidth: 1,
      borderRadius: scale(14),
      paddingHorizontal: scale(14),
      paddingVertical: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    profilePhotoBtnText: {
      ...type.captionStrong,
    },
    profileFormCard: {
      borderRadius: scale(18),
      borderWidth: 1,
      paddingHorizontal: scale(14),
      paddingVertical: vscale(14),
      gap: vscale(12),
    },
    profileFieldBlock: {
      gap: vscale(6),
    },
    profileFieldLabel: {
      ...type.captionStrong,
    },
    profileInput: {
      ...type.input,
      minHeight: vscale(48),
      borderWidth: 1,
      borderRadius: scale(12),
      paddingHorizontal: scale(12),
    },
    profilePhoneInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: scale(14),
      gap: scale(10),
    },
    profilePhonePrefix: {
      ...type.bodyStrong,
    },
    profilePhoneInput: {
      ...type.input,
      flex: 1,
      paddingVertical: 0,
    },
    profileFieldError: {
      ...type.captionStrong,
      marginTop: vscale(2),
      color: "#DC2626",
    },
    profileModalActions: {
      flexDirection: "row",
      gap: scale(10),
      paddingBottom: 0,
    },
    profileActionBtn: {
      flex: 1,
      minHeight: vscale(48),
      borderRadius: scale(12),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(14),
    },
    profileActionBtnText: {
      ...type.label,
    },
    profileActionPrimaryText: {
      ...type.label,
      color: "#FFFFFF",
    },
    sessionCard: {
      borderRadius: scale(18),
      borderWidth: 1,
      paddingHorizontal: scale(14),
      paddingVertical: vscale(14),
      gap: vscale(12),
    },
    sessionTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(10),
    },
    sessionBadge: {
      paddingHorizontal: scale(10),
      paddingVertical: vscale(6),
      borderRadius: vscale(14),
      alignItems: "center",
      justifyContent: "center",
    },
    sessionBadgeText: {
      ...type.captionStrong,
    },
    sessionDetails: {
      gap: vscale(8),
    },
    sessionDetailRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: scale(12),
    },
    sessionDetailLabel: {
      ...type.captionStrong,
      flex: 0.9,
    },
    sessionDetailValue: {
      ...type.captionStrong,
      flex: 1.2,
      textAlign: "right",
    },
    sessionHintCard: {
      borderRadius: scale(18),
      borderWidth: 1,
      paddingHorizontal: scale(14),
      paddingVertical: vscale(14),
      gap: vscale(6),
    },
    sessionHintTitle: {
      ...type.label,
    },
    sessionHintText: {
      ...type.caption,
    },
    helpIntroCard: {
      borderRadius: scale(18),
      borderWidth: 1,
      paddingHorizontal: scale(14),
      paddingVertical: vscale(14),
      flexDirection: "row",
      alignItems: "flex-start",
      gap: scale(12),
    },
    helpIntroIcon: {
      width: vscale(42),
      height: vscale(42),
      borderRadius: vscale(21),
      alignItems: "center",
      justifyContent: "center",
    },
    helpIntroTitle: {
      ...type.cardTitle,
    },
    helpIntroSub: {
      ...type.caption,
      marginTop: vscale(4),
    },
    helpInfoCard: {
      borderRadius: scale(16),
      borderWidth: 1,
      borderColor: "#E7EEF7",
      backgroundColor: "#FFFFFF",
      paddingHorizontal: scale(14),
      paddingVertical: vscale(14),
      flexDirection: "row",
      alignItems: "flex-start",
      gap: scale(12),
    },
    helpInfoBody: {
      flex: 1,
    },
    helpInfoTitle: {
      ...type.label,
    },
    helpInfoSub: {
      ...type.caption,
      marginTop: vscale(4),
    },

    // Expanded cards inside Privacy & Security modal
    psExpandedCard: {
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
      paddingHorizontal: 0,
      paddingVertical: 0,
      gap: 0,
    },
    psTopRow: {
      paddingHorizontal: scale(14),
      paddingVertical: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(12),
    },

    // ✅ Expanded card inside Personalization modal
    persExpandedCard: {
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
      paddingHorizontal: 0,
      paddingVertical: 0,
      gap: 0,
    },
    persTopRow: {
      paddingHorizontal: scale(14),
      paddingVertical: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(12),
    },

    // Theme picker
    themePickerWrap: {
      flexDirection: "row",
      paddingHorizontal: scale(14),
      paddingVertical: vscale(14),
      gap: scale(10),
    },
    themeOption: {
      flex: 1,
      borderRadius: scale(16),
      paddingVertical: vscale(14),
      alignItems: "center",
      justifyContent: "center",
      gap: vscale(8),
      position: "relative" as const,
    },
    themeOptionIcon: {
      width: scale(44),
      height: scale(44),
      borderRadius: scale(22),
      alignItems: "center",
      justifyContent: "center",
    },
    themeOptionLabel: {
      ...type.captionStrong,
    },
    themeCheckBadge: {
      position: "absolute" as const,
      top: scale(8),
      right: scale(8),
      width: scale(18),
      height: scale(18),
      borderRadius: scale(9),
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
