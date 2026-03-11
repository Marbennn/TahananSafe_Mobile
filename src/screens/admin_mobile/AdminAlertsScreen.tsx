// src/screens/admin_mobile/AdminAlertsScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AdminBotNav, { TabKey } from "../../components/AdminComponents/AdminBotNav";
import AdminElepsis from "../../../assets/Admin/BottomNavBar/AdminElepsis.svg";
import { Colors } from "../../theme/colors";

const BG = "#F5FAFE";
const SURFACE = "#FFFFFF";
const BORDER = "#E7EEF7";
const TEXT = "#0B2B45";
const MUTED = "#6B7280";
const SUBTLE = "#9AA4B2";

type AlertSeverity = "Critical" | "High" | "Moderate" | "Low" | "Info";

type AlertItem = {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  time: string;
  date: string;
  read: boolean;
  source: string;
};

type FilterKey = "All" | "Unread" | "Critical";

type Props = {
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
  onFabPress?: () => void;
};

function getSeverityColor(severity: AlertSeverity) {
  switch (severity) {
    case "Critical": return "#F04452";
    case "High":     return "#F5B301";
    case "Moderate": return "#FB923C";
    case "Low":      return "#35B56A";
    case "Info":     return "#3B82F6";
  }
}

function getSeverityBg(severity: AlertSeverity) {
  switch (severity) {
    case "Critical": return "#FFF0F1";
    case "High":     return "#FFFBEB";
    case "Moderate": return "#FFF7ED";
    case "Low":      return "#F0FDF4";
    case "Info":     return "#EFF6FF";
  }
}

function getSeverityIcon(severity: AlertSeverity): keyof typeof Ionicons.glyphMap {
  switch (severity) {
    case "Critical": return "alert-circle";
    case "High":     return "warning";
    case "Moderate": return "alert";
    case "Low":      return "information-circle-outline";
    case "Info":     return "information-circle-outline";
  }
}

const MOCK_ALERTS: AlertItem[] = [
  {
    id: "a1",
    title: "Critical: Domestic violence escalation",
    description: "Report #8934 has been escalated. Immediate response required.",
    severity: "Critical",
    time: "10:05 PM",
    date: "January 12, 2026",
    read: false,
    source: "Barangay Zone 2",
  },
  {
    id: "a2",
    title: "New unverified user account",
    description: "A new user registered and is pending identity verification.",
    severity: "High",
    time: "9:48 PM",
    date: "January 12, 2026",
    read: false,
    source: "User Management",
  },
  {
    id: "a3",
    title: "Hotline reported unreachable",
    description: "Hotline #3 (Barangay Poblacion) did not respond for 2 hours.",
    severity: "Moderate",
    time: "9:12 PM",
    date: "January 12, 2026",
    read: false,
    source: "Hotlines Monitor",
  },
  {
    id: "a4",
    title: "Follow-up reminder: Case #8014",
    description: "No update has been filed for Case #8014 in the last 24 hours.",
    severity: "Low",
    time: "8:50 PM",
    date: "January 12, 2026",
    read: true,
    source: "Barangay San Vicente",
  },
  {
    id: "a5",
    title: "Weekly report summary available",
    description: "The weekly admin summary for Jan 6–12 is ready to review.",
    severity: "Info",
    time: "8:00 AM",
    date: "January 12, 2026",
    read: true,
    source: "System",
  },
  {
    id: "a6",
    title: "Resident requested callback",
    description: "Resident from Barangay Poblacion is waiting for a callback from admin.",
    severity: "Moderate",
    time: "7:30 PM",
    date: "January 11, 2026",
    read: true,
    source: "Barangay Poblacion",
  },
  {
    id: "a7",
    title: "New incident report submitted",
    description: "Report #8912 filed with attachments pending review.",
    severity: "Low",
    time: "3:15 PM",
    date: "January 11, 2026",
    read: true,
    source: "Barangay San Jose",
  },
];

export default function AdminAlertsScreen({
  onTabChange,
  initialTab = "Inbox",
  onFabPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);
  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [filter, setFilter] = useState<FilterKey>("All");
  const [alerts, setAlerts] = useState<AlertItem[]>(MOCK_ALERTS);

  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 62;
  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;
  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;
  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + 6;

  const unreadCount = alerts.filter((a) => !a.read).length;

  const filtered = useMemo(() => {
    if (filter === "Unread") return alerts.filter((a) => !a.read);
    if (filter === "Critical") return alerts.filter((a) => a.severity === "Critical" || a.severity === "High");
    return alerts;
  }, [filter, alerts]);

  const markAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);

  const FILTERS: FilterKey[] = ["All", "Unread", "Critical"];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Alerts</Text>
              <Text style={styles.subtitle}>System and barangay notifications</Text>
            </View>
            {unreadCount > 0 && (
              <Pressable
                onPress={markAllRead}
                style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.7 }]}
                hitSlop={10}
              >
                <Text style={styles.markAllText}>Mark all read</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f;
            const badge = f === "Unread" ? unreadCount : undefined;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                  {f}
                </Text>
                {badge != null && badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Alert list */}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="notifications-off-outline" size={scale(36)} color={SUBTLE} />
              <Text style={styles.emptyTitle}>No alerts</Text>
              <Text style={styles.emptyText}>You're all caught up.</Text>
            </View>
          ) : (
            filtered.map((alert) => (
              <Pressable
                key={alert.id}
                style={({ pressed }) => [
                  styles.card,
                  !alert.read && styles.cardUnread,
                  pressed && { opacity: 0.88 },
                ]}
                onPress={() =>
                  setAlerts((prev) =>
                    prev.map((a) => (a.id === alert.id ? { ...a, read: true } : a))
                  )
                }
              >
                {/* Unread dot */}
                {!alert.read && <View style={styles.unreadDot} />}

                {/* Left severity icon */}
                <View
                  style={[
                    styles.severityIcon,
                    { backgroundColor: getSeverityBg(alert.severity) },
                  ]}
                >
                  <Ionicons
                    name={getSeverityIcon(alert.severity)}
                    size={scale(18)}
                    color={getSeverityColor(alert.severity)}
                  />
                </View>

                {/* Body */}
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text
                      style={[styles.cardTitle, !alert.read && styles.cardTitleUnread]}
                      numberOfLines={1}
                    >
                      {alert.title}
                    </Text>
                    <View
                      style={[
                        styles.severityPill,
                        { backgroundColor: getSeverityBg(alert.severity) },
                      ]}
                    >
                      <Text
                        style={[
                          styles.severityLabel,
                          { color: getSeverityColor(alert.severity) },
                        ]}
                      >
                        {alert.severity}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {alert.description}
                  </Text>

                  <View style={styles.cardMeta}>
                    <Ionicons name="location-outline" size={scale(11)} color={SUBTLE} />
                    <Text style={styles.metaText}>{alert.source}</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>{alert.time}</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>{alert.date}</Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>

        {/* Bottom nav */}
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

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    header: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(8),
      paddingBottom: vscale(4),
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      fontSize: scale(28),
      fontWeight: "900",
      color: TEXT,
      letterSpacing: 0.2,
    },
    subtitle: {
      marginTop: vscale(3),
      fontSize: scale(13),
      fontWeight: "400",
      color: MUTED,
    },
    markAllBtn: {
      paddingHorizontal: scale(12),
      paddingVertical: vscale(7),
      borderRadius: scale(999),
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
    },
    markAllText: {
      fontSize: scale(12),
      fontWeight: "600",
      color: Colors.primary,
    },

    filterRow: {
      flexDirection: "row",
      paddingHorizontal: scale(16),
      paddingVertical: vscale(10),
      gap: scale(8),
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(5),
      paddingHorizontal: scale(14),
      paddingVertical: vscale(7),
      borderRadius: scale(999),
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
    },
    filterChipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    filterLabel: {
      fontSize: scale(13),
      fontWeight: "600",
      color: MUTED,
    },
    filterLabelActive: {
      color: "#FFFFFF",
    },
    badge: {
      minWidth: scale(18),
      height: scale(18),
      borderRadius: scale(9),
      backgroundColor: "#F04452",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(4),
    },
    badgeText: {
      fontSize: scale(10),
      fontWeight: "800",
      color: "#FFFFFF",
    },

    content: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(2),
    },

    card: {
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: scale(14),
      paddingVertical: vscale(12),
      paddingHorizontal: scale(12),
      marginBottom: vscale(10),
      flexDirection: "row",
      alignItems: "flex-start",
      gap: scale(10),
      position: "relative",
    },
    cardUnread: {
      borderColor: "#C7D9F7",
      backgroundColor: "#F7FAFF",
    },

    unreadDot: {
      position: "absolute",
      top: scale(14),
      right: scale(14),
      width: scale(8),
      height: scale(8),
      borderRadius: scale(4),
      backgroundColor: Colors.primary,
    },

    severityIcon: {
      width: scale(38),
      height: scale(38),
      borderRadius: scale(12),
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },

    cardBody: {
      flex: 1,
      paddingRight: scale(16),
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
      marginBottom: vscale(3),
    },
    cardTitle: {
      flex: 1,
      fontSize: scale(14),
      fontWeight: "600",
      color: TEXT,
    },
    cardTitleUnread: {
      fontWeight: "800",
    },
    severityPill: {
      paddingHorizontal: scale(8),
      paddingVertical: vscale(3),
      borderRadius: scale(999),
      flexShrink: 0,
    },
    severityLabel: {
      fontSize: scale(10),
      fontWeight: "700",
    },
    cardDesc: {
      fontSize: scale(13),
      fontWeight: "400",
      color: MUTED,
      lineHeight: scale(18),
      marginBottom: vscale(6),
    },
    cardMeta: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: scale(4),
    },
    metaText: {
      fontSize: scale(11),
      fontWeight: "400",
      color: SUBTLE,
    },
    metaDot: {
      fontSize: scale(11),
      color: SUBTLE,
    },

    emptyWrap: {
      marginTop: vscale(40),
      alignItems: "center",
      paddingHorizontal: scale(16),
      paddingVertical: vscale(24),
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: scale(14),
    },
    emptyTitle: {
      marginTop: vscale(10),
      fontSize: scale(16),
      fontWeight: "600",
      color: TEXT,
    },
    emptyText: {
      marginTop: vscale(4),
      fontSize: scale(13),
      fontWeight: "400",
      color: MUTED,
      textAlign: "center",
    },
  });
}
