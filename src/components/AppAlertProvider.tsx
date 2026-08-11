import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert as RNAlert,
  type AlertButton,
  type AlertOptions,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Colors, useColors } from "../theme/colors";
import { createTypography } from "../theme/typography";

type Props = {
  children: React.ReactNode;
};

type QueuedAlert = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};

let nativeAlertImpl: typeof RNAlert.alert | null = null;
let alertHandler:
  | ((title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void)
  | null = null;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeButtons(buttons?: AlertButton[]) {
  if (buttons?.length) return buttons;
  return [{ text: "OK" }] as AlertButton[];
}

/**
 * Requests can fail in the background while the API is unavailable. Those
 * failures are already represented by the screen's empty/loading state, so
 * showing a modal for every poll or refresh quickly becomes disruptive.
 * Keep user-actionable validation and permission alerts visible; suppress only
 * transport/backend failures here.
 */
function shouldSuppressBackendAlert(title: string, message?: string) {
  const text = `${title} ${message || ""}`.toLowerCase();

  const silentAuthFailure = [
    "session expired",
    "access token expired",
    "invalid or expired access token",
    "invalid refresh token",
    "expired refresh token",
    "please log in again",
  ].some((marker) => text.includes(marker));

  if (silentAuthFailure) return true;

  return [
    "network request failed",
    "failed to fetch",
    "network error",
    "fetch failed",
    "unable to connect",
    "connection error",
    "connection failed",
    "econnrefused",
    "server unavailable",
    "backend unavailable",
    "service unavailable",
    "internal server error",
    "bad gateway",
    "gateway timeout",
    "status code 500",
    "status code 502",
    "status code 503",
    "request failed",
    "status fetch failed",
    "timed out",
    "timeout",
  ].some((marker) => text.includes(marker));
}

function installAlertPatch() {
  if ((RNAlert.alert as any).__tahananSafePatched) return;

  nativeAlertImpl = RNAlert.alert.bind(RNAlert);

  const patchedAlert: typeof RNAlert.alert = (title, message, buttons, options) => {
    if (alertHandler) {
      alertHandler(title, message, buttons, options);
      return;
    }

    nativeAlertImpl?.(title, message, buttons, options);
  };

  (patchedAlert as any).__tahananSafePatched = true;
  (RNAlert as any).alert = patchedAlert;
}

installAlertPatch();

/** Show the operating system alert without routing through the app's custom dialog. */
export function showNativeAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) {
  const alert = nativeAlertImpl ?? RNAlert.alert.bind(RNAlert);
  alert(title, message, buttons, options);
}

export default function AppAlertProvider({ children }: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();
  const [queue, setQueue] = useState<QueuedAlert[]>([]);
  const nextIdRef = useRef(1);

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;

  const current = queue[0] ?? null;
  const buttons = useMemo(() => normalizeButtons(current?.buttons), [current?.buttons]);
  const hasMessage = !!String(current?.message || "").trim();
  const isStacked = buttons.length > 2;

  const layoutWidth = Math.min(width, 600);
  const s = clamp(layoutWidth / 375, 0.88, 1.2);
  const vs = clamp(height / 812, 0.82, 1.15);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(
    () => createStyles(scale, vscale, Math.max(200, height - 32)),
    [width, height]
  );

  useEffect(() => {
    alertHandler = (title, message, alertButtons, options) => {
      if (shouldSuppressBackendAlert(String(title || ""), message)) return;

      setQueue((prev) => [
        ...prev,
        {
          id: nextIdRef.current++,
          title: String(title || "").trim() || "Notice",
          message,
          buttons: normalizeButtons(alertButtons),
          options,
        },
      ]);
    };

    return () => {
      alertHandler = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;

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
  }, [current, fade, pop]);

  const dequeueCurrent = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const closeWithAnim = useCallback(
    (afterClose?: () => void, dismissed = false) => {
      const active = current;
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(pop, { toValue: 0.98, duration: 120, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished) return;
        dequeueCurrent();
        if (dismissed) {
          active?.options?.onDismiss?.();
        }
        afterClose?.();
      });
    },
    [current, dequeueCurrent, fade, pop]
  );

  const onBackdropClose = useCallback(() => {
    if (!current?.options?.cancelable) return;
    closeWithAnim(undefined, true);
  }, [closeWithAnim, current?.options?.cancelable]);

  const renderButton = useCallback(
    (button: AlertButton, index: number) => {
      const label = String(button?.text || (button?.style === "cancel" ? "Cancel" : "OK"));
      const isCancel = button?.style === "cancel";
      const isDestructive = button?.style === "destructive";
      const stackedDefault = isStacked && !isCancel && !isDestructive;

      return (
        <Pressable
          key={`${current?.id || "alert"}_${label}_${index}`}
          onPress={() => closeWithAnim(() => button?.onPress?.())}
          hitSlop={8}
          style={({ pressed }) => [
            isStacked ? styles.stackBtn : styles.rowBtn,
            buttons.length === 1 && styles.singleBtn,
            isCancel
              ? styles.btnCancel
              : stackedDefault
                ? [styles.btnStackDefault, { borderColor: TC.actionPrimary }]
                : styles.btnConfirm,
            !isCancel && !stackedDefault && {
              backgroundColor: isDestructive ? "#DC2626" : TC.actionPrimary,
            },
            pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
        >
          <Text
            style={[
              styles.btnTextBase,
              isCancel
                ? [styles.btnCancelText, { color: TC.textDark }]
                : stackedDefault
                  ? [styles.btnStackDefaultText, { color: TC.actionPrimary }]
                  : styles.btnConfirmText,
            ]}
          >
            {label}
          </Text>
        </Pressable>
      );
    },
    [
      TC.actionPrimary,
      TC.textDark,
      buttons.length,
      closeWithAnim,
      current?.id,
      isStacked,
      styles,
    ]
  );

  return (
    <>
      {children}

      <Modal visible={!!current} transparent animationType="none" onRequestClose={onBackdropClose}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onBackdropClose}>
            <Animated.View style={[styles.backdrop, { opacity: fade, backgroundColor: TC.overlay }]} />
          </Pressable>

          {current ? (
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: fade,
                  transform: [{ scale: pop }],
                  backgroundColor: TC.surface,
                },
              ]}
            >
              <Text style={[styles.title, !hasMessage && styles.titleOnly, { color: TC.textDark }]}>
                {current.title}
              </Text>

              {hasMessage ? (
                <ScrollView
                  style={styles.messageScroll}
                  contentContainerStyle={styles.messageScrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  <Text style={[styles.sub, { color: TC.muted }]}>{current.message}</Text>
                </ScrollView>
              ) : null}

              <View style={isStacked ? styles.btnStack : styles.btnRow}>{buttons.map(renderButton)}</View>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function createStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number,
  cardMaxHeight: number
) {
  const type = createTypography(scale, vscale);
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: scale(24),
      paddingVertical: 16,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.32)",
    },
    card: {
      width: "100%",
      maxWidth: scale(328),
      maxHeight: cardMaxHeight,
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
      ...type.sectionTitle,
      textAlign: "center",
      color: "#111827",
      marginBottom: scale(10),
    },
    titleOnly: {
      marginBottom: scale(24),
    },
    sub: {
      ...type.caption,
      textAlign: "center",
      color: "#6B7280",
    },
    messageScroll: {
      alignSelf: "stretch",
      flexShrink: 1,
      minHeight: 0,
      maxHeight: vscale(240),
      marginBottom: scale(24),
    },
    messageScrollContent: {
      flexGrow: 0,
    },
    btnRow: {
      flexDirection: "row",
      alignSelf: "stretch",
      gap: scale(10),
    },
    btnStack: {
      alignSelf: "stretch",
      gap: scale(10),
    },
    rowBtn: {
      flex: 1,
      height: vscale(46),
      borderRadius: scale(14),
      alignItems: "center",
      justifyContent: "center",
    },
    stackBtn: {
      width: "100%",
      minHeight: vscale(46),
      borderRadius: scale(14),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(16),
      paddingVertical: vscale(12),
    },
    singleBtn: {
      flex: 0,
      width: "100%",
    },
    btnCancel: {
      backgroundColor: "#F3F4F6",
    },
    btnConfirm: {
      backgroundColor: Colors.actionPrimary,
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
    btnStackDefault: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
    },
    btnTextBase: {
      ...type.label,
      textAlign: "center",
    },
    btnCancelText: {
      color: "#374151",
    },
    btnConfirmText: {
      color: "#FFFFFF",
    },
    btnStackDefaultText: {
      color: Colors.primary,
    },
  });
}
