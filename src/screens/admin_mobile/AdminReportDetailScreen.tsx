// src/screens/admin_mobile/AdminReportDetailScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
  AdminIncident,
} from "../../api/admin";
import { apiUrl } from "../../config/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  reportId: string;
  onBack: () => void;
};

type StatusKey = "submitted" | "reviewing" | "resolved" | "cancelled";

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIMARY = String((Colors as any).primary ?? "#1E63D0");

const STATUS_STEPS: { key: StatusKey; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "submitted",  label: "Pending",  icon: "time-outline"          },
  { key: "reviewing",  label: "On Going", icon: "sync-outline"           },
  { key: "resolved",   label: "Resolved", icon: "checkmark-circle-outline" },
];

const STATUS_COLORS: Record<string, string> = {
  submitted: PRIMARY,
  reviewing: "#F5B301",
  resolved:  "#35B56A",
  cancelled: "#9AA4B2",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStatusColor(status?: string) {
  return STATUS_COLORS[String(status || "").toLowerCase()] ?? PRIMARY;
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

function getRiskColor(level?: string): string {
  const l = String(level || "").toLowerCase();
  if (l.includes("high")) return "#F04452";
  if (l.includes("mod"))  return "#F5B301";
  return "#35B56A";
}

function getRiskLabel(incident: AdminIncident): string {
  if (incident.ai_risk_level) {
    const r = incident.ai_risk_level.toLowerCase();
    if (r.includes("high")) return "High";
    if (r.includes("mod"))  return "Moderate";
    return "Low";
  }
  return incident.mode === "emergency" ? "High" : "Low";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-PH", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  } catch { return dateStr; }
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function buildPhotoUrl(_reportId: string, photo: any): string | null {
  if (!photo) return null;
  if (typeof photo === "string") {
    if (photo.startsWith("http")) return photo;
    return apiUrl(`/api/web/v1/evidence/id/${encodeURIComponent(photo)}`);
  }
  const fileId = photo?.fileId?.$oid ?? photo?.fileId;
  if (fileId) return apiUrl(`/api/web/v1/evidence/id/${encodeURIComponent(String(fileId))}`);
  if (photo?.url) {
    const u = String(photo.url);
    return u.startsWith("/") ? apiUrl(u) : u;
  }
  return null;
}

function getUserName(user: AdminIncident["user"]): string {
  if (!user) return "Unknown";
  if (typeof user === "string") return `User ···${user.slice(-6).toUpperCase()}`;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email || "Unknown";
}

function getUserEmail(user: AdminIncident["user"]): string | null {
  if (!user || typeof user === "string") return null;
  return user.email || null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHeader({
  icon,
  title,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={14} color={PRIMARY} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
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
        <Ionicons name={icon} size={15} color={PRIMARY} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AdminReportDetailScreen({ reportId, onBack }: Props) {
  const insets = useSafeAreaInsets();

  const [incident,         setIncident]         = useState<AdminIncident | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [error,            setError]            = useState<string | null>(null);

  const abortRef  = useRef<AbortController | null>(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;

  const load = useCallback(async (isRefresh = false) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminIncidentById(reportId, ctrl.signal);
      setIncident(data);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      ]).start();
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || "Failed to load report.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [reportId, fadeAnim, slideAnim]);

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  const shortId       = reportId.slice(-6).toUpperCase();
  const riskLabel     = incident ? getRiskLabel(incident) : null;
  const riskColor     = riskLabel ? getRiskColor(riskLabel) : "#9AA4B2";
  const statusColor   = incident ? getStatusColor(incident.status) : "#9AA4B2";
  const statusLabel   = incident ? getStatusLabel(incident.status) : "—";
  const currentStep   = STATUS_STEPS.findIndex(step => step.key === (incident?.status ?? "submitted"));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#EAF3FF" />

      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#EAF3FF", "#F5FAFE"]}
        style={[styles.header, { paddingTop: Math.max(insets.top - 44, 8) }]}
      >
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={PRIMARY} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Report #{shortId}</Text>
          {incident && (
            <View style={styles.headerMeta}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.headerStatus, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          )}
        </View>

        {riskLabel && (
          <View style={[styles.riskPill, { backgroundColor: `${riskColor}18`, borderColor: `${riskColor}35` }]}>
            <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
            <Text style={[styles.riskPillText, { color: riskColor }]}>{riskLabel} Risk</Text>
          </View>
        )}
      </LinearGradient>

      {/* ─── Loading ───────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading report...</Text>
        </View>

      /* ─── Error ──────────────────────────────────────────────────────────── */
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={52} color="#F04452" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>

      /* ─── Content ────────────────────────────────────────────────────────── */
      ) : incident ? (
        <>
          <Animated.ScrollView
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(true); }}
                tintColor={PRIMARY}
              />
            }
          >
            {/* ── Hero card ──────────────────────────────────────────────── */}
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={[
                  styles.modeChip,
                  incident.mode === "emergency" ? styles.modeEmergency : styles.modeComplain,
                ]}>
                  <Ionicons
                    name={incident.mode === "emergency" ? "flash" : "document-text"}
                    size={12}
                    color={incident.mode === "emergency" ? "#EF4444" : PRIMARY}
                  />
                  <Text style={[
                    styles.modeChipText,
                    { color: incident.mode === "emergency" ? "#EF4444" : PRIMARY },
                  ]}>
                    {incident.mode === "emergency" ? "Emergency" : "Complaint"}
                  </Text>
                </View>

                <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                  <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>

              <Text style={styles.heroType}>
                {incident.ai_incident_type || incident.incidentType || "Incident Report"}
              </Text>
            </View>

            {/* ── Case Progress ──────────────────────────────────────────── */}
            <View style={styles.section}>
              <SectionHeader icon="flag-outline" title="Case Progress" />
              <View style={styles.stepperCard}>
                {STATUS_STEPS.map((step, idx) => {
                  const done   = idx <= currentStep;
                  const active = idx === currentStep;
                  const color  = done ? getStatusColor(step.key) : "#D0DAEA";
                  return (
                    <React.Fragment key={step.key}>
                      <View style={styles.stepItem}>
                        <View style={[
                          styles.stepCircle,
                          { backgroundColor: done ? color : "#F1F5F9", borderColor: color },
                          active && { shadowColor: color, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
                        ]}>
                          {done ? (
                            <Ionicons
                              name={active ? step.icon : "checkmark"}
                              size={14}
                              color="#FFFFFF"
                            />
                          ) : (
                            <View style={styles.stepDot} />
                          )}
                        </View>
                        <Text style={[styles.stepLabel, done && { color, fontWeight: "700" }]}>
                          {step.label}
                        </Text>
                      </View>
                      {idx < STATUS_STEPS.length - 1 && (
                        <View style={[
                          styles.stepLine,
                          { backgroundColor: idx < currentStep ? "#35B56A" : "#D0DAEA" },
                        ]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>

            {/* ── Reported By ────────────────────────────────────────────── */}
            <View style={styles.section}>
              <SectionHeader icon="person-outline" title="Reported By" />
              <View style={styles.reporterCard}>
                <View style={styles.reporterAvatar}>
                  <Ionicons name="person" size={22} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reporterName}>{getUserName(incident.user)}</Text>
                  {getUserEmail(incident.user) ? (
                    <Text style={styles.reporterEmail}>{getUserEmail(incident.user)}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* ── Incident Details ───────────────────────────────────────── */}
            <View style={styles.section}>
              <SectionHeader icon="alert-circle-outline" title="Incident Details" />

              <View style={styles.detailsCard}>
                {/* Description — most prominent, sits at the top */}
                {incident.details ? (
                  <View style={styles.descBlock}>
                    <Text style={styles.descLabel}>DESCRIPTION</Text>
                    <Text style={styles.descText}>{incident.details}</Text>
                  </View>
                ) : null}

                {/* Info rows */}
                <View style={styles.infoRow}>
                  <View style={styles.infoIconWrap}>
                    <Ionicons name="calendar-outline" size={15} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Date &amp; Time</Text>
                    <Text style={styles.infoValue}>
                      {incident.dateStr || formatDate(incident.createdAt)}
                      {(incident.timeStr || formatTime(incident.createdAt))
                        ? "  ·  " + (incident.timeStr || formatTime(incident.createdAt))
                        : ""}
                    </Text>
                  </View>
                </View>
                <InfoRow icon="location-outline" label="Location" value={incident.locationStr || "—"} />
              </View>
            </View>

            {/* ── People Involved ────────────────────────────────────────── */}
            {(incident.offenderName || incident.witnessName) ? (
              <View style={styles.section}>
                <SectionHeader icon="people-outline" title="People Involved" />
                <View style={styles.card}>
                  <InfoRow icon="person-remove-outline"      label="Offender"     value={incident.offenderName} />
                  <InfoRow icon="eye-outline"                label="Witness"      value={incident.witnessName} />
                  <InfoRow icon="information-circle-outline" label="Witness Type" value={incident.witnessType} />
                </View>
              </View>
            ) : null}

            {/* ── AI Analysis ────────────────────────────────────────────── */}
            {(incident.ai_risk_level || incident.ai_priority_level || incident.ai_confidence_score !== undefined) ? (
              <View style={styles.section}>
                <SectionHeader icon="bulb-outline" title="AI Analysis" />
                <LinearGradient colors={["#EEF6FF", "#F5FAFE"]} style={styles.aiCard}>

                  {/* Chip row */}
                  <View style={styles.aiChipsRow}>
                    {incident.ai_risk_level ? (
                      <View style={[styles.aiChip, {
                        backgroundColor: `${getRiskColor(incident.ai_risk_level)}10`,
                        borderColor: `${getRiskColor(incident.ai_risk_level)}30`,
                      }]}>
                        <Ionicons name="warning-outline" size={16} color={getRiskColor(incident.ai_risk_level)} />
                        <View>
                          <Text style={styles.aiChipLabel}>Risk Level</Text>
                          <Text style={[styles.aiChipValue, { color: getRiskColor(incident.ai_risk_level) }]}>
                            {incident.ai_risk_level}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {incident.ai_priority_level ? (
                      <View style={[styles.aiChip, { backgroundColor: "#EEF6FF", borderColor: `${PRIMARY}30` }]}>
                        <Ionicons name="flag-outline" size={16} color={PRIMARY} />
                        <View>
                          <Text style={styles.aiChipLabel}>Priority</Text>
                          <Text style={[styles.aiChipValue, { color: PRIMARY }]}>
                            {incident.ai_priority_level}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Confidence bar */}
                  {incident.ai_confidence_score !== undefined ? (
                    <View style={styles.confidenceWrap}>
                      <View style={styles.confidenceHeader}>
                        <Ionicons name="analytics-outline" size={14} color="#7C3AED" />
                        <Text style={styles.confidenceLabel}>AI Confidence</Text>
                        <Text style={[styles.confidencePct, { color: "#7C3AED" }]}>
                          {Math.round((incident.ai_confidence_score || 0) * 100)}%
                        </Text>
                      </View>
                      <View style={styles.confTrack}>
                        <View style={[
                          styles.confFill,
                          { width: `${Math.round((incident.ai_confidence_score || 0) * 100)}%` as any },
                        ]} />
                      </View>
                    </View>
                  ) : null}

                  {/* Flags */}
                  {(incident.ai_children_involved || incident.ai_weapon_mentioned) ? (
                    <View style={styles.flagsRow}>
                      {incident.ai_children_involved && (
                        <View style={styles.flagChip}>
                          <Ionicons name="people-outline" size={13} color="#F04452" />
                          <Text style={styles.flagText}>Children involved</Text>
                        </View>
                      )}
                      {incident.ai_weapon_mentioned && (
                        <View style={styles.flagChip}>
                          <Ionicons name="alert-outline" size={13} color="#F04452" />
                          <Text style={styles.flagText}>Weapon mentioned</Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                </LinearGradient>
              </View>
            ) : null}

            {/* ── Evidence Photos ────────────────────────────────────────── */}
            {incident.photos && incident.photos.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader icon="image-outline" title={`Evidence Photos · ${incident.photos.length}`} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingVertical: 2 }}
                >
                  {incident.photos.map((photo, idx) => {
                    const uri = buildPhotoUrl(incident._id, photo);
                    if (!uri) return null;
                    return (
                      <View key={idx} style={styles.photoCard}>
                        <Image source={{ uri }} style={styles.photoImg} resizeMode="cover" />
                        <View style={styles.photoNumBadge}>
                          <Text style={styles.photoNum}>{idx + 1}</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {/* ── Timeline ───────────────────────────────────────────────── */}
            <View style={styles.section}>
              <SectionHeader icon="time-outline" title="Timeline" />
              <View style={styles.card}>
                <InfoRow
                  icon="cloud-upload-outline"
                  label="Submitted"
                  value={`${formatDate(incident.createdAt)}${formatTime(incident.createdAt) ? " · " + formatTime(incident.createdAt) : ""}`}
                />
                <InfoRow
                  icon="refresh-outline"
                  label="Last Updated"
                  value={`${formatDate(incident.updatedAt)}${formatTime(incident.updatedAt) ? " · " + formatTime(incident.updatedAt) : ""}`}
                />
              </View>
            </View>
          </Animated.ScrollView>

        </>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: "#F5FAFE" },

  // Header
  header:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  backBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E3EAF2", alignItems: "center", justifyContent: "center" },
  headerTitle:   { fontSize: 18, fontWeight: "800", color: "#0E2B4D" },
  headerMeta:    { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot:     { width: 7, height: 7, borderRadius: 4 },
  headerStatus:  { fontSize: 12, fontWeight: "700" },
  riskPill:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  riskDot:       { width: 7, height: 7, borderRadius: 4 },
  riskPillText:  { fontSize: 12, fontWeight: "700" },

  // States
  centered:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText:   { fontSize: 14, color: "#6B7A8D", fontWeight: "600" },
  errorText:     { fontSize: 14, color: "#F04452", fontWeight: "600", textAlign: "center", paddingHorizontal: 32 },
  retryBtn:      { backgroundColor: PRIMARY, paddingHorizontal: 28, paddingVertical: 11, borderRadius: 12 },
  retryText:     { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

  // Scroll
  content:       { paddingHorizontal: 16, paddingTop: 14, gap: 22 },

  // Hero card
  heroCard:      { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E6EDF5", padding: 16, gap: 10 },
  heroTop:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modeChip:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  modeEmergency: { backgroundColor: "#FEF2F2" },
  modeComplain:  { backgroundColor: "#EEF6FF" },
  modeChipText:  { fontSize: 11, fontWeight: "700" },
  statusPill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText:{ fontSize: 12, fontWeight: "700" },
  heroType:      { fontSize: 16, fontWeight: "800", color: "#0E2B4D", lineHeight: 23 },

  // Section
  section:       { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIconWrap: { width: 24, height: 24, borderRadius: 7, backgroundColor: "#EEF6FF", alignItems: "center", justifyContent: "center" },
  sectionTitle:  { fontSize: 12, fontWeight: "800", color: "#3A5068", letterSpacing: 0.4, textTransform: "uppercase" },

  // Card
  card:          { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E6EDF5", paddingVertical: 6, paddingHorizontal: 16 },

  // InfoRow
  infoRow:       { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
  infoIconWrap:  { width: 28, height: 28, borderRadius: 8, backgroundColor: "#EAF3FF", alignItems: "center", justifyContent: "center", marginTop: 1 },
  infoLabel:     { fontSize: 10, color: "#8899AA", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  infoValue:     { fontSize: 14, color: "#1E2E3E", fontWeight: "600", lineHeight: 20 },
  detailsBlock:  { paddingVertical: 10 },
  detailsText:   { fontSize: 14, color: "#1E2E3E", lineHeight: 22, marginLeft: 38, marginTop: 6 },

  // Stepper
  stepperCard:   { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E6EDF5", flexDirection: "row", alignItems: "center", padding: 20 },
  stepItem:      { flex: 1, alignItems: "center", gap: 7 },
  stepCircle:    { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  stepDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D0DAEA" },
  stepLabel:     { fontSize: 11, fontWeight: "600", color: "#B0BECA", textAlign: "center" },
  stepLine:      { flex: 1, height: 2, marginBottom: 26, maxWidth: 36 },

  // Reporter
  reporterCard:  { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E6EDF5", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  reporterAvatar:{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#EEF6FF", alignItems: "center", justifyContent: "center" },
  reporterName:  { fontSize: 15, fontWeight: "700", color: "#0E2B4D" },
  reporterEmail: { fontSize: 12, color: "#8899AA", fontWeight: "500", marginTop: 2 },

  // AI card
  aiCard:        { borderRadius: 18, borderWidth: 1, borderColor: `${PRIMARY}20`, padding: 16, gap: 14 },
  aiChipsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  aiChip:        { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, flex: 1, minWidth: 120 },
  aiChipLabel:   { fontSize: 10, color: "#8899AA", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  aiChipValue:   { fontSize: 14, fontWeight: "800" },
  confidenceWrap:{ gap: 8 },
  confidenceHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  confidenceLabel:  { flex: 1, fontSize: 13, color: "#3A5068", fontWeight: "600" },
  confidencePct:    { fontSize: 14, fontWeight: "800" },
  confTrack:     { height: 8, backgroundColor: "#E0E7EF", borderRadius: 999, overflow: "hidden" },
  confFill:      { height: 8, borderRadius: 999, backgroundColor: "#7C3AED" },
  flagsRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flagChip:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FEF2F2", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  flagText:      { fontSize: 12, color: "#F04452", fontWeight: "700" },

  // Photos
  photoCard:     { position: "relative" },
  photoImg:      { width: 160, height: 140, borderRadius: 16, backgroundColor: "#E6EDF5" },
  photoNumBadge: { position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0,0,0,0.52)", width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  photoNum:      { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },


  // Incident details — unified single card
  detailsCard:    { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E6EDF5", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  descBlock:      { gap: 6, paddingBottom: 14 },
  descLabel:      { fontSize: 10, fontWeight: "800", color: PRIMARY, letterSpacing: 0.8 },
  descText:       { fontSize: 15, color: "#0E2B4D", lineHeight: 24, fontWeight: "500" },
});
