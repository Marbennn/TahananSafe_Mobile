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
};

type Props = {
  item: LogItem;
  onPress: () => void;
};

const CARD_BORDER = "#E7EEF7";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function makeScale(width: number) {
  const baseW = 375;
  const s = clamp((width / baseW) * 1.03, 0.88, 1.18);
  const fs = clamp(s * 1.06, 0.92, 1.28);
  return { s, fs };
}

export default function RecentLogCard({ item, onPress }: Props) {
  const { width } = useWindowDimensions();
  const { s, fs } = useMemo(() => makeScale(width), [width]);

  const detailLines = width < 360 ? 3 : 2;

  const S = useMemo(() => {
    const padV = clamp(Math.round(16 * s), 12, 18);
    const padH = clamp(Math.round(14 * s), 12, 18);

    const barW = clamp(Math.round(4 * s), 3, 4);
    const gap = clamp(Math.round(12 * s), 10, 14);

    return StyleSheet.create({
      card: {
        flexDirection: "row",
        backgroundColor: "#fff",
        borderRadius: 16,
        paddingVertical: padV,
        paddingHorizontal: padH,
        minHeight: clamp(Math.round(96 * s), 86, 112),
        borderWidth: 1,
        borderColor: CARD_BORDER,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
      },

      leftBar: {
        width: barW,
        borderRadius: 999,
        backgroundColor: Colors.primary,
        marginRight: gap,
        alignSelf: "stretch",
      },

      body: {
        flex: 1,
        minWidth: 0, // ✅ important to prevent text causing horizontal overflow
        paddingRight: clamp(Math.round(8 * s), 6, 10),
      },

      title: {
        fontSize: clamp(Math.round(14 * fs), 12, 16),
        fontWeight: "900",
        color: Colors.primary,
        marginBottom: clamp(Math.round(4 * s), 3, 6),
      },

      detail: {
        fontSize: clamp(Math.round(12 * fs), 11, 14),
        fontWeight: "600",
        color: Colors.timestamp,
        lineHeight: clamp(Math.round(17 * fs), 15, 19),
        marginBottom: clamp(Math.round(10 * s), 8, 12),
      },

      metaRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
      },

      metaCol: {
        flexShrink: 1,
      },
      metaColRight: {
        alignItems: "flex-end",
        flexShrink: 1,
      },

      metaDate: {
        fontSize: clamp(Math.round(11 * fs), 10, 12),
        fontWeight: "700",
        color: Colors.timestamp,
      },
      metaTime: {
        fontSize: clamp(Math.round(11 * fs), 10, 12),
        fontWeight: "900",
        color: Colors.heading,
      },

      chevWrap: {
        width: clamp(Math.round(22 * s), 18, 26),
        alignItems: "flex-end",
        paddingTop: clamp(Math.round(6 * s), 4, 8),
        justifyContent: "flex-start",
      },
    });
  }, [s, fs]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [S.card, pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] }]}
    >
      <View style={S.leftBar} />

      <View style={S.body}>
        <Text style={S.title} numberOfLines={1} allowFontScaling={false}>
          {item.title}
        </Text>

        <Text style={S.detail} numberOfLines={detailLines} allowFontScaling={false}>
          {item.detail}
        </Text>

        <View style={S.metaRow}>
          <View style={S.metaCol}>
            <Text style={S.metaDate} numberOfLines={1} allowFontScaling={false}>
              {item.dateLeft}
            </Text>
            <Text style={S.metaTime} numberOfLines={1} allowFontScaling={false}>
              {item.timeLeft}
            </Text>
          </View>

          <View style={S.metaColRight}>
            <Text style={S.metaDate} numberOfLines={1} allowFontScaling={false}>
              {item.dateRight}
            </Text>
            <Text style={S.metaTime} numberOfLines={1} allowFontScaling={false}>
              {item.timeRight}
            </Text>
          </View>
        </View>
      </View>

      <View style={S.chevWrap}>
        <Ionicons name="chevron-forward" size={clamp(Math.round(18 * s), 16, 20)} color={Colors.heading} />
      </View>
    </Pressable>
  );
}