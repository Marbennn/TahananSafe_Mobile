// src/screens/admin_mobile/AdminReportsScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, useColors } from "../../theme/colors";
import { fetchAdminIncidents, AdminIncident } from "../../api/admin";
import AdminBotNav, { TabKey } from "../../components/AdminComponents/AdminBotNav";

// ─── Palette ────────────────────────────────────────────────────────────────
const BG        = "#F5FAFE";
const BORDER    = "#E7EEF7";
const TEXT_DARK = "#0B2B45";
const MUTED     = "#64748B";
const PRIMARY: string = String((Colors as any).primary ?? "#1E63D0");

// ─── Types ───────────────────────────────────────────────────────────────────
type FilterKey = "All" | "Pending" | "On Going" | "Resolved" | "High Risk";

type Props = {
  onBack: () => void;
  onOpenReportDetail: (reportId: string) => void;
  onTabChange?: (tab: TabKey) => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
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
    case "submitted": return "Pending";
    case "reviewing": return "On Going";
    case "resolved":  return "Resolved";
    case "cancelled": return "Cancelled";
    default:          return "Pending";
  }
}

function getStatusColor(status?: string): string {
  switch (String(status || "").toLowerCase()) {
    case "reviewing": return "#2563EB";
    case "resolved":  return "#16A34A";
    case "cancelled": return "#DC2626";
    default:          return "#EAB308";
  }
}

function getStatusIcon(status?: string): keyof typeof Ionicons.glyphMap {
  switch (String(status || "").toLowerCase()) {
    case "reviewing": return "sync-circle-outline";
    case "resolved":  return "checkmark-circle-outline";
    case "cancelled": return "close-circle-outline";
    default:          return "time-outline";
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  } catch { return dateStr; }
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return ""; }
}

function getUserName(user: AdminIncident["user"]): string {
  if (!user) return "Unknown";
  if (typeof user === "string") return `User #${user.slice(-5)}`;
  const first = user.firstName || "";
  const last  = user.lastName  || "";
  if (first || last) return `${first} ${last}`.trim();
  return user.email || `User #${user._id.slice(-5)}`;
}

function getInitials(user: AdminIncident["user"]): string {
  if (!user || typeof user === "string") return "?";
  const f = user.firstName?.[0] ?? "";
  const l = user.lastName?.[0]  ?? "";
  return (f + l).toUpperCase() || (user.email?.[0] ?? "?").toUpperCase();
}

const FILTERS: FilterKey[] = ["All", "Pending", "On Going", "Resolved", "High Risk"];

function filterAccent(f: FilterKey): string {
  if (f === "Pending")   return "#EAB308";
  if (f === "On Going")  return "#2563EB";
  if (f === "Resolved")  return "#16A34A";
  if (f === "High Risk") return "#EF4444";
  return PRIMARY;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AdminReportsScreen({ onBack, onOpenReportDetail, onTabChange }: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const wScale = Math.min(Math.max(Math.min(width / 375, height / 700), 0.86), 1.2);
  const hScale = Math.min(Math.max(height / 812, 0.78), 1.12);
  const scale  = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const NAV_BASE_HEIGHT    = height < 500 ? 66 : 78;
  const FAB_SIZE           = 62;
  const bottomPad          = Math.max(insets.bottom, 10);
  const navHeight          = NAV_BASE_HEIGHT + bottomPad;
  const chevronBottom      = navHeight + 90;
  const fabBottom          = navHeight - FAB_SIZE / 2 - 10;
  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + vscale(64);

  const [activeTab,  setActiveTab]  = useState<TabKey>("Reports");
  const [incidents,  setIncidents]  = useState<AdminIncident[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [filter,     setFilter]     = useState<FilterKey>("All");
  const [search,     setSearch]     = useState("");

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
      if (e?.name !== "AbortError") setError(e?.message || "Failed to load reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  const handleRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  const handleTabPress = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    } else if (tab !== "Reports") {
      onBack();
    }
  }, [onBack, onTabChange]);

  const counts = useMemo(() => ({
    all:     incidents.length,
    pending: incidents.filter((i) => !i.status || i.status === "submitted").length,
    ongoing: incidents.filter((i) => i.status === "reviewing").length,
    resolved:incidents.filter((i) => i.status === "resolved").length,
    high:    incidents.filter((i) => getRiskLabel(i) === "High").length,
  }), [incidents]);

  const filtered = useMemo(() => {
    let list = incidents;
    if (filter === "Pending")   list = list.filter((i) => !i.status || i.status === "submitted");
    else if (filter === "On Going")  list = list.filter((i) => i.status === "reviewing");
    else if (filter === "Resolved")  list = list.filter((i) => i.status === "resolved");
    else if (filter === "High Risk") list = list.filter((i) => getRiskLabel(i) === "High");

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((i) =>
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

  // ── Filter change animation ───────────────────────────────────────────────
  const tabAnim = useRef(new Animated.Value(1)).current;
  const listAnimStyle = useMemo(() => ({
    opacity: tabAnim,
    transform: [{ translateY: tabAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  }), [tabAnim]);

  const setFilterAnimated = useCallback((k: FilterKey) => {
    if (k === filter) return;
    Animated.timing(tabAnim, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
      setFilter(k);
      Animated.timing(tabAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  }, [filter, tabAnim]);

  const styles = useMemo(() => makeStyles(scale, vscale, width), [width, height]);

  // ── Render card ───────────────────────────────────────────────────────────
  const renderCard: ListRenderItem<AdminIncident> = ({ item }) => {
    const riskLabel  = getRiskLabel(item);
    const riskColor  = getRiskColor(riskLabel);
    const statusColor = getStatusColor(item.status);
    const statusIcon  = getStatusIcon(item.status);
    const accentColor = riskColor;

    const incidentTitle = item.ai_incident_type || item.incidentType ||
      (item.mode === "emergency" ? "Emergency" : "Complaint");
    const isEmergency = item.mode === "emergency";
    const dateStr  = formatDate(item.createdAt);
    const timeStr  = formatTime(item.createdAt);
    const userName = getUserName(item.user);
    const initials = getInitials(item.user);
    const hasAI    = !!item.ai_risk_level;
    const confidenceValue = item.ai_confidence_score != null
      ? item.ai_confidence_score > 1
        ? Math.round(item.ai_confidence_score)
        : Math.round(item.ai_confidence_score * 100)
      : null;

    return (
      <Pressable
        onPress={() => onOpenReportDetail(item._id)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.97 }]}
      >
        <View style={styles.cardInner}>
          <View style={[styles.accentEdge, { backgroundColor: accentColor }]} />

          <View style={styles.cardTopRow}>
            <View style={[styles.leadingIconWrap, { backgroundColor: "#EEF6FF", borderColor: BORDER }]}>
              <Ionicons name={statusIcon} size={styles._iconSize} color={statusColor} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.titleRow}>
                {isEmergency && (
                  <View style={styles.sosPill}>
                    <Ionicons name="flash" size={scale(10)} color="#DC2626" />
                    <Text style={styles.sosText} allowFontScaling={false}>SOS</Text>
                  </View>
                )}
                <Text style={styles.cardTitle} numberOfLines={1} allowFontScaling={false}>
                  {incidentTitle}
                </Text>
              </View>

              {!!item.details && (
                <Text style={styles.cardDetail} numberOfLines={2} allowFontScaling={false}>
                  {item.details}
                </Text>
              )}
            </View>

            <View style={[styles.riskPill, { backgroundColor: `${riskColor}16` }]}>
              <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
              <Text style={[styles.riskText, { color: riskColor }]} allowFontScaling={false}>
                {riskLabel}
              </Text>
            </View>
          </View>

          {/* User + location */}
          <View style={styles.metaGrid}>
            <View style={styles.metaRow}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText} allowFontScaling={false}>{initials}</Text>
              </View>
              <Text style={styles.metaText} numberOfLines={1} allowFontScaling={false}>{userName}</Text>
            </View>
            {!!item.locationStr && (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={styles._miniIcon} color="#94A3B8" />
                <Text style={styles.metaTextMuted} numberOfLines={1} allowFontScaling={false}>
                  {item.locationStr}
                </Text>
              </View>
            )}
          </View>

          {/* AI badges */}
          {hasAI && (
            <View style={styles.aiWrap}>
              <View style={[styles.aiBadge, { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}>
                <Ionicons name="sparkles-outline" size={scale(10)} color="#7C3AED" />
                <Text style={[styles.aiBadgeText, { color: "#7C3AED" }]} allowFontScaling={false}>AI Analyzed</Text>
              </View>
              {confidenceValue != null && (
                <View style={[styles.aiBadge, { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }]}>
                  <Ionicons name="stats-chart-outline" size={scale(10)} color="#64748B" />
                  <Text style={[styles.aiBadgeText, { color: "#64748B" }]} allowFontScaling={false}>
                    {confidenceValue}% confidence
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Bottom row */}
          <View style={styles.cardBottomRow}>
            <View style={styles.cardMetaRow}>
              <Ionicons name="time-outline" size={styles._miniIcon} color="#94A3B8" />
              <Text style={styles.metaTimeText} allowFontScaling={false}>
                {dateStr}{timeStr ? `  ·  ${timeStr}` : ""}
              </Text>
            </View>
            <View style={[styles.statusPill, { borderColor: "#EAF2FF", backgroundColor: "#F3F8FF" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusPillText, { color: statusColor }]} allowFontScaling={false}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.safe}>
      <StatusBar barStyle={TC.statusBar} translucent backgroundColor="transparent" />

      <View style={styles.page}>
        {/* Gradient header backdrop — extends behind status bar */}
        <LinearGradient
          colors={["#EAF3FF", "#F5FAFE"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.headerBg}
        />

        {/* Header */}
        <View style={[styles.headerWrap, { paddingTop: insets.top + vscale(8) }]}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} allowFontScaling={false}>Reports</Text>
              <Text style={styles.headerSub} allowFontScaling={false}>
                {loading ? "Loading incidents…" : `${counts.all} total incidents`}
              </Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={styles._iconSize} color="#94A3B8" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search reports…"
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {!!search && (
              <Pressable onPress={() => setSearch("")} style={styles.clearBtn}>
                <Ionicons name="close" size={styles._iconSize} color="#94A3B8" />
              </Pressable>
            )}
          </View>

          {/* Segment filters */}
          <View style={styles.segmentWrap}>
            {FILTERS.map((k) => {
              const active = k === filter;
              const accent = filterAccent(k);
              return (
                <Pressable
                  key={k}
                  onPress={() => setFilterAnimated(k)}
                  style={[
                    styles.segmentBtn,
                    active
                      ? { backgroundColor: "#FFFFFF", borderColor: "transparent" }
                      : { backgroundColor: "transparent" },
                  ]}
                >
                  <View style={styles.segmentInner}>
                    <View style={[styles.segmentDot, { backgroundColor: active ? accent : "#CBD5E1" }]} />
                    <Text
                      style={[styles.segmentText, { color: active ? TEXT_DARK : "#64748B" }]}
                      numberOfLines={1}
                      allowFontScaling={false}
                    >
                      {k}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.centerHint} allowFontScaling={false}>Loading reports…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Ionicons name="warning-outline" size={styles._emptyIcon} color="#F59E0B" />
            <Text style={styles.errorText} allowFontScaling={false}>{error}</Text>
            <Pressable onPress={() => load()} style={styles.retryBtn}>
              <Text style={styles.retryText} allowFontScaling={false}>Retry</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <Animated.View style={[styles.centerBox, listAnimStyle]}>
            <Ionicons name="document-text-outline" size={styles._emptyIcon} color="#94A3B8" />
            <Text style={styles.centerHint} allowFontScaling={false}>
              No reports found{filter !== "All" ? ` for ${filter}` : ""}.
            </Text>
            {!!search && (
              <Text style={styles.centerSubHint} allowFontScaling={false}>Try a different keyword.</Text>
            )}
          </Animated.View>
        ) : (
          <Animated.View style={[{ flex: 1 }, listAnimStyle]}>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item._id}
              renderItem={renderCard}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.listContent, { paddingBottom: CONTENT_BOTTOM_PAD }]}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={PRIMARY}
                  colors={[PRIMARY]}
                />
              }
            />
          </Animated.View>
        )}

        <AdminBotNav
          activeTab={activeTab}
          onTabPress={handleTabPress}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={() => {}}
        />
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
function makeStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number,
  width: number
) {
  const CARD_R    = scale(20);
  const _iconSize = scale(18);
  const _miniIcon = scale(13);
  const _emptyIcon= scale(44);

  return Object.assign(
    StyleSheet.create({
      safe: { flex: 1, backgroundColor: BG },
      page: { flex: 1, backgroundColor: BG },

      headerBg: {
        position: "absolute", top: 0, left: 0, right: 0,
        height: vscale(240),
      },

      headerWrap: {
        width: "100%",
        maxWidth: 880,
        alignSelf: "center",
        paddingHorizontal: scale(16),
        paddingTop: vscale(8),
        paddingBottom: vscale(10),
      },

      headerTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: scale(10),
        marginBottom: vscale(10),
      },

      headerTitle: {
        fontSize: scale(28),
        fontWeight: "900",
        color: TEXT_DARK,
        letterSpacing: -0.2,
      },

      headerSub: {
        marginTop: vscale(4),
        fontSize: scale(12),
        fontWeight: "400",
        color: MUTED,
        lineHeight: scale(16),
      },

      searchWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
        borderWidth: 1,
        borderColor: "#EEF4FF",
        backgroundColor: "#F8FBFF",
        borderRadius: scale(16),
        paddingHorizontal: scale(12),
        height: vscale(44),
        marginBottom: vscale(4),
      },

      searchInput: {
        flex: 1,
        minWidth: 0,
        fontSize: scale(12),
        color: TEXT_DARK,
        fontWeight: "400",
      },

      clearBtn: {
        width: vscale(28),
        height: vscale(28),
        borderRadius: vscale(999),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#EEF4FF",
      },

      segmentWrap: {
        marginTop: vscale(8),
        flexDirection: "row",
        borderWidth: 1,
        borderColor: "#EAF2FF",
        backgroundColor: "#F3F8FF",
        borderRadius: scale(16),
        padding: scale(4),
        gap: scale(4),
      },

      segmentBtn: {
        flex: 1,
        height: vscale(36),
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: "transparent",
        alignItems: "center",
        justifyContent: "center",
      },

      segmentInner: { flexDirection: "row", alignItems: "center", gap: scale(5) },
      segmentDot: { width: scale(7), height: scale(7), borderRadius: scale(99) },
      segmentText: { fontSize: scale(10), fontWeight: "600" },

      listContent: {
        width: "100%",
        maxWidth: 880,
        alignSelf: "center",
        paddingHorizontal: scale(16),
        paddingTop: vscale(8),
      },

      // Card
      card: {
        borderRadius: CARD_R,
        borderWidth: 1,
        borderColor: "#EAF2FF",
        backgroundColor: "#FFFFFF",
        marginBottom: vscale(10),
        elevation: 0,
        shadowColor: "transparent",
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
      },

      cardInner: {
        borderRadius: CARD_R,
        overflow: "hidden",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(12),
      },

      accentEdge: {
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: scale(5),
        opacity: 0.9,
      },

      cardTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: scale(10),
      },

      leadingIconWrap: {
        width: vscale(40),
        height: vscale(40),
        borderRadius: vscale(13),
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        flexShrink: 0,
      },

      titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        flexWrap: "wrap",
        marginBottom: vscale(2),
      },

      sosPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(3),
        backgroundColor: "#FFF1F2",
        borderColor: "#FECDD3",
        borderWidth: 1,
        borderRadius: scale(999),
        paddingHorizontal: scale(6),
        paddingVertical: vscale(2),
      },

      sosText: {
        fontSize: scale(9),
        fontWeight: "900",
        color: "#DC2626",
      },

      cardTitle: {
        flex: 1,
        fontSize: scale(15),
        fontWeight: "900",
        color: TEXT_DARK,
        letterSpacing: -0.1,
      },

      cardDetail: {
        fontSize: scale(12),
        fontWeight: "400",
        color: MUTED,
        lineHeight: vscale(16),
      },

      riskPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(4),
        paddingHorizontal: scale(8),
        paddingVertical: vscale(4),
        borderRadius: scale(999),
        flexShrink: 0,
      },

      riskDot: { width: scale(6), height: scale(6), borderRadius: scale(99) },
      riskText: { fontSize: scale(10), fontWeight: "900" },

      metaGrid: { gap: vscale(5), marginTop: vscale(8) },
      metaRow:  { flexDirection: "row", alignItems: "center", gap: scale(6) },

      avatarWrap: {
        width: scale(24), height: scale(24),
        borderRadius: scale(999),
        backgroundColor: "#EAF3FF",
        alignItems: "center", justifyContent: "center",
      },

      avatarText:    { fontSize: scale(9), fontWeight: "900", color: PRIMARY },
      metaText:      { flex: 1, fontSize: scale(12), fontWeight: "600", color: "#516477" },
      metaTextMuted: { flex: 1, fontSize: scale(11), fontWeight: "400", color: "#94A3B8" },

      aiWrap: { flexDirection: "row", flexWrap: "wrap", gap: scale(6), marginTop: vscale(8) },

      aiBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(4),
        borderRadius: scale(999),
        borderWidth: 1,
        paddingHorizontal: scale(8),
        paddingVertical: vscale(3),
      },

      aiBadgeText: { fontSize: scale(10), fontWeight: "700" },

      cardBottomRow: {
        marginTop: vscale(10),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: scale(10),
        flexWrap: "wrap",
      },

      cardMetaRow: { flexDirection: "row", alignItems: "center", gap: scale(5) },
      metaTimeText:  { fontSize: scale(10), fontWeight: "400", color: "#94A3B8" },

      statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(5),
        borderWidth: 1,
        borderRadius: scale(999),
        paddingHorizontal: scale(9),
        paddingVertical: vscale(5),
      },

      statusDot:     { width: scale(7), height: scale(7), borderRadius: scale(99) },
      statusPillText:{ fontSize: scale(10), fontWeight: "900" },

      // Center states
      centerBox: {
        flex: 1,
        width: "100%",
        maxWidth: Math.min(width, 880),
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: scale(20),
        gap: vscale(10),
        paddingBottom: vscale(160),
      },

      centerHint: {
        fontSize: scale(13), fontWeight: "400",
        color: MUTED, textAlign: "center",
      },

      centerSubHint: {
        fontSize: scale(12), fontWeight: "400",
        color: "#94A3B8", textAlign: "center",
        marginTop: vscale(-4),
      },

      errorText: {
        fontSize: scale(13), fontWeight: "400",
        color: "#B91C1C", textAlign: "center",
      },

      retryBtn: {
        marginTop: vscale(6),
        paddingVertical: vscale(10),
        paddingHorizontal: scale(18),
        backgroundColor: PRIMARY,
        borderRadius: scale(999),
      },

      retryText: { color: "#FFFFFF", fontWeight: "900", fontSize: scale(12) },
    }),
    { _iconSize, _miniIcon, _emptyIcon }
  ) as any;
}
