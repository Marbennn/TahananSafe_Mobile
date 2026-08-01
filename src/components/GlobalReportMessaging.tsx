import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../auth/AuthContext";
import { requestJson } from "../api/http";
import {
  fetchMyNotifications,
  type NotificationItem,
} from "../api/notifications";
import {
  getReportStatusMeta,
  normalizeReportStatus,
  type ReportStatus,
} from "../utils/reportStatus";
import { useColors } from "../theme/colors";
import ReportMessaging from "./ReportDetailsScreen/ReportMessaging";

type MessagingReport = {
  id: string;
  title: string;
  detail: string;
  alertNo: string;
  rawStatus: string;
  status: ReportStatus;
  incidentDate: string;
  incidentTime: string;
  location: string;
  reportedPerson: string;
  witnessName: string;
  witnessType: string;
  updatedAt: string;
  evidenceCount: number;
  canChat: boolean;
};

type FloatingBounds = {
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
  defaultX: number;
  defaultY: number;
};

const FLOATING_BUTTON_SIZE = 56;

const REPORT_CARD_STATUS_COLORS: Record<
  ReportStatus,
  { backgroundColor: string; textColor: string }
> = {
  SUBMITTED: { backgroundColor: "#AFCDF8", textColor: "#40536B" },
  UNDER_REVIEW: { backgroundColor: "#FDE7A6", textColor: "#72551C" },
  MEDIATION_SCHEDULED: { backgroundColor: "#DDC7F7", textColor: "#7652C8" },
  ONGOING_ASSISTANCE: { backgroundColor: "#F8BB96", textColor: "#4B5563" },
  RESOLVED: { backgroundColor: "#C7F2D8", textColor: "#18723A" },
  CERTIFICATION_ISSUED: {
    backgroundColor: "#F2B0B6",
    textColor: "#70414C",
  },
  ARCHIVED: { backgroundColor: "#DDE2E8", textColor: "#4B5563" },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function getDocumentId(value: any) {
  if (value && typeof value === "object") {
    return String(value.$oid ?? value._id ?? value.id ?? "").trim();
  }
  return String(value ?? "").trim();
}

function toMessagingReport(doc: any): MessagingReport | null {
  const id = getDocumentId(doc?._id ?? doc?.id);
  if (!id) return null;

  const rawStatus = String(doc?.status || "SUBMITTED").trim();
  const statusKey = rawStatus.toUpperCase().replace(/[\s-]+/g, "_");
  const incidentType = String(doc?.incidentType || "").trim();
  const mode = String(doc?.mode || "").trim().toLowerCase();
  const title =
    incidentType ||
    (mode === "emergency" ? "Emergency Report" : "Incident Report");
  const detail =
    String(doc?.details || doc?.offenderName || "No description provided.").trim();
  const complainId = String(doc?.complainId || "").trim();
  const photos = Array.isArray(doc?.photos) ? doc.photos : [];
  const videos = Array.isArray(doc?.videos) ? doc.videos : [];

  return {
    id,
    title,
    detail,
    alertNo: complainId ? `#${complainId}` : `#${id.slice(-6).toUpperCase()}`,
    rawStatus: rawStatus || "SUBMITTED",
    status: normalizeReportStatus(rawStatus),
    incidentDate: String(doc?.dateStr || "").trim(),
    incidentTime: String(doc?.timeStr || "").trim(),
    location: String(doc?.locationStr || "").trim(),
    reportedPerson: String(doc?.offenderName || "").trim(),
    witnessName: String(doc?.witnessName || "").trim(),
    witnessType: String(doc?.witnessType || "").trim(),
    updatedAt: String(doc?.updatedAt || doc?.createdAt || ""),
    evidenceCount: photos.length + videos.length,
    canChat:
      statusKey !== "CANCELLED" &&
      statusKey !== "CANCELED" &&
      statusKey !== "RESOLVED",
  };
}

function formatReportDate(value: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMessagingStatusMeta(report: MessagingReport) {
  const raw = report.rawStatus.trim().toLowerCase();
  if (raw === "cancelled" || raw === "canceled") {
    return {
      shortLabel: "Cancelled",
      color: "#B91C1C",
      bg: "#FEE2E2",
    };
  }
  const statusMeta = getReportStatusMeta(report.status);
  const statusColors = REPORT_CARD_STATUS_COLORS[report.status];
  return {
    ...statusMeta,
    color: statusColors.textColor,
    bg: statusColors.backgroundColor,
  };
}

function groupUnreadNotifications(items: NotificationItem[]) {
  const next: Record<string, number> = {};
  for (const item of items) {
    if (item.type !== "thread" || !item.unread || !item.incidentId) continue;
    const reportId = String(item.incidentId);
    next[reportId] = (next[reportId] || 0) + 1;
  }
  return next;
}

export default function GlobalReportMessaging() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const colors = useColors();
  const { user } = useAuth() as any;
  const userId = String(
    user?._id ?? user?.id ?? user?.userId ?? user?.email ?? ""
  ).trim();

  const styles = useMemo(
    () => makeStyles(colors, width, height),
    [colors, height, width]
  );

  const [listVisible, setListVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MessagingReport | null>(
    null
  );
  const [reports, setReports] = useState<MessagingReport[]>([]);
  const [unreadByReport, setUnreadByReport] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadSequenceRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const floatingPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const floatingPositionRef = useRef({ x: 0, y: 0 });
  const floatingDragStartRef = useRef({ x: 0, y: 0 });
  const floatingPositionUserRef = useRef("");
  const previousFloatingBoundsRef = useRef<FloatingBounds | null>(null);
  const dotAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const totalUnread = useMemo(
    () => Object.values(unreadByReport).reduce((sum, count) => sum + count, 0),
    [unreadByReport]
  );
  const selectedReportContext = useMemo(() => {
    if (!selectedReport) return undefined;
    const statusMeta = getMessagingStatusMeta(selectedReport);

    return {
      reference: selectedReport.alertNo,
      title: selectedReport.title,
      description: selectedReport.detail,
      statusLabel: statusMeta.shortLabel,
      statusColor: statusMeta.color,
      statusBackgroundColor: statusMeta.bg,
      incidentDate: selectedReport.incidentDate,
      incidentTime: selectedReport.incidentTime,
      location: selectedReport.location,
      reportedPerson: selectedReport.reportedPerson,
      witnessName: selectedReport.witnessName,
      witnessType: selectedReport.witnessType,
      evidenceCount: selectedReport.evidenceCount,
    };
  }, [selectedReport]);

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const notifications = await fetchMyNotifications(100);
      setUnreadByReport(groupUnreadNotifications(notifications));
    } catch {
      // Keep the global button usable if notification polling fails.
    }
  }, [userId]);

  const loadReports = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!userId) return;

      const sequence = ++loadSequenceRef.current;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setErrorMessage("");

      try {
        const [payload, notifications] = await Promise.all([
          requestJson<any>({
            method: "GET",
            path: "/api/mobile/v1/reports/my",
            auth: true,
          }),
          fetchMyNotifications(100).catch(() => null),
        ]);
        if (sequence !== loadSequenceRef.current) return;

        const rawReports = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.incidents)
          ? payload.incidents
          : [];
        const nextReports = rawReports
          .map(toMessagingReport)
          .filter((report): report is MessagingReport => !!report)
          .sort((first, second) => {
            const firstTime = new Date(first.updatedAt || 0).getTime() || 0;
            const secondTime = new Date(second.updatedAt || 0).getTime() || 0;
            return secondTime - firstTime;
          });

        setReports(nextReports);
        if (notifications) {
          setUnreadByReport(groupUnreadNotifications(notifications));
        }
      } catch (error: any) {
        if (sequence !== loadSequenceRef.current) return;
        if (mode === "initial" || reports.length === 0) {
          setErrorMessage(error?.message || "Could not load your reports.");
        }
      } finally {
        if (sequence === loadSequenceRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [reports.length, userId]
  );

  useEffect(() => {
    if (!userId) {
      loadSequenceRef.current += 1;
      setListVisible(false);
      setSelectedReport(null);
      setReports([]);
      setUnreadByReport({});
      return;
    }

    void refreshUnread();
    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      if (nextState === "active") void refreshUnread();
    });
    const timer = setInterval(() => {
      if (appStateRef.current === "active" && !selectedReport) {
        void refreshUnread();
      }
    }, 10000);

    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [refreshUnread, selectedReport, userId]);

  useEffect(() => {
    if (totalUnread <= 0) {
      dotAnimations.forEach((dot) => dot.setValue(0));
      return;
    }

    const loops = dotAnimations.map((dot, index) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(dot, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.delay(650),
        ])
      );
      loop.start();
      return loop;
    });

    return () => loops.forEach((loop) => loop.stop());
  }, [dotAnimations, totalUnread]);

  const openReportList = useCallback(() => {
    Keyboard.dismiss();
    setSelectedReport(null);
    setListVisible(true);
    void loadReports(reports.length ? "refresh" : "initial");
  }, [loadReports, reports.length]);

  const closeReportList = useCallback(() => {
    setListVisible(false);
    setSelectedReport(null);
  }, []);

  const closeConversation = useCallback(() => {
    setSelectedReport(null);
    void refreshUnread();
  }, [refreshUnread]);

  const androidSafeBottom =
    Platform.OS === "android"
      ? Math.min(Math.max(insets.bottom, 16), 48)
      : Math.max(insets.bottom, 16);
  const floatingBottom = androidSafeBottom + (height < 650 ? 76 : 92);
  const floatingBounds = useMemo<FloatingBounds>(() => {
    const horizontalMargin = 10;
    const topMargin = Math.max(insets.top, 10) + 8;
    const minimumX = Math.max(insets.left, horizontalMargin);
    const maximumX = Math.max(
      minimumX,
      width - Math.max(insets.right, horizontalMargin) - FLOATING_BUTTON_SIZE
    );
    const minimumY = topMargin;
    const maximumY = Math.max(
      minimumY,
      height - floatingBottom - FLOATING_BUTTON_SIZE
    );

    return {
      minimumX,
      maximumX,
      minimumY,
      maximumY,
      defaultX: maximumX,
      defaultY: maximumY,
    };
  }, [
    floatingBottom,
    height,
    insets.left,
    insets.right,
    insets.top,
    width,
  ]);

  useEffect(() => {
    const shouldReset = floatingPositionUserRef.current !== userId;
    const previousBounds = previousFloatingBoundsRef.current;
    floatingPositionUserRef.current = userId;

    let current = {
      x: floatingBounds.defaultX,
      y: floatingBounds.defaultY,
    };

    if (!shouldReset && previousBounds) {
      const previousWidth =
        previousBounds.maximumX - previousBounds.minimumX;
      const previousHeight =
        previousBounds.maximumY - previousBounds.minimumY;
      const horizontalRatio = previousWidth
        ? clamp(
            (floatingPositionRef.current.x - previousBounds.minimumX) /
              previousWidth,
            0,
            1
          )
        : 1;
      const verticalRatio = previousHeight
        ? clamp(
            (floatingPositionRef.current.y - previousBounds.minimumY) /
              previousHeight,
            0,
            1
          )
        : 1;

      current = {
        x:
          floatingBounds.minimumX +
          horizontalRatio *
            (floatingBounds.maximumX - floatingBounds.minimumX),
        y:
          floatingBounds.minimumY +
          verticalRatio *
            (floatingBounds.maximumY - floatingBounds.minimumY),
      };
    }

    previousFloatingBoundsRef.current = floatingBounds;
    floatingPositionRef.current = current;
    floatingPosition.setValue(current);
  }, [floatingBounds, floatingPosition, userId]);

  const floatingPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
        onPanResponderGrant: () => {
          floatingDragStartRef.current = floatingPositionRef.current;
          floatingPosition.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          const next = {
            x: clamp(
              floatingDragStartRef.current.x + gesture.dx,
              floatingBounds.minimumX,
              floatingBounds.maximumX
            ),
            y: clamp(
              floatingDragStartRef.current.y + gesture.dy,
              floatingBounds.minimumY,
              floatingBounds.maximumY
            ),
          };
          floatingPositionRef.current = next;
          floatingPosition.setValue(next);
        },
        onPanResponderRelease: () => {
          floatingPosition.setValue(floatingPositionRef.current);
        },
        onPanResponderTerminate: () => {
          floatingPosition.setValue(floatingPositionRef.current);
        },
        onShouldBlockNativeResponder: () => true,
      }),
    [floatingBounds, floatingPosition]
  );

  if (!userId) return null;

  return (
    <>
      <Modal
        visible={listVisible && !selectedReport}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeReportList}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close report messages"
            style={styles.backdrop}
            onPress={closeReportList}
          />

          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.headerText}>
                <Text style={styles.modalTitle} allowFontScaling={false}>
                  Messages
                </Text>
                <Text style={styles.modalSubtitle} allowFontScaling={false}>
                  Choose a report to view its conversation
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close messages"
                hitSlop={10}
                onPress={closeReportList}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.stateTitle}>Loading your reports</Text>
                <Text style={styles.stateText}>
                  Your conversations will appear here.
                </Text>
              </View>
            ) : errorMessage ? (
              <View style={styles.centerState}>
                <View style={styles.stateIcon}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={30}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.stateTitle}>Unable to load reports</Text>
                <Text style={styles.stateText}>{errorMessage}</Text>
                <Pressable
                  onPress={() => void loadReports("initial")}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.retryText}>Try Again</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={reports}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.listContent,
                  reports.length === 0 && styles.emptyListContent,
                ]}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void loadReports("refresh")}
                    colors={[colors.primary]}
                    tintColor={colors.primary}
                  />
                }
                ListHeaderComponent={
                  reports.length ? (
                    <View style={styles.listHeadingRow}>
                      <Text style={styles.listHeading}>Your Reports</Text>
                      <View style={styles.reportCountPill}>
                        <Text style={styles.reportCountText}>
                          {reports.length}
                        </Text>
                      </View>
                    </View>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={styles.centerState}>
                    <View style={styles.stateIcon}>
                      <Ionicons
                        name="document-text-outline"
                        size={32}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={styles.stateTitle}>No reports yet</Text>
                    <Text style={styles.stateText}>
                      Reports you submit will be available for messaging here.
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const statusMeta = getMessagingStatusMeta(item);
                  const unreadCount = unreadByReport[item.id] || 0;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open messages for ${item.alertNo}`}
                      onPress={() => setSelectedReport(item)}
                      style={({ pressed }) => [
                        styles.reportCard,
                        pressed && styles.reportCardPressed,
                      ]}
                    >
                      <View style={styles.reportBody}>
                        <View style={styles.reportMetaRow}>
                          <Text
                            style={styles.reportNumber}
                            numberOfLines={1}
                            allowFontScaling={false}
                          >
                            REP {item.alertNo}
                          </Text>
                          <View style={styles.reportMetaActions}>
                            {unreadCount ? (
                              <View style={styles.unreadPill}>
                                <Text style={styles.unreadPillText}>
                                  {unreadCount > 99 ? "99+" : unreadCount}
                                </Text>
                              </View>
                            ) : null}

                            <View
                              style={[
                                styles.statusPill,
                                { backgroundColor: statusMeta.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusText,
                                  { color: statusMeta.color },
                                ]}
                                numberOfLines={1}
                              >
                                {statusMeta.shortLabel}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <Text
                          style={styles.reportTitle}
                          numberOfLines={1}
                          allowFontScaling={false}
                        >
                          {item.title}
                        </Text>

                        <Text
                          style={styles.reportDetail}
                          numberOfLines={2}
                          allowFontScaling={false}
                        >
                          {item.detail}
                        </Text>

                        <View style={styles.reportBottomRow}>
                          <Text
                            style={styles.reportDate}
                            numberOfLines={1}
                            allowFontScaling={false}
                          >
                            {formatReportDate(item.updatedAt)}
                          </Text>

                          <View style={styles.viewMessagesRow}>
                            <Text
                              style={styles.viewMessagesText}
                              numberOfLines={1}
                              allowFontScaling={false}
                            >
                              View Messages
                            </Text>
                            <Ionicons
                              name="chevron-forward"
                              size={17}
                              color={colors.primary}
                            />
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {selectedReport ? (
        <ReportMessaging
          key={selectedReport.id}
          reportId={selectedReport.id}
          canChat={selectedReport.canChat}
          reportStatus={selectedReport.rawStatus.toUpperCase()}
          autoOpen
          hideFab
          showBackButton
          modalTitle={`Report ${selectedReport.alertNo}`}
          reportContext={selectedReportContext}
          onModalClose={closeConversation}
        />
      ) : null}

      {!listVisible && !selectedReport ? (
        <Animated.View
          {...floatingPanResponder.panHandlers}
          style={[
            styles.floatingButtonMover,
            {
              transform: floatingPosition.getTranslateTransform(),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              totalUnread
                ? `Open messages, ${totalUnread} unread`
                : "Open messages"
            }
            accessibilityHint="Tap to open or drag to reposition"
            onPress={openReportList}
            style={({ pressed }) => [
              styles.floatingButton,
              pressed && styles.floatingButtonPressed,
            ]}
          >
            <View style={styles.floatingIconWrap}>
              <Ionicons
                name="chatbubble-outline"
                size={25}
                color="#FFFFFF"
              />
              <View style={styles.floatingDots}>
                {dotAnimations.map((dot, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.floatingDot,
                      {
                        transform: [
                          {
                            translateY: dot.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -3],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            {totalUnread ? (
              <View style={styles.floatingBadge}>
                <Text style={styles.floatingBadgeText} allowFontScaling={false}>
                  {totalUnread > 99 ? "99+" : totalUnread}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      ) : null}
    </>
  );
}

function makeStyles(
  colors: ReturnType<typeof useColors>,
  width: number,
  height: number
) {
  const modalHeight = Math.min(Math.round(height * 0.78), 720);
  const modalWidth = Math.min(Math.round(width * 0.92), 540);

  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    modalCard: {
      width: modalWidth,
      height: modalHeight,
      maxHeight: "86%",
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider,
    },
    modalHeader: {
      minHeight: 76,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      backgroundColor: colors.card,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    modalTitle: {
      fontSize: 19,
      fontWeight: "900",
      color: colors.heading,
    },
    modalSubtitle: {
      fontSize: 11.5,
      lineHeight: 16,
      fontWeight: "500",
      color: colors.muted,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.inputBg,
    },
    listContent: {
      paddingHorizontal: 14,
      paddingTop: 16,
      paddingBottom: 24,
      gap: 11,
    },
    emptyListContent: {
      flexGrow: 1,
      justifyContent: "center",
    },
    listHeadingRow: {
      minHeight: 28,
      marginBottom: 2,
      paddingHorizontal: 2,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    listHeading: {
      fontSize: 14,
      fontWeight: "900",
      color: colors.heading,
    },
    reportCountPill: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      paddingHorizontal: 7,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.chipBg,
    },
    reportCountText: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.primary,
    },
    reportCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.card,
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    reportCardPressed: {
      opacity: 0.96,
    },
    reportBody: {
      borderRadius: 14,
      overflow: "hidden",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    reportMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 4,
    },
    reportNumber: {
      flex: 1,
      fontSize: 9.5,
      fontWeight: "500",
      color: colors.muted,
    },
    reportMetaActions: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    reportTitle: {
      fontSize: 16.5,
      lineHeight: 20,
      fontWeight: "700",
      color: colors.textDark,
    },
    reportDetail: {
      marginTop: 0,
      fontSize: 13.25,
      lineHeight: 19.5,
      fontStyle: "italic",
      fontWeight: "400",
      color: colors.muted,
    },
    reportBottomRow: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    reportDate: {
      flex: 1,
      minWidth: 0,
      fontSize: 11,
      fontWeight: "400",
      color: colors.muted,
    },
    statusPill: {
      maxWidth: 145,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "700",
    },
    viewMessagesRow: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    viewMessagesText: {
      fontSize: 11.5,
      fontWeight: "700",
      color: colors.primary,
    },
    unreadPill: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#E11D48",
    },
    unreadPillText: {
      fontSize: 9,
      fontWeight: "900",
      color: "#FFFFFF",
    },
    centerState: {
      flex: 1,
      minHeight: 260,
      paddingHorizontal: 28,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    stateIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      marginBottom: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.chipBg,
    },
    stateTitle: {
      marginTop: 4,
      fontSize: 15,
      fontWeight: "900",
      color: colors.heading,
      textAlign: "center",
    },
    stateText: {
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "500",
      color: colors.muted,
      textAlign: "center",
    },
    retryButton: {
      minHeight: 42,
      marginTop: 10,
      borderRadius: 21,
      paddingHorizontal: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.actionPrimary,
    },
    retryText: {
      fontSize: 12,
      fontWeight: "900",
      color: "#FFFFFF",
    },
    floatingButtonMover: {
      position: "absolute",
      left: 0,
      top: 0,
      zIndex: 100,
      width: FLOATING_BUTTON_SIZE,
      height: FLOATING_BUTTON_SIZE,
    },
    floatingButton: {
      width: FLOATING_BUTTON_SIZE,
      height: FLOATING_BUTTON_SIZE,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      shadowColor: "#0F172A",
      shadowOpacity: colors.isDark ? 0.42 : 0.24,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 12,
    },
    floatingButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.94 }],
    },
    floatingIconWrap: {
      width: 32,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    floatingDots: {
      position: "absolute",
      top: 13,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
      gap: 3,
    },
    floatingDot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: "#FFFFFF",
    },
    floatingBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#E11D48",
      borderWidth: 2,
      borderColor: colors.surface,
    },
    floatingBadgeText: {
      fontSize: 9,
      fontWeight: "900",
      color: "#FFFFFF",
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
