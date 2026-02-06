import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../theme/colors";
import ChecklistBadge from "../ChecklistBadge";

type Props = {
  visible: boolean;
  onClose: () => void; // Back to Login closes everything
  scale: (n: number) => number;
  vscale: (n: number) => number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ForgotPasswordSuccessModal({
  visible,
  onClose,
  scale,
  vscale,
}: Props) {
  const styles = useMemo(() => createStyles(scale, vscale), [scale, vscale]);

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
              <View style={styles.badgeWrap}>
                <ChecklistBadge size={clamp(scale(78), 66, 92)} />
              </View>

              <Text style={styles.successTitle}>Password Reset{"\n"}Successfully</Text>

              <View style={styles.spacer} />

              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.btnOuter,
                  pressed ? { transform: [{ scale: 0.99 }], opacity: 0.98 } : null,
                ]}
              >
                <LinearGradient
                  colors={Colors.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>Back to Login</Text>
                </LinearGradient>
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

  // ✅ make it taller but still safe on small screens
  const minCardH = clamp(vscale(260), 230, 320);

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

      // ✅ LENGTHEN HERE
      minHeight: minCardH,
      paddingHorizontal: clamp(scale(18), 14, 22),
      paddingTop: clamp(vscale(26), 22, 34),
      paddingBottom: clamp(vscale(22), 18, 30),

      // ✅ never overflow screen
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

    badgeWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: vscale(6),
      paddingBottom: vscale(10),
    },

    successTitle: {
      textAlign: "center",
      fontSize: clamp(scale(14.5), 13, 17),
      fontWeight: "900",
      color: "#111827",
      marginBottom: vscale(6),
    },

    spacer: {
      flexGrow: 1, // ✅ pushes button lower (gives “taller” feel)
      minHeight: vscale(10),
    },

    btnOuter: {
      width: "100%",
      borderRadius: clamp(scale(14), 12, 16),
      overflow: "hidden",
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
      height: clamp(vscale(46), 44, 54),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: clamp(scale(14), 12, 16),
    },

    btnText: {
      color: "#FFFFFF",
      fontSize: clamp(scale(12), 11, 13),
      fontWeight: "900",
    },
  });
}
