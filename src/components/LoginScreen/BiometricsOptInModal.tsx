// src/components/LoginScreen/BiometricsOptInModal.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onClose: () => void;
  onEnable: () => void;
  onNotNow: () => void;
  scale: (n: number) => number;
  vscale: (n: number) => number;
};

export default function BiometricsOptInModal({
  visible,
  onClose,
  onEnable,
  onNotNow,
  scale,
  vscale,
}: Props) {
  const styles = React.useMemo(
    () => createStyles(scale, vscale),
    [scale, vscale]
  );

  const title = "Enable Biometrics?";
  const description =
    Platform.OS === "ios"
      ? "Use Face ID to fill your saved login details next time. OTP verification will still be required."
      : "Use fingerprint to fill your saved login details next time. OTP verification will still be required.";

  const iconName = Platform.OS === "ios" ? "scan-outline" : "finger-print-outline";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name={iconName as any} size={scale(28)} color="#0F766E" />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.buttonCol}>
            <Pressable
              onPress={onEnable}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryBtnText}>Enable</Text>
            </Pressable>

            <Pressable
              onPress={onNotNow}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryBtnText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number
) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(17, 24, 39, 0.45)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: scale(24),
    },

    card: {
      width: "100%",
      maxWidth: scale(360),
      backgroundColor: "#FFFFFF",
      borderRadius: scale(24),
      paddingHorizontal: scale(22),
      paddingTop: vscale(22),
      paddingBottom: vscale(18),
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },

    iconWrap: {
      width: scale(58),
      height: scale(58),
      borderRadius: scale(29),
      backgroundColor: "#ECFDF5",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: vscale(14),
    },

    title: {
      fontSize: scale(20),
      fontWeight: "800",
      color: "#111827",
      textAlign: "center",
    },

    description: {
      marginTop: vscale(10),
      fontSize: scale(13),
      lineHeight: scale(19),
      color: "#6B7280",
      textAlign: "center",
      paddingHorizontal: scale(6),
    },

    buttonCol: {
      width: "100%",
      marginTop: vscale(22),
      gap: vscale(10),
    },

    primaryBtn: {
      height: vscale(48),
      borderRadius: scale(14),
      backgroundColor: "#0F766E",
      alignItems: "center",
      justifyContent: "center",
    },

    primaryBtnText: {
      fontSize: scale(14),
      fontWeight: "800",
      color: "#FFFFFF",
    },

    secondaryBtn: {
      height: vscale(48),
      borderRadius: scale(14),
      backgroundColor: "#F3F4F6",
      alignItems: "center",
      justifyContent: "center",
    },

    secondaryBtnText: {
      fontSize: scale(14),
      fontWeight: "700",
      color: "#111827",
    },

    pressed: {
      opacity: 0.85,
      transform: [{ scale: 0.99 }],
    },
  });
}
