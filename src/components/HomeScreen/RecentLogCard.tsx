import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
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

export default function RecentLogCard({ item, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.leftBar} />

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.detail} numberOfLines={2}>
          {item.detail}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaDate} numberOfLines={1}>
              {item.dateLeft}
            </Text>
            <Text style={styles.metaTime} numberOfLines={1}>
              {item.timeLeft}
            </Text>
          </View>

          <View style={styles.metaColRight}>
            <Text style={styles.metaDate} numberOfLines={1}>
              {item.dateRight}
            </Text>
            <Text style={styles.metaTime} numberOfLines={1}>
              {item.timeRight}
            </Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#9AA4B2" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,

    // ✅ make it "fatter"
    paddingVertical: 16,
    paddingHorizontal: 14,
    minHeight: 88,

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
    marginRight: 12,
    // ✅ stretch properly with the taller card
    alignSelf: "stretch",
  },

  body: { flex: 1, paddingRight: 10 },

  title: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0B2B45",
    marginBottom: 3,
  },

  detail: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 10,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  metaCol: { gap: 2 },
  metaColRight: { alignItems: "flex-end", gap: 2 },

  metaDate: { fontSize: 9.5, fontWeight: "700", color: "#6B7280" },
  metaTime: { fontSize: 9.5, fontWeight: "900", color: "#0B2B45" },
});
