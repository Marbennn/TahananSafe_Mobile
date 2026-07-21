// src/components/LoginScreen/EnterVerificationModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
  Animated,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, useColors } from "../../theme/colors";

import * as SecureStore from "expo-secure-store";

import ChecklistBadge from "../ChecklistBadge";

// ✅ use YOUR app session storage (same keys Splash/App uses)
import { saveTokens, setLoggedIn, setHasPin } from "../../auth/session";

// ✅ call /me to know if user has pin
import { getMeApi } from "../../api/pin";

type Props = {
  visible: boolean;
  email: string;
  initialSeconds?: number;
  onClose: () => void;

  // parent will navigate after success
  onVerified: (code: string) => void;

  onResend?: () => void;

  // optional extra controls (safe to ignore)
  isVerifying?: boolean;
  errorText?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const TAG = "[Login EnterVerificationModal]";
const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000")
  .trim()
  .replace(/\/+$/, "");
const VERIFY_LOGIN_OTP_PATH = "/api/mobile/v1/verify-login-otp";

// ✅ SecureStore keys must contain only: A-Z a-z 0-9 . - _
function safeKeyPart(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
}

function refreshKeyForEmail(email: string) {
  return `tahanansafe_refresh_${safeKeyPart(email)}`;
}

async function verifyLoginOtpRequest(email: string, otp: string) {
  const url = `${API_URL}${VERIFY_LOGIN_OTP_PATH}`;
  console.log(`${TAG} verify URL:`, url);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });

  const raw = await res.text().catch(() => "");
  console.log(`${TAG} status:`, res.status);
  console.log(`${TAG} raw:`, raw);

  let data: any = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    throw new Error(data?.message || `OTP verify failed (HTTP ${res.status})`);
  }

  return data as {
    message?: string;
    accessToken: string;
    refreshToken?: string;
    user?: any;
  };
}

export default function EnterVerificationModal({
  visible,
  email,
  initialSeconds = 34,
  onClose,
  onVerified,
  onResend,
  isVerifying = false,
  errorText = null,
}: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();

  const s = clamp(Math.min(width, 480) / 375, 0.84, 1.12);
  const vs = clamp(height / 812, 0.76, 1.08);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const [code, setCode] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;

  const timeText = `00:${String(secondsLeft).padStart(2, "0")}`;
  const canContinue = code.length === 4 && !isVerifying && !verifying;

  const focusInput = () => {
    setTimeout(() => inputRef.current?.focus?.(), 100);
  };

  const closeWithAnim = () => {
    if (isVerifying || verifying) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 0.98, duration: 120, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  useEffect(() => {
    if (!visible) return;

    setCode("");
    setSecondsLeft(initialSeconds);
    setVerifying(false);
    setOtpError(null);

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

    const t = setTimeout(focusInput, 220);
    return () => clearTimeout(t);
  }, [visible, initialSeconds, fade, pop]);

  useEffect(() => {
    if (!visible) return;
    if (secondsLeft <= 0) return;

    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [visible, secondsLeft]);

  const handleChange = (t: string) => {
    setCode(t.replace(/\D/g, "").slice(0, 4));
    if (otpError) setOtpError(null);
  };

  const handleContinue = async () => {
    if (!canContinue) return;

    const e = String(email || "").trim().toLowerCase();
    if (!e) {
      Alert.alert("Missing Email", "Email is required for OTP verification.");
      return;
    }

    const otp = code.trim();
    if (otp.length !== 4) return;

    try {
      setVerifying(true);
      console.log(`${TAG} verify START`);

      // 1) verify OTP -> get tokens
      const data = await verifyLoginOtpRequest(e, otp);

      // 2) save tokens to your app session storage (AsyncStorage)
      await saveTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      // Store refresh token in SecureStore for normal token refresh.
      if (data?.refreshToken) {
        const key = refreshKeyForEmail(e);
        try {
          await SecureStore.setItemAsync(key, data.refreshToken);
          // ✅ SECURITY: token saved (no key logged)
        } catch (err: any) {
          // SecureStore save failed silently
        }
      }

      // 3) mark logged in (persist)
      await setLoggedIn(true);

      // 4) ask /me if user has pin -> store hasPin
      try {
        const me = await getMeApi();
        await setHasPin(!!me.user.hasPin);
        // hasPin set
      } catch (err: any) {
        await setHasPin(false);
        // getMe failed, default hasPin=false
      }

      // ✅ SECURITY: No token values logged

      // 5) close + notify parent
      closeWithAnim();
      onVerified(otp);
    } catch (err: any) {
      console.log(`${TAG} verify ERROR:`, err?.message || err);
      setOtpError("Invalid OTP. Please try again.");
    } finally {
      setVerifying(false);
      console.log(`${TAG} verify END`);
    }
  };

  const handleResend = () => {
    if (secondsLeft > 0 || isVerifying || verifying) return;
    setSecondsLeft(initialSeconds);
    onResend?.();
    setTimeout(focusInput, 160);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeWithAnim}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]} />
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >

        <Animated.View
          style={[styles.card, { opacity: fade, transform: [{ scale: pop }], backgroundColor: TC.surface }]}
        >
          {/* X close button */}
          <Pressable
            onPress={closeWithAnim}
            hitSlop={10}
            disabled={isVerifying || verifying}
            style={[styles.closeBtn, (isVerifying || verifying) && { opacity: 0.35 }]}
          >
            <View style={styles.xWrap}>
              <View style={[styles.xBar, { transform: [{ rotate: "45deg" }] }]} />
              <View style={[styles.xBar, { transform: [{ rotate: "-45deg" }] }]} />
            </View>
          </Pressable>

          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={styles.cardContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.badgeWrap}>
            <ChecklistBadge size={scale(86)} />
          </View>

          <Text style={[styles.title, { color: TC.textDark }]}>Enter Verification Code!</Text>

          <Text style={[styles.sub, { color: TC.muted }]}>
            Enter the 4 - digit verification code sent to{"\n"}your email address
          </Text>

          <View style={styles.otpWrapper}>
            <View style={styles.otpRow}>
              {[0, 1, 2, 3].map((i) => {
                const ch = code[i] ?? "";
                const isActive = i === code.length && code.length < 4;
                const isFilled = ch.length > 0;
                return (
                  <View
                    key={i}
                    style={[
                      styles.otpBox,
                      (isActive || isFilled) && styles.otpBoxActive,
                    ]}
                  >
                    <Text style={styles.otpChar}>{ch}</Text>
                  </View>
                );
              })}
            </View>

            {/* Overlay the input over the entire OTP row so taps hit it directly */}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={handleChange}
              keyboardType="number-pad"
              returnKeyType="done"
              maxLength={4}
              style={styles.hiddenInput}
              autoFocus={false}
              blurOnSubmit={false}
              showSoftInputOnFocus={true}
              onSubmitEditing={handleContinue}
              editable={!isVerifying && !verifying}
            />

            {!!(errorText || otpError) && (
              <Text style={styles.errorText}>{otpError ?? errorText}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.timer}>
              Remaining Time <Text style={styles.timerStrong}>{timeText}</Text>
            </Text>

            <View style={styles.resendRow}>
              <Text style={styles.mutedSmall}>Didn't get the code </Text>
              <Pressable
                onPress={handleResend}
                hitSlop={10}
                disabled={secondsLeft > 0 || isVerifying || verifying}
              >
                <Text
                  style={[
                    styles.resend,
                    (secondsLeft > 0 || isVerifying || verifying) && { opacity: 0.45 },
                  ]}
                >
                  Resend it
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleContinue}
            disabled={!canContinue}
            hitSlop={10}
            style={({ pressed }) => [
              styles.btnOuter,
              !canContinue && { opacity: 0.6 },
              pressed && canContinue ? { transform: [{ scale: 0.99 }] } : null,
            ]}
          >
            <View style={styles.btnClip}>
              <LinearGradient
                colors={TC.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                {isVerifying || verifying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnText}>Continue</Text>
                )}
              </LinearGradient>
            </View>
          </Pressable>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
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
      backgroundColor: "rgba(0,0,0,0.28)",
    },
    card: {
      width: "100%",
      maxWidth: scale(320),
      maxHeight: "94%",
      borderRadius: scale(18),
      backgroundColor: "#FFFFFF",
      paddingHorizontal: scale(18),
      paddingTop: scale(16),
      paddingBottom: scale(12),
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
    cardScroll: { width: "100%", flexShrink: 1 },
    cardContent: { paddingTop: scale(2), paddingBottom: scale(2) },

    closeBtn: {
      position: "absolute",
      top: scale(12),
      right: scale(12),
      zIndex: 10,
      padding: scale(4),
    },
    xWrap: {
      width: scale(20),
      height: scale(20),
      alignItems: "center",
      justifyContent: "center",
    },
    xBar: {
      position: "absolute",
      width: scale(14),
      height: scale(2),
      borderRadius: scale(1),
      backgroundColor: "#9CA3AF",
    },

    badgeWrap: {
      alignItems: "center",
      marginTop: scale(2),
      marginBottom: scale(10),
    },
    title: {
      textAlign: "center",
      fontSize: scale(13.5),
      fontWeight: "900",
      color: Colors.text,
      marginBottom: scale(6),
    },
    sub: {
      textAlign: "center",
      fontSize: scale(10.5),
      lineHeight: scale(14),
      color: "#6B7280",
      marginBottom: scale(12),
    },

    otpWrapper: {
      alignSelf: "stretch",
      marginBottom: scale(20),
    },
    otpRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: scale(10),
      paddingHorizontal: scale(6),
    },
    otpBox: {
      flex: 1,
      height: vscale(48),
      borderRadius: scale(10),
      borderWidth: 1,
      borderColor: "#C9D9EA",
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
    otpBoxActive: { borderColor: "#A7C6E6" },
    otpChar: {
      fontSize: scale(16),
      fontWeight: "900",
      color: Colors.text,
    },
    errorText: {
      textAlign: "left",
      paddingHorizontal: scale(6),
      marginTop: scale(5),
      marginBottom: scale(0),
      fontSize: scale(10.5),
      color: "#DC2626",
      fontWeight: "800",
    },
    hiddenInput: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0,
    },

    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: scale(8),
      marginBottom: scale(20),
    },
    timer: {
      fontSize: scale(10),
      color: "#6B7280",
      fontWeight: "400",
    },
    timerStrong: { color: Colors.primary, fontWeight: "900" },
    resendRow: { flexDirection: "row", alignItems: "center" },
    mutedSmall: {
      fontSize: scale(10),
      color: "#6B7280",
      fontWeight: "400",
    },
    resend: {
      fontSize: scale(10),
      fontWeight: "900",
      color: Colors.link,
      textDecorationLine: "underline",
    },

    btnOuter: {
      alignSelf: "center",
      width: "55%",
      borderRadius: scale(50),
      marginTop: scale(2),
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
    btnClip: {
      borderRadius: scale(50),
      overflow: "hidden",
    },
    btnGradient: {
      height: vscale(46),
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: { color: "#FFFFFF", fontSize: scale(12.8), fontWeight: "900" },
  });
}
