// src/components/PinScreen/InvalidPinModal.tsx
import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  Animated,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, useColors } from "../../theme/colors";

type Props = {
  visible: boolean;
  message?: string;
  title?: string;
  buttonText?: string;
  onClose: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function InvalidPinModal({
  visible,
  message,
  title,
  buttonText,
  onClose,
}: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();

  const s = clamp(Math.min(width, 480) / 375, 0.84, 1.12);
  const vs = clamp(height / 812, 0.76, 1.08);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (!visible) return;

    fade.setValue(0);
    pop.setValue(0.96);

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(pop, {
        toValue: 1,
        speed: 18,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, fade, pop]);

  const closeWithAnim = () => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 0.98, duration: 120, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeWithAnim}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: fade, backgroundColor: TC.overlay }]} />

        <Animated.View
          style={[styles.card, { opacity: fade, transform: [{ scale: pop }], backgroundColor: TC.surface }]}
        >
          <View style={styles.badgeWrap}>
            <View style={styles.badgeHalo}>
              <Ionicons name="keypad-outline" size={scale(34)} color="#DC2626" />
            </View>
          </View>

          <Text style={[styles.title, { color: TC.textDark }]}>{title || "Incorrect PIN"}</Text>

          <Text style={[styles.sub, { color: TC.muted }]}>
            {message || "The PIN you entered is incorrect.\nPlease try again."}
          </Text>

          <View style={styles.btnRow}>
            <Pressable
              onPress={closeWithAnim}
              hitSlop={8}
              style={({ pressed }) => [
                styles.btnConfirm,
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text style={styles.btnConfirmText}>{buttonText || "Try Again"}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: scale(24),
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.32)",
    },
    card: {
      width: "100%",
      maxWidth: scale(320),
      maxHeight: "90%",
      borderRadius: scale(20),
      backgroundColor: "#FFFFFF",
      paddingHorizontal: scale(24),
      paddingTop: scale(28),
      paddingBottom: scale(20),
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
        },
        android: { elevation: 10 },
      }),
    },

    badgeWrap: {
      marginBottom: scale(18),
    },
    badgeHalo: {
      width: scale(72),
      height: scale(72),
      borderRadius: scale(36),
      backgroundColor: "#FEE2E2",
      alignItems: "center",
      justifyContent: "center",
    },

    title: {
      textAlign: "center",
      fontSize: scale(16),
      fontWeight: "900",
      color: "#111827",
      marginBottom: scale(10),
    },
    sub: {
      textAlign: "center",
      fontSize: scale(12),
      lineHeight: scale(18),
      color: "#6B7280",
      marginBottom: scale(24),
    },

    btnRow: {
      alignSelf: "stretch",
    },
    btnConfirm: {
      height: vscale(46),
      borderRadius: scale(14),
      backgroundColor: Colors.actionPrimary,
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: {
          shadowColor: Colors.actionPrimary,
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        android: { elevation: 5 },
      }),
    },
    btnConfirmText: {
      color: "#FFFFFF",
      fontSize: scale(13),
      fontWeight: "900",
    },
  });
}
