import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";

type Props = {
  visible: boolean;

  onClose: () => void;
  onBack: () => void;
  onReset: (newPassword: string) => void;

  scale: (n: number) => number;
  vscale: (n: number) => number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ForgotPasswordNewPasswordModal({
  visible,
  onClose,
  onBack,
  onReset,
  scale,
  vscale,
}: Props) {
  const styles = useMemo(() => createStyles(scale, vscale), [scale, vscale]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
  }, [visible]);

  const passwordsMatch = newPassword === confirmPassword;
  const canReset =
    newPassword.trim().length >= 6 &&
    confirmPassword.trim().length >= 6 &&
    passwordsMatch;

  const handleReset = () => {
    if (!canReset) {
      if (newPassword.trim().length < 6) {
        Alert.alert("Invalid", "Password must be at least 6 characters.");
        return;
      }
      if (!passwordsMatch) {
        Alert.alert("Mismatch", "Passwords do not match.");
        return;
      }
      return;
    }
    onReset(newPassword.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.centerWrap}
        >
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollInner}
          >
            <View style={styles.card}>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close" size={scale(18)} color="#111827" />
              </Pressable>

              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>Create a new password for your account.</Text>

              <Text style={styles.label}>New Password</Text>
              <View style={styles.passWrap}>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="********"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Pressable
                  onPress={() => setShowNew((v) => !v)}
                  hitSlop={10}
                  style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons
                    name={showNew ? "eye-off-outline" : "eye-outline"}
                    size={scale(18)}
                    color="#6B7280"
                  />
                </Pressable>
              </View>

              <Text style={[styles.label, { marginTop: vscale(10) }]}>
                Confirm Password
              </Text>
              <View style={styles.passWrap}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="********"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Pressable
                  onPress={() => setShowConfirm((v) => !v)}
                  hitSlop={10}
                  style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons
                    name={showConfirm ? "eye-off-outline" : "eye-outline"}
                    size={scale(18)}
                    color="#6B7280"
                  />
                </Pressable>
              </View>

              {!passwordsMatch && confirmPassword.length > 0 ? (
                <Text style={styles.errorText}>Passwords do not match</Text>
              ) : null}

              <Pressable
                onPress={handleReset}
                hitSlop={10}
                disabled={!canReset}
                style={({ pressed }) => [
                  styles.btnOuter,
                  !canReset && { opacity: 0.55 },
                  pressed ? { transform: [{ scale: 0.99 }], opacity: 0.98 } : null,
                ]}
              >
                <LinearGradient
                  colors={Colors.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>Reset Password</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={onBack}
                hitSlop={10}
                style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const cardW = clamp(scale(332), 292, 396);
  const inputH = clamp(vscale(46), 42, 54);

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.12)",
      paddingHorizontal: scale(18),
      justifyContent: "center",
    },

    centerWrap: { flex: 1, justifyContent: "center" },

    scrollInner: {
      flexGrow: 1,
      justifyContent: "center",
      paddingVertical: vscale(14),
    },

    card: {
      width: "100%",
      maxWidth: cardW,
      alignSelf: "center",
      backgroundColor: "#FFFFFF",
      borderRadius: clamp(scale(18), 14, 22),
      paddingHorizontal: clamp(scale(18), 14, 22),
      paddingTop: clamp(vscale(16), 14, 18),
      paddingBottom: clamp(vscale(16), 14, 18),
      maxHeight: "92%",

      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.16,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
        },
        android: { elevation: 8 },
      }),
    },

    closeBtn: {
      position: "absolute",
      top: vscale(8),
      right: scale(8),
      width: scale(34),
      height: scale(34),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
    },

    title: {
      textAlign: "center",
      fontSize: clamp(scale(14), 13, 16),
      fontWeight: "900",
      color: "#111827",
      marginBottom: vscale(6),
    },

    subtitle: {
      textAlign: "center",
      fontSize: clamp(scale(10.5), 10, 12),
      lineHeight: clamp(scale(14), 13, 16),
      color: "#6B7280",
      marginBottom: vscale(12),
    },

    label: {
      fontSize: clamp(scale(11), 10, 12),
      fontWeight: "800",
      color: "#111827",
      marginBottom: vscale(8),
    },

    input: {
      width: "100%",
      height: inputH,
      borderRadius: clamp(scale(12), 10, 14),
      paddingHorizontal: clamp(scale(14), 12, 16),
      borderWidth: 1.2,
      borderColor: "#E5E7EB",
      backgroundColor: "#FFFFFF",
      fontSize: clamp(scale(13), 12, 14),
      color: "#111827",
    },

    passWrap: { position: "relative", width: "100%", justifyContent: "center" },

    eyeBtn: {
      position: "absolute",
      right: clamp(scale(10), 8, 12),
      height: inputH,
      width: clamp(scale(36), 32, 40),
      alignItems: "center",
      justifyContent: "center",
    },

    errorText: {
      marginTop: vscale(6),
      fontSize: clamp(scale(10), 9, 11),
      fontWeight: "800",
      color: "#DC2626",
      textAlign: "center",
    },

    btnOuter: {
      width: "100%",
      borderRadius: clamp(scale(14), 12, 16),
      overflow: "hidden",
      marginTop: vscale(12),
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.14,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 7 },
        },
        android: { elevation: 7 },
      }),
    },

    btn: {
      height: clamp(vscale(44), 42, 52),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: clamp(scale(14), 12, 16),
    },

    btnText: {
      color: "#FFFFFF",
      fontSize: clamp(scale(12), 11, 13),
      fontWeight: "900",
    },

    backLink: { marginTop: vscale(10), alignItems: "center" },

    backText: {
      fontSize: clamp(scale(11), 10, 12),
      fontWeight: "900",
      color: "#1D4ED8",
    },
  });
}
