// src/screens/HomeScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";

import GreetingCard from "../components/HomeScreen/GreetingCard";
import RecentLogCard, { LogItem } from "../components/HomeScreen/RecentLogCard";
import QuickActions from "../components/HomeScreen/QuickActions";

import HomeScreenLogo from "../../assets/HomeScreen/HomeScreenLogo.svg";

type Props = {
  onQuickExit?: () => void;
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;

  // ✅ NEW
  onOpenNotifications?: () => void;
};

const BG = "#F5FAFE";
const TEXT_DARK = "#0B2B45";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function HomeScreen({
  onQuickExit,
  onTabChange,
  initialTab = "Home",
  onOpenNotifications,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // ✅ Tutorial overlay state
  const [showFabTutorial, setShowFabTutorial] = useState(false);

  // OPTIONAL: auto-show tutorial on first mount (simple version)
  useEffect(() => {
    setShowFabTutorial(true);
  }, []);

  // ✅ scale based on common mobile width (375)
  const s = useMemo(() => clamp(width / 375, 0.9, 1.25), [width]);

  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  // ✅ FIX: add enough space so content won't go under the nav + FAB overlap
  const CONTENT_BOTTOM_PAD = useMemo(() => {
    const fabOverlapPad = Math.round(FAB_SIZE * 0.55);
    return navHeight + fabOverlapPad + 16;
  }, [navHeight]);

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const pressFab = () => handleTab("Incident");
  const longPressFab = () => onQuickExit?.();

  const notifCount = 69;

  const now = useMemo(() => new Date(), []);
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, [now]);

  const dateLine = useMemo(() => {
    const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
    const monthDayYear = now.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const time = now.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${weekday} | ${monthDayYear} | ${time}`;
  }, [now]);

  const logs: LogItem[] = useMemo(
    () => [
      {
        id: "log-1",
        title: "Sinipa ng tatay",
        detail: "On January 12, 2026, at approximately 8:30 PM,",
        dateLeft: "January 12, 2026",
        timeLeft: "8:30 PM",
        dateRight: "January 20, 2026",
        timeRight: "12:00 PM",
      },
      {
        id: "log-2",
        title: "Sinipa ng tatay",
        detail: "On January 12, 2026, at approximately 8:30 PM,",
        dateLeft: "January 12, 2026",
        timeLeft: "8:30 PM",
        dateRight: "January 20, 2026",
        timeRight: "12:00 PM",
      },
    ],
    []
  );

  const PAD = useMemo(() => clamp(Math.round(16 * s), 12, 20), [s]);
  const GAP = useMemo(() => clamp(Math.round(16 * s), 12, 18), [s]);

  const logoW = clamp(Math.round(width * 0.48), 150, 230);
  const logoH = clamp(Math.round(36 * s), 30, 42);

  const iconBtnSize = clamp(Math.round(38 * s), 34, 44);
  const notifIconSize = clamp(Math.round(20 * s), 18, 24);
  const helpIconSize = clamp(Math.round(22 * s), 20, 26);

  // ✅ NEW: small extra top padding only (SafeAreaView already handles insets.top)
  const HEADER_TOP_PAD = useMemo(() => clamp(Math.round(6 * s), 2, 10), [s]);

  // ✅ Tutorial positioning (based on center FAB)
  const fabCenterX = width / 2;
  const ringSize = Math.round(FAB_SIZE + 18);
  const ringLeft = fabCenterX - ringSize / 2;

  // BottomNavBar likely positions the FAB with bottom=fabBottom and centered horizontally.
  // Align the ring with the same bottom, but compensate for the ring being bigger.
  const ringBottom = fabBottom - (ringSize - FAB_SIZE) / 2;

  // Arrow + tooltip positioning
  const arrowSize = clamp(Math.round(30 * s), 26, 34);
  const tooltipMaxW = clamp(Math.round(width * 0.78), 260, 340);

  // place tooltip above the ring
  const tooltipBottom = ringBottom + ringSize + clamp(Math.round(14 * s), 12, 18);
  const tooltipLeft = clamp(Math.round(fabCenterX - tooltipMaxW / 2), 12, width - tooltipMaxW - 12);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: BG },
        page: { flex: 1, backgroundColor: BG, position: "relative" },

        topBar: {
          paddingHorizontal: PAD,
          paddingTop: HEADER_TOP_PAD,
          paddingBottom: clamp(Math.round(10 * s), 6, 14),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },

        logoWrap: {
          height: logoH,
          width: logoW,
          justifyContent: "center",
        },

        rightActions: {
          flexDirection: "row",
          alignItems: "center",
          gap: clamp(Math.round(14 * s), 10, 16),
        },

        iconBtn: {
          width: iconBtnSize,
          height: iconBtnSize,
          borderRadius: 999,
          backgroundColor: "#F0F6FF",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "#E7EEF7",
        },

        badge: {
          position: "absolute",
          right: -3,
          top: -3,
          minWidth: clamp(Math.round(20 * s), 18, 22),
          height: clamp(Math.round(20 * s), 18, 22),
          paddingHorizontal: clamp(Math.round(6 * s), 5, 7),
          borderRadius: 999,
          backgroundColor: "#EF4444",
          alignItems: "center",
          justifyContent: "center",
        },
        badgeText: {
          fontSize: clamp(Math.round(10 * s), 9, 12),
          fontWeight: "900",
          color: "#fff",
          lineHeight: clamp(Math.round(12 * s), 10, 14),
        },

        scrollContent: {
          paddingTop: clamp(Math.round(10 * s), 8, 12),
          rowGap: GAP,
        },

        sectionRow: {
          marginTop: clamp(Math.round(6 * s), 4, 8),
          paddingHorizontal: PAD,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        sectionTitle: {
          fontSize: clamp(Math.round(12 * s), 11, 14),
          fontWeight: "800",
          color: TEXT_DARK,
        },
        seeMore: {
          fontSize: clamp(Math.round(11 * s), 10, 13),
          fontWeight: "800",
          color: Colors.link,
        },

        logsWrap: {
          paddingHorizontal: PAD,
          paddingTop: clamp(Math.round(10 * s), 8, 12),
          gap: clamp(Math.round(12 * s), 10, 14),
        },

        // ✅ Tutorial overlay styles
        tutorialOverlay: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "flex-end",
          // keep it above BottomNavBar
          zIndex: 999,
          elevation: 999,
        },
        dimmer: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.45)",
        },
        highlightRing: {
          position: "absolute",
          width: ringSize,
          height: ringSize,
          left: ringLeft,
          bottom: ringBottom,
          borderRadius: 999,
          borderWidth: 3,
          borderColor: "rgba(255,255,255,0.95)",
          backgroundColor: "transparent",
        },
        arrowWrap: {
          position: "absolute",
          left: fabCenterX - arrowSize / 2,
          bottom: ringBottom + ringSize + clamp(Math.round(4 * s), 2, 6),
          alignItems: "center",
          justifyContent: "center",
        },
        tooltip: {
          position: "absolute",
          left: tooltipLeft,
          bottom: tooltipBottom,
          width: tooltipMaxW,
          backgroundColor: "rgba(255,255,255,0.96)",
          borderRadius: 16,
          paddingVertical: clamp(Math.round(10 * s), 9, 12),
          paddingHorizontal: clamp(Math.round(12 * s), 10, 14),
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.9)",
        },
        tooltipTitle: {
          fontSize: clamp(Math.round(13 * s), 12, 15),
          fontWeight: "900",
          color: "#0B2B45",
        },
        tooltipText: {
          marginTop: 6,
          fontSize: clamp(Math.round(12 * s), 11, 14),
          fontWeight: "700",
          color: "#244A66",
          lineHeight: clamp(Math.round(16 * s), 14, 18),
        },
        tooltipHint: {
          marginTop: 10,
          fontSize: clamp(Math.round(11 * s), 10, 12),
          fontWeight: "800",
          color: Colors.link,
          alignSelf: "flex-end",
        },
      }),
    [
      PAD,
      GAP,
      s,
      logoW,
      logoH,
      iconBtnSize,
      HEADER_TOP_PAD,
      ringSize,
      ringLeft,
      ringBottom,
      fabCenterX,
      arrowSize,
      tooltipLeft,
      tooltipBottom,
      tooltipMaxW,
    ]
  );

  const closeTutorial = () => setShowFabTutorial(false);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Top header */}
        <View style={styles.topBar}>
          <View style={styles.logoWrap}>
            <HomeScreenLogo width={logoW} height={logoH} />
          </View>

          <View style={styles.rightActions}>
            <Pressable
              onPress={onOpenNotifications ?? (() => {})}
              hitSlop={12}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons
                name="notifications-outline"
                size={notifIconSize}
                color={TEXT_DARK}
              />
              {notifCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {notifCount > 99 ? "99+" : String(notifCount)}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => {}}
              hitSlop={12}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons
                name="help-circle-outline"
                size={helpIconSize}
                color={TEXT_DARK}
              />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ bottom: CONTENT_BOTTOM_PAD }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_BOTTOM_PAD },
          ]}
        >
          <GreetingCard greeting={greeting} dateLine={dateLine} />

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>
            <Pressable onPress={() => {}} hitSlop={10}>
              <Text style={styles.seeMore}>See more</Text>
            </Pressable>
          </View>

          <View style={styles.logsWrap}>
            {logs.map((item) => (
              <RecentLogCard key={item.id} item={item} onPress={() => {}} />
            ))}
          </View>

          <QuickActions
            onSignOut={() => onQuickExit?.()}
            onHideApp={() => onQuickExit?.()}
            onAlert={() => {}}
            onProfile={() => {}}
          />
        </ScrollView>

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

        {/* ✅ FAB Tutorial Overlay */}
        {showFabTutorial ? (
          <View style={styles.tutorialOverlay} pointerEvents="box-none">
            {/* Dimmer (tap anywhere to dismiss) */}
            <Pressable style={styles.dimmer} onPress={closeTutorial} />

            {/* Highlight ring around FAB */}
            <View style={styles.highlightRing} pointerEvents="none" />

            {/* Arrow pointing DOWN to the FAB */}
            <View style={styles.arrowWrap} pointerEvents="none">
              <Ionicons name="arrow-down" size={arrowSize} color="#FFFFFF" />
            </View>

            {/* Tooltip */}
            <View style={styles.tooltip} pointerEvents="none">
              <Text style={styles.tooltipTitle}>Create an Incident Log</Text>
              <Text style={styles.tooltipText}>
                Tap the <Text style={{ fontWeight: "900" }}>+</Text> button to add a new report.
              </Text>
              <Text style={styles.tooltipHint}>Tap anywhere to continue</Text>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
