// src/screens/admin_mobile/AdminReportDetailScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
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
import { Colors, useColors } from "../../theme/colors";
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

// ─── Constants (uniform with ReportDetailScreen) ─────────────────────────────
const PRIMARY = String((Colors as any).primary ?? "#0B5AA7");
const BG = "#FFFFFF";
const SURFACE = "#FFFFFF";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";
const TEXT_MUTED = "#6E7D90";
const { width: SCREEN_W } = Dimensions.get("window");

const gradColors = (Colors.gradient ??
  ([PRIMARY, String((Colors as any).primaryDark ?? "#021C36")] as const)) as readonly [
  string,
  string,
  ...string[]
];

const STATUS_STEPS: { key: StatusKey; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "submitted",  label: "Pending",   icon: "time-outline"             },
  { key: "reviewing",  label: "On Going",  icon: "sync-outline"             },
  { key: "resolved",   label: "Resolved",  icon: "checkmark-circle-outline" },
  { key: "cancelled",  label: "Cancelled", icon: "close-circle-outline"     },
];

const STATUS_COLORS: Record<string, string> = {
  submitted: "#3B82F6",
  reviewing: "#F59E0B",
  resolved:  "#22C55E",
  cancelled: "#9AA4B2",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStatusColor(status?: string) {
  return STATUS_COLORS[String(status || "").toLowerCase()] ?? "#3B82F6";
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

function statusIconName(status?: string) {
  const s = String(status || "").toLowerCase();
  if (s === "resolved") return "checkmark-circle-outline" as const;
  if (s === "cancelled") return "close-circle-outline" as const;
  if (s === "reviewing") return "sync-circle-outline" as const;
  return "time-outline" as const;
}

function getRiskColor(level?: string): string {
  const l = String(level || "").toLowerCase();
  if (l.includes("high")) return "#EF4444";
  if (l.includes("mod"))  return "#F59E0B";
  return "#22C55E";
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

function getInitials(user: AdminIncident["user"]): string {
  if (!user || typeof user === "string") return "?";
  const f = user.firstName?.[0] ?? "";
  const l = user.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AdminReportDetailScreen({ reportId, onBack }: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();

  const [incident,   setIncident]   = useState<AdminIncident | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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
  const sIcon         = incident ? statusIconName(incident.status) : "time-outline";
  const isCancelled   = String(incident?.status || "").toLowerCase() === "cancelled";
  const currentStep   = isCancelled
    ? STATUS_STEPS.length - 1
    : STATUS_STEPS.findIndex(step => step.key === (incident?.status ?? "submitted"));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} backgroundColor={TC.screenBg} />

      {/* ─── Header (matching ReportDetailScreen heroCard) ──────────── */}
      <View style={[s.heroWrap, { paddingTop: Math.max(insets.top - 44, 6) }]}>
        <View style={s.heroCard}>
          <View style={s.heroHeaderRow}>
            <Pressable
              onPress={onBack}
              hitSlop={12}
              style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.75 }]}
            >
              <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
            </Pressable>

            <Text style={s.heroTitle} numberOfLines={1}>
              Report #{shortId}
            </Text>

            {riskLabel ? (
              <View style={[s.riskBadge, { borderColor: `${riskColor}40` }]}>
                <Ionicons name="shield" size={13} color={riskColor} />
                <Text style={[s.riskBadgeText, { color: riskColor }]}>{riskLabel}</Text>
              </View>
            ) : (
              <View style={{ width: 36, height: 36 }} />
            )}
          </View>

          {incident && (
            <View style={s.heroStatusCenterRow}>
              <View style={[s.statusPill, { borderColor: BORDER, backgroundColor: SURFACE }]}>
                <View style={[s.dot, { backgroundColor: statusColor }]} />
                <Ionicons name={sIcon} size={14} color={statusColor} />
                <Text style={[s.statusPillText, { color: statusColor }]} numberOfLines={1}>
                  {statusLabel.toUpperCase()}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ─── Loading ──────────────────────────────────────────────────── */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={s.loadingText}>Loading report…</Text>
        </View>

      /* ─── Error ────────────────────────────────────────────────────── */
      ) : error ? (
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={44} color="#B91C1C" />
          <Text style={s.errorTitle}>Something went wrong</Text>
          <Text style={s.errorText}>{error}</Text>
          <Pressable
            onPress={() => load()}
            style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.92 }]}
          >
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>

      /* ─── Content ──────────────────────────────────────────────────── */
      ) : incident ? (
        <>
          <Animated.ScrollView
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(true); }}
                tintColor={PRIMARY}
              />
            }
          >
            {/* ── Incident narrative card ──────────────────────── */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeaderRow}>
                <Ionicons name="document-text-outline" size={18} color={TEXT_DARK} />
                <Text style={s.sectionTitle}>
                  {incident.ai_incident_type || incident.incidentType || "Incident Report"}
                </Text>
              </View>

              <View style={s.modeRow}>
                <View style={[
                  s.modeChip,
                  incident.mode === "emergency" ? s.modeEmergency : s.modeComplain,
                ]}>
                  <Ionicons
                    name={incident.mode === "emergency" ? "flash" : "document-text"}
                    size={12}
                    color={incident.mode === "emergency" ? "#EF4444" : PRIMARY}
                  />
                  <Text style={[
                    s.modeChipText,
                    { color: incident.mode === "emergency" ? "#EF4444" : PRIMARY },
                  ]}>
                    {incident.mode === "emergency" ? "Emergency" : "Complaint"}
                  </Text>
                </View>
              </View>

              {incident.details ? (
                <Text style={s.narrativeText}>{incident.details}</Text>
              ) : null}
            </View>

            {/* ── Date / Time (meta grid) ──────────────────────── */}
            <View style={s.metaGrid}>
              <View style={s.metaCard}>
                <View style={s.metaRow}>
                  <Ionicons name="calendar-outline" size={14} color={TEXT_MUTED} />
                  <Text style={s.metaLabel}>Date</Text>
                </View>
                <Text style={s.metaValue}>
                  {incident.dateStr || formatDate(incident.createdAt)}
                </Text>
              </View>

              <View style={s.metaCard}>
                <View style={s.metaRow}>
                  <Ionicons name="time-outline" size={14} color={TEXT_MUTED} />
                  <Text style={s.metaLabel}>Time</Text>
                </View>
                <Text style={s.metaValue}>
                  {incident.timeStr || formatTime(incident.createdAt) || "—"}
                </Text>
              </View>
            </View>

            {/* ── Location ─────────────────────────────────────── */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeaderRow}>
                <Ionicons name="location-outline" size={18} color={TEXT_DARK} />
                <Text style={s.sectionTitle}>Location</Text>
              </View>
              <Text style={s.locationText}>{incident.locationStr || "—"}</Text>
            </View>

            {/* ── Case Progress (stepper) ──────────────────────── */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeaderRow}>
                <Ionicons name="flag-outline" size={18} color={TEXT_DARK} />
                <Text style={s.sectionTitle}>Case Progress</Text>
              </View>
              <View style={s.stepperRow}>
                {STATUS_STEPS.map((step, idx) => {
                  // When cancelled: submitted = done, reviewing/resolved = skipped, cancelled = active
                  const done   = isCancelled
                    ? (step.key === "submitted" || step.key === "cancelled")
                    : idx <= currentStep;
                  const active = isCancelled
                    ? step.key === "cancelled"
                    : idx === currentStep;
                  const skipped = isCancelled && (step.key === "reviewing" || step.key === "resolved");
                  const color  = done ? getStatusColor(step.key) : "#D0DAEA";
                  return (
                    <React.Fragment key={step.key}>
                      <View style={[s.stepItem, skipped && { opacity: 0.35 }]}>
                        <View style={[
                          s.stepCircle,
                          done
                            ? { backgroundColor: color, borderColor: color }
                            : { backgroundColor: "#F8FAFC", borderColor: "#D0DAEA" },
                          active && { shadowColor: color, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
                        ]}>
                          {done ? (
                            <Ionicons
                              name={active ? step.icon : "checkmark"}
                              size={14}
                              color="#FFFFFF"
                            />
                          ) : (
                            <View style={s.stepDotInner} />
                          )}
                        </View>
                        <Text style={[
                          s.stepLabel,
                          done && { color: TEXT_DARK, fontWeight: "700" },
                          active && { color, fontWeight: "900" },
                        ]}>
                          {step.label}
                        </Text>
                      </View>
                      {idx < STATUS_STEPS.length - 1 && (
                        <View style={s.stepConnector}>
                          <View style={[
                            s.stepLine,
                            { backgroundColor: isCancelled
                              ? "#E2E8F0"
                              : idx < currentStep ? "#22C55E" : "#E2E8F0" },
                          ]} />
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>

            {/* ── Reported By ──────────────────────────────────── */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeaderRow}>
                <Ionicons name="person-circle-outline" size={18} color={TEXT_DARK} />
                <Text style={s.sectionTitle}>Reported By</Text>
              </View>
              <View style={s.witnessRow}>
                <View style={s.reporterBadge}>
                  <Text style={s.reporterInitials}>{getInitials(incident.user)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.witnessName} numberOfLines={1}>{getUserName(incident.user)}</Text>
                  {getUserEmail(incident.user) ? (
                    <Text style={s.witnessRole} numberOfLines={1}>{getUserEmail(incident.user)}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* ── People Involved ──────────────────────────────── */}
            {(incident.offenderName || incident.witnessName) ? (
              <View style={s.sectionCard}>
                <View style={s.sectionHeaderRow}>
                  <Ionicons name="people-outline" size={18} color={TEXT_DARK} />
                  <Text style={s.sectionTitle}>People Involved</Text>
                </View>
                {incident.offenderName ? (
                  <View style={s.witnessRow}>
                    <View style={s.witnessBadge}>
                      <Ionicons name="person-remove-outline" size={14} color={TEXT_MUTED} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.witnessName} numberOfLines={1}>{incident.offenderName}</Text>
                      <Text style={s.witnessRole}>Offender</Text>
                    </View>
                  </View>
                ) : null}
                {incident.offenderName && incident.witnessName ? <View style={s.divider} /> : null}
                {incident.witnessName ? (
                  <View style={s.witnessRow}>
                    <View style={s.witnessBadge}>
                      <Ionicons name="eye-outline" size={14} color={TEXT_MUTED} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.witnessName} numberOfLines={1}>{incident.witnessName}</Text>
                      <Text style={s.witnessRole}>{incident.witnessType || "Witness"}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* ── AI Analysis ──────────────────────────────────── */}
            {(incident.ai_risk_level || incident.ai_priority_level || incident.ai_confidence_score !== undefined) ? (
              <View style={s.sectionCard}>
                <View style={s.sectionHeaderRow}>
                  <Ionicons name="sparkles-outline" size={18} color={TEXT_DARK} />
                  <Text style={s.sectionTitle}>AI Analysis</Text>
                </View>

                {/* Chip row */}
                <View style={s.aiChipsRow}>
                  {incident.ai_risk_level ? (
                    <View style={[s.aiChip, { borderColor: `${getRiskColor(incident.ai_risk_level)}30` }]}>
                      <Ionicons name="shield-outline" size={14} color={getRiskColor(incident.ai_risk_level)} />
                      <View>
                        <Text style={s.aiChipLabel}>Risk Level</Text>
                        <Text style={[s.aiChipValue, { color: getRiskColor(incident.ai_risk_level) }]}>
                          {incident.ai_risk_level}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {incident.ai_priority_level ? (
                    <View style={[s.aiChip, { borderColor: `${PRIMARY}20` }]}>
                      <Ionicons name="flag-outline" size={14} color={PRIMARY} />
                      <View>
                        <Text style={s.aiChipLabel}>Priority</Text>
                        <Text style={[s.aiChipValue, { color: PRIMARY }]}>
                          {incident.ai_priority_level}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* Confidence bar */}
                {incident.ai_confidence_score !== undefined ? (
                  <View style={s.confidenceWrap}>
                    <View style={s.confidenceHeader}>
                      <Ionicons name="analytics-outline" size={14} color={PRIMARY} />
                      <Text style={s.confidenceLabel}>AI Confidence</Text>
                      <Text style={s.confidencePct}>
                        {Math.round((incident.ai_confidence_score || 0) * 100)}%
                      </Text>
                    </View>
                    <View style={s.confTrack}>
                      <LinearGradient
                        colors={gradColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          s.confFill,
                          { width: `${Math.round((incident.ai_confidence_score || 0) * 100)}%` as any },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}

                {/* Flags */}
                {(incident.ai_children_involved || incident.ai_weapon_mentioned) ? (
                  <View style={s.flagsRow}>
                    {incident.ai_children_involved && (
                      <View style={s.flagChip}>
                        <Ionicons name="people" size={12} color="#EF4444" />
                        <Text style={s.flagText}>Children Involved</Text>
                      </View>
                    )}
                    {incident.ai_weapon_mentioned && (
                      <View style={s.flagChip}>
                        <Ionicons name="warning" size={12} color="#EF4444" />
                        <Text style={s.flagText}>Weapon Mentioned</Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* ── Evidence Photos ──────────────────────────────── */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeaderRow}>
                <Ionicons name="images-outline" size={18} color={TEXT_DARK} />
                <Text style={s.sectionTitle}>Evidence</Text>
                <Text style={s.sectionHint}>
                  {incident.photos?.length ?? 0} photo(s)
                </Text>
              </View>

              {incident.photos && incident.photos.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.galleryRow}
                >
                  {incident.photos.map((photo, idx) => {
                    const uri = buildPhotoUrl(incident._id, photo);
                    if (!uri) return null;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => setPhotoPreview(uri)}
                        style={({ pressed }) => [s.photoCard, pressed && { opacity: 0.92 }]}
                      >
                        <Image source={{ uri }} style={s.photoImg} resizeMode="cover" />
                        <View style={s.photoOverlay}>
                          <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={s.emptyEvidence}>
                  <Ionicons name="image-outline" size={44} color="#94A3B8" />
                  <Text style={s.emptyEvidenceText}>No uploaded evidence yet.</Text>
                </View>
              )}
            </View>

            {/* ── Timeline ─────────────────────────────────────── */}
            <View style={s.sectionCard}>
              <View style={s.sectionHeaderRow}>
                <Ionicons name="time-outline" size={18} color={TEXT_DARK} />
                <Text style={s.sectionTitle}>Timeline</Text>
              </View>

              <View style={s.timelineItem}>
                <View style={s.timelineDot}>
                  <View style={[s.timelineDotInner, { backgroundColor: PRIMARY }]} />
                </View>
                <View style={s.timelineContent}>
                  <Text style={s.timelineLabel}>Report Submitted</Text>
                  <Text style={s.timelineDate}>
                    {formatDate(incident.createdAt)}{formatTime(incident.createdAt) ? ` · ${formatTime(incident.createdAt)}` : ""}
                  </Text>
                </View>
              </View>

              <View style={s.timelineConnector} />

              <View style={s.timelineItem}>
                <View style={s.timelineDot}>
                  <View style={[s.timelineDotInner, { backgroundColor: statusColor }]} />
                </View>
                <View style={s.timelineContent}>
                  <Text style={s.timelineLabel}>Last Updated</Text>
                  <Text style={s.timelineDate}>
                    {formatDate(incident.updatedAt)}{formatTime(incident.updatedAt) ? ` · ${formatTime(incident.updatedAt)}` : ""}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Footer ───────────────────────────────────────── */}
            <Text style={s.footerNote}>
              Alert no: <Text style={s.footerCode}>#{shortId}</Text>
            </Text>

          </Animated.ScrollView>

          {/* ── Photo preview modal ───────────────────────────── */}
          <Modal
            visible={!!photoPreview}
            transparent
            animationType="fade"
            onRequestClose={() => setPhotoPreview(null)}
            statusBarTranslucent
          >
            <View style={s.viewerBackdrop}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setPhotoPreview(null)} />

              <View style={s.viewerTopBar}>
                <Pressable
                  onPress={() => setPhotoPreview(null)}
                  hitSlop={12}
                  style={({ pressed }) => [s.viewerIconBtn, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="close" size={22} color="#FFFFFF" />
                </Pressable>
              </View>

              {photoPreview && (
                <Image
                  source={{ uri: photoPreview }}
                  style={s.viewerImage}
                  resizeMode="contain"
                />
              )}

              <Text style={s.viewerHint}>
                Tap outside to close{Platform.OS === "ios" ? " · Pinch to zoom" : ""}
              </Text>
            </View>
          </Modal>
        </>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles (uniform with ReportDetailScreen) ─────────────────────────────────
const CARD_R = 18;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  // Hero header (matching ReportDetailScreen heroCard)
  heroWrap: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: BG,
  },
  heroCard: {
    width: "100%",
    borderRadius: CARD_R,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    flex: 1,
    fontSize: 16.5,
    fontWeight: "900",
    color: TEXT_DARK,
    letterSpacing: 0.1,
    textAlign: "left",
  },
  riskBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  riskBadgeText: { fontSize: 10.5, fontWeight: "900" },
  heroStatusCenterRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 10.5, fontWeight: "900" },
  dot: { width: 7, height: 7, borderRadius: 99 },

  // States
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  loadingText: { fontSize: 11, color: TEXT_MUTED, fontWeight: "400" },
  errorTitle: { fontSize: 16, fontWeight: "900", color: TEXT_DARK, marginTop: 8 },
  errorText: { fontSize: 12, color: TEXT_MUTED, fontWeight: "400", textAlign: "center" },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    marginTop: 4,
  },
  retryText: { fontSize: 12, fontWeight: "900", color: PRIMARY },

  // Scroll
  content: { paddingHorizontal: 14, paddingTop: 2, gap: 12 },

  // Section card (matching ReportDetailScreen sectionCard)
  sectionCard: {
    width: "100%",
    borderRadius: CARD_R,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    color: TEXT_DARK,
  },
  sectionHint: { fontSize: 10, fontWeight: "900", color: "#94A3B8" },

  // Mode chip
  modeRow: { marginBottom: 8 },
  modeChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modeEmergency: { backgroundColor: "#FEF2F2" },
  modeComplain: { backgroundColor: "#EEF3FF" },
  modeChipText: { fontSize: 11, fontWeight: "900" },

  // Narrative
  narrativeText: {
    fontSize: 11.5,
    fontWeight: "400",
    color: TEXT_MUTED,
    lineHeight: 16,
    fontStyle: "italic",
  },

  // Meta grid (date/time)
  metaGrid: { flexDirection: "row", gap: 10 },
  metaCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaLabel: { fontSize: 10, fontWeight: "900", color: "#94A3B8" },
  metaValue: { marginTop: 6, fontSize: 11.5, fontWeight: "400", color: TEXT_DARK },

  // Location
  locationText: {
    fontSize: 11.5,
    fontWeight: "400",
    color: TEXT_MUTED,
    lineHeight: 16,
  },

  // Witness / Reporter rows
  witnessRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  witnessBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F6FAFF",
    alignItems: "center",
    justifyContent: "center",
  },
  reporterBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  reporterInitials: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  witnessName: { fontSize: 12, fontWeight: "900", color: TEXT_DARK },
  witnessRole: { marginTop: 2, fontSize: 10.5, fontWeight: "400", color: "#94A3B8" },

  // Divider
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 6,
    marginLeft: 50,
  },

  // Stepper
  stepperRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
  },
  stepItem: { flex: 1, alignItems: "center", gap: 8 },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D0DAEA" },
  stepLabel: { fontSize: 10.5, fontWeight: "400", color: "#B0BECA", textAlign: "center" },
  stepConnector: {
    flex: 0.6,
    justifyContent: "center",
    marginTop: 16,
  },
  stepLine: { height: 2, borderRadius: 2 },

  // AI Analysis
  aiChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minWidth: 130,
    backgroundColor: SURFACE,
  },
  aiChipLabel: {
    fontSize: 9,
    color: "#94A3B8",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  aiChipValue: { fontSize: 13, fontWeight: "900", marginTop: 1 },
  confidenceWrap: { gap: 8 },
  confidenceHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  confidenceLabel: { flex: 1, fontSize: 11.5, color: TEXT_MUTED, fontWeight: "400" },
  confidencePct: { fontSize: 13, fontWeight: "900", color: PRIMARY },
  confTrack: { height: 6, backgroundColor: "#F1F5F9", borderRadius: 999, overflow: "hidden" },
  confFill: { height: 6, borderRadius: 999 },
  flagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  flagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  flagText: { fontSize: 11, color: "#DC2626", fontWeight: "900" },

  // Photos (matching ReportDetailScreen gallery)
  galleryRow: { gap: 10, paddingRight: 6 },
  photoCard: {
    width: 130,
    height: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F1F6FD",
    overflow: "hidden",
    position: "relative",
  },
  photoImg: { width: "100%", height: "100%" },
  photoOverlay: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyEvidence: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  emptyEvidenceText: { fontSize: 11, fontWeight: "400", color: "#94A3B8" },

  // Timeline
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotInner: { width: 10, height: 10, borderRadius: 5 },
  timelineContent: { flex: 1, gap: 2 },
  timelineLabel: { fontSize: 12, fontWeight: "900", color: TEXT_DARK },
  timelineDate: { fontSize: 10.5, fontWeight: "400", color: "#94A3B8" },
  timelineConnector: {
    width: 2,
    height: 18,
    backgroundColor: "#E2E8F0",
    marginLeft: 10,
    borderRadius: 1,
  },

  // Footer
  footerNote: {
    paddingTop: 2,
    paddingBottom: 12,
    textAlign: "center",
    fontSize: 10.5,
    fontWeight: "400",
    color: "#94A3B8",
  },
  footerCode: { color: PRIMARY, fontWeight: "900" },

  // Photo viewer modal (matching ReportDetailScreen)
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 10 + (Platform.OS === "ios" ? 16 : 0),
    paddingHorizontal: 14,
    height: 60 + (Platform.OS === "ios" ? 18 : 0),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 5,
  },
  viewerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: SCREEN_W - 24,
    height: SCREEN_W - 24,
    borderRadius: 12,
  },
  viewerHint: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10.5,
    fontWeight: "400",
    color: "rgba(255,255,255,0.72)",
  },
});
