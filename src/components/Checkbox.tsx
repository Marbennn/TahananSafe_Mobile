// src/components/Checkbox.tsx
import React from "react";
import { View, Text, Pressable, StyleSheet, GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, useColors } from "../theme/colors";
import { Typography } from "../theme/typography";

type Props = {
  value: boolean;
  onToggle: (event?: GestureResponderEvent) => void;
  label: string;
};

export default function Checkbox({ value, onToggle, label }: Props) {
  const TC = useColors();
  return (
    <Pressable onPress={onToggle} style={styles.wrap} hitSlop={10}>
      <View style={[styles.box, { backgroundColor: TC.surface, borderColor: TC.border }, value && { backgroundColor: TC.primary, borderColor: TC.primary }]}>
        {value ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
      </View>
      <Text style={[styles.text, { color: TC.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  box: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#C7D2E0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  boxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  text: { ...Typography.caption, color: "#9AA4B2" },
});
