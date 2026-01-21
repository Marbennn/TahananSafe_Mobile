// src/components/InputField.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
  rightIconName?: IoniconName;
  onPressRightIcon?: () => void;
};

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
}: Props) {
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
          <Pressable
            onPress={onPressRightIcon}
            hitSlop={12}
            style={styles.eyeBtn}
          >
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
