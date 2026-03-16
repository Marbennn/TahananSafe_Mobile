// src/components/PinScreen/InvalidPinModal.tsx
import React, { useEffect, useRef } from "react";
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
import { Colors } from "../../theme/colors";

type Props = {
  visible: boolean;
  message?: string;
  onClose: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function InvalidPinModal({ visible, message, onClose }: Props) {
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = React.useMemo(() => createStyles(scale, vscale), [width, height]);

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
        <Animated.View style={[styles.backdrop, { opacity: fade }]} />

        <Animated.View
          style={[styles.card, { opacity: fade, transform: [{ scale: pop }] }]}
        >
          {/* Icon badge */}
          <View style={styles.badgeWrap}>
            <View style={styles.badgeHalo}>
              <Ionicons name="keypad-outline" size={scale(34)} color="#DC2626" />
            </View>
          </View>

          <Text style={styles.title}>Incorrect PIN</Text>

          <Text style={styles.sub}>
            {message || "The PIN you entered is incorrect.\nPlease try again."}
          </Text>

          <Pressable
            onPress={closeWithAnim}
            hitSlop={8}
            style={({ pressed }) => [
              styles.btnOuter,
              pressed ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
            ]}
          >
            <View style={styles.btnInner}>
              <Text style={styles.btnText}>Try Again</Text>
            </View>
          </Pressable>
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
      paddingHorizontal: scale(18),
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.32)",
    },
    card: {
      width: "100%",
      maxWidth: scale(320),
      borderRadius: scale(18),
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
      marginBottom: scale(16),
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

    btnOuter: {
      alignSelf: "stretch",
      borderRadius: scale(50),
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#DC2626",
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 5 },
        },
        android: { elevation: 5 },
      }),
    },
    btnInner: {
      height: vscale(46),
      borderRadius: scale(50),
      backgroundColor: "#DC2626",
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: {
      color: "#FFFFFF",
      fontSize: scale(13),
      fontWeight: "900",
    },
  });
}
