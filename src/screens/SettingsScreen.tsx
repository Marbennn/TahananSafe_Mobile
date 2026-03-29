// src/screens/SettingsScreen.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors } from "../theme/colors";
import { useTheme, ThemeMode } from "../theme/ThemeContext";

// ✅ Auth context (for current account email)
import { useAuth } from "../auth/AuthContext";

// ✅ SecureStore for per-account flags/tokens
import * as SecureStore from "expo-secure-store";

// ✅ Needed to talk to backend and keep App.tsx routing correct
import { getAccessToken, setHasPin, setPinSkippedForUser } from "../auth/session";
import { setPinApi, getMeApi } from "../api/pin";

// ✅ NEW: Verify Account card component
import VerifyAccountCard from "../components/Settings/VerifyAccountCard";
import LogoutModal from "../components/LogoutModal";

type Props = {
  onAccountPress?: () => void;
  onPrivacyPress?: () => void;
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

type SettingItem = {
  key: string;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
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

export default function SettingsScreen({
  onAccountPress,
  onPrivacyPress,
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

  // ===== Responsive scaling helpers =====
  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  // icon sizes (numbers kept OUTSIDE styles)
  const iconSize = scale(20);
  const smallIcon = scale(16);

  const { mode: themeMode, isDark, setMode: setThemeMode } = useTheme();

  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);
  const C = Colors as any;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // ✅ MATCH Hotlines/Reports sizing
  const NAV_BASE_HEIGHT = 78;
  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;

  // ✅ More scrollable (extra breathing room at bottom)
  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + vscale(40);

  const screenBg = isDark ? "#0F172A" : (C.screenBg ?? C.background ?? BG);
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
  const { user } = useAuth() as any;
  const userEmail: string = (user?.email ? String(user.email) : "").trim().toLowerCase();

  // ✅ Account modal
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const openAccountModal = () => setAccountModalVisible(true);
  const closeAccountModal = () => setAccountModalVisible(false);

  // ✅ Privacy & Security modal
  const [psModalVisible, setPsModalVisible] = useState(false);
  const openPrivacySecurity = () => setPsModalVisible(true);
  const closePrivacySecurity = () => setPsModalVisible(false);

  // ✅ Personalization modal (NEW)
  const [persModalVisible, setPersModalVisible] = useState(false);
  const openPersonalizationModal = () => setPersModalVisible(true);
  const closePersonalizationModal = () => setPersModalVisible(false);

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
      Alert.alert("Biometrics disabled", "Biometrics login is turned off for this account on this device.");
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
  const mainItems: SettingItem[] = useMemo(
    () => [
      {
        key: "account",
        label: "Account",
        subtitle: "Profile, email, sessions",
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
        onPress: onHelpPress,
      },
      {
        key: "terms",
        label: "Terms and Conditions",
        subtitle: "Policies & agreements",
        icon: "document-text-outline",
        onPress: onTermsPress,
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
    [onHelpPress, onTermsPress]
  );

  const canManageSecurity = !!userEmail;
  const currentStatusLabel = userEmail ? "Active" : "Guest";
  const currentStatusIcon = userEmail ? "checkmark-circle-outline" : "alert-circle-outline";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: screenBg }]} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ✅ Account Modal */}
      <Modal visible={accountModalVisible} transparent animationType="slide" onRequestClose={closeAccountModal}>
        <View style={styles.accountModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAccountModal} />
          <View style={[styles.accountModalSheet, { backgroundColor: surface, borderColor: divider }]}>
            <View style={styles.accountModalHeader}>
              <Text style={[styles.accountModalTitle, { color: textDark }]}>Account</Text>

              <Pressable onPress={closeAccountModal} hitSlop={10} style={styles.accountModalClose}>
                <Ionicons name="close" size={iconSize} color={muted} />
              </Pressable>
            </View>

            <View style={[styles.currentAccountRow, { borderColor: divider }]}>
              <View style={[styles.currentAvatar, { backgroundColor: chipBg }]}>
                <Ionicons name="person" size={scale(18)} color={primary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.currentTitle, { color: textDark }]}>Current Account</Text>
                <Text style={[styles.currentSub, { color: muted }]}>
                  {userEmail ? maskEmail(userEmail) : "Not signed in"}
                </Text>
              </View>

              <View style={[styles.currentPill, { backgroundColor: chipBg }]}>
                <Ionicons name={currentStatusIcon as any} size={smallIcon} color={primary} />
                <Text style={[styles.currentPillText, { color: primary }]}>{currentStatusLabel}</Text>
              </View>
            </View>

            <View style={[styles.line, { backgroundColor: divider }]} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountModalContent}>
              <Pressable
                onPress={() => {
                  closeAccountModal();
                  if (onAccountPress) onAccountPress();
                  else Alert.alert("Profile", "Wire this to your Profile screen.");
                }}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={styles.accountModalItem}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconWrap, { backgroundColor: "#EEF6FF" }]}>
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
                onPress={() => Alert.alert("Email", "Wire this to your Email settings screen.")}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={styles.accountModalItem}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconWrap, { backgroundColor: "#EEF6FF" }]}>
                    <Ionicons name="mail-outline" size={iconSize} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitleInner, { color: textDark }]}>Email</Text>
                    <Text style={[styles.settingSub, { color: muted }]}>Update email address</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={iconSize} color={primary} />
              </Pressable>

              <Pressable
                onPress={() => Alert.alert("Sessions", "Wire this to your Sessions screen.")}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={styles.accountModalItem}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconWrap, { backgroundColor: "#EEF6FF" }]}>
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

      {/* ✅ Privacy & Security Modal */}
      <Modal visible={psModalVisible} transparent animationType="slide" onRequestClose={closePrivacySecurity}>
        <View style={styles.accountModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePrivacySecurity} />
          <View style={[styles.psModalSheet, { backgroundColor: surface, borderColor: divider }]}>
            <View style={styles.accountModalHeader}>
              <Text style={[styles.accountModalTitle, { color: textDark }]}>Privacy and Security</Text>

              <Pressable onPress={closePrivacySecurity} hitSlop={10} style={styles.accountModalClose}>
                <Ionicons name="close" size={iconSize} color={muted} />
              </Pressable>
            </View>

            <View style={[styles.currentAccountRow, { borderColor: divider }]}>
              <View style={[styles.currentAvatar, { backgroundColor: chipBg }]}>
                <Ionicons name="lock-closed" size={scale(18)} color={primary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.currentTitle, { color: textDark }]}>Current Account</Text>
                <Text style={[styles.currentSub, { color: muted }]}>
                  {userEmail ? maskEmail(userEmail) : "Not signed in"}
                </Text>
              </View>

              <View style={[styles.currentPill, { backgroundColor: chipBg }]}>
                <Ionicons name={currentStatusIcon as any} size={smallIcon} color={primary} />
                <Text style={[styles.currentPillText, { color: primary }]}>{currentStatusLabel}</Text>
              </View>
            </View>

            <View style={[styles.line, { backgroundColor: divider }]} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountModalContent}>
              {/* Privacy */}
              <Pressable
                onPress={() => {
                  closePrivacySecurity();
                  onPrivacyPress?.();
                }}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={styles.accountModalItem}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconWrap, { backgroundColor: "#EEF6FF" }]}>
                    <Ionicons name="shield-checkmark-outline" size={iconSize} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitleInner, { color: textDark }]}>Privacy</Text>
                    <Text style={[styles.settingSub, { color: muted }]}>Permissions, data protection</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={iconSize} color={primary} />
              </Pressable>

              {/* Biometrics */}
              <View style={[styles.accountModalItem, styles.psExpandedCard]}>
                <View style={styles.psTopRow}>
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconWrap, { backgroundColor: "#EEF6FF" }]}>
                      <Ionicons name="finger-print-outline" size={iconSize} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingTitleInner, { color: textDark }]}>Biometrics</Text>
                      <Text style={[styles.settingSub, { color: muted }]}>Face ID / fingerprint quick login</Text>
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
                      <Text style={[styles.toggleTitle, { color: textDark }]}>Use biometrics to login</Text>
                      <Text style={[styles.toggleSub, { color: muted }]}>
                        Enables biometric login for this account on this device.
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
              <View style={[styles.accountModalItem, styles.psExpandedCard]}>
                <View style={styles.psTopRow}>
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconWrap, { backgroundColor: "#EEF6FF" }]}>
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

                    {!!userEmail && (
                      <View style={styles.accountFoot}>
                        <Ionicons name="mail-outline" size={smallIcon} color={muted} />
                        <Text style={[styles.accountFootText, { color: muted }]}>Account: {userEmail}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ✅ Personalization Modal (NEW - behaves like Account modal) */}
      <Modal visible={persModalVisible} transparent animationType="slide" onRequestClose={closePersonalizationModal}>
        <View style={styles.accountModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePersonalizationModal} />
          <View style={[styles.persModalSheet, { backgroundColor: surface, borderColor: divider }]}>
            <View style={styles.accountModalHeader}>
              <Text style={[styles.accountModalTitle, { color: textDark }]}>Personalization</Text>

              <Pressable onPress={closePersonalizationModal} hitSlop={10} style={styles.accountModalClose}>
                <Ionicons name="close" size={iconSize} color={muted} />
              </Pressable>
            </View>

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
                      <Text style={[styles.settingTitleInner, { color: textDark, fontWeight: "600" }]}>Appearance</Text>
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
                          { color: isActive ? primary : textDark, fontWeight: isActive ? "800" : "500" },
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

      <View style={[styles.page, { backgroundColor: screenBg }]}>
        {/* Header */}
        <View style={styles.headerWrap}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: textDark }]}>Settings</Text>
              <Text style={[styles.subtitle, { color: muted }]}>Manage account, security, and app preferences</Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical
        >
          {/* ✅ Verify Account Card */}
          <VerifyAccountCard
            primary={primary}
            divider={divider}
            surface={surface}
            scale={scale}
            vscale={vscale}
            user={user}
            userEmail={userEmail}
            bioEnabled={bioEnabled}
            pinEnabled={pinEnabled}
            onOpenAccount={openAccountModal}
            onOpenPrivacySecurity={openPrivacySecurity}
            onOpenPinSetup={openPinSetup}
          />

          {/* ✅ ONE continuous card list */}
          <View style={[styles.oneCard, { backgroundColor: surface, borderColor: divider }]}>
            {mainItems.map((item, idx) => (
              <React.Fragment key={item.key}>
                <SettingRow
                  label={item.label}
                  subtitle={item.subtitle}
                  icon={item.icon}
                  onPress={item.onPress}
                  primary={primary}
                  muted={muted}
                  textDark={textDark}
                  divider={divider}
                  iconSize={iconSize}
                  styles={styles}
                  isDark={isDark}
                  chipBg={chipBg}
                />
                {idx !== mainItems.length - 1 && <View style={[styles.line, { backgroundColor: divider }]} />}
              </React.Fragment>
            ))}
          </View>

          {/* ✅ Logout card */}
          <View style={[styles.logoutCard, { backgroundColor: surface, borderColor: divider }]}>
            <Pressable onPress={() => setLogoutModalVisible(true)} android_ripple={{ color: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }} style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: chipBg }]}>
                  <Ionicons name="log-out-outline" size={iconSize} color={primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitleInner, { color: textDark }]}>Log out</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={iconSize} color={primary} />
            </Pressable>
          </View>

          <View style={{ height: vscale(26) }} />
        </ScrollView>

        {/* ✅ PIN setup modal (unchanged) */}
        <Modal visible={pinModalVisible} transparent animationType="fade" onRequestClose={closePinSetup}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: surface, borderColor: divider }]}>
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

                <Pressable onPress={closePinSetup} hitSlop={10} style={styles.modalCloseBtn}>
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
                  style={[styles.modalInput, { borderColor: divider, color: textDark }]}
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
                  style={[styles.modalInput, { borderColor: divider, color: textDark }]}
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
                  style={[styles.modalBtn, { backgroundColor: primary, borderColor: primary }]}
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
            </View>
          </View>
        </Modal>

        {/* Bottom nav */}
        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          centerLabel="Community"
        />
      </View>

      <LogoutModal
        visible={logoutModalVisible}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={() => {
          setLogoutModalVisible(false);
          onLogout?.();
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

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const CARD_R = scale(18);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },
    headerWrap: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
      paddingBottom: vscale(8),
      zIndex: 30,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(12),
    },
    // ✅ CHANGED: from scale(30) -> scale(28) to match Hotlines + Reports
    title: { fontSize: scale(28), fontWeight: "900" },

    subtitle: {
      marginTop: vscale(4),
      fontSize: scale(12),
      fontWeight: "500",
      lineHeight: scale(16),
    },

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

    settingTitle: { fontSize: scale(14), fontWeight: "600" },
    settingTitleInner: { fontSize: scale(14), fontWeight: "400" },

    settingSub: {
      marginTop: vscale(2),
      fontSize: scale(11),
      fontWeight: "400",
      lineHeight: scale(15),
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
    statusChipText: { fontSize: scale(12), fontWeight: "900" },

    toggleWrap: {
      paddingHorizontal: scale(14),
      paddingVertical: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(12),
    },
    toggleTitle: { fontSize: scale(14), fontWeight: "900" },
    toggleSub: {
      marginTop: vscale(4),
      fontSize: scale(11),
      fontWeight: "500",
      lineHeight: scale(15),
    },

    emptyState: {
      paddingHorizontal: scale(14),
      paddingVertical: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
    },
    emptyText: { flex: 1, fontSize: scale(12), fontWeight: "500", lineHeight: scale(16) },

    accountFoot: {
      paddingHorizontal: scale(14),
      paddingBottom: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    accountFootText: { fontSize: scale(11), fontWeight: "500" },

    // PIN Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.35)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(16),
    },
    modalCard: {
      width: "100%",
      maxWidth: 520,
      borderRadius: CARD_R,
      borderWidth: 1,
      padding: scale(14),
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
    modalTitle: { fontSize: scale(16), fontWeight: "900" },
    modalHint: { marginTop: vscale(2), fontSize: scale(11), fontWeight: "500", lineHeight: scale(15) },
    modalCloseBtn: {
      width: vscale(36),
      height: vscale(36),
      borderRadius: vscale(18),
      alignItems: "center",
      justifyContent: "center",
    },
    modalField: { marginTop: vscale(12) },
    modalLabel: { fontSize: scale(12), fontWeight: "900", marginBottom: vscale(6) },
    modalInput: {
      height: vscale(44),
      borderWidth: 1,
      borderRadius: vscale(12),
      paddingHorizontal: scale(12),
      fontSize: scale(16),
      fontWeight: "600",
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
      height: vscale(42),
      borderRadius: vscale(21),
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(14),
    },
    modalBtnGhost: { backgroundColor: "transparent" },
    modalBtnText: { fontSize: scale(14), fontWeight: "900" },
    modalFoot: {
      marginTop: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    modalFootText: { fontSize: scale(11), fontWeight: "500" },

    // Account Modal Bottom Sheet
    accountModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.35)",
      justifyContent: "flex-end",
    },
    accountModalSheet: {
      borderTopLeftRadius: CARD_R,
      borderTopRightRadius: CARD_R,
      borderWidth: 1,
      overflow: "hidden",
      paddingBottom: Platform.OS === "ios" ? vscale(12) : vscale(10),
      maxHeight: "82%",
    },
    psModalSheet: {
      borderTopLeftRadius: CARD_R,
      borderTopRightRadius: CARD_R,
      borderWidth: 1,
      overflow: "hidden",
      paddingBottom: Platform.OS === "ios" ? vscale(12) : vscale(10),
      maxHeight: "86%",
    },
    // ✅ NEW: Personalization modal sizing
    persModalSheet: {
      borderTopLeftRadius: CARD_R,
      borderTopRightRadius: CARD_R,
      borderWidth: 1,
      overflow: "hidden",
      paddingBottom: Platform.OS === "ios" ? vscale(12) : vscale(10),
      maxHeight: "86%",
    },

    accountModalHeader: {
      paddingHorizontal: scale(14),
      paddingVertical: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(10),
    },
    accountModalTitle: { fontSize: scale(16), fontWeight: "900" },
    accountModalClose: {
      width: vscale(36),
      height: vscale(36),
      borderRadius: vscale(18),
      alignItems: "center",
      justifyContent: "center",
    },

    currentAccountRow: {
      marginHorizontal: scale(14),
      marginBottom: vscale(10),
      borderRadius: CARD_R,
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
    currentTitle: { fontSize: scale(12), fontWeight: "900" },
    currentSub: { marginTop: vscale(2), fontSize: scale(12), fontWeight: "500" },

    currentPill: {
      paddingHorizontal: scale(10),
      paddingVertical: vscale(6),
      borderRadius: vscale(14),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(6),
    },
    currentPillText: { fontSize: scale(12), fontWeight: "900" },

    accountModalContent: {
      paddingHorizontal: scale(14),
      paddingBottom: vscale(16),
      gap: vscale(10),
    },
    accountModalItem: {
      borderRadius: CARD_R,
      borderWidth: 1,
      borderColor: "#E7EEF7",
      backgroundColor: "#FFFFFF",
      paddingHorizontal: scale(14),
      paddingVertical: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(12),
      overflow: "hidden",
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
      fontSize: scale(12),
      fontWeight: "600",
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
