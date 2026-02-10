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

import HomeScreenLogo from "../../assets/HomeScreen/NewLogo.svg";

// ✅ Tutorial overlay
import FabTutorialOverlay from "../components/Tutorial/FabTutorialOverlay";

// ✅ Auth context (real logged in user)
import { useAuth } from "../auth/AuthContext";

// ✅ use existing session token + me API
import { getAccessToken } from "../auth/session";
import { getMeApi } from "../api/pin";

type Props = {
  onQuickExit?: () => void;
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;

  onOpenNotifications?: () => void;
};

const BG = "#F5FAFE";
const TEXT_DARK = "#0B2B45";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function makeGreeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function makeDateLine(d: Date) {
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
  const monthDayYear = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${weekday} | ${monthDayYear} | ${time}`;
}

export default function HomeScreen({
  onQuickExit,
  onTabChange,
  initialTab = "Home",
  onOpenNotifications,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // ✅ real user from AuthContext
  const { user, setUser } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // ✅ Tutorial overlay state
  const [showFabTutorial, setShowFabTutorial] = useState(false);

  useEffect(() => {
    setShowFabTutorial(true);
  }, []);

  // ✅ Fetch real profile once to populate AuthContext.user
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const existingFirst =
          typeof user?.firstName === "string" ? user.firstName.trim() : "";
        if (existingFirst.length > 0) return;

        const token = await getAccessToken();
        if (!token) return;

        const me = await getMeApi({ accessToken: token });
        const apiUser: any = me?.user ?? me;

        const firstName =
          (typeof apiUser?.firstName === "string" && apiUser.firstName.trim()) ||
          (typeof apiUser?.profile?.firstName === "string" &&
            apiUser.profile.firstName.trim()) ||
          (typeof apiUser?.personalInfo?.firstName === "string" &&
            apiUser.personalInfo.firstName.trim()) ||
          "";

        const lastName =
          (typeof apiUser?.lastName === "string" && apiUser.lastName.trim()) ||
          (typeof apiUser?.profile?.lastName === "string" &&
            apiUser.profile.lastName.trim()) ||
          (typeof apiUser?.personalInfo?.lastName === "string" &&
            apiUser.personalInfo.lastName.trim()) ||
          "";

        const nextUser = {
          _id: String(apiUser?._id ?? apiUser?.id ?? ""),
          email: String(apiUser?.email ?? ""),
          firstName,
          lastName,
          gender: apiUser?.gender,
          phoneNumber: apiUser?.phoneNumber,
          dateOfBirth: apiUser?.dateOfBirth,
          age: apiUser?.age,
          hasPin: !!apiUser?.hasPin,
          profileImage: apiUser?.profileImage,
        };

        if (!mounted) return;

        if (nextUser.email || nextUser._id || nextUser.firstName) {
          setUser(nextUser as any);
        }
      } catch {
        // ignore (home should still load)
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, setUser]);

  // ✅ LIVE CLOCK: update every minute so time + greeting stays current
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    // tick now immediately on mount
    setNow(new Date());

    const id = setInterval(() => {
      setNow(new Date());
    }, 60 * 1000); // ✅ every minute

    return () => clearInterval(id);
  }, []);

  const greeting = useMemo(() => makeGreeting(now), [now]);
  const dateLine = useMemo(() => makeDateLine(now), [now]);

  // ✅ Real firstName
  const userName = useMemo(() => {
    const fn = user?.firstName;
    if (typeof fn === "string" && fn.trim().length > 0) return fn.trim();
    return "User";
  }, [user]);

  // ✅ scale based on common mobile width (375)
  const s = useMemo(() => clamp(width / 375, 0.9, 1.25), [width]);

  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

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

  const HEADER_TOP_PAD = useMemo(() => clamp(Math.round(6 * s), 2, 10), [s]);

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
      }),
    [PAD, GAP, s, logoW, logoH, iconBtnSize, HEADER_TOP_PAD]
  );

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
          {/* ✅ LIVE GREETING + LIVE DATE/TIME */}
          <GreetingCard greeting={greeting} dateLine={dateLine} userName={userName} />

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

        <FabTutorialOverlay
          visible={showFabTutorial}
          onClose={() => setShowFabTutorial(false)}
          width={width}
          s={s}
          fabSize={FAB_SIZE}
          fabBottom={fabBottom}
          navHeight={navHeight}
          title="Create an Incident Log"
          message="Tap the + button to add a new report."
        />
      </View>
    </SafeAreaView>
  );
}
