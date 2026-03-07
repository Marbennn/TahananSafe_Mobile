// src/components/BottomNavBar.tsx
import React, { useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  Alert,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../theme/colors";

export type TabKey =
  | "Home"
  | "Inbox"
  | "Incident"
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
  fabBottom: number;

  fabSize?: number;

  onFabPress: () => void;
  onFabLongPress?: () => void;

  centerLabel?: string;

  Chevron?: React.ComponentType<{ width?: number; height?: number }>;
};

const NAV_BG = "#FFFFFF";
const INACTIVE = "#9AA4B2";

/* ===================== RATE LIMIT (10 seconds) ===================== */
const INCIDENT_SUBMIT_COOLDOWN_MS = 10_000;
const INCIDENT_LAST_SUBMIT_KEY = "tahanansafe_last_incident_submit_at_v1";

function formatSecondsCeil(ms: number) {
  const s = Math.ceil(ms / 1000);
  return s <= 0 ? 0 : s;
}
/* ============================================================ */

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
  fabSize: fabSizeProp = 62,
  onFabPress,
  onFabLongPress,
  centerLabel = "Incident Log",
  Chevron,
}: Props) {
  const { width } = useWindowDimensions();
  const { s } = useMemo(() => makeScale(width), [width]);

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

  // FAB sizing
  const fabSize = useMemo(() => {
    const raw = fabSizeProp * s;
    if (width < 360) return clamp(Math.round(raw), 52, 62);
    if (width < 400) return clamp(Math.round(raw), 56, 68);
    return clamp(Math.round(raw), 60, 76);
  }, [fabSizeProp, s, width]);

  const fabIconSize = useMemo(() => {
    const raw = 30 * s;
    if (width < 360) return clamp(Math.round(raw), 24, 28);
    if (width < 400) return clamp(Math.round(raw), 26, 30);
    return clamp(Math.round(raw), 28, 34);
  }, [s, width]);

  const cutoutSize = useMemo(
    () => clamp(Math.round(fabSize * 1.42), fabSize + 22, fabSize + 40),
    [fabSize]
  );

  // ✅ button position (ONLY button uses this)
  const fabLift = useMemo(() => {
    const base = clamp(Math.round(fabSize * 0.86), 30, 54);
    if (width < 360) return clamp(Math.round(base * 0.93), 28, 50);
    if (width < 400) return clamp(Math.round(base * 0.96), 29, 52);
    return base;
  }, [fabSize, width]);

  const effectiveNavHeight = useMemo(
    () => navHeight + EXTRA_BAR_HEIGHT,
    [navHeight, EXTRA_BAR_HEIGHT]
  );

  const centerLabelBottom = useMemo(
    () => clamp(Math.round(12 * s), 10, 16),
    [s]
  );

  const cutoutVisibleHeight = useMemo(() => {
    const h = cutoutSize * 0.55;
    return clamp(
      Math.round(h),
      Math.round(cutoutSize * 0.5),
      Math.round(cutoutSize * 0.65)
    );
  }, [cutoutSize]);

  // ✅ halo internal upward shift (within the clip)
  const haloUp = useMemo(() => {
    const base = clamp(Math.round(fabSize * 0.18), 10, 20);
    if (width < 360) return clamp(Math.round(base * 0.9), 9, 18);
    return base;
  }, [fabSize, width]);

  const haloLiftExtra = useMemo(() => {
    return clamp(Math.round(60 * s), 8, 80);
  }, [s]);

  // Base bottom anchor shared logic
  const baseBottom =
    paddingBottom + (effectiveNavHeight - paddingBottom) - fabLift;

  /* ===================== TAB CLICK ANIMATIONS ===================== */
  // Per-tab Animated scale values so each button can "pop" when clicked
  const tabScalesRef = useRef<Record<TabKey, Animated.Value>>({
    Home: new Animated.Value(1),
    Inbox: new Animated.Value(1),
    Incident: new Animated.Value(1),
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

    // stop any running animation so it feels snappy on rapid taps
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
      // bounce animation regardless if active/inactive
      animateTabPress(tab);
      // navigate after triggering the animation
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

        // wrapper inside item for Animated transform
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

        centerSlot: {
          flex: 1,
          minWidth: 0,
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: itemPaddingBottom + EXTRA_BAR_HEIGHT * 0.35,
        },

        centerLabel: {
          position: "absolute",
          bottom: centerLabelBottom,
          fontSize: labelFont,
          color: INACTIVE,
          fontWeight: "600",
          includeFontPadding: false,
        },

        haloLayer: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: baseBottom + haloLiftExtra,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9,
          pointerEvents: "none",
        },

        cutoutClip: {
          position: "absolute",
          top: -haloUp,
          width: cutoutSize,
          height: cutoutVisibleHeight,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "flex-start",
        },

        /**
         * ✅ HALO (white half circle) WITHOUT edge color:
         * - NO shadow
         * - NO elevation
         * - NO border
         */
        cutout: {
          width: cutoutSize,
          height: cutoutSize,
          borderRadius: cutoutSize / 2,
          backgroundColor: NAV_BG,
          borderWidth: 0,
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "transparent",
                shadowOpacity: 0,
                shadowRadius: 0,
                shadowOffset: { width: 0, height: 0 },
              }
            : { elevation: 0 }),
        },

        fabLayer: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: baseBottom,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        },

        fabPressable: {
          width: fabSize,
          height: fabSize,
          borderRadius: fabSize / 2,
          overflow: "hidden",
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

        fabInner: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
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
      fabSize,
      fabLift,
      cutoutSize,
      EXTRA_BAR_HEIGHT,
      centerLabelBottom,
      cutoutVisibleHeight,
      haloUp,
      haloLiftExtra,
      baseBottom,
    ]
  );

  // ✅ FAB press handler with cooldown popup
  const handleFabPress = async () => {
    try {
      const now = Date.now();
      const raw = await AsyncStorage.getItem(INCIDENT_LAST_SUBMIT_KEY);
      const last = raw ? Number(raw) : 0;

      const elapsed = now - (Number.isFinite(last) ? last : 0);
      const remaining = INCIDENT_SUBMIT_COOLDOWN_MS - elapsed;

      if (remaining > 0) {
        const secs = formatSecondsCeil(remaining);
        Alert.alert(
          "Please wait",
          `You can report again in ${secs} second${secs === 1 ? "" : "s"}.`
        );
        return;
      }

      onFabPress();
    } catch {
      // If storage fails, don't block user
      onFabPress();
    }
  };

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

      <View style={styles.navWrap}>
        <NavItem
          icon="home-outline"
          label="Home"
          active={activeTab === "Home"}
          onPress={() => handleTabPress("Home")}
          iconSize={iconSize}
          labelStyle={styles.label}
          labelActiveStyle={styles.labelActive}
          itemStyle={styles.item}
          innerStyle={styles.itemInner}
          scaleAnim={tabScalesRef.current.Home}
          pressInScale={pressInScale}
        />

        <NavItem
          icon="call-outline"
          label="Hotlines"
          active={activeTab === "Inbox"}
          onPress={() => handleTabPress("Inbox")}
          iconSize={iconSize}
          labelStyle={styles.label}
          labelActiveStyle={styles.labelActive}
          itemStyle={styles.item}
          innerStyle={styles.itemInner}
          scaleAnim={tabScalesRef.current.Inbox}
          pressInScale={pressInScale}
        />

        <View style={styles.centerSlot} pointerEvents="none">
          <Text
            style={[
              styles.centerLabel,
              activeTab === "Incident" && styles.labelActive,
            ]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {centerLabel}
          </Text>
        </View>

        <NavItem
          icon="stats-chart-outline"
          label="Reports"
          active={activeTab === "Reports"}
          onPress={() => handleTabPress("Reports")}
          iconSize={iconSize}
          labelStyle={styles.label}
          labelActiveStyle={styles.labelActive}
          itemStyle={styles.item}
          innerStyle={styles.itemInner}
          scaleAnim={tabScalesRef.current.Reports}
          pressInScale={pressInScale}
        />

        <NavItem
          icon="settings-outline"
          label="Settings"
          active={activeTab === "Settings"}
          onPress={() => handleTabPress("Settings")}
          iconSize={iconSize}
          labelStyle={styles.label}
          labelActiveStyle={styles.labelActive}
          itemStyle={styles.item}
          innerStyle={styles.itemInner}
          scaleAnim={tabScalesRef.current.Settings}
          pressInScale={pressInScale}
        />
      </View>

      {/* ✅ HALO only */}
      <View style={styles.haloLayer}>
        <View style={styles.cutoutClip}>
          <View style={styles.cutout} />
        </View>
      </View>

      {/* ✅ FAB only */}
      <View style={styles.fabLayer} pointerEvents="box-none">
        <Pressable
          onPress={handleFabPress}
          onLongPress={onFabLongPress}
          delayLongPress={350}
          style={({ pressed }) => [
            styles.fabPressable,
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <View style={styles.fabInner}>
            <LinearGradient
              colors={Colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="add" size={fabIconSize} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>
    </>
  );
}

function NavItem({
  icon,
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
    // Let the parent do the "pop" sequence; here we just return to 1 quickly if needed.
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
          name={icon}
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