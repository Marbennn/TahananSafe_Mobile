// src/components/InputField.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, useColors } from "../theme/colors";
import { Typography } from "../theme/typography";

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
  const TC = useColors();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: TC.text }]}>{label}</Text>

      <View style={[styles.inputWrap, { borderColor: TC.border, backgroundColor: TC.inputBg }, focused && { borderColor: TC.link }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={TC.placeholder}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: TC.text }]}
        />

        {rightIconName ? (
          <Pressable
            onPress={onPressRightIcon}
            hitSlop={12}
            style={styles.eyeBtn}
          >
            <Ionicons name={rightIconName} size={20} color={TC.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 14 },
  label: {
    ...Typography.label,
    color: Colors.text,
    marginBottom: 8,
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
  input: { flex: 1, ...Typography.input, color: Colors.text, paddingVertical: 0 },
  eyeBtn: { paddingLeft: 10, paddingVertical: 6 },
});
