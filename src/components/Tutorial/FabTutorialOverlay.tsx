// src/components/tutorial/FabTutorialOverlay.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Props = {
  visible: boolean;
  onClose: () => void;

  // Layout inputs from HomeScreen
  width: number;
  s: number;

  fabSize: number;
  fabBottom: number;
  navHeight: number; // not used right now but useful later

  title?: string;
  message?: string;
};

export default function FabTutorialOverlay({
  visible,
  onClose,
  width,
  s,
  fabSize,
  fabBottom,
  navHeight,
  title = "Create an Incident Log",
  message = "Tap the + button to add a new report.",
}: Props) {
  if (!visible) return null;

  // ✅ Tutorial positioning (based on center FAB)
  const fabCenterX = width / 2;

  const ringSize = Math.round(fabSize + 18);
  const ringLeft = fabCenterX - ringSize / 2;

  // Align with FAB bottom (ring bigger than FAB)
  const ringBottom = fabBottom - (ringSize - fabSize) / 2;

  const arrowSize = clamp(Math.round(30 * s), 26, 34);
  const tooltipMaxW = clamp(Math.round(width * 0.78), 260, 340);

  const tooltipBottom = ringBottom + ringSize + clamp(Math.round(14 * s), 12, 18);
  const tooltipLeft = clamp(
    Math.round(fabCenterX - tooltipMaxW / 2),
    12,
    width - tooltipMaxW - 12
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        tutorialOverlay: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "flex-end",
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
      ringSize,
      ringLeft,
      ringBottom,
      fabCenterX,
      arrowSize,
      tooltipLeft,
      tooltipBottom,
      tooltipMaxW,
      s,
      width,
    ]
  );

  return (
    <View style={styles.tutorialOverlay} pointerEvents="box-none">
      {/* Dimmer (tap anywhere to dismiss) */}
      <Pressable style={styles.dimmer} onPress={onClose} />

      {/* Highlight ring around FAB */}
      <View style={styles.highlightRing} pointerEvents="none" />

      {/* Arrow pointing DOWN to the FAB */}
      <View style={styles.arrowWrap} pointerEvents="none">
        <Ionicons name="arrow-down" size={arrowSize} color="#FFFFFF" />
      </View>

      {/* Tooltip */}
      <View style={styles.tooltip} pointerEvents="none">
        <Text style={styles.tooltipTitle}>{title}</Text>
        <Text style={styles.tooltipText}>
          {message.split("+").length > 1 ? (
            <>
              {message.split("+")[0]}
              <Text style={{ fontWeight: "900" }}>+</Text>
              {message.split("+").slice(1).join("+")}
            </>
          ) : (
            message
          )}
        </Text>
        <Text style={styles.tooltipHint}>Tap anywhere to continue</Text>
      </View>
    </View>
  );
}
