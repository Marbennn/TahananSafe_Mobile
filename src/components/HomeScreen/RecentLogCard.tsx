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
  "worklet";
  return Math.max(min, Math.min(max, n));
}

export default function RecentLogCard({ item, onPress }: Props) {
  const { width } = useWindowDimensions();

  // ✅ scale based on common mobile width (375)
  const s = useMemo(() => clamp(width / 375, 0.9, 1.15), [width]);

  // ✅ dynamic sizes
  const S = useMemo(() => {
    return StyleSheet.create({
      card: {
        flexDirection: "row",
        backgroundColor: "#fff",
        borderRadius: 16,
        paddingVertical: Math.round(16 * s),
        paddingHorizontal: Math.round(14 * s),
        minHeight: Math.round(96 * s),
        borderWidth: 1,
        borderColor: CARD_BORDER,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
      },

      leftBar: {
        width: 4,
        borderRadius: 999,
        backgroundColor: Colors.primary,
        marginRight: Math.round(12 * s),
        alignSelf: "stretch",
      },

      body: {
        flex: 1,
        paddingRight: Math.round(10 * s),
      },

      // ✅ Title uses primary color (responsive size)
      title: {
        fontSize: Math.round(13 * s),
        fontWeight: "900",
        color: Colors.primary,
        marginBottom: Math.round(4 * s),
      },

      detail: {
        fontSize: Math.round(11 * s),
        fontWeight: "600",
        color: Colors.timestamp, // #888888
        lineHeight: Math.round(16 * s),
        marginBottom: Math.round(10 * s),
      },

      metaRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
      },

      metaCol: {
        gap: Math.round(3 * s),
      },
      metaColRight: {
        alignItems: "flex-end",
        gap: Math.round(3 * s),
      },

      metaDate: {
        fontSize: Math.round(10 * s),
        fontWeight: "700",
        color: Colors.timestamp,
      },
      metaTime: {
        fontSize: Math.round(10 * s),
        fontWeight: "900",
        color: Colors.heading,
      },

      chevWrap: {
        width: Math.round(20 * s),
        alignItems: "flex-end",
        paddingTop: Math.round(6 * s),
        justifyContent: "flex-start",
      },
    });
  }, [s]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        S.card,
        pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] },
      ]}
    >
      <View style={S.leftBar} />

      <View style={S.body}>
        <Text style={S.title} numberOfLines={1}>
          {item.title}
        </Text>

        <Text style={S.detail} numberOfLines={2}>
          {item.detail}
        </Text>

        <View style={S.metaRow}>
          <View style={S.metaCol}>
            <Text style={S.metaDate} numberOfLines={1}>
              {item.dateLeft}
            </Text>
            <Text style={S.metaTime} numberOfLines={1}>
              {item.timeLeft}
            </Text>
          </View>

          <View style={S.metaColRight}>
            <Text style={S.metaDate} numberOfLines={1}>
              {item.dateRight}
            </Text>
            <Text style={S.metaTime} numberOfLines={1}>
              {item.timeRight}
            </Text>
          </View>
        </View>
      </View>

      <View style={S.chevWrap}>
        <Ionicons
          name="chevron-forward"
          size={Math.round(18 * s)}
          color={Colors.heading}
        />
      </View>
    </Pressable>
  );
}
