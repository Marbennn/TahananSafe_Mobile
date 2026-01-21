// src/screens/HomeScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";

// ✅ NEW components
import GreetingCard from "../components/HomeScreen/GreetingCard";
import RecentLogCard, { LogItem } from "../components/HomeScreen/RecentLogCard";
import QuickActions from "../components/HomeScreen/QuickActions";

type Props = {
  onQuickExit?: () => void;
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
};

export default function HomeScreen({
  onQuickExit,
  onTabChange,
  initialTab = "Home",
}: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Bottom nav sizing
  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  // ✅ keep content safely above the navbar (less empty space)
  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + 6;

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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Top header */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={styles.brandRow}>
            <Image
              source={require("../../assets/HomeScreen/HomeScreenLogo.png")}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandText}>TahananSafe</Text>
          </View>

          <Pressable
            onPress={() => {}}
            hitSlop={12}
            style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={Colors.primary}
            />
            {notifCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {notifCount > 99 ? "99+" : String(notifCount)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: CONTENT_BOTTOM_PAD }}
        >
          {/* Greeting card component (SVG-based) */}
          <GreetingCard greeting={greeting} dateLine={dateLine} />

          {/* Recent Logs header */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>
            <Pressable onPress={() => {}} hitSlop={10}>
              <Text style={styles.seeMore}>See more</Text>
            </Pressable>
          </View>

          {/* Recent logs cards */}
          <View style={styles.logsWrap}>
            {logs.map((item) => (
              <RecentLogCard key={item.id} item={item} onPress={() => {}} />
            ))}
          </View>

          {/* ✅ Quick Actions extracted */}
          <QuickActions
            onSignOut={() => onQuickExit?.()}
            onHideApp={() => onQuickExit?.()}
            onAlert={() => {}}
            onProfile={() => {}}
          />
        </ScrollView>

        {/* Bottom nav */}
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

const BG = "#F5FAFE";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  page: { flex: 1, backgroundColor: BG },

  topBar: {
    paddingHorizontal: 14,
    paddingBottom: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandLogo: { width: 18, height: 18 },
  brandText: { fontSize: 14, fontWeight: "800", color: Colors.primary },

  bellBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  badge: {
    position: "absolute",
    right: 3,
    top: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },

  sectionRow: {
    marginTop: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 12, fontWeight: "800", color: "#0B2B45" },
  seeMore: { fontSize: 11, fontWeight: "800", color: Colors.link },

  logsWrap: { paddingHorizontal: 14, paddingTop: 10, gap: 10 },
});
