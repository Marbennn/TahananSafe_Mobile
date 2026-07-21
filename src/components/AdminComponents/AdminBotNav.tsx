// src/components/AdminComponents/AdminBotNav.tsx
import React, { useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, useColors } from "../../theme/colors";

export type TabKey =
  | "Home"
  | "Inbox"
  | "Incident"
  | "Community"
  | "Map"
  | "Reports"
  | "Ledger"
  | "Settings";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;

  navHeight: number;
  paddingBottom: number;

  // kept for compatibility — unused after FAB removal
  chevronBottom?: number;
  fabBottom?: number;
  fabSize?: number;
  onFabPress?: () => void;
  onFabLongPress?: () => void;
  centerLabel?: string;
  Chevron?: React.ComponentType<{ width?: number; height?: number }>;
};

const NAV_BG = "#FFFFFF";
const INACTIVE = "#9AA4B2";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function makeScale(width: number) {
  const baseW = 375;
  const s = clamp(width / baseW, 0.86, 1.2);
  return { s };
}

export default function AdminBotNav({
  activeTab,
  onTabPress,
  navHeight,
  paddingBottom,
}: Props) {
  const TC = useColors();
  const { width } = useWindowDimensions();
  const { s } = useMemo(() => makeScale(width), [width]);
  const compact = width < 340;

  const EXTRA_BAR_HEIGHT = useMemo(
    () => clamp(Math.round(12 * s), 10, 18),
    [s]
  );

  const iconSize = useMemo(() => clamp(Math.round(22 * s), 19, 26), [s]);
  const labelFont = useMemo(
    () => clamp(Math.round(10 * s), compact ? 8 : 9, 12),
    [s, compact]
  );
  const labelMarginTop = useMemo(() => clamp(Math.round(3 * s), 2, 4), [s]);

  const navPaddingTop = useMemo(() => clamp(Math.round(12 * s), 10, 16), [s]);
  const navPaddingHorizontal = useMemo(
    () => clamp(Math.round(8 * s), compact ? 3 : 6, 14),
    [s, compact]
  );
  const itemPaddingBottom = useMemo(
    () => clamp(Math.round(12 * s), 10, 16),
    [s]
  );

  const effectiveNavHeight = useMemo(
    () => navHeight + EXTRA_BAR_HEIGHT,
    [navHeight, EXTRA_BAR_HEIGHT]
  );

  /* ── Tab click animations ── */
  const tabScalesRef = useRef<Record<TabKey, Animated.Value>>({
    Home: new Animated.Value(1),
    Inbox: new Animated.Value(1),
    Incident: new Animated.Value(1),
    Community: new Animated.Value(1),
    Map: new Animated.Value(1),
    Reports: new Animated.Value(1),
    Ledger: new Animated.Value(1),
    Settings: new Animated.Value(1),
  });

  const pressInScale = useMemo(() => 0.92, []);
  const popUpScale = useMemo(() => 1.08, []);
  const settleScale = useMemo(() => 1.0, []);

  const animateTabPress = useCallback(
    (tab: TabKey) => {
      const v = tabScalesRef.current[tab];
      if (!v) return;
      v.stopAnimation();
      Animated.sequence([
        Animated.timing(v, {
          toValue: popUpScale,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.spring(v, {
          toValue: settleScale,
          friction: 6,
          tension: 180,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [popUpScale, settleScale]
  );

  const handleTabPress = useCallback(
    (tab: TabKey) => {
      animateTabPress(tab);
      onTabPress(tab);
    },
    [animateTabPress, onTabPress]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        navWrap: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: effectiveNavHeight,
          paddingBottom,
          backgroundColor: NAV_BG,
          borderTopWidth: 0,
          alignItems: "flex-end",
          justifyContent: "center",
          paddingTop: navPaddingTop + EXTRA_BAR_HEIGHT * 0.25,
          paddingHorizontal: navPaddingHorizontal,
          zIndex: 1,
        },

        itemsRow: {
          width: "100%",
          maxWidth: 840,
          flexDirection: "row",
          alignItems: "flex-end",
          alignSelf: "center",
        },

        item: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: itemPaddingBottom + EXTRA_BAR_HEIGHT * 0.35,
          minWidth: 0,
        },

        itemInner: {
          alignItems: "center",
          justifyContent: "center",
        },

        label: {
          marginTop: labelMarginTop,
          fontSize: labelFont,
          color: INACTIVE,
          fontWeight: "600",
          includeFontPadding: false,
        },
        labelActive: {
          color: Colors.primary,
          fontWeight: "800",
        },
      }),
    [
      effectiveNavHeight,
      paddingBottom,
      navPaddingTop,
      navPaddingHorizontal,
      itemPaddingBottom,
      labelMarginTop,
      labelFont,
      EXTRA_BAR_HEIGHT,
    ]
  );

  return (
    <View style={[styles.navWrap, { backgroundColor: TC.surface }]}>
      <View style={styles.itemsRow}>
      <NavItem
        icon="home-outline"
        activeIcon="home"
        label="Home"
        active={activeTab === "Home"}
        onPress={() => handleTabPress("Home")}
        iconSize={iconSize}
        labelStyle={styles.label}
        labelActiveStyle={[styles.labelActive, { color: TC.primary }]}
        itemStyle={styles.item}
        innerStyle={styles.itemInner}
        scaleAnim={tabScalesRef.current.Home}
        pressInScale={pressInScale}
      />

      <NavItem
        icon="notifications-outline"
        activeIcon="notifications"
        label="Alerts"
        active={activeTab === "Inbox"}
        onPress={() => handleTabPress("Inbox")}
        iconSize={iconSize}
        labelStyle={styles.label}
        labelActiveStyle={[styles.labelActive, { color: TC.primary }]}
        itemStyle={styles.item}
        innerStyle={styles.itemInner}
        scaleAnim={tabScalesRef.current.Inbox}
        pressInScale={pressInScale}
      />

      <NavItem
        icon="map-outline"
        activeIcon="map"
        label="Map"
        active={activeTab === "Map"}
        onPress={() => handleTabPress("Map")}
        iconSize={iconSize}
        labelStyle={styles.label}
        labelActiveStyle={[styles.labelActive, { color: TC.primary }]}
        itemStyle={styles.item}
        innerStyle={styles.itemInner}
        scaleAnim={tabScalesRef.current.Map}
        pressInScale={pressInScale}
      />

      <NavItem
        icon="people-outline"
        activeIcon="people"
        label="Community"
        active={activeTab === "Community"}
        onPress={() => handleTabPress("Community")}
        iconSize={iconSize}
        labelStyle={styles.label}
        labelActiveStyle={[styles.labelActive, { color: TC.primary }]}
        itemStyle={styles.item}
        innerStyle={styles.itemInner}
        scaleAnim={tabScalesRef.current.Community}
        pressInScale={pressInScale}
      />

      <NavItem
        icon="stats-chart-outline"
        activeIcon="stats-chart"
        label="Reports"
        active={activeTab === "Reports"}
        onPress={() => handleTabPress("Reports")}
        iconSize={iconSize}
        labelStyle={styles.label}
        labelActiveStyle={[styles.labelActive, { color: TC.primary }]}
        itemStyle={styles.item}
        innerStyle={styles.itemInner}
        scaleAnim={tabScalesRef.current.Reports}
        pressInScale={pressInScale}
      />

      <NavItem
        icon="settings-outline"
        activeIcon="settings"
        label="Settings"
        active={activeTab === "Settings"}
        onPress={() => handleTabPress("Settings")}
        iconSize={iconSize}
        labelStyle={styles.label}
        labelActiveStyle={[styles.labelActive, { color: TC.primary }]}
        itemStyle={styles.item}
        innerStyle={styles.itemInner}
        scaleAnim={tabScalesRef.current.Settings}
        pressInScale={pressInScale}
      />
      </View>
    </View>
  );
}

function NavItem({
  icon,
  activeIcon,
  label,
  active,
  onPress,
  iconSize,
  itemStyle,
  innerStyle,
  labelStyle,
  labelActiveStyle,
  scaleAnim,
  pressInScale,
}: {
  icon: IoniconName;
  activeIcon?: IoniconName;
  label: string;
  active: boolean;
  onPress: () => void;
  iconSize: number;
  itemStyle: any;
  innerStyle: any;
  labelStyle: any;
  labelActiveStyle: any;
  scaleAnim: Animated.Value;
  pressInScale: number;
}) {
  const handlePressIn = useCallback(() => {
    scaleAnim.stopAnimation();
    Animated.timing(scaleAnim, {
      toValue: pressInScale,
      duration: 90,
      useNativeDriver: true,
    }).start();
  }, [pressInScale, scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 90,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={itemStyle}
      hitSlop={10}
      android_ripple={
        Platform.OS === "android"
          ? { color: "rgba(0,0,0,0.08)", borderless: true }
          : undefined
      }
    >
      <Animated.View style={[innerStyle, { transform: [{ scale: scaleAnim }] }]}>
        <Ionicons
          name={active && activeIcon ? activeIcon : icon}
          size={iconSize}
          color={active ? Colors.primary : "#9AA4B2"}
        />
        <Text
          style={[labelStyle, active && labelActiveStyle]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
