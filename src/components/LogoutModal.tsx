// src/components/LogoutModal.tsx
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
import { Colors } from "../theme/colors";

type Props = {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function LogoutModal({ visible, onConfirm, onCancel }: Props) {
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;

  const closeWithAnim = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 0.98, duration: 120, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) cb();
    });
  };

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

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeWithAnim(onCancel)}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]} />

        <Animated.View
          style={[styles.card, { opacity: fade, transform: [{ scale: pop }] }]}
        >
          <Text style={styles.title}>Log Out</Text>

          <Text style={styles.sub}>
            Are you sure you want to log out?
          </Text>

          {/* Buttons */}
          <View style={styles.btnRow}>
            {/* Cancel */}
            <Pressable
              onPress={() => closeWithAnim(onCancel)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.btnCancel,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={styles.btnCancelText}>Cancel</Text>
            </Pressable>

            {/* Confirm */}
            <Pressable
              onPress={() => closeWithAnim(onConfirm)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.btnConfirm,
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text style={styles.btnConfirmText}>Log Out</Text>
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
      flexDirection: "row",
      alignSelf: "stretch",
      gap: scale(10),
    },

    btnCancel: {
      flex: 1,
      height: vscale(46),
      borderRadius: scale(14),
      backgroundColor: "#F3F4F6",
      alignItems: "center",
      justifyContent: "center",
    },
    btnCancelText: {
      fontSize: scale(13),
      fontWeight: "700",
      color: "#374151",
    },

    btnConfirm: {
      flex: 1,
      height: vscale(46),
      borderRadius: scale(14),
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: {
          shadowColor: Colors.primary,
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        android: { elevation: 5 },
      }),
    },
    btnConfirmText: {
      fontSize: scale(13),
      fontWeight: "900",
      color: "#FFFFFF",
    },
  });
}
