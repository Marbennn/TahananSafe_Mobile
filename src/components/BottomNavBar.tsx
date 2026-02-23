// src/components/BottomNavBar.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";

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

  // compatibility (not used here but kept so HomeScreen doesn't break)
  chevronBottom: number;
  fabBottom: number;

  fabSize?: number;

  onFabPress: () => void;
  onFabLongPress?: () => void;

  centerLabel?: string;

  Chevron?: React.ComponentType<{ width?: number; height?: number }>;
};

const NAV_BG = "#FFFFFF";
const BORDER = "#E7EEF7";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function makeScale(width: number) {
  const baseW = 375;
  const s = clamp((width / baseW) * 1.03, 0.88, 1.25);
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

  const iconSize = useMemo(() => clamp(Math.round(22 * s), 20, 26), [s]);
  const fabIconSize = useMemo(() => clamp(Math.round(30 * s), 26, 34), [s]);

  const labelFont = useMemo(() => {
    if (width < 350) return clamp(Math.round(9 * s), 8, 10);
    return clamp(Math.round(10 * s), 9, 12);
  }, [s, width]);

  const labelMarginTop = useMemo(() => clamp(Math.round(4 * s), 3, 6), [s]);

  const navPaddingTop = useMemo(() => clamp(Math.round(10 * s), 8, 14), [s]);
  const navPaddingHorizontal = useMemo(
    () => clamp(Math.round(4 * s), 2, 10),
    [s]
  );
  const itemPaddingBottom = useMemo(
    () => clamp(Math.round(6 * s), 4, 10),
    [s]
  );

  const fabSize = useMemo(
    () => clamp(Math.round(fabSizeProp * s), 54, 76),
    [fabSizeProp, s]
  );

  const navBaseHeight = Math.max(0, navHeight - paddingBottom);

  const NOTCH_DIAMETER = fabSize + clamp(Math.round(22 * s), 18, 26);
  const NOTCH_RADIUS = NOTCH_DIAMETER / 2;

  const fabAnchorBottom = paddingBottom + (navBaseHeight - fabSize / 2);

  // how far the FAB is pushed down into the bar
  const FAB_DOWN_BY = clamp(Math.round(20 * s), 14, 26);
  const fabBottomFixed = fabAnchorBottom - FAB_DOWN_BY;

  const HALO_SIZE = fabSize + clamp(Math.round(18 * s), 14, 22);
  const HALO_DOWN_BY = clamp(Math.round(22 * s), 16, 28);
  const haloBottom =
    fabAnchorBottom - (HALO_SIZE - fabSize) / 2 - HALO_DOWN_BY;

  const BORDER_GAP = NOTCH_DIAMETER + clamp(Math.round(12 * s), 10, 16);

  /**
   * ✅ KEY FIX:
   * Reserve vertical space in the center slot equal to the amount the FAB overlaps into the bar.
   * This pushes the "Incident Log" label down so it won't be covered by the FAB.
   */
  const centerTopReserve = useMemo(() => {
    const overlapIntoBar = Math.max(0, FAB_DOWN_BY - clamp(Math.round(6 * s), 4, 10));
    // add a little extra breathing space
    return clamp(Math.round(overlapIntoBar + 10 * s), 14, 34);
  }, [FAB_DOWN_BY, s]);

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
          backgroundColor: NAV_BG,
          flexDirection: "row",
          alignItems: "flex-end",
          paddingTop: navPaddingTop,
          paddingHorizontal: navPaddingHorizontal,
        },

        topBorderRow: {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 1,
          flexDirection: "row",
          alignItems: "center",
        },
        topBorderSeg: {
          flex: 1,
          height: 1,
          backgroundColor: BORDER,
        },

        notchRow: {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          alignItems: "center",
          justifyContent: "flex-start",
        },
        notchMask: {
          overflow: "hidden",
          backgroundColor: "transparent",
        },
        notchCircle: {
          position: "absolute",
          left: 0,
          backgroundColor: NAV_BG,
          borderWidth: 1,
          borderColor: BORDER,
          borderBottomWidth: 0,
        },

        item: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: itemPaddingBottom,
          minWidth: 0,
        },

        label: {
          marginTop: labelMarginTop,
          fontSize: labelFont,
          color: "#9AA4B2",
          fontWeight: "600",
          includeFontPadding: false,
        },
        labelActive: {
          color: Colors.primary,
          fontWeight: "800",
        },

        /**
         * ✅ FIXED CENTER SLOT:
         * - align to bottom
         * - reserve top padding so FAB doesn't cover the label
         */
        centerSlot: {
          flex: 1,
          minWidth: 0,
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: itemPaddingBottom,
          paddingTop: centerTopReserve,
        },

        fabWrap: {
          position: "absolute",
          left: 0,
          right: 0,
          alignItems: "center",
          justifyContent: "center",
        },

        fabHalo: {
          backgroundColor: NAV_BG,
          borderWidth: 0,
        },

        fabPressable: {
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
      navPaddingTop,
      navPaddingHorizontal,
      itemPaddingBottom,
      labelMarginTop,
      labelFont,
      centerTopReserve,
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

      <View style={[styles.navWrap, { height: navHeight, paddingBottom }]}>
        <View pointerEvents="none" style={styles.topBorderRow}>
          <View style={styles.topBorderSeg} />
          <View style={{ width: BORDER_GAP }} />
          <View style={styles.topBorderSeg} />
        </View>

        <View pointerEvents="none" style={styles.notchRow}>
          <View
            style={[styles.notchMask, { width: NOTCH_DIAMETER, height: NOTCH_RADIUS }]}
          >
            <View
              style={[
                styles.notchCircle,
                {
                  width: NOTCH_DIAMETER,
                  height: NOTCH_DIAMETER,
                  borderRadius: NOTCH_RADIUS,
                  top: -NOTCH_RADIUS,
                },
              ]}
            />
          </View>
        </View>

        <NavItem
          icon="home-outline"
          label="Home"
          active={activeTab === "Home"}
          onPress={() => onTabPress("Home")}
          iconSize={iconSize}
          labelStyle={styles.label}
          labelActiveStyle={styles.labelActive}
          itemStyle={styles.item}
        />

        <NavItem
          icon="call-outline"
          label="Hotlines"
          active={activeTab === "Inbox"}
          onPress={() => onTabPress("Inbox")}
          iconSize={iconSize}
          labelStyle={styles.label}
          labelActiveStyle={styles.labelActive}
          itemStyle={styles.item}
        />

        <View style={styles.centerSlot}>
          <Text
            style={[styles.label, activeTab === "Incident" && styles.labelActive]}
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
          onPress={() => onTabPress("Reports")}
          iconSize={iconSize}
          labelStyle={styles.label}
          labelActiveStyle={styles.labelActive}
          itemStyle={styles.item}
        />

        <NavItem
          icon="settings-outline"
          label="Settings"
          active={activeTab === "Settings"}
          onPress={() => onTabPress("Settings")}
          iconSize={iconSize}
          labelStyle={styles.label}
          labelActiveStyle={styles.labelActive}
          itemStyle={styles.item}
        />
      </View>

      <View style={[styles.fabWrap, { bottom: haloBottom }]} pointerEvents="none">
        <View
          style={[
            styles.fabHalo,
            {
              width: HALO_SIZE,
              height: HALO_SIZE,
              borderRadius: HALO_SIZE / 2,
            },
          ]}
        />
      </View>

      <View style={[styles.fabWrap, { bottom: fabBottomFixed }]}>
        <Pressable
          onPress={onFabPress}
          onLongPress={onFabLongPress}
          delayLongPress={350}
          style={({ pressed }) => [
            styles.fabPressable,
            { width: fabSize, height: fabSize, borderRadius: fabSize / 2 },
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <View style={[styles.fabInner, { borderRadius: fabSize / 2 }]}>
            <LinearGradient
              colors={Colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                StyleSheet.absoluteFillObject,
                { borderRadius: fabSize / 2 },
              ]}
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
  labelStyle,
  labelActiveStyle,
}: {
  icon: IoniconName;
  label: string;
  active: boolean;
  onPress: () => void;
  iconSize: number;
  itemStyle: any;
  labelStyle: any;
  labelActiveStyle: any;
}) {
  return (
    <Pressable onPress={onPress} style={itemStyle} hitSlop={10}>
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
    </Pressable>
  );
}