// src/screens/admin_mobile/AdminReportsScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";
import { fetchAdminIncidents, AdminIncident } from "../../api/admin";
import AdminBotNav, { TabKey } from "../../components/AdminComponents/AdminBotNav";

type FilterKey = "All" | "Pending" | "On Going" | "Resolved" | "High Risk";

type Props = {
  onBack: () => void;
  onOpenReportDetail: (reportId: string) => void;
  onTabChange?: (tab: TabKey) => void;
};

const BG = "#F6FAFD";
const TEXT_DARK = "#0B2B45";
const TEXT_MUTED = "#6E8094";
const BORDER = "#E4EDF5";
const CARD = "#FFFFFF";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function makeScale(width: number, height: number) {
  const base = clamp(Math.min(width / 375, height / 812) * 1.02, 0.88, 1.24);
  const font = clamp(base * 1.05, 0.92, 1.28);
  return { s: base, fs: font };
}

function getRiskColor(level?: string) {
  const l = String(level || "").toLowerCase();
  if (l === "high") return "#EF4444";
  if (l === "moderate" || l === "medium") return "#F59E0B";
  return "#22C55E";
}

function getRiskLabel(incident: AdminIncident): string {
  if (incident.ai_risk_level) {
    const r = incident.ai_risk_level.toLowerCase();
    if (r.includes("high")) return "High";
    if (r.includes("mod") || r.includes("med")) return "Moderate";
    return "Low";
  }
  if (incident.mode === "emergency") return "High";
  return "Low";
}

function getStatusLabel(status?: string): string {
  switch (String(status || "").toLowerCase()) {
    case "submitted":
      return "Pending";
    case "reviewing":
      return "On Going";
    case "resolved":
      return "Resolved";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}

function getStatusColor(status?: string): string {
  switch (String(status || "").toLowerCase()) {
    case "reviewing":
      return "#F59E0B";
    case "resolved":
      return "#22C55E";
    case "cancelled":
      return "#94A3B8";
    default:
      return "#3B82F6";
  }
}

function getStatusBg(status?: string): string {
  switch (String(status || "").toLowerCase()) {
    case "reviewing":
      return "#FFFBEB";
    case "resolved":
      return "#F0FDF4";
    case "cancelled":
      return "#F8FAFC";
    default:
      return "#EFF6FF";
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function getUserName(user: AdminIncident["user"]): string {
  if (!user) return "Unknown";
  if (typeof user === "string") return `User #${user.slice(-5)}`;
  const first = user.firstName || "";
  const last = user.lastName || "";
  if (first || last) return `${first} ${last}`.trim();
  return user.email || `User #${user._id.slice(-5)}`;
}

function getInitials(user: AdminIncident["user"]): string {
  if (!user || typeof user === "string") return "?";
  const f = user.firstName?.[0] ?? "";
  const l = user.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || (user.email?.[0] ?? "?").toUpperCase();
}

const FILTERS: FilterKey[] = ["All", "Pending", "On Going", "Resolved", "High Risk"];

const FILTER_META: Record<FilterKey, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  All: { icon: "apps-outline", color: TEXT_DARK },
  Pending: { icon: "time-outline", color: "#3B82F6" },
  "On Going": { icon: "sync-outline", color: "#F59E0B" },
  Resolved: { icon: "checkmark-circle-outline", color: "#22C55E" },
  "High Risk": { icon: "warning-outline", color: "#EF4444" },
};

export default function AdminReportsScreen({
  onBack,
  onOpenReportDetail,
  onTabChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { s, fs } = useMemo(() => makeScale(width, height), [width, height]);

  const isSmallPhone = width < 360;
  const isTabletLike = width >= 768;

  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 62;
  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;
  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  const PAD = clamp(Math.round(16 * s), 14, 24);
  const GAP = clamp(Math.round(12 * s), 10, 16);

  const [activeTab, setActiveTab] = useState<TabKey>("Reports");
  const [incidents, setIncidents] = useState<AdminIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("All");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const data = await fetchAdminIncidents(ctrl.signal);
      setIncidents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e?.message || "Failed to load reports.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const handleTabPress = useCallback(
    (tab: TabKey) => {
      setActiveTab(tab);
      onTabChange?.(tab);
      if (tab !== "Reports") onBack();
    },
    [onBack, onTabChange]
  );

  const counts = useMemo(
    () => ({
      all: incidents.length,
      pending: incidents.filter((i) => !i.status || i.status === "submitted").length,
      ongoing: incidents.filter((i) => i.status === "reviewing").length,
      resolved: incidents.filter((i) => i.status === "resolved").length,
      high: incidents.filter((i) => getRiskLabel(i) === "High").length,
    }),
    [incidents]
  );

  const filtered = useMemo(() => {
    let list = incidents;

    if (filter === "Pending") {
      list = list.filter((i) => !i.status || i.status === "submitted");
    } else if (filter === "On Going") {
      list = list.filter((i) => i.status === "reviewing");
    } else if (filter === "Resolved") {
      list = list.filter((i) => i.status === "resolved");
    } else if (filter === "High Risk") {
      list = list.filter((i) => getRiskLabel(i) === "High");
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          (i.incidentType || "").toLowerCase().includes(q) ||
          (i.ai_incident_type || "").toLowerCase().includes(q) ||
          (i.details || "").toLowerCase().includes(q) ||
          (i.locationStr || "").toLowerCase().includes(q) ||
          getUserName(i.user).toLowerCase().includes(q) ||
          i._id.toLowerCase().includes(q)
      );
    }

    return list;
  }, [incidents, filter, search]);

  function getFilterCount(f: FilterKey): number {
    switch (f) {
      case "All":
        return counts.all;
      case "Pending":
        return counts.pending;
      case "On Going":
        return counts.ongoing;
      case "Resolved":
        return counts.resolved;
      case "High Risk":
        return counts.high;
      default:
        return 0;
    }
  }

  const cardGap = GAP;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: BG,
        },

        root: {
          flex: 1,
          backgroundColor: BG,
        },

        listContent: {
          paddingHorizontal: PAD,
          paddingTop: clamp(Math.round(10 * s), 8, 14),
          paddingBottom: navHeight + 34,
        },

        heroCard: {
          backgroundColor: CARD,
          borderRadius: clamp(Math.round(22 * s), 18, 26),
          borderWidth: 1,
          borderColor: BORDER,
          paddingHorizontal: clamp(Math.round(16 * s), 14, 22),
          paddingVertical: clamp(Math.round(14 * s), 12, 18),
          marginBottom: GAP,
          shadowColor: "#0B2B45",
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        },

        topRow: {
          flexDirection: "row",
          alignItems: "center",
        },

        backBtn: {
          width: clamp(Math.round(42 * s), 38, 48),
          height: clamp(Math.round(42 * s), 38, 48),
          borderRadius: 14,
          borderWidth: 1,
          borderColor: BORDER,
          backgroundColor: "#F9FCFF",
          alignItems: "center",
          justifyContent: "center",
        },

        headerTextWrap: {
          flex: 1,
          marginLeft: 12,
        },

        title: {
          fontSize: clamp(Math.round(24 * fs), 20, 28),
          fontWeight: "900",
          color: TEXT_DARK,
          letterSpacing: -0.3,
        },

        subtitle: {
          marginTop: 2,
          fontSize: clamp(Math.round(12 * fs), 11, 14),
          color: TEXT_MUTED,
          fontWeight: "600",
        },

        headerRightIcon: {
          width: clamp(Math.round(42 * s), 38, 48),
          height: clamp(Math.round(42 * s), 38, 48),
          borderRadius: 14,
          backgroundColor: "#EAF3FF",
          alignItems: "center",
          justifyContent: "center",
        },

        heroBottomRow: {
          marginTop: clamp(Math.round(14 * s), 12, 18),
          flexDirection: isTabletLike ? "row" : "column",
          alignItems: isTabletLike ? "center" : "stretch",
          justifyContent: "space-between",
          gap: 10,
        },

        heroInfoBox: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },

        heroInfoPill: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: "#F7FAFD",
          borderWidth: 1,
          borderColor: BORDER,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 14,
          flexShrink: 1,
        },

        heroInfoText: {
          fontSize: clamp(Math.round(12 * fs), 11, 14),
          color: TEXT_DARK,
          fontWeight: "700",
        },

        heroMiniText: {
          fontSize: clamp(Math.round(11 * fs), 10, 13),
          color: TEXT_MUTED,
          fontWeight: "600",
        },

        statsWrap: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: cardGap,
          marginBottom: GAP,
        },

        statCard: {
          width: "48%",
          backgroundColor: CARD,
          borderRadius: clamp(Math.round(18 * s), 16, 20),
          borderWidth: 1,
          borderColor: BORDER,
          paddingHorizontal: clamp(Math.round(12 * s), 10, 16),
          paddingVertical: clamp(Math.round(12 * s), 10, 16),
        },

        statCardActive: {
          shadowColor: "#0B2B45",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },

        statTop: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        },

        statIconBox: {
          width: clamp(Math.round(34 * s), 30, 38),
          height: clamp(Math.round(34 * s), 30, 38),
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
        },

        statCount: {
          fontSize: clamp(Math.round(24 * fs), 20, 28),
          fontWeight: "900",
          lineHeight: clamp(Math.round(26 * fs), 22, 30),
        },

        statLabel: {
          fontSize: clamp(Math.round(12 * fs), 11, 14),
          color: TEXT_MUTED,
          fontWeight: "700",
        },

        searchCard: {
          backgroundColor: CARD,
          borderRadius: clamp(Math.round(18 * s), 16, 20),
          borderWidth: 1,
          borderColor: BORDER,
          padding: clamp(Math.round(10 * s), 9, 12),
          marginBottom: GAP,
        },

        searchWrap: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#F9FCFF",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: BORDER,
          paddingHorizontal: 12,
          paddingVertical: isSmallPhone ? 10 : 11,
        },

        searchWrapFocused: {
          borderColor: Colors.primary,
          backgroundColor: "#FFFFFF",
        },

        searchInput: {
          flex: 1,
          marginLeft: 8,
          fontSize: clamp(Math.round(13 * fs), 12, 15),
          color: TEXT_DARK,
          paddingVertical: 0,
        },

        chipsWrap: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 12,
        },

        chip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 999,
          backgroundColor: "#F8FBFE",
          borderWidth: 1,
          borderColor: BORDER,
        },

        chipActive: {
          backgroundColor: Colors.primary,
          borderColor: Colors.primary,
        },

        chipText: {
          fontSize: clamp(Math.round(12 * fs), 11, 13),
          fontWeight: "800",
          color: "#5C6E81",
        },

        chipTextActive: {
          color: "#FFFFFF",
        },

        chipBadge: {
          minWidth: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: "#EAF0F6",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 5,
        },

        chipBadgeActive: {
          backgroundColor: "rgba(255,255,255,0.22)",
        },

        chipBadgeText: {
          fontSize: clamp(Math.round(10 * fs), 9, 11),
          fontWeight: "900",
          color: "#516477",
        },

        chipBadgeTextActive: {
          color: "#FFFFFF",
        },

        sectionRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          marginTop: 2,
        },

        sectionTitleWrap: {
          flex: 1,
        },

        sectionTitle: {
          fontSize: clamp(Math.round(16 * fs), 14, 18),
          color: TEXT_DARK,
          fontWeight: "900",
        },

        sectionSub: {
          marginTop: 2,
          fontSize: clamp(Math.round(11 * fs), 10, 13),
          color: "#8CA0B3",
          fontWeight: "600",
        },

        clearBtn: {
          backgroundColor: "#EAF3FF",
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 7,
          marginLeft: 10,
        },

        clearBtnText: {
          fontSize: clamp(Math.round(11 * fs), 10, 12),
          fontWeight: "800",
          color: Colors.primary,
        },

        card: {
          backgroundColor: CARD,
          borderRadius: clamp(Math.round(18 * s), 16, 20),
          borderWidth: 1,
          borderColor: BORDER,
          marginBottom: GAP,
          overflow: "hidden",
          shadowColor: "#0B2B45",
          shadowOpacity: 0.05,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },

        cardPressed: {
          opacity: 0.96,
          transform: [{ scale: 0.995 }],
        },

        cardAccent: {
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
        },

        cardBody: {
          paddingHorizontal: clamp(Math.round(16 * s), 14, 18),
          paddingVertical: clamp(Math.round(14 * s), 12, 18),
          paddingLeft: clamp(Math.round(18 * s), 16, 22),
        },

        cardHeaderRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 10,
        },

        cardHeaderLeft: {
          flex: 1,
          minWidth: 0,
        },

        cardTitleRow: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
        },

        emergencyPill: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: "#FFF1F2",
          borderColor: "#FECDD3",
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: 7,
          paddingVertical: 3,
        },

        emergencyText: {
          fontSize: clamp(Math.round(10 * fs), 9, 11),
          color: "#DC2626",
          fontWeight: "900",
        },

        incidentTitle: {
          flexShrink: 1,
          fontSize: clamp(Math.round(16 * fs), 14, 18),
          color: TEXT_DARK,
          fontWeight: "900",
        },

        detailText: {
          marginTop: 6,
          fontSize: clamp(Math.round(12 * fs), 11, 14),
          lineHeight: clamp(Math.round(18 * s), 16, 21),
          color: "#627589",
          fontWeight: "500",
        },

        rightTopCol: {
          alignItems: "flex-end",
          gap: 8,
        },

        riskPill: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
        },

        riskDot: {
          width: 6,
          height: 6,
          borderRadius: 999,
        },

        riskText: {
          fontSize: clamp(Math.round(11 * fs), 10, 12),
          fontWeight: "900",
        },

        chevronBtn: {
          width: 28,
          height: 28,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F7FAFD",
          borderWidth: 1,
          borderColor: BORDER,
        },

        metaGrid: {
          gap: 9,
          marginTop: 12,
        },

        metaRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },

        avatar: {
          width: clamp(Math.round(26 * s), 24, 30),
          height: clamp(Math.round(26 * s), 24, 30),
          borderRadius: 999,
          backgroundColor: "#EAF3FF",
          alignItems: "center",
          justifyContent: "center",
        },

        avatarText: {
          fontSize: clamp(Math.round(10 * fs), 9, 11),
          color: Colors.primary,
          fontWeight: "900",
        },

        metaText: {
          flex: 1,
          fontSize: clamp(Math.round(12 * fs), 11, 14),
          color: "#516477",
          fontWeight: "600",
        },

        mutedMetaText: {
          flex: 1,
          fontSize: clamp(Math.round(11 * fs), 10, 13),
          color: "#8FA1B3",
          fontWeight: "500",
        },

        aiWrap: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 12,
        },

        aiBadge: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: 9,
          paddingVertical: 5,
        },

        aiBadgeText: {
          fontSize: clamp(Math.round(10 * fs), 9, 11),
          fontWeight: "800",
        },

        bottomRow: {
          marginTop: 14,
          flexDirection: isSmallPhone ? "column" : "row",
          alignItems: isSmallPhone ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: 8,
        },

        dateWrap: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          flexShrink: 1,
        },

        dateText: {
          fontSize: clamp(Math.round(11 * fs), 10, 13),
          color: "#8FA1B3",
          fontWeight: "600",
        },

        statusPill: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
        },

        statusDot: {
          width: 6,
          height: 6,
          borderRadius: 999,
        },

        statusText: {
          fontSize: clamp(Math.round(11 * fs), 10, 12),
          fontWeight: "900",
        },

        centered: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 28,
          gap: 12,
        },

        stateCard: {
          width: "100%",
          maxWidth: 360,
          backgroundColor: CARD,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: BORDER,
          paddingHorizontal: 20,
          paddingVertical: 24,
          alignItems: "center",
        },

        stateIconWrap: {
          width: 76,
          height: 76,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        },

        stateTitle: {
          fontSize: clamp(Math.round(17 * fs), 15, 19),
          color: TEXT_DARK,
          fontWeight: "900",
          textAlign: "center",
        },

        stateText: {
          marginTop: 6,
          fontSize: clamp(Math.round(13 * fs), 12, 14),
          color: TEXT_MUTED,
          fontWeight: "500",
          textAlign: "center",
          lineHeight: clamp(Math.round(18 * s), 16, 20),
        },

        retryBtn: {
          marginTop: 14,
          backgroundColor: Colors.primary,
          borderRadius: 14,
          paddingHorizontal: 18,
          paddingVertical: 11,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
        },

        retryBtnText: {
          color: "#FFFFFF",
          fontSize: clamp(Math.round(13 * fs), 12, 14),
          fontWeight: "800",
        },
      }),
    [PAD, s, fs, navHeight, GAP, cardGap, isTabletLike, isSmallPhone]
  );

  const renderReportCard: ListRenderItem<AdminIncident> = ({ item }) => {
    const riskLabel = getRiskLabel(item);
    const riskColor = getRiskColor(riskLabel);

    const statusLabel = getStatusLabel(item.status);
    const statusColor = getStatusColor(item.status);
    const statusBg = getStatusBg(item.status);

    const userName = getUserName(item.user);
    const initials = getInitials(item.user);

    const incidentTitle =
      item.ai_incident_type ||
      item.incidentType ||
      (item.mode === "emergency" ? "Emergency" : "Complaint");

    const isEmergency = item.mode === "emergency";
    const dateStr = formatDate(item.createdAt);
    const timeStr = formatTime(item.createdAt);
    const hasAI = !!item.ai_risk_level;

    const confidenceValue =
      item.ai_confidence_score != null
        ? item.ai_confidence_score > 1
          ? Math.round(item.ai_confidence_score)
          : Math.round(item.ai_confidence_score * 100)
        : null;

    return (
      <Pressable
        onPress={() => onOpenReportDetail(item._id)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={[styles.cardAccent, { backgroundColor: riskColor }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.cardTitleRow}>
                {isEmergency && (
                  <View style={styles.emergencyPill}>
                    <Ionicons name="flash" size={10} color="#DC2626" />
                    <Text style={styles.emergencyText} allowFontScaling={false}>
                      SOS
                    </Text>
                  </View>
                )}

                <Text style={styles.incidentTitle} numberOfLines={1} allowFontScaling={false}>
                  {incidentTitle}
                </Text>
              </View>

              {!!item.details && (
                <Text style={styles.detailText} numberOfLines={2} allowFontScaling={false}>
                  {item.details}
                </Text>
              )}
            </View>

            <View style={styles.rightTopCol}>
              <View style={[styles.riskPill, { backgroundColor: `${riskColor}16` }]}>
                <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
                <Text style={[styles.riskText, { color: riskColor }]} allowFontScaling={false}>
                  {riskLabel}
                </Text>
              </View>

              <View style={styles.chevronBtn}>
                <Ionicons name="chevron-forward" size={14} color="#9AAEC0" />
              </View>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText} allowFontScaling={false}>
                  {initials}
                </Text>
              </View>
              <Text style={styles.metaText} numberOfLines={1} allowFontScaling={false}>
                {userName}
              </Text>
            </View>

            {!!item.locationStr && (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color="#9AAEC0" />
                <Text style={styles.mutedMetaText} numberOfLines={1} allowFontScaling={false}>
                  {item.locationStr}
                </Text>
              </View>
            )}
          </View>

          {hasAI && (
            <View style={styles.aiWrap}>
              <View
                style={[
                  styles.aiBadge,
                  {
                    backgroundColor: "#F5F3FF",
                    borderColor: "#DDD6FE",
                  },
                ]}
              >
                <Ionicons name="sparkles-outline" size={11} color="#7C3AED" />
                <Text
                  style={[styles.aiBadgeText, { color: "#7C3AED" }]}
                  allowFontScaling={false}
                >
                  AI Analyzed
                </Text>
              </View>

              {confidenceValue != null && (
                <View
                  style={[
                    styles.aiBadge,
                    {
                      backgroundColor: "#F8FAFC",
                      borderColor: "#E2E8F0",
                    },
                  ]}
                >
                  <Ionicons name="stats-chart-outline" size={11} color="#64748B" />
                  <Text
                    style={[styles.aiBadgeText, { color: "#64748B" }]}
                    allowFontScaling={false}
                  >
                    {confidenceValue}% confidence
                  </Text>
                </View>
              )}

              {item.ai_children_involved && (
                <View
                  style={[
                    styles.aiBadge,
                    {
                      backgroundColor: "#FFF7ED",
                      borderColor: "#FED7AA",
                    },
                  ]}
                >
                  <Text
                    style={[styles.aiBadgeText, { color: "#C2410C" }]}
                    allowFontScaling={false}
                  >
                    Children involved
                  </Text>
                </View>
              )}

              {item.ai_weapon_mentioned && (
                <View
                  style={[
                    styles.aiBadge,
                    {
                      backgroundColor: "#FFF1F2",
                      borderColor: "#FECDD3",
                    },
                  ]}
                >
                  <Text
                    style={[styles.aiBadgeText, { color: "#BE123C" }]}
                    allowFontScaling={false}
                  >
                    Weapon mentioned
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.bottomRow}>
            <View style={styles.dateWrap}>
              <Ionicons name="calendar-outline" size={13} color="#9AAEC0" />
              <Text style={styles.dateText} allowFontScaling={false}>
                {dateStr}
                {timeStr ? `  ·  ${timeStr}` : ""}
              </Text>
            </View>

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: statusBg,
                  borderColor: `${statusColor}30`,
                },
              ]}
            >
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]} allowFontScaling={false}>
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const HeaderComponent = (
    <View>
      <View style={styles.heroCard}>
        <View style={styles.topRow}>
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
            <Ionicons
              name="arrow-back"
              size={clamp(Math.round(20 * s), 18, 22)}
              color={TEXT_DARK}
            />
          </Pressable>

          <View style={styles.headerTextWrap}>
            <Text style={styles.title} allowFontScaling={false}>
              Reports
            </Text>
            <Text style={styles.subtitle} allowFontScaling={false}>
              {loading ? "Loading incidents..." : `${counts.all} total incidents`}
            </Text>
          </View>

          <View style={styles.headerRightIcon}>
            <Ionicons
              name="document-text-outline"
              size={clamp(Math.round(18 * s), 16, 20)}
              color={Colors.primary}
            />
          </View>
        </View>

      </View>

      <View style={styles.searchCard}>
        <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
          <Ionicons
            name="search-outline"
            size={clamp(Math.round(17 * s), 15, 18)}
            color={searchFocused ? Colors.primary : "#9AAEC0"}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by type, reporter, location..."
            placeholderTextColor="#9AAEC0"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {!!search && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#9AAEC0" />
            </Pressable>
          )}
        </View>

        <View style={styles.chipsWrap}>
          {FILTERS.map((f) => {
            const active = filter === f;
            const meta = FILTER_META[f];
            const count = getFilterCount(f);

            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Ionicons
                  name={meta.icon}
                  size={13}
                  color={active ? "#FFFFFF" : meta.color}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]} allowFontScaling={false}>
                  {f}
                </Text>
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text
                    style={[
                      styles.chipBadgeText,
                      active && styles.chipBadgeTextActive,
                    ]}
                    allowFontScaling={false}
                  >
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle} allowFontScaling={false}>
            {filtered.length === counts.all
              ? `${filtered.length} Report${filtered.length !== 1 ? "s" : ""}`
              : `${filtered.length} of ${counts.all} Reports`}
          </Text>
          <Text style={styles.sectionSub} allowFontScaling={false}>
            Tap a report card to open full details
          </Text>
        </View>

        {(filter !== "All" || search.trim()) && (
          <Pressable
            onPress={() => {
              setFilter("All");
              setSearch("");
            }}
            style={styles.clearBtn}
          >
            <Text style={styles.clearBtnText} allowFontScaling={false}>
              Clear
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.root}>
          {HeaderComponent}
          <View style={styles.centered}>
            <View style={styles.stateCard}>
              <View style={[styles.stateIconWrap, { backgroundColor: "#EAF3FF" }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
              <Text style={styles.stateTitle} allowFontScaling={false}>
                Loading reports
              </Text>
              <Text style={styles.stateText} allowFontScaling={false}>
                Please wait while the incident reports are being prepared.
              </Text>
            </View>
          </View>
        </View>

        <AdminBotNav
          activeTab={activeTab}
          onTabPress={handleTabPress}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={() => {}}
          centerLabel="Admin Menu"
        />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.root}>
          {HeaderComponent}
          <View style={styles.centered}>
            <View style={styles.stateCard}>
              <View style={[styles.stateIconWrap, { backgroundColor: "#FFF1F2" }]}>
                <Ionicons name="alert-circle-outline" size={36} color="#EF4444" />
              </View>
              <Text style={styles.stateTitle} allowFontScaling={false}>
                Could not load reports
              </Text>
              <Text style={styles.stateText} allowFontScaling={false}>
                {error}
              </Text>

              <Pressable onPress={() => load()} style={styles.retryBtn}>
                <Ionicons name="refresh-outline" size={15} color="#FFFFFF" />
                <Text style={styles.retryBtnText} allowFontScaling={false}>
                  Try Again
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <AdminBotNav
          activeTab={activeTab}
          onTabPress={handleTabPress}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={() => {}}
          centerLabel="Admin Menu"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.root}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderReportCard}
          ListHeaderComponent={HeaderComponent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.stateCard}>
                <View style={[styles.stateIconWrap, { backgroundColor: "#EAF3FF" }]}>
                  <Ionicons name="folder-open-outline" size={36} color={Colors.primary} />
                </View>
                <Text style={styles.stateTitle} allowFontScaling={false}>
                  No reports found
                </Text>
                <Text style={styles.stateText} allowFontScaling={false}>
                  {search.trim()
                    ? "Try a different search term or remove some filters."
                    : "There are no reports available for this filter yet."}
                </Text>
              </View>
            </View>
          }
        />
      </View>

      <AdminBotNav
        activeTab={activeTab}
        onTabPress={handleTabPress}
        navHeight={navHeight}
        paddingBottom={bottomPad}
        chevronBottom={chevronBottom}
        fabBottom={fabBottom}
        fabSize={FAB_SIZE}
        onFabPress={() => {}}
        centerLabel="Admin Menu"
      />
    </SafeAreaView>
  );
}