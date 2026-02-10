// src/components/HomeScreen/QuickActions.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import BlueBoxSvg from "../../../assets/HomeScreen/BlueBox.svg";
import AlertSvg from "../../../assets/HomeScreen/AlertIcon.svg";
import ProfileIconSvg from "../../../assets/HomeScreen/ProfileIcon.svg";

type Props = {
  onSignOut?: () => void;
  onHideApp?: () => void;
  onAlert?: () => void;
  onProfile?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type IconRenderer = (size: number) => React.ReactElement;

export default function QuickActions({
  onSignOut,
  onHideApp,
  onAlert,
  onProfile,
}: Props) {
  const { width } = useWindowDimensions();

  // scale factor
  const s = useMemo(() => clamp(width / 375, 0.9, 1.25), [width]);

  // ✅ small font bump for titles/labels
  const fs = useMemo(() => clamp(s * 1.06, 0.95, 1.3), [s]);

  // base spacing
  const BASE_PAD = useMemo(() => clamp(Math.round(16 * s), 12, 20), [s]);
  const GAP = useMemo(() => clamp(Math.round(10 * s), 8, 14), [s]);

  // available width inside padding
  const available = useMemo(() => width - BASE_PAD * 2, [width, BASE_PAD]);

  // ideal tile width
  const idealItemW = useMemo(() => (available - GAP * 3) / 4, [available, GAP]);

  // button hit-area size
  const btnSize = useMemo(() => clamp(Math.round(idealItemW), 62, 88), [idealItemW]);

  // center perfectly
  const rowContentW = useMemo(() => btnSize * 4 + GAP * 3, [btnSize, GAP]);
  const extra = useMemo(() => Math.max(0, available - rowContentW), [available, rowContentW]);
  const sidePad = useMemo(() => BASE_PAD + Math.floor(extra / 2), [BASE_PAD, extra]);

  // smaller blue tile inside the same button
  const TILE_FACTOR = 0.88;
  const tileSize = useMemo(() => Math.round(btnSize * TILE_FACTOR), [btnSize]);

  // icons scale off tile
  const iconSizeSvg = useMemo(() => clamp(Math.round(tileSize * 0.42), 18, 30), [tileSize]);
  const iconSizeIon = useMemo(() => clamp(Math.round(tileSize * 0.38), 16, 28), [tileSize]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginTop: clamp(Math.round(14 * s), 10, 18) },

        // ✅ bigger title
        title: {
          paddingHorizontal: sidePad,
          fontSize: clamp(Math.round(14 * fs), 13, 16),
          fontWeight: "900",
          color: "#0B2B45",
        },

        row: {
          paddingHorizontal: sidePad,
          paddingTop: clamp(Math.round(12 * s), 10, 16),
          flexDirection: "row",
          gap: GAP,
          justifyContent: "center",
        },

        item: {
          width: btnSize,
          alignItems: "center",
        },

        // Pressable still uses btnSize (layout unchanged)
        btn: {
          width: btnSize,
          height: btnSize,
          alignItems: "center",
          justifyContent: "center",
        },

        iconOverlay: {
          ...StyleSheet.absoluteFillObject,
          alignItems: "center",
          justifyContent: "center",
        },

        // ✅ bigger label
        label: {
          marginTop: clamp(Math.round(8 * s), 6, 10),
          fontSize: clamp(Math.round(12 * fs), 11, 14),
          fontWeight: "900",
          color: "#0B2B45",
          textAlign: "center",
        },
      }),
    [s, fs, sidePad, GAP, btnSize]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Quick Actions</Text>

      <View style={styles.row}>
        <QuickAction
          itemStyle={styles.item}
          btnStyle={styles.btn}
          label="Alert"
          onPress={onAlert ?? (() => {})}
          iconNudge={{ x: 0, y: -4 }}
          Icon={(sz) => <AlertSvg width={sz} height={sz} />}
          tileSize={tileSize}
          iconOverlayStyle={styles.iconOverlay}
          labelStyle={styles.label}
          iconSize={iconSizeSvg}
        />

        <QuickAction
          itemStyle={styles.item}
          btnStyle={styles.btn}
          label="Profile"
          onPress={onProfile ?? (() => {})}
          iconNudge={{ x: 0, y: -4 }}
          Icon={(sz) => <ProfileIconSvg width={sz} height={sz} />}
          tileSize={tileSize}
          iconOverlayStyle={styles.iconOverlay}
          labelStyle={styles.label}
          iconSize={iconSizeSvg}
        />

        <QuickAction
          itemStyle={styles.item}
          btnStyle={styles.btn}
          label="Sign out"
          onPress={onSignOut ?? (() => {})}
          iconNudge={{ x: 0, y: -4 }}
          Icon={(sz) => <Ionicons name="log-out-outline" size={sz} color="#fff" />}
          tileSize={tileSize}
          iconOverlayStyle={styles.iconOverlay}
          labelStyle={styles.label}
          iconSize={iconSizeIon}
        />

        <QuickAction
          itemStyle={styles.item}
          btnStyle={styles.btn}
          label="Hide App"
          onPress={onHideApp ?? (() => {})}
          iconNudge={{ x: 0, y: -4 }}
          Icon={(sz) => <Ionicons name="eye-off-outline" size={sz} color="#fff" />}
          tileSize={tileSize}
          iconOverlayStyle={styles.iconOverlay}
          labelStyle={styles.label}
          iconSize={iconSizeIon}
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
  tileSize,
  iconSize,
  itemStyle,
  btnStyle,
  iconOverlayStyle,
  labelStyle,
}: {
  label: string;
  onPress: () => void;
  Icon: IconRenderer;
  iconNudge?: { x?: number; y?: number };
  tileSize: number;
  iconSize: number;
  itemStyle: any;
  btnStyle: any;
  iconOverlayStyle: any;
  labelStyle: any;
}) {
  const x = iconNudge.x ?? 0;
  const y = iconNudge.y ?? 0;

  return (
    <View style={itemStyle}>
      <Pressable
        onPress={onPress}
        hitSlop={12}
        style={({ pressed }) => [
          btnStyle,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        ]}
      >
        <BlueBoxSvg width={tileSize} height={tileSize} />

        <View
          pointerEvents="none"
          style={[
            iconOverlayStyle,
            { transform: [{ translateX: x }, { translateY: y }] },
          ]}
        >
          {Icon(iconSize)}
        </View>
      </Pressable>

      <Text style={labelStyle} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
