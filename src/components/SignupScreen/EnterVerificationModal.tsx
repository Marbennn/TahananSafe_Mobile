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
import { createTypography } from "../../theme/typography";

// ✅ separated badge component
import ChecklistBadge from "../ChecklistBadge";

// ✅ IMPORTANT: use the SAME storage keys your app uses everywhere
import { setLoggedIn } from "../../auth/session";
import { verifyRegistrationOtp } from "../../api/auth";

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
  const [savingSession, setSavingSession] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [showSentNotice, setShowSentNotice] = useState(false);

  const inputRef = useRef<TextInput>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;

  const timeText = `00:${String(secondsLeft).padStart(2, "0")}`;
  const canContinue = code.length === 4 && !isVerifying && !savingSession;

  const focusInput = () => {
    setTimeout(() => inputRef.current?.focus?.(), 100);
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
    setOtpError(null);

    // ✅ show inline notice every time modal opens
    setShowSentNotice(true);

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

    // ✅ auto hide notice after 2.8s
    const noticeTimer = setTimeout(() => setShowSentNotice(false), 2800);

    return () => {
      clearTimeout(t);
      clearTimeout(noticeTimer);
    };
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
    if (otpError) setOtpError(null);
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

      const data = await verifyRegistrationOtp(e, otp);

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
      setOtpError("Invalid OTP. Please try again.");
    } finally {
      setSavingSession(false);
      console.log(`${TAG} verify END`);
    }
  };

  const handleResend = () => {
    if (secondsLeft > 0 || isVerifying || savingSession) return;
    setSecondsLeft(initialSeconds);
    onResend?.();

    // ✅ show notice again on resend
    setShowSentNotice(true);
    setTimeout(() => setShowSentNotice(false), 2800);

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
          style={[
            styles.card,
            {
              opacity: fade,
              transform: [{ scale: pop }],
              backgroundColor: TC.surface,
            },
          ]}
        >
          {/* X close button */}
          <Pressable
            onPress={closeWithAnim}
            hitSlop={10}
            disabled={isVerifying || savingSession}
            style={[styles.closeBtn, (isVerifying || savingSession) && { opacity: 0.35 }]}
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
              editable={!isVerifying && !savingSession}
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
                colors={TC.actionGradient}
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

          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const typography = createTypography(scale);
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
    badgeWrap: {
      alignItems: "center",
      marginTop: scale(2),
      marginBottom: scale(10),
    },

    // ✅ NEW notice styles
    noticeBox: {
      alignSelf: "stretch",
      borderRadius: scale(12),
      paddingVertical: scale(10),
      paddingHorizontal: scale(12),
      backgroundColor: "rgba(59,130,246,0.10)",
      borderWidth: 1,
      borderColor: "rgba(59,130,246,0.25)",
      marginBottom: scale(10),
    },
    noticeText: {
      ...typography.microStrong,
      textAlign: "center",
      color: "#1D4ED8",
    },

    title: {
      ...typography.sectionTitle,
      textAlign: "center",
      color: Colors.text,
      marginBottom: scale(6),
    },
    sub: {
      ...typography.caption,
      textAlign: "center",
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
      ...typography.numeric,
      color: Colors.text,
    },
    errorText: {
      ...typography.microStrong,
      textAlign: "left",
      paddingHorizontal: scale(6),
      marginTop: scale(5),
      marginBottom: scale(0),
      color: "#DC2626",
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
      ...typography.micro,
      color: "#6B7280",
    },
    timerStrong: {
      ...typography.microStrong,
      color: Colors.primary,
    },
    resendRow: { flexDirection: "row", alignItems: "center" },
    mutedSmall: {
      ...typography.micro,
      color: "#6B7280",
    },
    resend: {
      ...typography.microStrong,
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
    btnText: {
      ...typography.button,
      color: "#FFFFFF",
    },
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
  });
}
