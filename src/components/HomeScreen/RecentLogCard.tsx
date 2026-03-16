// src/components/HomeScreen/RecentLogCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";

export type LogItem = {
  id: string;
  title: string;
  detail: string;
  dateLeft: string;
  timeLeft: string;
  dateRight: string;
  timeRight: string;
  updatedAt?: string;
};

type Props = {
  item: LogItem;
  onPress?: () => void;
};

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const month = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  const mm = String(m).padStart(2, "0");
  return `${month} ${day}, ${year} at ${hh}:${mm} ${ampm}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// simple scale (matches your “stable scale” approach)
function makeScale(width: number, height: number) {
  const baseW = 375;
  const baseH = 812;
  const scaleW = width / baseW;
  const scaleH = height / baseH;
  const s = clamp(Math.min(scaleW, scaleH) * 1.04, 0.88, 1.28);
  const fs = clamp(s * 1.06, 0.92, 1.32);
  return { s, fs };
}

export default function RecentLogCard({ item, onPress }: Props) {
  const { width, height } = useWindowDimensions();
  const { s, fs } = useMemo(() => makeScale(width, height), [width, height]);

  const styles = useMemo(() => makeStyles(s, fs), [s, fs]);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && onPress ? { opacity: 0.92, transform: [{ scale: 0.995 }] } : null]}
      hitSlop={8}
    >
      {/* left accent */}
      <View style={styles.leftAccent} />

      {/* content */}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1} allowFontScaling={false}>
            {item.title || "Other"}
          </Text>

          <Ionicons name="chevron-forward" size={clamp(Math.round(18 * fs), 16, 20)} color="#94A3B8" />
        </View>

        <Text style={styles.detail} numberOfLines={2} ellipsizeMode="tail" allowFontScaling={false}>
          {item.detail || "—"}
        </Text>

        {!!item.updatedAt && (
          <Text style={styles.updatedAt} numberOfLines={1} allowFontScaling={false}>
            Updated: {formatUpdatedAt(item.updatedAt)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function makeStyles(s: number, fs: number) {
  const R = clamp(Math.round(16 * s), 14, 18);
  const PAD_X = clamp(Math.round(14 * s), 12, 16);
  const PAD_Y = clamp(Math.round(12 * s), 10, 14);

  // ✅ Two-line reservation math
  const detailFont = clamp(Math.round(12 * fs), 11, 13);
  const detailLine = clamp(Math.round(16 * fs), 14, 18);

  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "stretch",
      borderRadius: R,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#E7EEF7",

      // ✅ Make overall height consistent even if other parts vary slightly
      minHeight: clamp(Math.round(96 * s), 90, 112),

      // remove heavy shadows (your style preference)
      shadowColor: "#000",
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      overflow: "hidden",
    },

    leftAccent: {
      width: clamp(Math.round(4 * s), 4, 6),
      backgroundColor: Colors.primary,
    },

    body: {
      flex: 1,
      paddingHorizontal: PAD_X,
      paddingVertical: PAD_Y,
      justifyContent: "center",
    },

    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: clamp(Math.round(10 * s), 8, 12),
    },

    title: {
      flex: 1,
      minWidth: 0,
      fontSize: clamp(Math.round(14 * fs), 13, 16),
      fontWeight: "900",
      color: "#0B2B45",
    },

    detail: {
      marginTop: clamp(Math.round(4 * s), 3, 6),
      fontSize: detailFont,
      lineHeight: detailLine,
      fontWeight: "600",
      color: "#64748B",
    },

    updatedAt: {
      marginTop: clamp(Math.round(18 * s), 14, 24),
      fontSize: clamp(Math.round(10 * fs), 9, 11),
      fontWeight: "600",
      color: Colors.primary,
    },

    bottomRow: {
      marginTop: clamp(Math.round(8 * s), 6, 10),
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: clamp(Math.round(10 * s), 8, 12),
    },

    col: { flex: 1, minWidth: 0 },
    colRight: { flex: 1, minWidth: 0, alignItems: "flex-end" },

    metaLabel: {
      fontSize: clamp(Math.round(10 * fs), 10, 12),
      fontWeight: "700",
      color: "#94A3B8",
    },
    metaValue: {
      marginTop: clamp(Math.round(2 * s), 1, 3),
      fontSize: clamp(Math.round(12 * fs), 11, 14),
      fontWeight: "900",
      color: "#0B2B45",
    },
  });
}