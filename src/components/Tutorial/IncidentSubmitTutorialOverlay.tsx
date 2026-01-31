// src/components/Tutorial/IncidentSubmitTutorialOverlay.tsx
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

  screenWidth: number;
  s: number;

  targetX: number; // absolute x (measureInWindow)
  targetY: number; // absolute y (measureInWindow)
  targetW: number;
  targetH: number;

  title?: string;
  message?: string;
};

export default function IncidentSubmitTutorialOverlay({
  visible,
  onClose,
  screenWidth,
  s,
  targetX,
  targetY,
  targetW,
  targetH,
  title = "Submit your report",
  message = "Tap this button to securely send your incident.",
}: Props) {
  if (!visible) return null;

  const ringPad = clamp(Math.round(10 * s), 8, 14);

  // Highlight frame around the target
  const frameX = Math.max(8, targetX - ringPad);
  const frameY = Math.max(8, targetY - ringPad);
  const frameW = Math.min(screenWidth - 16, targetW + ringPad * 2);
  const frameH = targetH + ringPad * 2;

  const arrowSize = clamp(Math.round(28 * s), 24, 32);
  const tooltipMaxW = clamp(Math.round(screenWidth * 0.84), 270, 360);

  // Tooltip position (prefer above if there's space)
  const preferAbove = frameY > 140;

  const tooltipTop = preferAbove
    ? frameY - clamp(Math.round(90 * s), 78, 100)
    : frameY + frameH + clamp(Math.round(14 * s), 12, 18);

  const tooltipLeft = clamp(
    Math.round(frameX + frameW / 2 - tooltipMaxW / 2),
    12,
    screenWidth - tooltipMaxW - 12
  );

  const arrowTop = preferAbove
    ? frameY - arrowSize - clamp(Math.round(6 * s), 4, 8)
    : frameY + frameH + clamp(Math.round(4 * s), 2, 6);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          elevation: 9999,
        },
        dimmer: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.45)",
        },

        highlightFrame: {
          position: "absolute",
          left: frameX,
          top: frameY,
          width: frameW,
          height: frameH,
          borderRadius: clamp(Math.round(24 * s), 18, 28),
          borderWidth: 3,
          borderColor: "rgba(255,255,255,0.95)",
          backgroundColor: "transparent",
        },

        arrowWrap: {
          position: "absolute",
          left: frameX + frameW / 2 - arrowSize / 2,
          top: arrowTop,
          alignItems: "center",
          justifyContent: "center",
        },

        tooltip: {
          position: "absolute",
          left: tooltipLeft,
          top: tooltipTop,
          width: tooltipMaxW,
          backgroundColor: "rgba(255,255,255,0.96)",
          borderRadius: 16,
          paddingVertical: clamp(Math.round(10 * s), 9, 12),
          paddingHorizontal: clamp(Math.round(12 * s), 10, 14),
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.9)",
        },
        title: {
          fontSize: clamp(Math.round(13 * s), 12, 15),
          fontWeight: "900",
          color: "#0B2B45",
        },
        text: {
          marginTop: 6,
          fontSize: clamp(Math.round(12 * s), 11, 14),
          fontWeight: "700",
          color: "#244A66",
          lineHeight: clamp(Math.round(16 * s), 14, 18),
        },
        hint: {
          marginTop: 10,
          fontSize: clamp(Math.round(11 * s), 10, 12),
          fontWeight: "800",
          color: Colors.link,
          alignSelf: "flex-end",
        },
      }),
    [frameX, frameY, frameW, frameH, arrowSize, arrowTop, tooltipLeft, tooltipTop, tooltipMaxW, s]
  );

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.dimmer} onPress={onClose} />

      <View style={styles.highlightFrame} pointerEvents="none" />

      <View style={styles.arrowWrap} pointerEvents="none">
        <Ionicons
          name={preferAbove ? "arrow-down" : "arrow-up"}
          size={arrowSize}
          color="#FFFFFF"
        />
      </View>

      <View style={styles.tooltip} pointerEvents="none">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{message}</Text>
        <Text style={styles.hint}>Tap anywhere to continue</Text>
      </View>
    </View>
  );
}
