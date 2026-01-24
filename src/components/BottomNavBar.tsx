// src/components/BottomNavBar.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

export default function BottomNavBar({
  activeTab,
  onTabPress,
  navHeight,
  paddingBottom,
  chevronBottom,
  fabSize = 62,
  onFabPress,
  onFabLongPress,
  centerLabel = "Incident Log",
  Chevron,
}: Props) {
  const navBaseHeight = Math.max(0, navHeight - paddingBottom);

  const NOTCH_DIAMETER = fabSize + 22;
  const NOTCH_RADIUS = NOTCH_DIAMETER / 2;

  // Stable anchor (do not tie halo to FAB_DOWN_BY)
  const fabAnchorBottom = paddingBottom + (navBaseHeight - fabSize / 2);

  // Move only the FAB down
  const FAB_DOWN_BY = 20;
  const fabBottomFixed = fabAnchorBottom - FAB_DOWN_BY;

  // Halo stays anchored (independent from FAB_DOWN_BY)
  const HALO_SIZE = fabSize + 18;

  // ✅ Increase this to reduce the visible “cap” above the bar
  const HALO_DOWN_BY = 22;
  const haloBottom =
    fabAnchorBottom - (HALO_SIZE - fabSize) / 2 - HALO_DOWN_BY;

  // Leave a gap in the top border so it doesn't run under the notch
  const BORDER_GAP = NOTCH_DIAMETER + 12;

  return (
    <>
      {/* Chevron (optional) */}
      {Chevron ? (
        <View
          style={[styles.chevronWrap, { bottom: chevronBottom }]}
          pointerEvents="none"
        >
          <Chevron width={22} height={22} />
        </View>
      ) : null}

      {/* Bottom bar */}
      <View style={[styles.navWrap, { height: navHeight, paddingBottom }]}>
        {/* ✅ Split top border into left + right (gap under notch) */}
        <View pointerEvents="none" style={styles.topBorderRow}>
          <View style={styles.topBorderSeg} />
          <View style={{ width: BORDER_GAP }} />
          <View style={styles.topBorderSeg} />
        </View>

        {/* Notch curve (blended) */}
        <View pointerEvents="none" style={styles.notchRow}>
          <View
            style={[
              styles.notchMask,
              { width: NOTCH_DIAMETER, height: NOTCH_RADIUS },
            ]}
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

        {/* Tabs */}
        <NavItem
          icon="home-outline"
          label="Home"
          active={activeTab === "Home"}
          onPress={() => onTabPress("Home")}
        />

        {/* ✅ UI label becomes Hotlines, but key remains "Inbox" */}
        <NavItem
          icon="call-outline"
          label="Hotlines"
          active={activeTab === "Inbox"}
          onPress={() => onTabPress("Inbox")}
        />

        {/* Center slot under FAB */}
        <View style={styles.centerSlot}>
          <View style={{ height: 26 }} />
          <Text
            style={[styles.label, activeTab === "Incident" && styles.labelActive]}
          >
            {centerLabel}
          </Text>
        </View>

        {/* ✅ REAL Reports tab key */}
        <NavItem
          icon="stats-chart-outline"
          label="Reports"
          active={activeTab === "Reports"}
          onPress={() => onTabPress("Reports")}
        />

        <NavItem
          icon="settings-outline"
          label="Settings"
          active={activeTab === "Settings"}
          onPress={() => onTabPress("Settings")}
        />
      </View>

      {/* Halo behind FAB (same color as navbar) */}
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

      {/* FAB */}
      <View style={[styles.fabWrap, { bottom: fabBottomFixed }]}>
        <Pressable
          onPress={onFabPress}
          onLongPress={onFabLongPress}
          delayLongPress={350}
          style={({ pressed }) => [
            styles.fab,
            { width: fabSize, height: fabSize, borderRadius: fabSize / 2 },
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <Ionicons name="add" size={30} color="#FFFFFF" />
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
}: {
  icon: IoniconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.item} hitSlop={10}>
      <Ionicons
        name={icon}
        size={22}
        color={active ? Colors.primary : "#9AA4B2"}
      />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    borderTopWidth: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: 10,
    paddingHorizontal: 4,
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
    paddingBottom: 6,
  },

  label: {
    marginTop: 4,
    fontSize: 10,
    color: "#9AA4B2",
    fontWeight: "600",
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: "800",
  },

  centerSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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

  fab: {
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
});
