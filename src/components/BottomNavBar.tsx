// src/components/BottomNavBar.tsx
import React, { useMemo, useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { Colors, useColors } from "../theme/colors";
import QuickActions from "./HomeScreen/QuickActions";

export type TabKey =
  | "Home"
  | "Inbox"
  | "Incident"
  | "Community"
  | "Reports"
  | "Ledger"
  | "Settings";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;

  navHeight: number;
  paddingBottom: number;

  // compatibility (kept so other screens don't break)
  chevronBottom: number;
  fabBottom?: number;

  fabSize?: number;

  onFabPress?: () => void;
  onFabLongPress?: () => void;
  fabQuickActions?: boolean;
  onQuickExit?: () => void;

  centerLabel?: string;
  centerLabelActive?: boolean;

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

export default function BottomNavBar({
  activeTab,
  onTabPress,
  navHeight,
  paddingBottom,
  chevronBottom,
  fabBottom,
  fabSize = 68,
  onFabPress,
  onFabLongPress,
  fabQuickActions = false,
  onQuickExit,
  centerLabel,
  centerLabelActive = false,
  Chevron,
}: Props) {
  const { width } = useWindowDimensions();
  const { s } = useMemo(() => makeScale(width), [width]);
  const TC = useColors();
  const navBg = TC.isDark ? "#1E293B" : NAV_BG;
  const inactive = TC.isDark ? "#64748B" : INACTIVE;
  const activePrimary = TC.primary;
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const quickActionsAnim = useRef(new Animated.Value(0)).current;

  const EXTRA_BAR_HEIGHT = useMemo(
    () => clamp(Math.round(12 * s), 10, 18),
    [s]
  );

  const iconSize = useMemo(() => clamp(Math.round(22 * s), 19, 26), [s]);
  const labelFont = useMemo(() => clamp(Math.round(10 * s), 9, 12), [s]);
  const labelMarginTop = useMemo(() => clamp(Math.round(3 * s), 2, 4), [s]);

  const navPaddingTop = useMemo(() => clamp(Math.round(12 * s), 10, 16), [s]);
  const navPaddingHorizontal = useMemo(
    () => clamp(Math.round(8 * s), 6, 14),
    [s]
  );
  const itemPaddingBottom = useMemo(
    () => clamp(Math.round(12 * s), 10, 16),
    [s]
  );

  const effectiveNavHeight = useMemo(
    () => navHeight + EXTRA_BAR_HEIGHT,
    [navHeight, EXTRA_BAR_HEIGHT]
  );
  const centerFabBottom = useMemo(
    () => fabBottom ?? navHeight - fabSize / 2 - 10,
    [fabBottom, fabSize, navHeight]
  );
  const centerFabIconSize = useMemo(
    () => clamp(Math.round(30 * s), 26, 34),
    [s]
  );
  const quickActionsFs = useMemo(() => clamp(s * 1.06, 0.95, 1.3), [s]);

  const toggleQuickActions = useCallback(() => {
    if (quickActionsOpen) {
      Animated.timing(quickActionsAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setQuickActionsOpen(false));
      return;
    }

    setQuickActionsOpen(true);
    Animated.sequence([
      Animated.timing(quickActionsAnim, {
        toValue: 0.92,
        duration: 400,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(quickActionsAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 150,
      }),
    ]).start();
  }, [quickActionsAnim, quickActionsOpen]);
  const fabArchSize = useMemo(
    () => clamp(Math.round(fabSize + 34 * s), fabSize + 28, fabSize + 44),
    [fabSize, s]
  );

  /* ===================== TAB CLICK ANIMATIONS ===================== */
  const tabScalesRef = useRef<Record<TabKey, Animated.Value>>({
    Home: new Animated.Value(1),
    Inbox: new Animated.Value(1),
    Incident: new Animated.Value(1),
    Community: new Animated.Value(1),
    Reports: new Animated.Value(1),
    Ledger: new Animated.Value(1),
    Settings: new Animated.Value(1),
  });

  const pressInScale = useMemo(() => 0.92, []);
  const popUpScale = useMemo(() => 1.08, []);
  const settleScale = useMemo(() => 1.0, []);

  const animateTabPress = useCallback((tab: TabKey) => {
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
  }, [popUpScale, settleScale]);

  const handleTabPress = useCallback(
    (tab: TabKey) => {
      animateTabPress(tab);
      onTabPress(tab);
    },
    [animateTabPress, onTabPress]
  );
  /* ============================================================ */

  const styles = useMemo(
    () =>
      StyleSheet.create({
        chevronWrap: {
          position: "absolute",
          left: 0,
          right: 0,
          alignItems: "center",
          justifyContent: "center",
        },

        navWrap: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: effectiveNavHeight,
          paddingBottom,
          backgroundColor: NAV_BG,
          borderTopWidth: 0,
          flexDirection: "row",
          alignItems: "flex-end",
          paddingTop: navPaddingTop + EXTRA_BAR_HEIGHT * 0.25,
          paddingHorizontal: navPaddingHorizontal,
          zIndex: 1,
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

        centerSpacer: {
          flex: 1,
          minWidth: 0,
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: itemPaddingBottom + EXTRA_BAR_HEIGHT * 0.35,
        },

        centerFabWrap: {
          position: "absolute",
          left: 0,
          right: 0,
          alignItems: "center",
          zIndex: 3,
          elevation: 3,
        },

        centerFabButton: {
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          zIndex: 2,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
            },
            android: { elevation: 10 },
          }),
        },

        centerFabArchClip: {
          position: "absolute",
          bottom: fabSize / 2,
          width: fabArchSize,
          height: fabArchSize / 2,
          overflow: "hidden",
          alignItems: "center",
          zIndex: 1,
        },

        centerFabArch: {
          width: fabArchSize,
          height: fabArchSize,
          borderRadius: fabArchSize / 2,
          backgroundColor: navBg,
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
        centerLabel: {
          marginTop: labelMarginTop,
          fontSize: labelFont,
          fontWeight: "600",
          includeFontPadding: false,
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
      fabArchSize,
      fabSize,
      navBg,
    ]
  );

  return (
    <>
      {Chevron ? (
        <View
          style={[styles.chevronWrap, { bottom: chevronBottom }]}
          pointerEvents="none"
        >
          <Chevron
            width={clamp(Math.round(22 * s), 18, 26)}
            height={clamp(Math.round(22 * s), 18, 26)}
          />
        </View>
      ) : null}

      <View style={[styles.navWrap, { backgroundColor: navBg }]}>
        <NavItem
          icon="home-outline"
          activeIcon="home"
          label="Home"
          active={activeTab === "Home"}
          onPress={() => handleTabPress("Home")}
          iconSize={iconSize}
          labelStyle={[styles.label, { color: inactive }]}
          labelActiveStyle={{ color: activePrimary }}
          itemStyle={styles.item}
          innerStyle={styles.itemInner}
          scaleAnim={tabScalesRef.current.Home}
          pressInScale={pressInScale}
          activeColor={activePrimary}
          inactiveColor={inactive}
        />

        <NavItem
          icon="call-outline"
          activeIcon="call"
          label="Hotlines"
          active={activeTab === "Inbox"}
          onPress={() => handleTabPress("Inbox")}
          iconSize={iconSize}
          labelStyle={[styles.label, { color: inactive }]}
          labelActiveStyle={{ color: activePrimary }}
          itemStyle={styles.item}
          innerStyle={styles.itemInner}
          scaleAnim={tabScalesRef.current.Inbox}
          pressInScale={pressInScale}
          activeColor={activePrimary}
          inactiveColor={inactive}
        />

        <View style={styles.centerSpacer} pointerEvents="none">
          {centerLabel ? (
            <Text
              style={[
                styles.centerLabel,
                { color: centerLabelActive ? activePrimary : inactive },
              ]}
              allowFontScaling={false}
            >
              {centerLabel}
            </Text>
          ) : null}
        </View>

        <NavItem
          icon="stats-chart-outline"
          activeIcon="stats-chart"
          label="Reports"
          active={activeTab === "Reports"}
          onPress={() => handleTabPress("Reports")}
          iconSize={iconSize}
          labelStyle={[styles.label, { color: inactive }]}
          labelActiveStyle={{ color: activePrimary }}
          itemStyle={styles.item}
          innerStyle={styles.itemInner}
          scaleAnim={tabScalesRef.current.Reports}
          pressInScale={pressInScale}
          activeColor={activePrimary}
          inactiveColor={inactive}
        />

        <NavItem
          icon="settings-outline"
          activeIcon="settings"
          label="Settings"
          active={activeTab === "Settings"}
          onPress={() => handleTabPress("Settings")}
          iconSize={iconSize}
          labelStyle={[styles.label, { color: inactive }]}
          labelActiveStyle={{ color: activePrimary }}
          itemStyle={styles.item}
          innerStyle={styles.itemInner}
          scaleAnim={tabScalesRef.current.Settings}
          pressInScale={pressInScale}
          activeColor={activePrimary}
          inactiveColor={inactive}
        />
      </View>

      {onFabPress && fabQuickActions && quickActionsOpen ? (
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFillObject, { zIndex: 10, opacity: quickActionsAnim }]}
        >
          <Pressable
            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.22)" }]}
            onPress={toggleQuickActions}
          />
        </Animated.View>
      ) : null}

      {onFabPress && fabQuickActions ? (
        <QuickActions
          isOpen={quickActionsOpen}
          animation={quickActionsAnim}
          navHeight={navHeight}
          fabBottom={centerFabBottom}
          fabSize={fabSize}
          s={s}
          fs={quickActionsFs}
          onToggle={toggleQuickActions}
          onIncidentLog={onFabPress}
          onSos={() => onTabPress("Home")}
          onServices={() => onTabPress("Home")}
          onHideApp={() => onQuickExit?.()}
          onSignOut={() => onQuickExit?.()}
        />
      ) : onFabPress ? (
        <View
          style={[styles.centerFabWrap, { bottom: centerFabBottom }]}
          pointerEvents="box-none"
        >
          <View pointerEvents="none" style={styles.centerFabArchClip}>
            <View style={styles.centerFabArch} />
          </View>

          <Pressable
            onPress={onFabPress}
            onLongPress={onFabLongPress}
            hitSlop={10}
            style={({ pressed }) => [
              styles.centerFabButton,
              {
                width: fabSize,
                height: fabSize,
                borderRadius: fabSize / 2,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <LinearGradient
              colors={TC.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="add" size={centerFabIconSize} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}
    </>
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
  activeColor,
  inactiveColor,
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
  activeColor?: string;
  inactiveColor?: string;
}) {
  const iconColor = active ? (activeColor ?? Colors.primary) : (inactiveColor ?? "#9AA4B2");
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
          color={iconColor}
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
