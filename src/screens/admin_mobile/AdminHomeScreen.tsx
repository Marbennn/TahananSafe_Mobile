import React, { useMemo, useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  useWindowDimensions,
  Modal,
  Animated,
  PanResponder,
  Easing,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../theme/colors";
import { useAuth } from "../../auth/AuthContext";
import BottomNavBar, { TabKey } from "../../components/BottomNavBar";

type QuickAction = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
};

type ReportItem = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  level: "Low" | "Moderate" | "High";
};

type StatCard = {
  id: string;
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  onOpenNotifications?: () => void;
  onOpenHelp?: () => void;
  onOpenReports?: () => void;
  onOpenUsers?: () => void;
  onOpenHotlines?: () => void;
  onOpenAnalytics?: () => void;
  onOpenPendingReports?: () => void;
  onOpenVerifiedUsers?: () => void;
  onOpenEscalatedCases?: () => void;
  onOpenReportDetail?: (reportId: string) => void;
  onLogout?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const AdminHomeScreen: React.FC<Props> = ({
  onOpenNotifications,
  onOpenHelp,
  onOpenReports,
  onOpenUsers,
  onOpenHotlines,
  onOpenAnalytics,
  onOpenPendingReports,
  onOpenVerifiedUsers,
  onOpenEscalatedCases,
  onOpenReportDetail,
  onLogout,
}) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isSmallDevice = width < 380;

  const { logout } = useAuth() as any;

  const [activeTab, setActiveTab] = useState<TabKey>("Home");
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      onLogout?.();
    }
  }, [logout, onLogout]);

  const statCardWidth = useMemo(() => {
    const horizontalPadding = 20 * 2;
    const gap = 12;
    return (width - horizontalPadding - gap) / 2;
  }, [width]);

  const stats: StatCard[] = [
    {
      id: "1",
      label: "Pending Reports",
      value: "18",
      icon: "document-text-outline",
    },
    {
      id: "2",
      label: "Verified Users",
      value: "142",
      icon: "shield-checkmark-outline",
    },
    {
      id: "3",
      label: "Escalated Cases",
      value: "07",
      icon: "warning-outline",
    },
    {
      id: "4",
      label: "Hotlines Active",
      value: "06",
      icon: "call-outline",
    },
  ];

  const quickActions: QuickAction[] = [
    {
      id: "1",
      label: "Reports",
      icon: "document-text-outline",
      onPress: onOpenReports,
    },
    {
      id: "2",
      label: "Users",
      icon: "people-outline",
      onPress: onOpenUsers,
    },
    {
      id: "3",
      label: "Hotlines",
      icon: "call-outline",
      onPress: onOpenHotlines,
    },
    {
      id: "4",
      label: "Analytics",
      icon: "bar-chart-outline",
      onPress: onOpenAnalytics,
    },
  ];

  const recentReports: ReportItem[] = [
    {
      id: "8934",
      title: "Emergency domestic violence report",
      subtitle: "Barangay Zone 2 • Immediate review needed",
      date: "January 12, 2026",
      time: "10:00 PM",
      level: "High",
    },
    {
      id: "8034",
      title: "Resident requested hotline assistance",
      subtitle: "Barangay Poblacion • Waiting for callback",
      date: "January 12, 2026",
      time: "9:30 PM",
      level: "Moderate",
    },
    {
      id: "8014",
      title: "Incident follow-up submitted",
      subtitle: "Barangay San Vicente • Review attachments",
      date: "January 12, 2026",
      time: "8:45 PM",
      level: "Low",
    },
  ];

  const getRiskColor = (level: ReportItem["level"]) => {
    if (level === "High") return "#F04452";
    if (level === "Moderate") return "#F5B301";
    return "#35B56A";
  };

  // =========================
  // Bottom nav sizing
  // =========================
  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;
  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  const contentBottomPad = useMemo(() => {
    const fabOverlapPad = Math.round(FAB_SIZE * 0.55);
    return navHeight + fabOverlapPad + 18;
  }, [navHeight]);

  // =========================
  // Swipe-up Sheet
  // =========================
  const s = clamp(Math.min(width / 375, height / 812) * 1.04, 0.88, 1.28);

  const SHEET_HEIGHT = useMemo(() => clamp(Math.round(height * 0.31), 240, 320), [height]);
  const SHEET_TOTAL_HEIGHT = useMemo(() => SHEET_HEIGHT + bottomPad, [SHEET_HEIGHT, bottomPad]);

  const sheetY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const openSheet = useCallback(() => {
    sheetY.stopAnimation();
    backdropOpacity.stopAnimation();

    sheetY.setValue(SHEET_HEIGHT);
    backdropOpacity.setValue(0);
    setSheetOpen(true);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(sheetY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
        mass: 0.9,
      }),
    ]).start();
  }, [sheetY, backdropOpacity, SHEET_HEIGHT]);

  const closeSheet = useCallback(() => {
    sheetY.stopAnimation();
    backdropOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetY, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        sheetY.setValue(SHEET_HEIGHT);
        backdropOpacity.setValue(0);
        setSheetOpen(false);

        if (activeTab === "Incident" || activeTab === "Settings") {
          setActiveTab("Home");
        }
      }
    });
  }, [sheetY, backdropOpacity, SHEET_HEIGHT, activeTab]);

  const handlePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dx) < 20,
      onPanResponderMove: (_, g) => {
        const next = clamp(g.dy, 0, SHEET_HEIGHT);
        sheetY.setValue(next);
        const t = clamp(next / SHEET_HEIGHT, 0, 1);
        backdropOpacity.setValue(1 - t);
      },
      onPanResponderRelease: (_, g) => {
        const shouldClose = g.dy > 60 || g.vy > 0.9;
        if (shouldClose) {
          closeSheet();
        } else {
          Animated.parallel([
            Animated.timing(backdropOpacity, {
              toValue: 1,
              duration: 120,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.spring(sheetY, {
              toValue: 0,
              useNativeDriver: true,
              damping: 18,
              stiffness: 220,
              mass: 0.9,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // =========================
  // Bottom nav handlers
  // =========================
  const handleAdminTabPress = useCallback(
    (tab: TabKey) => {
      if (tab === "Home") {
        setActiveTab("Home");
        return;
      }

      if (tab === "Inbox") {
        setActiveTab("Inbox");
        onOpenHotlines?.();
        return;
      }

      if (tab === "Reports") {
        setActiveTab("Reports");
        onOpenReports?.();
        return;
      }

      if (tab === "Settings") {
        setActiveTab("Settings");
        openSheet();
        return;
      }

      if (tab === "Incident") {
        setActiveTab("Incident");
        openSheet();
      }
    },
    [onOpenHotlines, onOpenReports, openSheet]
  );

  const handleFabPress = useCallback(() => {
    setActiveTab("Incident");
    openSheet();
  }, [openSheet]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF3F8" />
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <View style={styles.brandIconWrap}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.brandText}>TahananSafe Admin</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable onPress={onOpenNotifications} style={styles.headerIconButton}>
              <Ionicons name="notifications" size={20} color={Colors.primary} />
              <View style={styles.badgeDot}>
                <Text style={styles.badgeText}>9</Text>
              </View>
            </Pressable>

            <Pressable onPress={onOpenHelp} style={styles.headerIconButton}>
              <Ionicons name="help-circle" size={22} color={Colors.primary} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: contentBottomPad,
          }}
        >
          <LinearGradient
            colors={["#0E5AA7", "#0A4177"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Good morning, Admin!</Text>
                <Text style={styles.heroSubtitle}>
                  Monitor incoming reports, user activity, and urgent cases from one dashboard.
                </Text>

                <View style={styles.heroMetaRow}>
                  <View style={styles.heroMetaChip}>
                    <Ionicons name="warning-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.heroMetaText}>3 urgent alerts</Text>
                  </View>

                  <View style={styles.heroMetaChip}>
                    <Ionicons name="time-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.heroMetaText}>Updated 9:41 AM</Text>
                  </View>
                </View>
              </View>

              <View style={styles.heroIconWrap}>
                <Ionicons name="grid-outline" size={30} color="#D9ECFF" />
              </View>
            </View>

            <View style={styles.paginationWrap}>
              <View style={styles.activeDot} />
              <View style={styles.inactiveDot} />
            </View>
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>System Overview</Text>
          </View>

          <View style={styles.statsGrid}>
            {stats.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.statCard, { width: statCardWidth }]}
                onPress={
                  item.label === "Pending Reports"
                    ? onOpenPendingReports
                    : item.label === "Verified Users"
                    ? onOpenVerifiedUsers
                    : item.label === "Escalated Cases"
                    ? onOpenEscalatedCases
                    : onOpenHotlines
                }
              >
                <View style={styles.statIconWrap}>
                  <Ionicons name={item.icon} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
            <Pressable onPress={onOpenReports}>
              <Text style={styles.seeMoreText}>See more</Text>
            </Pressable>
          </View>

          <View style={styles.listWrap}>
            {recentReports.map((item) => (
              <Pressable
                key={item.id}
                style={styles.reportCard}
                onPress={() => onOpenReportDetail?.(item.id)}
              >
                <View
                  style={[
                    styles.riskIndicator,
                    { backgroundColor: getRiskColor(item.level) },
                  ]}
                />

                <View style={styles.reportMainContent}>
                  <View style={styles.reportTopRow}>
                    <Text style={styles.reportTitle} numberOfLines={1}>
                      {item.title}
                    </Text>

                    <View
                      style={[
                        styles.riskPill,
                        { backgroundColor: `${getRiskColor(item.level)}18` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.riskPillText,
                          { color: getRiskColor(item.level) },
                        ]}
                      >
                        {item.level}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.reportSubtitle} numberOfLines={2}>
                    {item.subtitle}
                  </Text>

                  <View style={styles.reportBottomRow}>
                    <Text style={styles.reportDate}>{item.date}</Text>
                    <Text style={styles.reportTime}>{item.time}</Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.quickActionsRow}>
            {quickActions.map((action) => (
              <Pressable
                key={action.id}
                style={styles.quickActionItem}
                onPress={action.onPress}
              >
                <LinearGradient
                  colors={["#2D6FB5", "#0E5AA7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.quickActionIconWrap,
                    isSmallDevice && { width: 54, height: 54, borderRadius: 16 },
                  ]}
                >
                  <Ionicons name={action.icon} size={22} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleAdminTabPress}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={handleFabPress}
          centerLabel="Admin Menu"
        />

        <Modal
          visible={sheetOpen}
          transparent
          animationType="none"
          onRequestClose={closeSheet}
          statusBarTranslucent
        >
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable style={{ flex: 1 }} onPress={closeSheet} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheetOuter,
              {
                height: SHEET_TOTAL_HEIGHT,
                transform: [{ translateY: sheetY }],
              },
            ]}
          >
            <View style={[styles.sheetCard, { height: SHEET_TOTAL_HEIGHT }]} {...handlePan.panHandlers}>
              <View style={styles.sheetGrabber} />

              <Pressable
                onPress={() => {
                  closeSheet();
                  setActiveTab("Reports");
                  onOpenReports?.();
                }}
                style={({ pressed }) => [
                  styles.actionBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
                ]}
              >
                <Ionicons name="document-text-outline" size={20} color="#fff" style={styles.actionIcon} />
                <Text style={styles.actionText}>View Reports</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  closeSheet();
                  onOpenUsers?.();
                }}
                style={({ pressed }) => [
                  styles.actionBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
                ]}
              >
                <Ionicons name="people-outline" size={20} color="#fff" style={styles.actionIcon} />
                <Text style={styles.actionText}>Manage Users</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  closeSheet();
                  onOpenAnalytics?.();
                }}
                style={({ pressed }) => [
                  styles.actionBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
                ]}
              >
                <Ionicons name="bar-chart-outline" size={20} color="#fff" style={styles.actionIcon} />
                <Text style={styles.actionText}>View Analytics</Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  closeSheet();
                  await handleLogout();
                }}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.dangerBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
                ]}
              >
                <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.actionIcon} />
                <Text style={styles.actionText}>Sign Out</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default AdminHomeScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#EEF3F8",
  },
  container: {
    flex: 1,
    backgroundColor: "#EEF3F8",
    paddingHorizontal: 20,
    position: "relative",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DDEEFF",
  },
  brandText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0E2B4D",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAF2",
    position: "relative",
  },
  badgeDot: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: -4,
    right: -3,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  heroCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
    overflow: "hidden",
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "#D9ECFF",
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 14,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  heroMetaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  paginationWrap: {
    marginTop: 16,
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 6,
  },
  activeDot: {
    width: 18,
    height: 6,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },
  inactiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#213547",
  },
  seeMoreText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: Colors.primary,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 22,
  },
  statCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E6EDF5",
    minHeight: 108,
    justifyContent: "space-between",
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EAF3FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#102A43",
  },
  statLabel: {
    fontSize: 12.5,
    color: "#5B6B7A",
    fontWeight: "600",
    lineHeight: 17,
  },

  listWrap: {
    gap: 12,
    marginBottom: 22,
  },
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EDF5",
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  riskIndicator: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 10,
  },
  reportMainContent: {
    flex: 1,
  },
  reportTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  reportTitle: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "800",
    color: "#1E2E3E",
  },
  riskPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  riskPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  reportSubtitle: {
    fontSize: 12.5,
    color: "#657586",
    lineHeight: 18,
    marginBottom: 8,
  },
  reportBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reportDate: {
    fontSize: 12,
    color: "#7B8794",
    fontWeight: "500",
  },
  reportTime: {
    fontSize: 12,
    color: "#7B8794",
    fontWeight: "500",
  },

  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  quickActionItem: {
    flex: 1,
    alignItems: "center",
  },
  quickActionIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    elevation: 3,
    shadowColor: "#0E5AA7",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  quickActionLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#34495E",
    textAlign: "center",
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
  },

  sheetOuter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 64,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#D7E3F2",
    marginBottom: 14,
  },

  actionBtn: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#083B67",
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  dangerBtn: {
    backgroundColor: "#0B2B45",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  actionIcon: {
    marginTop: 1,
    marginRight: 10,
  },
});