// src/screens/admin_mobile/AdminAnalyticsScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, useColors } from "../../theme/colors";
import { Typography } from "../../theme/typography";
import { fetchAdminStats, fetchAdminIncidents, AdminStats, AdminIncident } from "../../api/admin";

type Props = {
  onBack: () => void;
};

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
  width,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  sub?: string;
  width: number;
}) {
  return (
    <View style={[statStyles.card, { borderColor: `${color}20`, width }]}>
      <View style={[statStyles.iconWrap, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
      {sub ? <Text style={statStyles.sub}>{sub}</Text> : null}
    </View>
  );
}

function BarChart({
  data,
  compact,
}: {
  data: { label: string; value: number; color: string }[];
  compact?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={chartStyles.container}>
      {data.map((item, idx) => {
        const pct = item.value / max;
        return (
          <View key={idx} style={chartStyles.barRow}>
            <Text
              style={[chartStyles.barLabel, compact && chartStyles.barLabelCompact]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            <View style={chartStyles.barTrack}>
              <View
                style={[
                  chartStyles.barFill,
                  {
                    width: `${Math.round(pct * 100)}%`,
                    backgroundColor: item.color,
                  },
                ]}
              />
            </View>
            <Text style={[chartStyles.barValue, { color: item.color }]}>
              {item.value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function deriveStatsFromIncidents(
  incidents: AdminIncident[]
): AdminStats {
  const pending = incidents.filter(
    (i) => !i.status || i.status === "submitted"
  ).length;
  const reviewing = incidents.filter((i) => i.status === "reviewing").length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;
  const cancelled = incidents.filter((i) => i.status === "cancelled").length;
  const emergencyReports = incidents.filter((i) => i.mode === "emergency").length;

  return {
    totalIncidents: incidents.length,
    pending,
    reviewing,
    resolved,
    cancelled,
    emergencyReports,
    totalUsers: 0,
    verifiedUsers: 0,
  };
}

export default function AdminAnalyticsScreen({ onBack }: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const horizontalPadding = compact ? 14 : 20;
  const boundedWidth = Math.min(width, 880);
  const innerWidth = Math.max(0, boundedWidth - horizontalPadding * 2);
  const statColumns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const statGap = compact ? 8 : 12;
  const statCardWidth = Math.max(
    0,
    (innerWidth - statGap * (statColumns - 1)) / statColumns
  );
  const styles = useMemo(
    () => makeStyles(horizontalPadding, statGap),
    [horizontalPadding, statGap]
  );

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [incidents, setIncidents] = useState<AdminIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      // Try fetching stats; fall back to deriving from incidents list
      const [statsResult, incidentsResult] = await Promise.allSettled([
        fetchAdminStats(ctrl.signal),
        fetchAdminIncidents(ctrl.signal),
      ]);

      const inc =
        incidentsResult.status === "fulfilled" ? incidentsResult.value : [];
      setIncidents(inc);

      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value);
      } else {
        // Derive from incidents list
        setStats(deriveStatsFromIncidents(inc));
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e?.message || "Failed to load analytics.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  const derivedStats = useMemo(
    () =>
      stats
        ? {
            ...stats,
            emergencyReports: incidents.filter(
              (incident) => incident.mode === "emergency",
            ).length,
          }
        : deriveStatsFromIncidents(incidents),
    [stats, incidents]
  );

  // --- Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    incidents.forEach((i) => {
      const key =
        i.ai_incident_type ||
        i.incidentType ||
        (i.mode === "emergency" ? "Emergency" : "Complaint");
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value], idx) => ({
        label,
        value,
        color: [
          "#0E5AA7", "#7C3AED", "#F04452", "#F5B301", "#35B56A", "#0891B2",
        ][idx] || "#9AA4B2",
      }));
  }, [incidents]);

  // --- Status distribution
  const statusBreakdown = useMemo(() => [
    { label: "Pending", value: derivedStats.pending, color: Colors.primary },
    { label: "On Going", value: derivedStats.reviewing, color: "#F5B301" },
    { label: "Resolved", value: derivedStats.resolved, color: "#35B56A" },
    { label: "Cancelled", value: derivedStats.cancelled, color: "#9AA4B2" },
  ], [derivedStats]);

  const resolveRate = useMemo(() => {
    const total = derivedStats.totalIncidents;
    if (!total) return 0;
    return Math.round((derivedStats.resolved / total) * 100);
  }, [derivedStats]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} backgroundColor={TC.screenBg} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSub}>System overview & insights</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="bar-chart" size={16} color={Colors.primary} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : error && incidents.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#F04452" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Hero summary */}
          <LinearGradient
            colors={["#0E5AA7", "#0A4177"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroLabel}>Total Incidents</Text>
                <Text style={styles.heroValue}>
                  {derivedStats.totalIncidents}
                </Text>
              </View>
              <View style={styles.heroIconWrap}>
                <Ionicons name="analytics-outline" size={28} color="#D9ECFF" />
              </View>
            </View>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaChip}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#FFFFFF" />
                <Text style={styles.heroMetaText}>{resolveRate}% resolved</Text>
              </View>
              <View style={styles.heroMetaChip}>
                <Ionicons name="warning-outline" size={13} color="#FFFFFF" />
                <Text style={styles.heroMetaText}>
                  {derivedStats.emergencyReports} emergency reports
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Stat cards grid */}
          <View style={styles.statsGrid}>
            <StatCard
              label="Pending"
              value={derivedStats.pending}
              icon="time-outline"
              color={Colors.primary}
              width={statCardWidth}
            />
            <StatCard
              label="On Going"
              value={derivedStats.reviewing}
              icon="sync-outline"
              color="#F5B301"
              width={statCardWidth}
            />
            <StatCard
              label="Resolved"
              value={derivedStats.resolved}
              icon="checkmark-circle-outline"
              color="#35B56A"
              sub={`${resolveRate}%`}
              width={statCardWidth}
            />
            <StatCard
              label="Emergency Reports"
              value={derivedStats.emergencyReports}
              icon="alert-circle-outline"
              color="#F04452"
              width={statCardWidth}
            />
            {derivedStats.totalUsers > 0 && (
              <StatCard
                label="Total Users"
                value={derivedStats.totalUsers}
                icon="people-outline"
                color="#7C3AED"
                width={statCardWidth}
              />
            )}
            {derivedStats.verifiedUsers > 0 && (
              <StatCard
                label="Verified"
                value={derivedStats.verifiedUsers}
                icon="shield-checkmark-outline"
                color="#0891B2"
                width={statCardWidth}
              />
            )}
          </View>

          {/* Status breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status Breakdown</Text>
            <View style={styles.chartCard}>
              <BarChart data={statusBreakdown} compact={compact} />
            </View>
          </View>

          {/* Category breakdown */}
          {categoryBreakdown.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Incident Categories</Text>
              <View style={styles.chartCard}>
                <BarChart data={categoryBreakdown} compact={compact} />
              </View>
            </View>
          )}

          {/* Resolution rate gauge */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resolution Rate</Text>
            <View style={styles.gaugeCard}>
              <View style={styles.gaugeTrack}>
                <View
                  style={[
                    styles.gaugeFill,
                    { width: `${resolveRate}%` },
                  ]}
                />
              </View>
              <View style={styles.gaugeLabels}>
                <Text style={styles.gaugePct}>{resolveRate}%</Text>
                <Text style={styles.gaugeDesc}>
                  {derivedStats.resolved} of {derivedStats.totalIncidents} reports resolved
                </Text>
              </View>

              <View style={styles.gaugeLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#35B56A" }]} />
                  <Text style={styles.legendText}>Resolved ({derivedStats.resolved})</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#E6EDF5" }]} />
                  <Text style={styles.legendText}>
                    Remaining ({derivedStats.totalIncidents - derivedStats.resolved})
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(horizontalPadding: number, statGap: number) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#EEF3F8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 880,
    alignSelf: "center",
    paddingHorizontal: horizontalPadding,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAF2",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...Typography.modalTitle,
    color: "#0E2B4D",
  },
  headerSub: {
    ...Typography.caption,
    color: "#6B7A8D",
    marginTop: 1,
  },
  headerBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DDEEFF",
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    ...Typography.bodyStrong,
    color: "#6B7A8D",
  },
  errorText: {
    ...Typography.bodyStrong,
    color: "#F04452",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryBtn: {
    backgroundColor: Colors.actionPrimary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  content: {
    width: "100%",
    maxWidth: 880,
    alignSelf: "center",
    paddingHorizontal: horizontalPadding,
    paddingTop: 4,
    gap: 20,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  heroLabel: {
    ...Typography.label,
    color: "#D9ECFF",
    marginBottom: 4,
  },
  heroValue: {
    ...Typography.display,
    color: "#FFFFFF",
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroMetaRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  heroMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroMetaText: {
    ...Typography.captionStrong,
    color: "#FFFFFF",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: statGap,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
    color: "#213547",
    textTransform: "uppercase",
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EDF5",
    padding: 16,
  },
  gaugeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EDF5",
    padding: 18,
    gap: 14,
  },
  gaugeTrack: {
    height: 14,
    backgroundColor: "#EEF3F8",
    borderRadius: 999,
    overflow: "hidden",
  },
  gaugeFill: {
    height: "100%",
    backgroundColor: "#35B56A",
    borderRadius: 999,
    minWidth: 4,
  },
  gaugeLabels: {
    gap: 4,
  },
  gaugePct: {
    ...Typography.metric,
    color: "#35B56A",
  },
  gaugeDesc: {
    ...Typography.bodySmall,
    color: "#6B7A8D",
  },
  gaugeLegend: {
    flexDirection: "row",
    gap: 18,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...Typography.captionStrong,
    color: "#6B7A8D",
  },
  });
}

const statStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 4,
    flexGrow: 0,
    flexShrink: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  value: {
    ...Typography.metric,
  },
  label: {
    ...Typography.captionStrong,
    color: "#6B7A8D",
  },
  sub: {
    ...Typography.micro,
    color: "#9AA4B2",
  },
});

const chartStyles = StyleSheet.create({
  container: {
    gap: 12,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  barLabel: {
    ...Typography.captionStrong,
    width: 90,
    color: "#5B6B7A",
  },
  barLabelCompact: {
    width: 62,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: "#EEF3F8",
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    minWidth: 4,
  },
  barValue: {
    ...Typography.label,
    width: 32,
    textAlign: "right",
  },
});
