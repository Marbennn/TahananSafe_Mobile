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
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";

import AdminBotNav, { TabKey } from "../../components/AdminComponents/AdminBotNav";
import { Colors } from "../../theme/colors";
import { useAuth } from "../../auth/AuthContext";

// ─── Palette ────────────────────────────────────────────────────────────────
const BG      = "#F5FAFE";
const SURFACE = "#FFFFFF";
const BORDER  = "#E7EEF7";
const TEXT    = "#0B2B45";
const MUTED   = "#6B7280";
const SUBTLE  = "#9AA4B2";
const DANGER  = "#EF4444";
const DANGER_BG = "#FFF0F0";

// ─── SecureStore helpers ────────────────────────────────────────────────────
function safeKey(email: string) {
  return String(email).trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

async function getFlag(key: string): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(key)) === "1"; }
  catch { return false; }
}

async function setFlag(key: string, v: boolean) {
  try { await SecureStore.setItemAsync(key, v ? "1" : "0"); }
  catch { /* ignore */ }
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Props = {
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
  onFabPress?: () => void;
  onLogout?: () => void;
};

type RowItem = {
  key: string;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  onPress?: () => void;
  danger?: boolean;
};

type ToggleItem = {
  key: string;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  value: boolean;
  onToggle: (v: boolean) => void;
};

type SectionData =
  | { type: "rows"; title: string; items: RowItem[] }
  | { type: "toggles"; title: string; items: ToggleItem[] };

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

  const NAV_BASE_HEIGHT   = 78;
  const FAB_SIZE          = 62;
  const bottomPad         = Math.max(insets.bottom, 10);
  const navHeight         = NAV_BASE_HEIGHT + bottomPad;
  const chevronBottom     = navHeight + 90;
  const fabBottom         = navHeight - FAB_SIZE / 2 - 10;
  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + vscale(40);

  const email      = (user?.email ?? "").trim().toLowerCase();
  const firstName  = user?.firstName ?? "";
  const lastName   = user?.lastName ?? "";
  const fullName   = (user?.name ?? [firstName, lastName].filter(Boolean).join(" ")) || "Admin";
  const initials   = getInitials(firstName, lastName, user?.name);

  // ── Security toggles ──────────────────────────────────────────────────────
  const [bioEnabled, setBioEnabled]       = useState(false);
  const [bioLoading, setBioLoading]       = useState(true);
  const [pinEnabled, setPinEnabled]       = useState(false);
  const [pinLoading, setPinLoading]       = useState(true);

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
    if (v) {
      Alert.alert("Enable PIN", "Set up PIN lock from Security settings.");
      return;
    }
    setPinEnabled(false);
    if (pinKey) await setFlag(pinKey, false);
    Alert.alert("PIN disabled", "PIN lock has been turned off.");
  }, [pinKey]);

  // ── Notification toggles ─────────────────────────────────────────────────
  const [pushEnabled,  setPushEnabled]  = useState(true);
  const [emailNotifs,  setEmailNotifs]  = useState(false);
  const [alertSound,   setAlertSound]   = useState(true);

  // ── Admin preference toggles ─────────────────────────────────────────────
  const [autoEscalate, setAutoEscalate] = useState(false);
  const [showBrgy,     setShowBrgy]     = useState(true);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            try { await logout?.(); } finally { onLogout?.(); }
          },
        },
      ]
    );
  }, [logout, onLogout]);

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);

  // ── Sections ─────────────────────────────────────────────────────────────
  const sections: SectionData[] = [
    {
      type: "rows",
      title: "Account",
      items: [
        {
          key: "edit-profile",
          label: "Edit Profile",
          subtitle: "Update name, contact info",
          icon: "person-circle-outline",
          iconBg: "#EFF6FF",
          iconColor: Colors.primary,
          onPress: () => Alert.alert("Edit Profile", "Coming soon."),
        },
        {
          key: "change-password",
          label: "Change Password",
          subtitle: "Update your admin password",
          icon: "key-outline",
          iconBg: "#FFF7ED",
          iconColor: "#D97706",
          onPress: () => Alert.alert("Change Password", "Coming soon."),
        },
        {
          key: "admin-role",
          label: "Role & Permissions",
          subtitle: "View your assigned permissions",
          icon: "shield-half-outline",
          iconBg: "#F0FDF4",
          iconColor: "#16A34A",
          onPress: () => Alert.alert("Role & Permissions", "Coming soon."),
        },
      ],
    },
    {
      type: "toggles",
      title: "Security",
      items: [
        {
          key: "biometrics",
          label: "Biometric Login",
          subtitle: bioLoading ? "Loading…" : bioEnabled ? "Enabled" : "Disabled",
          icon: "finger-print-outline",
          iconBg: "#EFF6FF",
          iconColor: Colors.primary,
          value: bioEnabled,
          onToggle: toggleBio,
        },
        {
          key: "pin",
          label: "PIN Lock",
          subtitle: pinLoading ? "Loading…" : pinEnabled ? "Enabled" : "Disabled",
          icon: "lock-closed-outline",
          iconBg: "#FFF7ED",
          iconColor: "#D97706",
          value: pinEnabled,
          onToggle: togglePin,
        },
      ],
    },
    {
      type: "toggles",
      title: "Notifications",
      items: [
        {
          key: "push",
          label: "Push Notifications",
          subtitle: "Alerts for reports and escalations",
          icon: "notifications-outline",
          iconBg: "#FFF0F6",
          iconColor: "#DB2777",
          value: pushEnabled,
          onToggle: setPushEnabled,
        },
        {
          key: "alert-sound",
          label: "Alert Sound",
          subtitle: "Sound for critical alerts",
          icon: "volume-high-outline",
          iconBg: "#F0FDF4",
          iconColor: "#16A34A",
          value: alertSound,
          onToggle: setAlertSound,
        },
        {
          key: "email-notifs",
          label: "Email Notifications",
          subtitle: "Weekly summary to your email",
          icon: "mail-outline",
          iconBg: "#EFF6FF",
          iconColor: Colors.primary,
          value: emailNotifs,
          onToggle: setEmailNotifs,
        },
      ],
    },
    {
      type: "toggles",
      title: "Admin Preferences",
      items: [
        {
          key: "auto-escalate",
          label: "Auto-Escalation",
          subtitle: "Automatically escalate unresolved reports",
          icon: "trending-up-outline",
          iconBg: "#FFF0F1",
          iconColor: "#EF4444",
          value: autoEscalate,
          onToggle: setAutoEscalate,
        },
        {
          key: "show-brgy",
          label: "Show Barangay Info",
          subtitle: "Display barangay details on reports",
          icon: "location-outline",
          iconBg: "#F0FDF4",
          iconColor: "#16A34A",
          value: showBrgy,
          onToggle: setShowBrgy,
        },
      ],
    },
    {
      type: "rows",
      title: "Support",
      items: [
        {
          key: "help",
          label: "Help & Support",
          subtitle: "FAQs, contact, documentation",
          icon: "help-circle-outline",
          iconBg: "#EFF6FF",
          iconColor: Colors.primary,
          onPress: () => Alert.alert("Help & Support", "Coming soon."),
        },
        {
          key: "terms",
          label: "Terms of Service",
          icon: "document-text-outline",
          iconBg: "#F8FAFC",
          iconColor: SUBTLE,
          onPress: () => Alert.alert("Terms of Service", "Coming soon."),
        },
        {
          key: "privacy",
          label: "Privacy Policy",
          icon: "eye-off-outline",
          iconBg: "#F8FAFC",
          iconColor: SUBTLE,
          onPress: () => Alert.alert("Privacy Policy", "Coming soon."),
        },
        {
          key: "about",
          label: "About TahananSafe",
          subtitle: "Version 1.0.0",
          icon: "information-circle-outline",
          iconBg: "#F8FAFC",
          iconColor: SUBTLE,
          onPress: () => Alert.alert("TahananSafe", "Version 1.0.0\nAdmin Build"),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Admin account & preferences</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Profile card ── */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{fullName}</Text>
              {email ? (
                <Text style={styles.profileEmail}>{maskEmail(email)}</Text>
              ) : null}
              <View style={styles.rolePill}>
                <Ionicons
                  name="shield-checkmark"
                  size={scale(11)}
                  color={Colors.primary}
                  style={{ marginRight: scale(4) }}
                />
                <Text style={styles.roleText}>Administrator</Text>
              </View>
            </View>
          </View>

          {/* ── Settings sections ── */}
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>

              <View style={styles.sectionCard}>
                {section.type === "rows" &&
                  section.items.map((item, idx) => (
                    <React.Fragment key={item.key}>
                      {idx > 0 && <View style={styles.divider} />}
                      <Pressable
                        style={({ pressed }) => [
                          styles.row,
                          item.danger && styles.rowDanger,
                          pressed && { opacity: 0.75 },
                        ]}
                        onPress={item.onPress}
                        hitSlop={4}
                      >
                        <View style={[styles.rowIcon, { backgroundColor: item.iconBg }]}>
                          <Ionicons
                            name={item.icon}
                            size={scale(18)}
                            color={item.danger ? DANGER : item.iconColor}
                          />
                        </View>
                        <View style={styles.rowBody}>
                          <Text
                            style={[styles.rowLabel, item.danger && styles.rowLabelDanger]}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>
                          {item.subtitle ? (
                            <Text style={styles.rowSub} numberOfLines={1}>
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={scale(16)}
                          color={item.danger ? DANGER : SUBTLE}
                        />
                      </Pressable>
                    </React.Fragment>
                  ))}

                {section.type === "toggles" &&
                  section.items.map((item, idx) => (
                    <React.Fragment key={item.key}>
                      {idx > 0 && <View style={styles.divider} />}
                      <View style={styles.row}>
                        <View style={[styles.rowIcon, { backgroundColor: item.iconBg }]}>
                          <Ionicons
                            name={item.icon}
                            size={scale(18)}
                            color={item.iconColor}
                          />
                        </View>
                        <View style={styles.rowBody}>
                          <Text style={styles.rowLabel} numberOfLines={1}>
                            {item.label}
                          </Text>
                          {item.subtitle ? (
                            <Text style={styles.rowSub} numberOfLines={1}>
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                        <Switch
                          value={item.value}
                          onValueChange={item.onToggle}
                          trackColor={{ false: BORDER, true: Colors.primary }}
                          thumbColor={SURFACE}
                        />
                      </View>
                    </React.Fragment>
                  ))}
              </View>
            </View>
          ))}

          {/* ── Sign out ── */}
          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={scale(18)} color={DANGER} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>
        </ScrollView>

        {/* ── Bottom nav ── */}
        <AdminBotNav
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={onFabPress ?? (() => {})}
          centerLabel="Admin Menu"
          Chevron={undefined}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: BG },
    page:    { flex: 1, backgroundColor: BG },

    header: {
      paddingHorizontal: scale(16),
      paddingTop:  vscale(8),
      paddingBottom: vscale(4),
    },
    title: {
      fontSize:   scale(28),
      fontWeight: "900",
      color:      TEXT,
      letterSpacing: 0.2,
    },
    subtitle: {
      marginTop:  vscale(3),
      fontSize:   scale(13),
      fontWeight: "400",
      color:      MUTED,
    },

    content: {
      paddingHorizontal: scale(16),
      paddingTop:  vscale(8),
    },

    // ── Profile card ──────────────────────────────────────────────────────
    profileCard: {
      backgroundColor: SURFACE,
      borderWidth:  1,
      borderColor:  BORDER,
      borderRadius: scale(16),
      padding:      scale(16),
      flexDirection: "row",
      alignItems:   "center",
      gap:          scale(14),
      marginBottom: vscale(20),
    },
    avatar: {
      width:        scale(58),
      height:       scale(58),
      borderRadius: scale(29),
      backgroundColor: Colors.primary,
      alignItems:   "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize:   scale(22),
      fontWeight: "800",
      color:      "#FFFFFF",
    },
    profileInfo: {
      flex: 1,
      gap:  vscale(3),
    },
    profileName: {
      fontSize:   scale(16),
      fontWeight: "800",
      color:      TEXT,
    },
    profileEmail: {
      fontSize:   scale(12),
      fontWeight: "400",
      color:      MUTED,
    },
    rolePill: {
      flexDirection:  "row",
      alignItems:     "center",
      alignSelf:      "flex-start",
      backgroundColor: "#EFF6FF",
      borderRadius:   scale(999),
      paddingHorizontal: scale(8),
      paddingVertical:   vscale(3),
      marginTop:      vscale(2),
    },
    roleText: {
      fontSize:   scale(11),
      fontWeight: "700",
      color:      Colors.primary,
    },

    // ── Section ───────────────────────────────────────────────────────────
    section: {
      marginBottom: vscale(16),
    },
    sectionTitle: {
      fontSize:   scale(12),
      fontWeight: "700",
      color:      SUBTLE,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: vscale(8),
      paddingLeft:  scale(4),
    },
    sectionCard: {
      backgroundColor: SURFACE,
      borderWidth:  1,
      borderColor:  BORDER,
      borderRadius: scale(14),
      overflow:     "hidden",
    },

    // ── Row ───────────────────────────────────────────────────────────────
    row: {
      flexDirection:  "row",
      alignItems:     "center",
      gap:            scale(12),
      paddingVertical: vscale(12),
      paddingHorizontal: scale(14),
    },
    rowDanger: {
      backgroundColor: DANGER_BG,
    },
    rowIcon: {
      width:        scale(36),
      height:       scale(36),
      borderRadius: scale(10),
      alignItems:   "center",
      justifyContent: "center",
      flexShrink:   0,
    },
    rowBody: {
      flex: 1,
      gap:  vscale(2),
    },
    rowLabel: {
      fontSize:   scale(14),
      fontWeight: "600",
      color:      TEXT,
    },
    rowLabelDanger: {
      color: DANGER,
    },
    rowSub: {
      fontSize:   scale(12),
      fontWeight: "400",
      color:      MUTED,
    },

    divider: {
      height:           1,
      backgroundColor:  BORDER,
      marginHorizontal: scale(14),
    },

    // ── Logout button ─────────────────────────────────────────────────────
    logoutBtn: {
      flexDirection:  "row",
      alignItems:     "center",
      justifyContent: "center",
      gap:            scale(8),
      backgroundColor: DANGER_BG,
      borderWidth:    1,
      borderColor:    "#FECACA",
      borderRadius:   scale(14),
      paddingVertical: vscale(14),
      marginBottom:   vscale(8),
    },
    logoutText: {
      fontSize:   scale(15),
      fontWeight: "700",
      color:      DANGER,
    },
  });
}
