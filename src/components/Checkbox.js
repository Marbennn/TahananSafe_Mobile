// src/components/Checkbox.js
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

export default function Checkbox({ value, onToggle, label }) {
  return (
    <Pressable onPress={onToggle} style={styles.wrap} hitSlop={10}>
      <View style={[styles.box, value && styles.boxChecked]}>
        {value ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
      </View>
      <Text style={styles.text}>{label}</Text>
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
  text: { fontSize: 12, color: "#9AA4B2" },
});
