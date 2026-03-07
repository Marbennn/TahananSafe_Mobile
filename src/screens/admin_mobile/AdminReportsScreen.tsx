// src/screens/admin_mobile/AdminReportsScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../theme/colors";
import { fetchAdminIncidents, AdminIncident } from "../../api/admin";

type FilterKey = "All" | "Pending" | "On Going" | "Resolved" | "High Risk";

type Props = {
  onBack: () => void;
  onOpenReportDetail: (reportId: string) => void;
};

function getRiskColor(level?: string) {
  const l = String(level || "").toLowerCase();
  if (l === "high") return "#F04452";
  if (l === "moderate" || l === "medium") return "#F5B301";
  return "#35B56A";
}

function getRiskLabel(incident: AdminIncident): string {
  if (incident.ai_risk_level) {
    const r = incident.ai_risk_level.toLowerCase();
    if (r.includes("high")) return "High";
    if (r.includes("mod")) return "Moderate";
    return "Low";
  }
  if (incident.mode === "emergency") return "High";
  return "Low";
}

function getStatusLabel(status?: string): string {
  switch (String(status || "").toLowerCase()) {
    case "submitted": return "Pending";
    case "reviewing": return "On Going";
    case "resolved": return "Resolved";
    case "cancelled": return "Cancelled";
    default: return "Pending";
  }
}

function getStatusColor(status?: string): string {
  switch (String(status || "").toLowerCase()) {
    case "reviewing": return "#F5B301";
    case "resolved": return "#35B56A";
    case "cancelled": return "#9AA4B2";
    default: return Colors.primary;
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

function getUserName(
  user: AdminIncident["user"]
): string {
  if (!user) return "Unknown";
  if (typeof user === "string") return `User #${user.slice(-5)}`;
  const first = user.firstName || "";
  const last = user.lastName || "";
  if (first || last) return `${first} ${last}`.trim();
  return user.email || `User #${user._id.slice(-5)}`;
}

const FILTERS: FilterKey[] = ["All", "Pending", "On Going", "Resolved", "High Risk"];

export default function AdminReportsScreen({ onBack, onOpenReportDetail }: Props) {
  const insets = useSafeAreaInsets();

  const [incidents, setIncidents] = useState<AdminIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("All");
  const [search, setSearch] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const data = await fetchAdminIncidents(ctrl.signal);
      setIncidents(data);
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
    return () => { abortRef.current?.abort(); };
  }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

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

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          (i.incidentType || "").toLowerCase().includes(q) ||
          (i.details || "").toLowerCase().includes(q) ||
          getUserName(i.user).toLowerCase().includes(q) ||
          (i.locationStr || "").toLowerCase().includes(q) ||
          i._id.toLowerCase().includes(q)
      );
    }

    return list;
  }, [incidents, filter, search]);

  const counts = useMemo(() => ({
    all: incidents.length,
    pending: incidents.filter((i) => !i.status || i.status === "submitted").length,
    ongoing: incidents.filter((i) => i.status === "reviewing").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
    high: incidents.filter((i) => getRiskLabel(i) === "High").length,
  }), [incidents]);

  function getFilterCount(f: FilterKey): number {
    if (f === "All") return counts.all;
    if (f === "Pending") return counts.pending;
    if (f === "On Going") return counts.ongoing;
    if (f === "Resolved") return counts.resolved;
    if (f === "High Risk") return counts.high;
    return 0;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF3F8" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>All Reports</Text>
          <Text style={styles.headerSub}>{counts.all} total incidents</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="document-text" size={16} color={Colors.primary} />
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9AA4B2" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search reports..."
          placeholderTextColor="#9AA4B2"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#9AA4B2" />
          </Pressable>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={styles.filtersScroll}
      >
        {FILTERS.map((f) => {
          const active = filter === f;
          const count = getFilterCount(f);
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f}
              </Text>
              <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : error ? (
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
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="folder-open-outline" size={52} color="#C5D2E0" />
              <Text style={styles.emptyTitle}>No reports found</Text>
              <Text style={styles.emptyText}>
                {search ? "Try a different search." : "No reports match this filter."}
              </Text>
            </View>
          ) : (
            filtered.map((item) => {
              const riskLabel = getRiskLabel(item);
              const riskColor = getRiskColor(riskLabel);
              const statusLabel = getStatusLabel(item.status);
              const statusColor = getStatusColor(item.status);
              const userName = getUserName(item.user);
              const incType =
                item.ai_incident_type || item.incidentType || (item.mode === "emergency" ? "Emergency" : "Complaint");

              return (
                <Pressable
                  key={item._id}
                  style={({ pressed }) => [
                    styles.card,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => onOpenReportDetail(item._id)}
                >
                  <View style={[styles.riskBar, { backgroundColor: riskColor }]} />

                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {incType}
                      </Text>
                      <View style={[styles.riskPill, { backgroundColor: `${riskColor}18` }]}>
                        <Text style={[styles.riskPillText, { color: riskColor }]}>
                          {riskLabel}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.cardDetail} numberOfLines={2}>
                      {item.details || "No details provided."}
                    </Text>

                    <View style={styles.cardMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="person-outline" size={12} color="#8899AA" />
                        <Text style={styles.metaText}>{userName}</Text>
                      </View>
                      {item.locationStr ? (
                        <View style={styles.metaItem}>
                          <Ionicons name="location-outline" size={12} color="#8899AA" />
                          <Text style={styles.metaText} numberOfLines={1}>
                            {item.locationStr}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.cardBottomRow}>
                      <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                      <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                        <Text style={[styles.statusPillText, { color: statusColor }]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#EEF3F8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
    backgroundColor: "#EEF3F8",
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
    fontSize: 20,
    fontWeight: "800",
    color: "#0E2B4D",
  },
  headerSub: {
    fontSize: 12,
    color: "#6B7A8D",
    fontWeight: "500",
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3EAF2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E2E3E",
    padding: 0,
  },
  filtersScroll: {
    flexGrow: 0,
    marginBottom: 14,
  },
  filtersRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAF2",
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5B6B7A",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  chipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EEF3F8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  chipBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#5B6B7A",
  },
  chipBadgeTextActive: {
    color: "#FFFFFF",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7A8D",
    fontWeight: "600",
  },
  errorText: {
    fontSize: 14,
    color: "#F04452",
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
    paddingTop: 4,
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#5B6B7A",
  },
  emptyText: {
    fontSize: 13,
    color: "#9AA4B2",
    textAlign: "center",
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EDF5",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    paddingRight: 14,
    gap: 12,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  riskBar: {
    width: 4,
    alignSelf: "stretch",
  },
  cardBody: {
    flex: 1,
    paddingVertical: 14,
    gap: 5,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "800",
    color: "#1E2E3E",
  },
  riskPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  riskPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  cardDetail: {
    fontSize: 12.5,
    color: "#657586",
    lineHeight: 17,
  },
  cardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "60%",
  },
  metaText: {
    fontSize: 11.5,
    color: "#8899AA",
    fontWeight: "500",
    flexShrink: 1,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  cardDate: {
    fontSize: 11.5,
    color: "#9AA4B2",
    fontWeight: "500",
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
});
