import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ✅ Background tile SVG
import BlueBoxSvg from "../../../assets/HomeScreen/BlueBox.svg";

// ✅ Icons
import AlertSvg from "../../../assets/HomeScreen/AlertIcon.svg";
import ProfileIconSvg from "../../../assets/HomeScreen/ProfileIcon.svg";

type Props = {
  onSignOut?: () => void;
  onHideApp?: () => void;
  onAlert?: () => void;
  onProfile?: () => void;
};

const TILE_SIZE = 64;

export default function QuickActions({
  onSignOut,
  onHideApp,
  onAlert,
  onProfile,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Quick Actions</Text>

      <View style={styles.row}>
        <QuickAction
          label="Alert"
          onPress={onAlert ?? (() => {})}
          // 🔧 Nudge alert slightly down-right (tweak if needed)
          iconNudge={{ x: 0, y: -4 }}
          Icon={() => <AlertSvg width={34} height={34} />}
        />
        <QuickAction
          label="Profile"
          onPress={onProfile ?? (() => {})}
          // 🔧 Nudge profile slightly down (tweak if needed)
          iconNudge={{ x: 0, y: -4 }}
          Icon={() => <ProfileIconSvg width={34} height={34} />}
        />
        <QuickAction
          label="Sign out"
          onPress={onSignOut ?? (() => {})}
          iconNudge={{ x: 0, y: -4 }}
          Icon={() => <Ionicons name="log-out-outline" size={30} color="#fff" />}
        />
        <QuickAction
          label="Hide App"
          onPress={onHideApp ?? (() => {})}
          iconNudge={{ x: 0, y: -4 }}
          Icon={() => <Ionicons name="eye-off-outline" size={30} color="#fff" />}
        />
      </View>
    </View>
  );
}

function QuickAction({
  label,
  onPress,
  Icon,
  iconNudge = { x: 0, y: 0 },
}: {
  label: string;
  onPress: () => void;
  Icon: React.ComponentType;
  iconNudge?: { x?: number; y?: number };
}) {
  const x = iconNudge.x ?? 0;
  const y = iconNudge.y ?? 0;

  return (
    <View style={styles.item}>
      <Pressable
        onPress={onPress}
        hitSlop={12}
        style={({ pressed }) => [
          styles.btn,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        ]}
      >
        <BlueBoxSvg width={TILE_SIZE} height={TILE_SIZE} />

        {/* ✅ absolute fill + translate nudge */}
        <View
          pointerEvents="none"
          style={[
            styles.iconOverlay,
            { transform: [{ translateX: x }, { translateY: y }] },
          ]}
        >
          <Icon />
        </View>
      </Pressable>

      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },

  title: {
    paddingHorizontal: 14,
    fontSize: 12,
    fontWeight: "800",
    color: "#0B2B45",
  },

  row: {
    paddingHorizontal: 14,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  item: { width: "24%", alignItems: "center" },

  btn: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },

  // ✅ use absoluteFill so the overlay is exactly the same as the tile area
  iconOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "800",
    color: "#0B2B45",
  },
});
