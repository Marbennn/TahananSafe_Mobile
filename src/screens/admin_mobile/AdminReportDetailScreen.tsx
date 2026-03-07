// src/screens/admin_mobile/AdminReportDetailScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../theme/colors";
import {
  fetchAdminIncidentById,
  updateIncidentStatus,
  AdminIncident,
} from "../../api/admin";
import { apiUrl } from "../../config/api";

type Props = {
  reportId: string;
  onBack: () => void;
};

type StatusKey = "submitted" | "reviewing" | "resolved" | "cancelled";

const STATUS_STEPS: StatusKey[] = ["submitted", "reviewing", "resolved"];

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

function getRiskColor(level?: string): string {
  const l = String(level || "").toLowerCase();
  if (l.includes("high")) return "#F04452";
  if (l.includes("mod")) return "#F5B301";
  return "#35B56A";
}

function getRiskLabel(incident: AdminIncident): string {
  if (incident.ai_risk_level) {
    const r = incident.ai_risk_level.toLowerCase();
    if (r.includes("high")) return "High";
    if (r.includes("mod")) return "Moderate";
    return "Low";
  }
  return incident.mode === "emergency" ? "High" : "Low";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-PH", {
      weekday: "short",
      month: "long",
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
    return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function buildPhotoUrl(reportId: string, photo: any): string | null {
  if (!photo) return null;
  if (typeof photo === "string") {
    if (photo.startsWith("http")) return photo;
    return apiUrl(`/api/web/v1/evidence/id/${encodeURIComponent(photo)}`);
  }
  const fileId = photo?.fileId?.$oid ?? photo?.fileId;
  if (fileId) {
    return apiUrl(`/api/web/v1/evidence/id/${encodeURIComponent(String(fileId))}`);
  }
  if (photo?.url) {
    const u = String(photo.url);
    if (u.startsWith("/")) return apiUrl(u);
    return u;
  }
  return null;
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={15} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function AdminReportDetailScreen({ reportId, onBack }: Props) {
  const insets = useSafeAreaInsets();

  const [incident, setIncident] = useState<AdminIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      if (!isRefresh) setLoading(true);
      setError(null);

      try {
        const data = await fetchAdminIncidentById(reportId, ctrl.signal);
        setIncident(data);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e?.message || "Failed to load report.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [reportId]
  );

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  const handleStatusChange = useCallback(
    async (newStatus: StatusKey) => {
      if (!incident) return;

      const label = getStatusLabel(newStatus);
      Alert.alert(
        "Update Status",
        `Mark this report as "${label}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            style: "default",
            onPress: async () => {
              setUpdating(true);
              try {
                await updateIncidentStatus(incident._id, newStatus);
                setIncident((prev) =>
                  prev ? { ...prev, status: newStatus } : prev
                );
                Alert.alert("Updated", `Status changed to ${label}.`);
              } catch (e: any) {
                Alert.alert("Error", e?.message || "Failed to update status.");
              } finally {
                setUpdating(false);
              }
            },
          },
        ]
      );
    },
    [incident]
  );

  const shortId = reportId.slice(-6).toUpperCase();
  const riskLabel = incident ? getRiskLabel(incident) : null;
  const riskColor = riskLabel ? getRiskColor(riskLabel) : "#9AA4B2";
  const statusLabel = incident ? getStatusLabel(incident.status) : "—";
  const statusColor = incident ? getStatusColor(incident.status) : "#9AA4B2";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF3F8" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Report #{shortId}</Text>
          {incident && (
            <View style={styles.headerStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.headerStatusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          )}
        </View>
        {riskLabel && (
          <View style={[styles.riskBadge, { backgroundColor: `${riskColor}18` }]}>
            <Text style={[styles.riskBadgeText, { color: riskColor }]}>
              {riskLabel}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading report...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#F04452" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : incident ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={Colors.primary}
            />
          }
        >
          {/* Status progress */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status Progress</Text>
            <View style={styles.statusSteps}>
              {STATUS_STEPS.map((step, idx) => {
                const stepIdx = STATUS_STEPS.indexOf(
                  (incident.status as StatusKey) || "submitted"
                );
                const done = idx <= stepIdx;
                const label = getStatusLabel(step);
                const color = done ? getStatusColor(step) : "#D0DAEA";
                return (
                  <React.Fragment key={step}>
                    <View style={styles.stepWrap}>
                      <View
                        style={[
                          styles.stepCircle,
                          { backgroundColor: done ? color : "#EEF3F8", borderColor: color },
                        ]}
                      >
                        {done && (
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        )}
                      </View>
                      <Text style={[styles.stepLabel, done && { color }]}>
                        {label}
                      </Text>
                    </View>
                    {idx < STATUS_STEPS.length - 1 && (
                      <View
                        style={[
                          styles.stepLine,
                          { backgroundColor: idx < stepIdx ? "#35B56A" : "#D0DAEA" },
                        ]}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>

          {/* Status update actions */}
          {incident.status !== "resolved" && incident.status !== "cancelled" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Update Status</Text>
              <View style={styles.actionRow}>
                {incident.status !== "reviewing" && (
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: "#F5B30120" }]}
                    onPress={() => handleStatusChange("reviewing")}
                    disabled={updating}
                  >
                    <Ionicons name="sync-outline" size={18} color="#F5B301" />
                    <Text style={[styles.actionBtnText, { color: "#F5B301" }]}>
                      Mark On Going
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "#35B56A20" }]}
                  onPress={() => handleStatusChange("resolved")}
                  disabled={updating}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#35B56A" />
                  <Text style={[styles.actionBtnText, { color: "#35B56A" }]}>
                    Mark Resolved
                  </Text>
                </Pressable>
              </View>
              {updating && (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />
              )}
            </View>
          )}

          {/* Incident details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Incident Details</Text>
            <View style={styles.card}>
              <InfoRow
                icon="alert-circle-outline"
                label="Type"
                value={incident.ai_incident_type || incident.incidentType || (incident.mode === "emergency" ? "Emergency" : "Complaint")}
              />
              <InfoRow
                icon="pulse-outline"
                label="Mode"
                value={incident.mode === "emergency" ? "Emergency" : "Complaint"}
              />
              <InfoRow
                icon="calendar-outline"
                label="Date"
                value={incident.dateStr || formatDate(incident.createdAt)}
              />
              <InfoRow
                icon="time-outline"
                label="Time"
                value={incident.timeStr || formatTime(incident.createdAt)}
              />
              <InfoRow
                icon="location-outline"
                label="Location"
                value={incident.locationStr}
              />

              {incident.details ? (
                <View style={styles.detailsBlock}>
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconWrap}>
                      <Ionicons name="document-text-outline" size={15} color={Colors.primary} />
                    </View>
                    <Text style={styles.infoLabel}>Details</Text>
                  </View>
                  <Text style={styles.detailsText}>{incident.details}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* People involved */}
          {(incident.offenderName || incident.witnessName) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>People Involved</Text>
              <View style={styles.card}>
                <InfoRow
                  icon="person-remove-outline"
                  label="Offender"
                  value={incident.offenderName}
                />
                <InfoRow
                  icon="eye-outline"
                  label="Witness"
                  value={incident.witnessName}
                />
                <InfoRow
                  icon="information-circle-outline"
                  label="Witness Type"
                  value={incident.witnessType}
                />
              </View>
            </View>
          ) : null}

          {/* AI Analysis */}
          {(incident.ai_risk_level || incident.ai_priority_level || incident.ai_confidence_score) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>AI Analysis</Text>
              <LinearGradient
                colors={["#0E5AA710", "#07519C08"]}
                style={styles.aiCard}
              >
                <View style={styles.aiRow}>
                  {incident.ai_risk_level ? (
                    <View style={styles.aiChip}>
                      <Ionicons name="warning-outline" size={14} color={riskColor} />
                      <View>
                        <Text style={styles.aiChipLabel}>Risk Level</Text>
                        <Text style={[styles.aiChipValue, { color: riskColor }]}>
                          {incident.ai_risk_level}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {incident.ai_priority_level ? (
                    <View style={styles.aiChip}>
                      <Ionicons name="flag-outline" size={14} color={Colors.primary} />
                      <View>
                        <Text style={styles.aiChipLabel}>Priority</Text>
                        <Text style={[styles.aiChipValue, { color: Colors.primary }]}>
                          {incident.ai_priority_level}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {incident.ai_confidence_score !== undefined ? (
                    <View style={styles.aiChip}>
                      <Ionicons name="analytics-outline" size={14} color="#7C3AED" />
                      <View>
                        <Text style={styles.aiChipLabel}>Confidence</Text>
                        <Text style={[styles.aiChipValue, { color: "#7C3AED" }]}>
                          {Math.round((incident.ai_confidence_score || 0) * 100)}%
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                <View style={styles.aiFlags}>
                  {incident.ai_children_involved && (
                    <View style={styles.aiFlag}>
                      <Ionicons name="people-outline" size={13} color="#F04452" />
                      <Text style={styles.aiFlagText}>Children involved</Text>
                    </View>
                  )}
                  {incident.ai_weapon_mentioned && (
                    <View style={styles.aiFlag}>
                      <Ionicons name="alert-outline" size={13} color="#F04452" />
                      <Text style={styles.aiFlagText}>Weapon mentioned</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </View>
          ) : null}

          {/* Photos */}
          {incident.photos && incident.photos.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Evidence Photos ({incident.photos.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {incident.photos.map((photo, idx) => {
                    const uri = buildPhotoUrl(incident._id, photo);
                    if (!uri) return null;
                    return (
                      <View key={idx} style={styles.photoWrap}>
                        <Image
                          source={{ uri }}
                          style={styles.photo}
                          resizeMode="cover"
                        />
                        <Text style={styles.photoLabel}>Photo {idx + 1}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {/* Timestamps */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timestamps</Text>
            <View style={styles.card}>
              <InfoRow
                icon="cloud-upload-outline"
                label="Submitted"
                value={formatDate(incident.createdAt) + (formatTime(incident.createdAt) ? " at " + formatTime(incident.createdAt) : "")}
              />
              <InfoRow
                icon="refresh-outline"
                label="Last Updated"
                value={formatDate(incident.updatedAt) + (formatTime(incident.updatedAt) ? " at " + formatTime(incident.updatedAt) : "")}
              />
            </View>
          </View>
        </ScrollView>
      ) : null}
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
    fontSize: 18,
    fontWeight: "800",
    color: "#0E2B4D",
  },
  headerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  headerStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: "800",
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
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#213547",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EDF5",
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F9",
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EAF3FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: "#8899AA",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: "#1E2E3E",
    fontWeight: "600",
    lineHeight: 20,
  },
  detailsBlock: {
    paddingVertical: 10,
  },
  detailsText: {
    fontSize: 14,
    color: "#1E2E3E",
    lineHeight: 22,
    marginLeft: 38,
    marginTop: 6,
  },
  statusSteps: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EDF5",
    padding: 18,
  },
  stepWrap: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B0BECA",
    textAlign: "center",
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginBottom: 20,
    maxWidth: 40,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  aiCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: `${Colors.primary}20`,
    padding: 16,
    gap: 12,
  },
  aiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 100,
  },
  aiChipLabel: {
    fontSize: 10,
    color: "#8899AA",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  aiChipValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  aiFlags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  aiFlag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F0444220",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  aiFlagText: {
    fontSize: 12,
    color: "#F04452",
    fontWeight: "700",
  },
  photoWrap: {
    alignItems: "center",
    gap: 6,
  },
  photo: {
    width: 140,
    height: 140,
    borderRadius: 14,
    backgroundColor: "#E6EDF5",
  },
  photoLabel: {
    fontSize: 11,
    color: "#8899AA",
    fontWeight: "600",
  },
});
