// src/components/PrimaryButton.tsx
import React from "react";
import { Pressable, Text, StyleSheet, GestureResponderEvent } from "react-native";
import { Colors, useColors } from "../theme/colors";
import { Typography } from "../theme/typography";

type Props = {
  title: string;
  onPress: (event?: GestureResponderEvent) => void;
  disabled?: boolean;
};

export default function PrimaryButton({ title, onPress, disabled }: Props) {
  const TC = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: TC.actionPrimary },
        disabled && styles.disabled,
        pressed && !disabled && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.actionPrimary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  disabled: { opacity: 0.55 },
  text: {
    ...Typography.button,
    color: "#fff",
  },
});
