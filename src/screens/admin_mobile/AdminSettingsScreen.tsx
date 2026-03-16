// src/screens/admin_mobile/AdminSettingsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  Switch,
  Alert,
  Modal,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";

import AdminBotNav, { TabKey } from "../../components/AdminComponents/AdminBotNav";
import { Colors } from "../../theme/colors";
import { useAuth } from "../../auth/AuthContext";
import LogoutModal from "../../components/LogoutModal";

// ─── Palette ────────────────────────────────────────────────────────────────
const BG      = "#F5FAFE";
const SURFACE = "#FFFFFF";
const BORDER  = "#E7EEF7";
const TEXT    = "#0B2B45";
const MUTED   = "#6B7280";
const CHIP_BG = "#EEF6FF";

// ─── SecureStore helpers ────────────────────────────────────────────────────
function safeKey(email: string) {
  return String(email).trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}
async function getFlag(key: string): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(key)) === "1"; } catch { return false; }
}
async function setFlag(key: string, v: boolean) {
  try { await SecureStore.setItemAsync(key, v ? "1" : "0"); } catch { /* ignore */ }
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Props = {
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
  onFabPress?: () => void;
  onLogout?: () => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function getInitials(firstName?: string, lastName?: string, name?: string) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (name) return name.slice(0, 2).toUpperCase();
  return "AD";
}
function maskEmail(email: string) {
  if (!email.includes("@")) return email;
  const [name, domain] = email.split("@");
  if (name.length <= 2) return `${name[0] ?? ""}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}
function statusText(enabled: boolean, loading: boolean) {
  if (loading) return "Loading…";
  return enabled ? "Enabled" : "Disabled";
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AdminSettingsScreen({
  onTabChange,
  initialTab = "Settings",
  onFabPress,
  onLogout,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user, logout } = useAuth() as any;

  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);
  const scale  = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const NAV_BASE_HEIGHT    = 78;
  const FAB_SIZE           = 62;
  const bottomPad          = Math.max(insets.bottom, 10);
  const navHeight          = NAV_BASE_HEIGHT + bottomPad;
  const chevronBottom      = navHeight + 90;
  const fabBottom          = navHeight - FAB_SIZE / 2 - 10;
  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + vscale(40);

  const iconSize  = scale(20);
  const smallIcon = scale(16);

  const email     = (user?.email ?? "").trim().toLowerCase();
  const firstName = user?.firstName ?? "";
  const lastName  = user?.lastName ?? "";
  const fullName  = (user?.name ?? [firstName, lastName].filter(Boolean).join(" ")) || "Admin";
  const initials  = getInitials(firstName, lastName, user?.name);

  // ── Modal visibility ──────────────────────────────────────────────────────
  const [modalLogout,   setModalLogout]   = useState(false);
  const [modalAccount,  setModalAccount]  = useState(false);
  const [modalSecurity, setModalSecurity] = useState(false);
  const [modalNotifs,   setModalNotifs]   = useState(false);
  const [modalPrefs,    setModalPrefs]    = useState(false);
  const [modalSupport,  setModalSupport]  = useState(false);

  // ── Security toggles ──────────────────────────────────────────────────────
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLoading, setBioLoading] = useState(true);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinLoading, setPinLoading] = useState(true);

  const bioKey = email ? `tahanansafe_bio_optin_${safeKey(email)}` : null;
  const pinKey = email ? `tahanansafe_pin_enabled_${safeKey(email)}` : null;

  useEffect(() => {
    if (!bioKey) { setBioLoading(false); return; }
    getFlag(bioKey).then((v) => { setBioEnabled(v); setBioLoading(false); });
  }, [bioKey]);
  useEffect(() => {
    if (!pinKey) { setPinLoading(false); return; }
    getFlag(pinKey).then((v) => { setPinEnabled(v); setPinLoading(false); });
  }, [pinKey]);

  const toggleBio = useCallback(async (v: boolean) => {
    setBioEnabled(v);
    if (bioKey) await setFlag(bioKey, v);
    if (!v) Alert.alert("Biometrics disabled", "Biometric login is turned off for this account.");
  }, [bioKey]);
  const togglePin = useCallback(async (v: boolean) => {
    if (v) { Alert.alert("Enable PIN", "Set up PIN lock from Security settings."); return; }
    setPinEnabled(false);
    if (pinKey) await setFlag(pinKey, false);
    Alert.alert("PIN disabled", "PIN lock has been turned off.");
  }, [pinKey]);

  // ── Notification toggles ─────────────────────────────────────────────────
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [alertSound,  setAlertSound]  = useState(true);

  // ── Admin preference toggles ─────────────────────────────────────────────
  const [autoEscalate, setAutoEscalate] = useState(false);
  const [showBrgy,     setShowBrgy]     = useState(true);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogoutConfirm = useCallback(async () => {
    setModalLogout(false);
    try { await logout?.(); } finally { onLogout?.(); }
  }, [logout, onLogout]);

  const handleTab = (key: TabKey) => { setActiveTab(key); onTabChange?.(key); };

  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);

  // ── Shared current-account pill ───────────────────────────────────────────
  const accountPill = email ? "Active" : "Guest";
  const accountPillIcon: keyof typeof Ionicons.glyphMap = email
    ? "checkmark-circle-outline"
    : "information-circle-outline";

  // ── Shared modal current-account row ─────────────────────────────────────
  function CurrentAccountRow({ modalIcon }: { modalIcon: keyof typeof Ionicons.glyphMap }) {
    return (
      <View style={[styles.currentAccountRow, { borderColor: BORDER }]}>
        <View style={[styles.currentAvatar, { backgroundColor: CHIP_BG }]}>
          <Ionicons name={modalIcon} size={scale(18)} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.currentTitle, { color: TEXT }]}>Current Account</Text>
          <Text style={[styles.currentSub, { color: MUTED }]}>
            {email ? maskEmail(email) : "Not signed in"}
          </Text>
        </View>
        <View style={[styles.currentPill, { backgroundColor: CHIP_BG }]}>
          <Ionicons name={accountPillIcon} size={smallIcon} color={Colors.primary} />
          <Text style={[styles.currentPillText, { color: Colors.primary }]}>{accountPill}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* ══════════════════════════════════════════════════════════════════════
          ACCOUNT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={modalAccount} transparent animationType="slide" onRequestClose={() => setModalAccount(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalAccount(false)} />
          <View style={[styles.sheet, { backgroundColor: SURFACE, borderColor: BORDER }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: TEXT }]}>Account</Text>
              <Pressable onPress={() => setModalAccount(false)} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={iconSize} color={MUTED} />
              </Pressable>
            </View>
            <CurrentAccountRow modalIcon="person" />
            <View style={[styles.sheetDivider, { backgroundColor: BORDER }]} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              <ModalRow icon="person-outline" label="Edit Profile" subtitle="Update name, contact info" onPress={() => Alert.alert("Edit Profile", "Coming soon.")} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <ModalRow icon="key-outline" label="Change Password" subtitle="Update your admin password" onPress={() => Alert.alert("Change Password", "Coming soon.")} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <ModalRow icon="shield-half-outline" label="Role & Permissions" subtitle="View your assigned permissions" onPress={() => Alert.alert("Role & Permissions", "Coming soon.")} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          PRIVACY & SECURITY MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={modalSecurity} transparent animationType="slide" onRequestClose={() => setModalSecurity(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalSecurity(false)} />
          <View style={[styles.sheetTall, { backgroundColor: SURFACE, borderColor: BORDER }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: TEXT }]}>Privacy & Security</Text>
              <Pressable onPress={() => setModalSecurity(false)} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={iconSize} color={MUTED} />
              </Pressable>
            </View>
            <CurrentAccountRow modalIcon="lock-closed" />
            <View style={[styles.sheetDivider, { backgroundColor: BORDER }]} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>

              {/* Biometrics */}
              <View style={styles.expandCard}>
                <View style={styles.expandTop}>
                  <View style={styles.modalItemLeft}>
                    <View style={[styles.modalIconWrap, { backgroundColor: CHIP_BG }]}>
                      <Ionicons name="finger-print-outline" size={iconSize} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalItemTitle, { color: TEXT }]}>Biometric Login</Text>
                      <Text style={[styles.modalItemSub, { color: MUTED }]}>Face ID / fingerprint quick login</Text>
                    </View>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: CHIP_BG }]}>
                    <Text style={[styles.statusChipText, { color: Colors.primary }]}>{statusText(bioEnabled, bioLoading)}</Text>
                  </View>
                </View>
                <View style={[styles.expandDivider, { backgroundColor: BORDER }]} />
                {!email ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="information-circle-outline" size={scale(15)} color={MUTED} />
                    <Text style={[styles.infoText, { color: MUTED }]}>Log in first to manage biometrics per account.</Text>
                  </View>
                ) : (
                  <View style={styles.toggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.toggleTitle, { color: TEXT }]}>Use biometrics to login</Text>
                      <Text style={[styles.toggleSub, { color: MUTED }]}>Enables biometric login for this account on this device.</Text>
                    </View>
                    <Switch value={bioEnabled} onValueChange={toggleBio} disabled={bioLoading} trackColor={{ false: BORDER, true: Colors.primary }} thumbColor={SURFACE} />
                  </View>
                )}
              </View>

              {/* PIN */}
              <View style={styles.expandCard}>
                <View style={styles.expandTop}>
                  <View style={styles.modalItemLeft}>
                    <View style={[styles.modalIconWrap, { backgroundColor: CHIP_BG }]}>
                      <Ionicons name="keypad-outline" size={iconSize} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalItemTitle, { color: TEXT }]}>PIN Lock</Text>
                      <Text style={[styles.modalItemSub, { color: MUTED }]}>4-digit PIN as extra login option</Text>
                    </View>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: CHIP_BG }]}>
                    <Text style={[styles.statusChipText, { color: Colors.primary }]}>{statusText(pinEnabled, pinLoading)}</Text>
                  </View>
                </View>
                <View style={[styles.expandDivider, { backgroundColor: BORDER }]} />
                {!email ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="information-circle-outline" size={scale(15)} color={MUTED} />
                    <Text style={[styles.infoText, { color: MUTED }]}>Log in first to enable PIN for your account.</Text>
                  </View>
                ) : (
                  <View style={styles.toggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.toggleTitle, { color: TEXT }]}>Enable PIN login</Text>
                      <Text style={[styles.toggleSub, { color: MUTED }]}>Adds an extra security step for this account.</Text>
                    </View>
                    <Switch value={pinEnabled} onValueChange={togglePin} disabled={pinLoading} trackColor={{ false: BORDER, true: Colors.primary }} thumbColor={SURFACE} />
                  </View>
                )}
              </View>

              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          NOTIFICATIONS MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={modalNotifs} transparent animationType="slide" onRequestClose={() => setModalNotifs(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalNotifs(false)} />
          <View style={[styles.sheetTall, { backgroundColor: SURFACE, borderColor: BORDER }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: TEXT }]}>Notifications</Text>
              <Pressable onPress={() => setModalNotifs(false)} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={iconSize} color={MUTED} />
              </Pressable>
            </View>
            <CurrentAccountRow modalIcon="notifications" />
            <View style={[styles.sheetDivider, { backgroundColor: BORDER }]} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              <ToggleCard icon="notifications-outline" label="Push Notifications" subtitle="Alerts for reports and escalations" value={pushEnabled} onToggle={setPushEnabled} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <ToggleCard icon="volume-high-outline" label="Alert Sound" subtitle="Sound for critical alerts" value={alertSound} onToggle={setAlertSound} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <ToggleCard icon="mail-outline" label="Email Notifications" subtitle="Weekly summary to your email" value={emailNotifs} onToggle={setEmailNotifs} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          ADMIN PREFERENCES MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={modalPrefs} transparent animationType="slide" onRequestClose={() => setModalPrefs(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalPrefs(false)} />
          <View style={[styles.sheet, { backgroundColor: SURFACE, borderColor: BORDER }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: TEXT }]}>Admin Preferences</Text>
              <Pressable onPress={() => setModalPrefs(false)} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={iconSize} color={MUTED} />
              </Pressable>
            </View>
            <CurrentAccountRow modalIcon="shield-checkmark" />
            <View style={[styles.sheetDivider, { backgroundColor: BORDER }]} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              <ToggleCard icon="trending-up-outline" label="Auto-Escalation" subtitle="Automatically escalate unresolved reports" value={autoEscalate} onToggle={setAutoEscalate} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <ToggleCard icon="location-outline" label="Show Barangay Info" subtitle="Display barangay details on reports" value={showBrgy} onToggle={setShowBrgy} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          HELP & SUPPORT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={modalSupport} transparent animationType="slide" onRequestClose={() => setModalSupport(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalSupport(false)} />
          <View style={[styles.sheet, { backgroundColor: SURFACE, borderColor: BORDER }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: TEXT }]}>Help & Support</Text>
              <Pressable onPress={() => setModalSupport(false)} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={iconSize} color={MUTED} />
              </Pressable>
            </View>
            <View style={[styles.sheetDivider, { backgroundColor: BORDER }]} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              <ModalRow icon="help-circle-outline" label="Help & Support" subtitle="FAQs, contact, documentation" onPress={() => Alert.alert("Help & Support", "Coming soon.")} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <ModalRow icon="document-text-outline" label="Terms of Service" subtitle="Policies & agreements" onPress={() => Alert.alert("Terms of Service", "Coming soon.")} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <ModalRow icon="eye-off-outline" label="Privacy Policy" subtitle="Data privacy information" onPress={() => Alert.alert("Privacy Policy", "Coming soon.")} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <ModalRow icon="information-circle-outline" label="About TahananSafe" subtitle="Version 1.0.0 · Admin Build" onPress={() => Alert.alert("TahananSafe", "Version 1.0.0\nAdmin Build")} iconSize={iconSize} scale={scale} vscale={vscale} styles={styles} />
              <View style={{ height: vscale(12) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN SCREEN
      ══════════════════════════════════════════════════════════════════════ */}
      <View style={styles.page}>
        <View style={styles.headerWrap}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage account, security, and app preferences</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical
        >
          {/* Profile card */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{fullName}</Text>
              {email ? <Text style={styles.profileEmail}>{maskEmail(email)}</Text> : null}
              <View style={styles.rolePill}>
                <Ionicons name="shield-checkmark" size={scale(11)} color={Colors.primary} style={{ marginRight: scale(4) }} />
                <Text style={styles.roleText}>Administrator</Text>
              </View>
            </View>
          </View>

          {/* Main settings card */}
          <View style={styles.oneCard}>
            <MainRow icon="person-circle-outline" label="Account" subtitle="Profile, password, permissions" onPress={() => setModalAccount(true)} iconSize={iconSize} styles={styles} />
            <View style={styles.line} />
            <MainRow icon="lock-closed-outline" label="Privacy & Security" subtitle="Biometrics, PIN lock" onPress={() => setModalSecurity(true)} iconSize={iconSize} styles={styles} />
            <View style={styles.line} />
            <MainRow icon="notifications-outline" label="Notifications" subtitle="Push, sound, email alerts" onPress={() => setModalNotifs(true)} iconSize={iconSize} styles={styles} />
            <View style={styles.line} />
            <MainRow icon="settings-outline" label="Admin Preferences" subtitle="Escalation, barangay display" onPress={() => setModalPrefs(true)} iconSize={iconSize} styles={styles} />
            <View style={styles.line} />
            <MainRow icon="help-circle-outline" label="Help & Support" subtitle="FAQs, terms, about" onPress={() => setModalSupport(true)} iconSize={iconSize} styles={styles} />
          </View>

          {/* Log out card */}
          <View style={styles.logoutCard}>
            <Pressable onPress={() => setModalLogout(true)} android_ripple={{ color: "rgba(0,0,0,0.06)" }} style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: CHIP_BG }]}>
                  <Ionicons name="log-out-outline" size={iconSize} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>Log out</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={iconSize} color={Colors.primary} />
            </Pressable>
          </View>

          <View style={{ height: vscale(26) }} />
        </ScrollView>

        <AdminBotNav
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={onFabPress ?? (() => {})}
        />
      </View>

      <LogoutModal
        visible={modalLogout}
        onCancel={() => setModalLogout(false)}
        onConfirm={handleLogoutConfirm}
      />
    </SafeAreaView>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function MainRow({ icon, label, subtitle, onPress, iconSize, styles }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  iconSize: number;
  styles: any;
}) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: "rgba(0,0,0,0.06)" }} style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIconWrap, { backgroundColor: CHIP_BG }]}>
          <Ionicons name={icon} size={iconSize} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingTitle}>{label}</Text>
          {!!subtitle && <Text style={styles.settingSub}>{subtitle}</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={iconSize} color={Colors.primary} />
    </Pressable>
  );
}

function ModalRow({ icon, label, subtitle, onPress, iconSize, scale, vscale, styles }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  iconSize: number;
  scale: (n: number) => number;
  vscale: (n: number) => number;
  styles: any;
}) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: "rgba(0,0,0,0.06)" }} style={styles.modalItem}>
      <View style={styles.modalItemLeft}>
        <View style={[styles.modalIconWrap, { backgroundColor: CHIP_BG }]}>
          <Ionicons name={icon} size={iconSize} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.modalItemTitle, { color: "#0B2B45" }]}>{label}</Text>
          {!!subtitle && <Text style={[styles.modalItemSub, { color: "#6B7280" }]}>{subtitle}</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={iconSize} color={Colors.primary} />
    </Pressable>
  );
}

function ToggleCard({ icon, label, subtitle, value, onToggle, iconSize, scale, vscale, styles }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  iconSize: number;
  scale: (n: number) => number;
  vscale: (n: number) => number;
  styles: any;
}) {
  return (
    <View style={styles.expandCard}>
      <View style={styles.expandTop}>
        <View style={styles.modalItemLeft}>
          <View style={[styles.modalIconWrap, { backgroundColor: CHIP_BG }]}>
            <Ionicons name={icon} size={iconSize} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalItemTitle, { color: "#0B2B45" }]}>{label}</Text>
            {!!subtitle && <Text style={[styles.modalItemSub, { color: "#6B7280" }]}>{subtitle}</Text>}
          </View>
        </View>
        <Switch value={value} onValueChange={onToggle} trackColor={{ false: BORDER, true: Colors.primary }} thumbColor={SURFACE} />
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const CARD_R = scale(18);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    headerWrap: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
      paddingBottom: vscale(8),
    },
    title: { fontSize: scale(28), fontWeight: "900", color: TEXT },
    subtitle: { marginTop: vscale(4), fontSize: scale(12), fontWeight: "500", color: "#6B7280", lineHeight: scale(16) },

    content: { paddingHorizontal: scale(16), paddingTop: vscale(6) },

    // Profile card
    profileCard: {
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: CARD_R,
      paddingHorizontal: scale(14),
      paddingVertical: vscale(14),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(12),
      marginBottom: vscale(12),
    },
    avatar: {
      width: scale(48), height: scale(48), borderRadius: scale(24),
      backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
    },
    avatarText: { fontSize: scale(18), fontWeight: "800", color: "#FFFFFF" },
    profileName: { fontSize: scale(15), fontWeight: "800", color: TEXT },
    profileEmail: { marginTop: vscale(2), fontSize: scale(12), fontWeight: "400", color: "#6B7280" },
    rolePill: {
      flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
      backgroundColor: CHIP_BG, borderRadius: scale(999),
      paddingHorizontal: scale(8), paddingVertical: vscale(3), marginTop: vscale(4),
    },
    roleText: { fontSize: scale(11), fontWeight: "700", color: Colors.primary },

    // Main list card
    oneCard: {
      backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
      borderRadius: CARD_R, overflow: "hidden", marginBottom: vscale(12),
    },
    logoutCard: {
      backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
      borderRadius: CARD_R, overflow: "hidden", marginBottom: vscale(8),
    },
    line: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginHorizontal: scale(14) },

    settingRow: {
      paddingHorizontal: scale(14), paddingVertical: vscale(12),
      flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: scale(12),
    },
    settingLeft: { flexDirection: "row", alignItems: "center", gap: scale(10), flex: 1 },
    settingIconWrap: {
      width: vscale(40), height: vscale(40), borderRadius: vscale(14),
      alignItems: "center", justifyContent: "center",
    },
    settingTitle: { fontSize: scale(14), fontWeight: "600", color: TEXT },
    settingSub: { marginTop: vscale(2), fontSize: scale(11), fontWeight: "400", color: "#6B7280", lineHeight: scale(15) },

    // Modal overlay + sheets
    overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.35)", justifyContent: "flex-end" },
    sheet: {
      borderTopLeftRadius: CARD_R, borderTopRightRadius: CARD_R,
      borderWidth: 1, overflow: "hidden",
      paddingBottom: Platform.OS === "ios" ? vscale(12) : vscale(10),
      maxHeight: "82%", backgroundColor: SURFACE,
    },
    sheetTall: {
      borderTopLeftRadius: CARD_R, borderTopRightRadius: CARD_R,
      borderWidth: 1, overflow: "hidden",
      paddingBottom: Platform.OS === "ios" ? vscale(12) : vscale(10),
      maxHeight: "88%", backgroundColor: SURFACE,
    },
    sheetHeader: {
      paddingHorizontal: scale(14), paddingVertical: vscale(12),
      flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: scale(10),
    },
    sheetTitle: { fontSize: scale(16), fontWeight: "900" },
    closeBtn: {
      width: vscale(36), height: vscale(36), borderRadius: vscale(18),
      alignItems: "center", justifyContent: "center",
    },
    sheetDivider: { height: StyleSheet.hairlineWidth },

    currentAccountRow: {
      marginHorizontal: scale(14), marginBottom: vscale(10),
      borderRadius: CARD_R, borderWidth: 1,
      paddingHorizontal: scale(12), paddingVertical: vscale(12),
      flexDirection: "row", alignItems: "center", gap: scale(10),
    },
    currentAvatar: {
      width: vscale(40), height: vscale(40), borderRadius: vscale(20),
      alignItems: "center", justifyContent: "center",
    },
    currentTitle: { fontSize: scale(12), fontWeight: "900" },
    currentSub: { marginTop: vscale(2), fontSize: scale(12), fontWeight: "500" },
    currentPill: {
      paddingHorizontal: scale(10), paddingVertical: vscale(6),
      borderRadius: vscale(14), flexDirection: "row", alignItems: "center", gap: scale(6),
    },
    currentPillText: { fontSize: scale(12), fontWeight: "900" },

    sheetContent: { paddingHorizontal: scale(14), paddingBottom: vscale(16), gap: vscale(10) },

    // Modal item row (simple pressable)
    modalItem: {
      borderRadius: CARD_R, borderWidth: 1, borderColor: BORDER,
      backgroundColor: SURFACE,
      paddingHorizontal: scale(14), paddingVertical: vscale(12),
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      gap: scale(12), overflow: "hidden",
    },
    modalItemLeft: { flexDirection: "row", alignItems: "center", gap: scale(10), flex: 1 },
    modalIconWrap: {
      width: vscale(40), height: vscale(40), borderRadius: vscale(14),
      alignItems: "center", justifyContent: "center",
    },
    modalItemTitle: { fontSize: scale(14), fontWeight: "600" },
    modalItemSub: { marginTop: vscale(2), fontSize: scale(11), fontWeight: "400", lineHeight: scale(15) },

    // Status chip
    statusChip: {
      paddingHorizontal: scale(10), paddingVertical: vscale(6),
      borderRadius: vscale(14), alignItems: "center", justifyContent: "center", minWidth: scale(72),
    },
    statusChipText: { fontSize: scale(12), fontWeight: "900" },

    // Expanded card (biometrics / PIN / toggle cards)
    expandCard: {
      borderRadius: CARD_R, borderWidth: 1, borderColor: BORDER,
      backgroundColor: SURFACE, overflow: "hidden",
    },
    expandTop: {
      paddingHorizontal: scale(14), paddingVertical: vscale(12),
      flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: scale(12),
    },
    expandDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: scale(14) },
    toggleRow: {
      paddingHorizontal: scale(14), paddingVertical: vscale(12),
      flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: scale(12),
    },
    toggleTitle: { fontSize: scale(13), fontWeight: "700" },
    toggleSub: { marginTop: vscale(3), fontSize: scale(11), fontWeight: "400", lineHeight: scale(15) },
    infoRow: {
      paddingHorizontal: scale(14), paddingVertical: vscale(10),
      flexDirection: "row", alignItems: "center", gap: scale(8),
    },
    infoText: { flex: 1, fontSize: scale(11), fontWeight: "500", lineHeight: scale(15) },
  });
}
