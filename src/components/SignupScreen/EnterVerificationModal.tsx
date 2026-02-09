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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../theme/colors";

// ✅ separated badge component
import ChecklistBadge from "../ChecklistBadge";

// ✅ IMPORTANT: use the SAME storage keys your app uses everywhere
import { saveTokens, setLoggedIn } from "../../auth/session";

type Props = {
  visible: boolean;
  email: string;
  initialSeconds?: number; // default: 34
  onClose: () => void;

  // Parent decides next step after successful verification
  onVerified: (code: string) => void;

  // Parent resend handler (SignupScreen already calls registerSendOtp)
  onResend?: () => void;

  // ✅ NEW (fix TS error in SignupScreen)
  isVerifying?: boolean; // disables buttons while verifying
  errorText?: string | null; // show wrong OTP message without closing
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const TAG = "[Signup EnterVerificationModal]";
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

// ✅ Signup should verify REGISTRATION OTP (NOT login OTP)
const VERIFY_REG_OTP_PATH = "/api/mobile/v1/verify-registration-otp";

async function verifyRegistrationOtpRequest(email: string, otp: string) {
  const url = `${API_URL}${VERIFY_REG_OTP_PATH}`;
  console.log(`${TAG} verify URL:`, url);
  console.log(`${TAG} verify email:`, email);
  console.log(`${TAG} verify otpLen:`, otp.length);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });

  const raw = await res.text().catch(() => "");
  console.log(`${TAG} verify status:`, res.status);
  console.log(`${TAG} verify raw:`, raw);

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
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const [code, setCode] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const [savingSession, setSavingSession] = useState(false);

  const inputRef = useRef<TextInput>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;

  const timeText = `00:${String(secondsLeft).padStart(2, "0")}`;
  const canContinue = code.length === 4 && !isVerifying && !savingSession;

  const focusInput = () => {
    requestAnimationFrame(() => inputRef.current?.focus?.());
  };

  const closeWithAnim = () => {
    if (isVerifying || savingSession) return;
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
    setSavingSession(false);

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
    const cleaned = t.replace(/\D/g, "").slice(0, 4);
    setCode(cleaned);
  };

  const handleContinue = async () => {
    if (!canContinue) return;

    const e = (email || "").trim();
    if (!e) {
      Alert.alert("Missing Email", "Email is required for OTP verification.");
      return;
    }

    const otp = code.trim();
    if (otp.length !== 4) return;

    try {
      setSavingSession(true);
      console.log(`${TAG} verify START`);

      const data = await verifyRegistrationOtpRequest(e, otp);

      // ✅ SAVE TOKENS USING YOUR APP'S OFFICIAL STORAGE KEYS
      await saveTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      // ✅ Mark logged in so Splash won't send you back to onboarding
      await setLoggedIn(true);

      console.log(`${TAG} tokens saved via session.ts`, {
        access: Boolean(data?.accessToken),
        refresh: Boolean(data?.refreshToken),
      });

      closeWithAnim();
      onVerified(otp);
    } catch (err: any) {
      console.log(`${TAG} verify ERROR:`, err?.message || err);
      Alert.alert(
        "Verification Failed",
        err?.message || "OTP is incorrect. Please try again."
      );
    } finally {
      setSavingSession(false);
      console.log(`${TAG} verify END`);
    }
  };

  const handleResend = () => {
    if (secondsLeft > 0 || isVerifying || savingSession) return;
    setSecondsLeft(initialSeconds);
    onResend?.();
    setTimeout(focusInput, 160);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeWithAnim}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]} />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: fade,
              transform: [{ scale: pop }],
            },
          ]}
        >
          <View style={styles.badgeWrap}>
            <ChecklistBadge size={scale(86)} />
          </View>

          <Text style={styles.title}>Enter Verification Code!</Text>

          <Text style={styles.sub}>
            Enter the 4 - digit verification code sent to{"\n"}your email address
          </Text>

          <Pressable
            onPress={focusInput}
            style={styles.otpRow}
            disabled={isVerifying || savingSession}
          >
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
          </Pressable>

          {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

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
            onSubmitEditing={handleContinue}
            editable={!isVerifying && !savingSession}
          />

          <View style={styles.infoRow}>
            <Text style={styles.timer}>
              Remaining Time <Text style={styles.timerStrong}>{timeText}</Text>
            </Text>

            <View style={styles.resendRow}>
              <Text style={styles.mutedSmall}>Didn’t get the code </Text>
              <Pressable
                onPress={handleResend}
                hitSlop={10}
                disabled={secondsLeft > 0 || isVerifying || savingSession}
              >
                <Text
                  style={[
                    styles.resend,
                    (secondsLeft > 0 || isVerifying || savingSession) && {
                      opacity: 0.45,
                    },
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
                colors={Colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                {isVerifying || savingSession ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.btnText}>Continue</Text>
                )}
              </LinearGradient>
            </View>
          </Pressable>

          <Pressable
            onPress={closeWithAnim}
            hitSlop={10}
            style={[
              styles.cancelBtn,
              (isVerifying || savingSession) && { opacity: 0.45 },
            ]}
            disabled={isVerifying || savingSession}
          >
            <Text style={styles.cancelText}>Cancel</Text>
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
      backgroundColor: "rgba(0,0,0,0.28)",
    },
    card: {
      width: "100%",
      maxWidth: scale(320),
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
    otpRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: scale(10),
      paddingHorizontal: scale(6),
      marginBottom: scale(10),
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
      textAlign: "center",
      marginBottom: scale(10),
      fontSize: scale(10.5),
      color: "#DC2626",
      fontWeight: "800",
    },
    hiddenInput: {
      position: "absolute",
      opacity: 0,
      height: 1,
      width: 1,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: scale(8),
      marginBottom: scale(12),
    },
    timer: {
      fontSize: scale(10),
      color: "#6B7280",
      fontWeight: "700",
    },
    timerStrong: {
      color: Colors.primary,
      fontWeight: "900",
    },
    resendRow: { flexDirection: "row", alignItems: "center" },
    mutedSmall: {
      fontSize: scale(10),
      color: "#6B7280",
      fontWeight: "600",
    },
    resend: {
      fontSize: scale(10),
      fontWeight: "900",
      color: Colors.link,
      textDecorationLine: "underline",
    },
    btnOuter: {
      borderRadius: scale(14),
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
      borderRadius: scale(14),
      overflow: "hidden",
    },
    btnGradient: {
      height: vscale(46),
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: {
      color: "#FFFFFF",
      fontSize: scale(12.8),
      fontWeight: "900",
    },
    cancelBtn: {
      alignItems: "center",
      paddingVertical: scale(10),
    },
    cancelText: {
      fontSize: scale(11.5),
      fontWeight: "800",
      color: Colors.link,
    },
  });
}
