// src/components/InputField.js
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

export default function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize = "none",
  autoCorrect = false,
  rightIconName,
  onPressRightIcon,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.inputWrap, focused && styles.focused]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />

        {rightIconName ? (
          <Pressable onPress={onPressRightIcon} hitSlop={12} style={styles.eyeBtn}>
            <Ionicons name={rightIconName} size={20} color="#6B7785" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 14 },
  label: {
    fontSize: 13,
    color: Colors.text,
    marginBottom: 8,
    fontWeight: "600",
  },
  inputWrap: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  focused: { borderColor: Colors.link },
  input: { flex: 1, fontSize: 14, color: Colors.text, paddingVertical: 0 },
  eyeBtn: { paddingLeft: 10, paddingVertical: 6 },
});
