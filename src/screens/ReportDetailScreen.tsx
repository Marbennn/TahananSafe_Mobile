// src/screens/ReportDetailScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors } from "../theme/colors";

import type { ReportItem } from "./ReportScreen";
import {
  fetchReportDetail,
  fetchReportThreads,
  sendReportThreadMessage,
  ThreadDto,
  ReportDetailDto,
  buildReportPhotoUrl,
} from "../api/reports";

type ViewKey = "details" | "threads";

type ThreadMsg = {
  id: string;
  side: "left" | "right";
  sender?: string;
  text: string;
  time: string;
};

type Props = {
  report: ReportItem;

  initialTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  onQuickExit?: () => void;

  onBack?: () => void;
};

function formatStamp(d: Date) {
  return d.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dtoToUi(dto: ThreadDto): ThreadMsg {
  const isResident = dto.senderRole === "resident";
  return {
    id: dto._id,
    side: isResident ? "right" : "left",
    sender: isResident ? undefined : dto.senderName || "Staff",
    text: dto.text,
    time: dto.createdAt ? formatStamp(new Date(dto.createdAt)) : "",
  };
}

function prettyStatus(s?: string) {
  if (!s) return "PENDING";
  return String(s).toUpperCase();
}

const BG = "#F5FAFE";
const CARD_BG = "#FFFFFF";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";
const TEXT_MUTED = "#6E7D90";

export default function ReportDetailScreen({
  report,
  initialTab = "Reports",
  onTabChange,
  onQuickExit,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // ✅ responsive scaling
  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);

  const PRIMARY = Colors.primary || "#0B5AA7";

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [view, setView] = useState<ViewKey>("details");

  // ✅ scale nav/fab a bit too (responsive)
  const NAV_BASE_HEIGHT = vscale(78);
  const FAB_SIZE = scale(62);

  const bottomPad = Math.max(insets.bottom, vscale(10));
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + vscale(90);
  const fabBottom = navHeight - FAB_SIZE / 2 - vscale(10);

  // ✅ IMPORTANT: Reserve bottom space so content never goes behind BottomNavBar
  const RESERVED_BOTTOM = navHeight + vscale(18);

  // ✅ better keyboard behavior (so reply row won't hide behind nav)
  const keyboardOffset = Platform.OS === "ios" ? navHeight : 0;

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const pressFab = () => handleTab("Incident");
  const longPressFab = () => onQuickExit?.();

  const threadScrollRef = useRef<ScrollView | null>(null);
  const [draft, setDraft] = useState("");

  // ✅ threads
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ThreadMsg[]>([]);
  const [threadsError, setThreadsError] = useState("");

  // ✅ details
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detail, setDetail] = useState<ReportDetailDto | null>(null);

  // ✅ report id
  const reportId = (report as any)?.id || (report as any)?._id || "";

  // =========================
  // ✅ Smooth segmented pill
  // =========================
  const SEG_PAD = scale(3);
  const [segWidth, setSegWidth] = useState(0);

  const segAnim = useRef(new Animated.Value(view === "details" ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(segAnim, {
      toValue: view === "details" ? 0 : 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const innerWidth = Math.max(segWidth - SEG_PAD * 2, 0);
  const indicatorWidth = innerWidth / 2;
  const translateX = segAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, indicatorWidth],
  });

  const loadDetail = async () => {
    if (!reportId) return;
    setLoadingDetail(true);
    setDetailError("");
    try {
      const d = await fetchReportDetail(reportId);
      setDetail(d);
    } catch (e: any) {
      setDetailError(e?.message || "Failed to load report detail");
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadThreads = async () => {
    if (!reportId) return;
    setLoadingThreads(true);
    setThreadsError("");
    try {
      const list = await fetchReportThreads(reportId);
      const ui = list.map(dtoToUi);
      setMessages(ui);

      setTimeout(() => {
        threadScrollRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } catch (e: any) {
      setThreadsError(e?.message || "Failed to load threads");
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  useEffect(() => {
    if (view === "threads") loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, reportId]);

  const onSend = async () => {
    const t = draft.trim();
    if (!t) return;
    if (!reportId) {
      Alert.alert("Missing report id", "Cannot send message because reportId is empty.");
      return;
    }
    if (sending) return;

    setSending(true);

    const optimistic: ThreadMsg = {
      id: `tmp_${Date.now()}`,
      side: "right",
      text: t,
      time: formatStamp(new Date()),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    setTimeout(() => {
      threadScrollRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      await sendReportThreadMessage(reportId, t);
      await loadThreads();
    } catch (e: any) {
      Alert.alert("Send failed", e?.message || "Could not send message.");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(t);
    } finally {
      setSending(false);
    }
  };

  // ✅ Prefer backend detail, fallback to prop
  const incidentTitle =
    detail?.incidentType ||
    (report as any)?.incidentTitle ||
    (report as any)?.incidentType ||
    report.title ||
    "Incident";

  const incidentNarrative =
    detail?.details ||
    (detail as any)?.narrative ||
    (report as any)?.details ||
    report.detail ||
    "No details provided.";

  const witnessName = detail?.witnessName || (report as any)?.witnessName || "—";
  const witnessRole = detail?.witnessType || (report as any)?.witnessRole || (report as any)?.witnessType || "—";

  const locationLabel = detail?.locationStr || (report as any)?.locationStr || (report as any)?.location || "—";
  const statusLabel = prettyStatus(detail?.status || (report as any)?.status);

  const dateLabel = detail?.dateStr || (report as any)?.dateStr || report.dateLeft || "—";
  const timeLabel = detail?.timeStr || (report as any)?.timeStr || report.timeLeft || "—";

  const photosRaw = ((detail?.photos ?? (report as any)?.photos) || []) as any[];

  const photoUrls = useMemo(() => {
    return photosRaw.map((p) => buildReportPhotoUrl(reportId, p)).filter(Boolean) as string[];
  }, [photosRaw, reportId]);

  const threadHeader = useMemo(() => {
    const locShort = locationLabel ? String(locationLabel).split(",")[0] : "Barangay";
    return `${locShort}\n${dateLabel}, ${timeLabel}`;
  }, [locationLabel, dateLabel, timeLabel]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, vscale(6)) }]}>
          <Pressable onPress={onBack} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}>
            <Ionicons name="chevron-back" size={scale(22)} color={PRIMARY} />
          </Pressable>

          <Text style={styles.topTitle}>Reports</Text>

          <View style={{ width: scale(36), height: scale(36) }} />
        </View>

        {/* Segmented tabs */}
        <View style={styles.segmentWrap}>
          <View style={styles.segmentPill} onLayout={(e) => setSegWidth(e.nativeEvent.layout.width)}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.segmentIndicator,
                {
                  width: indicatorWidth,
                  transform: [{ translateX }],
                },
              ]}
            />

            <Pressable onPress={() => setView("details")} style={({ pressed }) => [styles.segmentBtn, pressed && { transform: [{ scale: 0.99 }] }]}>
              <Text style={[styles.segmentTextGhost, view === "details" && styles.segmentTextActive]} numberOfLines={1}>
                Incident Details
              </Text>
            </Pressable>

            <Pressable onPress={() => setView("threads")} style={({ pressed }) => [styles.segmentBtn, pressed && { transform: [{ scale: 0.99 }] }]}>
              <Text style={[styles.segmentTextGhost, view === "threads" && styles.segmentTextActive]} numberOfLines={1}>
                Threads
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Body */}
        {view === "details" ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              {
                // ✅ reserve space for bottom nav (fix overlap)
                paddingBottom: RESERVED_BOTTOM,
              },
            ]}
          >
            <View style={styles.detailsCard}>
              {loadingDetail ? (
                <View style={styles.centerState}>
                  <ActivityIndicator />
                  <Text style={styles.stateText}>Loading report...</Text>
                </View>
              ) : detailError ? (
                <View style={styles.centerState}>
                  <Text style={[styles.stateText, { color: "#EF4444", textAlign: "center" }]}>{detailError}</Text>
                  <Pressable onPress={loadDetail} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.95 }]}>
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={styles.detailsHeader}>
                Incident Detail: <Text style={styles.statusText}>{statusLabel}</Text>
              </Text>

              <Text style={styles.incidentTitle}>{incidentTitle}</Text>
              <Text style={styles.incidentNarrative}>{incidentNarrative}</Text>

              <View style={styles.evidenceRow}>
                {photoUrls.length > 0 ? (
                  photoUrls.slice(0, 3).map((u, i) => (
                    <View key={i} style={styles.evidenceBox}>
                      <Image source={{ uri: u }} style={styles.evidenceImg} resizeMode="cover" />
                    </View>
                  ))
                ) : (
                  [0, 1, 2].map((i) => (
                    <View key={i} style={styles.evidenceBox}>
                      <View style={styles.evidenceIconWrap}>
                        <Ionicons name="image-outline" size={scale(18)} color="#B8C4D8" />
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Witness</Text>
                <Text style={styles.witnessName}>{witnessName}</Text>
                <Text style={styles.witnessRole}>{witnessRole}</Text>
              </View>

              <View style={styles.metaGrid}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Date: {dateLabel}</Text>
                  <Text style={styles.metaLabel}>Location: {locationLabel}</Text>
                </View>

                <View style={styles.metaColRight}>
                  <Text style={[styles.metaLabel, { textAlign: "right" }]}>Time: {timeLabel}</Text>
                </View>
              </View>

              <Text style={styles.alertFooter}>
                Alert no. <Text style={styles.alertNo}>{String((report as any)?.alertNo ?? reportId ?? "")}</Text>
              </Text>
            </View>
          </ScrollView>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={keyboardOffset}
          >
            {/* ✅ reserve space for bottom nav (fix overlap) */}
            <View style={[styles.threadOuter, { paddingBottom: RESERVED_BOTTOM }]}>
              <View style={styles.threadCard}>
                <Text style={styles.threadHeaderText}>{threadHeader}</Text>

                {loadingThreads ? (
                  <View style={styles.centerState}>
                    <ActivityIndicator />
                    <Text style={styles.stateText}>Loading threads...</Text>
                  </View>
                ) : threadsError ? (
                  <View style={styles.centerState}>
                    <Text style={[styles.stateText, { color: "#EF4444" }]}>{threadsError}</Text>
                    <Pressable onPress={loadThreads} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.95 }]}>
                      <Text style={styles.retryText}>Retry</Text>
                    </Pressable>
                  </View>
                ) : (
                  <ScrollView
                    ref={(r) => {
                      threadScrollRef.current = r;
                    }}
                    style={styles.threadScroll}
                    contentContainerStyle={styles.threadScrollContent}
                    showsVerticalScrollIndicator
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {messages.map((m) => {
                      const isLeft = m.side === "left";
                      return (
                        <View key={m.id} style={styles.msgBlock}>
                          {isLeft && m.sender ? (
                            <Text style={styles.msgTopLine}>
                              {m.sender}
                              {"\n"}
                              <Text style={styles.msgTime}>{m.time}</Text>
                            </Text>
                          ) : null}

                          <View style={[styles.msgRow, isLeft ? styles.msgRowLeft : styles.msgRowRight]}>
                            <View style={[styles.bubble, isLeft ? styles.bubbleLeft : styles.bubbleRight]}>
                              <Text style={styles.bubbleText}>{m.text}</Text>
                            </View>
                          </View>

                          {!isLeft ? (
                            <Text style={[styles.msgTime, { textAlign: "right", marginTop: vscale(4) }]}>{m.time}</Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </ScrollView>
                )}

                <View style={styles.replyRow}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Reply here"
                    placeholderTextColor="#9AA4B2"
                    style={styles.replyInput}
                    returnKeyType="send"
                    onSubmitEditing={onSend}
                    editable={!sending}
                  />

                  <Pressable
                    onPress={onSend}
                    disabled={sending}
                    style={({ pressed }) => [
                      styles.sendBtn,
                      (pressed || sending) && { transform: [{ scale: 0.98 }], opacity: 0.95 },
                    ]}
                  >
                    {sending ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send" size={scale(18)} color="#FFFFFF" />}
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={pressFab}
          onFabLongPress={longPressFab}
          centerLabel="Incident Log"
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const PRIMARY = Colors.primary || "#0B5AA7";

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    topBar: {
      paddingHorizontal: scale(14),
      paddingBottom: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backBtn: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(12),
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: {
      fontSize: scale(18),
      fontWeight: "900",
      color: TEXT_DARK,
      letterSpacing: 0.2,
    },

    segmentWrap: {
      paddingHorizontal: scale(14),
      paddingTop: vscale(2),
      paddingBottom: vscale(10),
    },
    segmentPill: {
      height: vscale(36),
      borderRadius: vscale(18),
      backgroundColor: "#EFF4FA",
      borderWidth: 1,
      borderColor: BORDER,
      flexDirection: "row",
      padding: scale(3),
      position: "relative",
      overflow: "hidden",
    },
    segmentIndicator: {
      position: "absolute",
      left: 0,
      top: scale(3),
      bottom: scale(3),
      borderRadius: vscale(16),
      backgroundColor: "#0A3F79",
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    segmentBtn: {
      flex: 1,
      borderRadius: vscale(16),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(6),
      zIndex: 2,
    },
    segmentTextGhost: {
      fontSize: scale(11),
      fontWeight: "900",
      color: PRIMARY,
    },
    segmentTextActive: { color: "#FFFFFF" },

    scrollContent: { paddingHorizontal: scale(14), paddingTop: vscale(6) },

    detailsCard: {
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: CARD_BG,
      borderRadius: scale(18),
      paddingVertical: vscale(14),
      paddingHorizontal: scale(14),
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
      minHeight: vscale(260),
    },

    detailsHeader: {
      fontSize: scale(11),
      fontWeight: "900",
      color: TEXT_DARK,
      marginBottom: vscale(10),
    },
    statusText: { color: TEXT_DARK, fontWeight: "900" },

    incidentTitle: {
      fontSize: scale(12.5),
      fontWeight: "900",
      color: TEXT_DARK,
      marginBottom: vscale(6),
    },
    incidentNarrative: {
      fontSize: scale(10.5),
      fontWeight: "700",
      color: TEXT_MUTED,
      lineHeight: vscale(15),
      fontStyle: "italic",
      marginBottom: vscale(12),
    },

    evidenceRow: {
      flexDirection: "row",
      gap: scale(10),
      marginBottom: vscale(12),
    },
    evidenceBox: {
      flex: 1,
      height: vscale(62),
      borderRadius: scale(12),
      backgroundColor: "#F1F5FB",
      borderWidth: 1,
      borderColor: "#E6EEF9",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    evidenceImg: { width: "100%", height: "100%" },
    evidenceIconWrap: {
      width: scale(34),
      height: scale(34),
      borderRadius: scale(10),
      backgroundColor: "#EEF3FB",
      borderWidth: 1,
      borderColor: "#DFE9F7",
      alignItems: "center",
      justifyContent: "center",
    },

    section: { marginTop: vscale(2), marginBottom: vscale(12) },
    sectionTitle: {
      fontSize: scale(11),
      fontWeight: "900",
      color: TEXT_DARK,
      marginBottom: vscale(6),
    },
    witnessName: {
      fontSize: scale(11),
      fontWeight: "900",
      color: TEXT_DARK,
      marginBottom: vscale(2),
    },
    witnessRole: { fontSize: scale(10), fontWeight: "800", color: "#9AA7B8" },

    metaGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: scale(10),
      marginTop: vscale(4),
    },
    metaCol: { flex: 1, gap: vscale(6) },
    metaColRight: { width: scale(120), justifyContent: "flex-start" },
    metaLabel: { fontSize: scale(10), fontWeight: "900", color: TEXT_MUTED },

    alertFooter: {
      marginTop: vscale(12),
      fontSize: scale(9.5),
      fontWeight: "900",
      color: "#9AA7B8",
      textAlign: "center",
    },
    alertNo: { color: PRIMARY, fontWeight: "900" },

    // Threads
    threadOuter: { flex: 1, paddingHorizontal: scale(14), paddingTop: vscale(6) },
    threadCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: CARD_BG,
      borderRadius: scale(18),
      padding: scale(12),
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
    },
    threadHeaderText: {
      fontSize: scale(10),
      fontWeight: "900",
      color: "#9AA7B8",
      marginBottom: vscale(10),
      lineHeight: vscale(14),
    },

    threadScroll: {
      flex: 1,
      borderRadius: scale(14),
      backgroundColor: "#F6FAFF",
      borderWidth: 1,
      borderColor: "#E8F0FA",
      paddingHorizontal: scale(10),
      paddingVertical: vscale(10),
    },
    threadScrollContent: { paddingBottom: vscale(12) },

    msgBlock: { marginBottom: vscale(12) },
    msgTopLine: {
      fontSize: scale(9.5),
      fontWeight: "900",
      color: "#6B7280",
      marginBottom: vscale(6),
      lineHeight: vscale(12),
    },
    msgTime: { fontSize: scale(8.5), fontWeight: "800", color: "#94A3B8" },

    msgRow: { flexDirection: "row", alignItems: "flex-end" },
    msgRowLeft: { justifyContent: "flex-start" },
    msgRowRight: { justifyContent: "flex-end" },

    bubble: {
      maxWidth: "78%",
      borderRadius: scale(14),
      paddingHorizontal: scale(12),
      paddingVertical: vscale(10),
    },
    bubbleLeft: { backgroundColor: "#E9EEF6" },
    bubbleRight: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
    bubbleText: { fontSize: scale(10.5), fontWeight: "700", color: "#374151", lineHeight: vscale(14) },

    replyRow: { flexDirection: "row", alignItems: "center", gap: scale(10), marginTop: vscale(10) },
    replyInput: {
      flex: 1,
      height: vscale(40),
      borderRadius: scale(20),
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: "#F7FBFF",
      paddingHorizontal: scale(14),
      fontSize: scale(10.5),
      fontWeight: "700",
      color: "#111827",
    },
    sendBtn: {
      width: scale(44),
      height: scale(44),
      borderRadius: scale(22),
      backgroundColor: PRIMARY,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.14,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },

    centerState: { alignItems: "center", justifyContent: "center", gap: vscale(10), paddingVertical: vscale(20) },
    stateText: { fontSize: scale(10.5), fontWeight: "800", color: "#64748B" },
    retryBtn: {
      paddingHorizontal: scale(14),
      paddingVertical: vscale(10),
      borderRadius: scale(12),
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: "#FFFFFF",
    },
    retryText: { fontSize: scale(10.5), fontWeight: "900", color: PRIMARY },
  });
}