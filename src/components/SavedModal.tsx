// src/components/SavedModal.tsx
import React, { useCallback, useEffect, useMemo, useRef } from "react";
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
import { Colors, useColors } from "../theme/colors";

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  buttonLabel?: string;
  onClose: () => void;
  hideButton?: boolean;
  autoCloseMs?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function SavedModal({
  visible,
  title = "Saved!",
  message = "Your changes have been saved successfully.",
  buttonLabel = "OK",
  onClose,
  hideButton = false,
  autoCloseMs,
}: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();
  const hasMessage = message.trim().length > 0;

  const layoutWidth = Math.min(width, 600);
  const s = clamp(layoutWidth / 375, 0.88, 1.2);
  const vs = clamp(height / 812, 0.82, 1.15);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;

  const closeWithAnim = useCallback(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 0.98, duration: 120, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [fade, onClose, pop]);

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

  useEffect(() => {
    if (!visible || !autoCloseMs) return;

    const timer = setTimeout(() => {
      closeWithAnim();
    }, autoCloseMs);

    return () => clearTimeout(timer);
  }, [autoCloseMs, closeWithAnim, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeWithAnim}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: fade, backgroundColor: TC.overlay }]} />

        <Animated.View
          style={[
            styles.card,
            !hasMessage && hideButton ? styles.cardCompact : null,
            { opacity: fade, transform: [{ scale: pop }], backgroundColor: TC.surface },
          ]}
        >
          <Text
            style={[
              styles.title,
              !hasMessage && hideButton ? styles.titleStandalone : !hasMessage ? styles.titleOnly : null,
              { color: TC.textDark },
            ]}
          >
            {title}
          </Text>

          {hasMessage ? (
            <Text style={[styles.sub, { color: TC.muted }]}>{message}</Text>
          ) : null}

          {!hideButton ? (
            <Pressable
              onPress={closeWithAnim}
              hitSlop={8}
              style={({ pressed }) => [
                styles.btnOuter,
                pressed ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
              ]}
            >
              <View style={[styles.btnInner, { backgroundColor: TC.actionPrimary }]}>
                <Text style={styles.btnText}>{buttonLabel}</Text>
              </View>
            </Pressable>
          ) : null}
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
    cardCompact: {
      maxWidth: scale(276),
      paddingHorizontal: scale(20),
      paddingTop: scale(22),
      paddingBottom: scale(22),
    },

    title: {
      textAlign: "center",
      fontSize: scale(16),
      fontWeight: "900",
      color: Colors.text,
      marginBottom: scale(10),
    },
    titleOnly: {
      marginBottom: scale(22),
    },
    titleStandalone: {
      marginBottom: 0,
    },
    sub: {
      textAlign: "center",
      fontSize: scale(12),
      lineHeight: scale(18),
      color: "#6B7280",
      marginBottom: scale(22),
    },

    btnOuter: {
      alignSelf: "stretch",
      borderRadius: scale(14),
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 5 },
        },
        android: { elevation: 5 },
      }),
    },
    btnInner: {
      height: vscale(46),
      borderRadius: scale(14),
      backgroundColor: Colors.actionPrimary,
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
