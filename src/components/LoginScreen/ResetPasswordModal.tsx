// src/components/LoginScreen/ResetPasswordModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../theme/colors";

type Props = {
  visible: boolean;
  email: string;
  setEmail: (v: string) => void;

  onClose: () => void;

  // called when OTP is complete and user presses Verify OTP
  onVerified?: (code: string) => void;

  // responsiveness from screen
  scale: (n: number) => number;
  vscale: (n: number) => number;
};

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ResetPasswordModal({
  visible,
  email,
  setEmail,
  onClose,
  onVerified,
  scale,
  vscale,
}: Props) {
  const styles = useMemo(() => createStyles(scale, vscale), [scale, vscale]);

  // ✅ show OTP section after sending code
  const [otpVisible, setOtpVisible] = useState(false);

  const OTP_LEN = 4;
  const [otp, setOtp] = useState<string[]>(Array.from({ length: OTP_LEN }, () => ""));
  const [secondsLeft, setSecondsLeft] = useState(34);

  const refs = useRef<Array<TextInput | null>>([]);

  const resetAll = () => {
    setOtpVisible(false);
    setOtp(Array.from({ length: OTP_LEN }, () => ""));
    setSecondsLeft(34);
    refs.current = [];
  };

  useEffect(() => {
    if (!visible) resetAll();
  }, [visible]);

  useEffect(() => {
    if (!otpVisible) return;
    if (secondsLeft <= 0) return;

    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [otpVisible, secondsLeft]);

  const canSend = email.trim().length > 0 && isValidEmail(email.trim());
  const codeJoined = otp.join("");
  const canVerify = codeJoined.length === OTP_LEN && otp.every((d) => d.length === 1);

  const handleSendCode = () => {
    if (!canSend) {
      Alert.alert("Invalid", "Please enter a valid email.");
      return;
    }

    // demo "sent"
    setOtpVisible(true);
    setSecondsLeft(34);
    setOtp(Array.from({ length: OTP_LEN }, () => ""));

    setTimeout(() => refs.current?.[0]?.focus?.(), 60);
  };

  const handleResend = () => {
    if (secondsLeft > 0) return;

    // demo resend
    setSecondsLeft(34);
    setOtp(Array.from({ length: OTP_LEN }, () => ""));
    setTimeout(() => refs.current?.[0]?.focus?.(), 60);
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = (value || "").replace(/\D/g, "").slice(-1);

    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (digit && index < OTP_LEN - 1) refs.current[index + 1]?.focus?.();
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key !== "Backspace") return;

    if (otp[index]) {
      setOtp((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    if (index > 0) refs.current[index - 1]?.focus?.();
  };

  const handleVerify = () => {
    if (!canVerify) return;
    onVerified?.(codeJoined);
  };

  const primaryLabel = otpVisible ? "Verify OTP" : "Send Verification Code";
  const onPrimaryPress = otpVisible ? handleVerify : handleSendCode;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* tap outside */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>

          <Text style={styles.subtitle}>
            Forgot your password? Enter your email{"\n"}
            address and we’ll help you reset it.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="JohnDoe@gmail.com"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          {/* ✅ OTP section like screenshot */}
          {otpVisible ? (
            <View style={styles.otpSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoText}>
                  Remaining Time: 00:{pad2(Math.max(secondsLeft, 0))}
                </Text>

                <View style={styles.resendWrap}>
                  <Text style={styles.infoText}>Didn't get the code? </Text>
                  <Pressable
                    onPress={handleResend}
                    disabled={secondsLeft > 0}
                    hitSlop={8}
                    style={({ pressed }) => [
                      pressed && secondsLeft <= 0 ? { opacity: 0.7 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.resendText,
                        secondsLeft > 0 && { opacity: 0.45 },
                      ]}
                    >
                      Resend it
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.otpRow}>
                {otp.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => {
                      refs.current[i] = r; // ✅ no return
                    }}
                    value={d ? "•" : ""}
                    placeholder="*"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={1}
                    style={styles.otpBox}
                    onChangeText={(v) => handleOtpChange(i, v)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(i, nativeEvent.key)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.otpSpacer} />
          )}

          {/* ✅ button style like screenshot */}
          <Pressable
            onPress={onPrimaryPress}
            hitSlop={10}
            disabled={otpVisible ? !canVerify : !canSend}
            style={({ pressed }) => [
              styles.btnOuter,
              (otpVisible ? !canVerify : !canSend) && { opacity: 0.55 },
              pressed ? { transform: [{ scale: 0.99 }], opacity: 0.98 } : null,
            ]}
          >
            <LinearGradient
              colors={Colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>{primaryLabel}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.backText}>Back to Login</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  // tighter card like screenshot
  const cardW = clamp(scale(320), 280, 380);

  const inputH = clamp(vscale(44), 42, 52);

  const otpBox = clamp(scale(46), 40, 56);
  const otpGap = clamp(scale(10), 8, 14);

  const radius = clamp(scale(16), 14, 20);

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.12)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(18),
    },

    card: {
      width: "100%",
      maxWidth: cardW,
      backgroundColor: "#FFFFFF",
      borderRadius: radius,
      paddingHorizontal: clamp(scale(18), 14, 22),
      paddingTop: clamp(vscale(16), 14, 18),
      paddingBottom: clamp(vscale(14), 12, 18),

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
      height: inputH,
      borderRadius: clamp(scale(12), 10, 14),
      paddingHorizontal: clamp(scale(14), 12, 16),
      borderWidth: 1.2,
      borderColor: "#93C5FD",
      backgroundColor: "#FFFFFF",
      fontSize: clamp(scale(13), 12, 14),
      color: "#111827",
    },

    otpSpacer: {
      height: vscale(8),
    },

    otpSection: {
      marginTop: vscale(10),
      marginBottom: vscale(10),
    },

    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: vscale(10),
    },

    infoText: {
      fontSize: clamp(scale(9.5), 9, 11),
      color: "#6B7280",
      fontWeight: "700",
    },

    resendWrap: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
      justifyContent: "flex-end",
    },

    resendText: {
      fontSize: clamp(scale(9.5), 9, 11),
      color: "#1D4ED8",
      fontWeight: "900",
      textDecorationLine: "underline",
    },

    otpRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: otpGap,
    },

    otpBox: {
      width: otpBox,
      height: otpBox,
      borderRadius: clamp(scale(10), 9, 12),
      borderWidth: 1.2,
      borderColor: "#93C5FD",
      textAlign: "center",
      fontSize: clamp(scale(18), 16, 22),
      fontWeight: "900",
      color: "#111827",
      backgroundColor: "#FFFFFF",
      paddingTop: 0,
      paddingBottom: 0,
    },

    btnOuter: {
      width: "100%",
      borderRadius: clamp(scale(14), 12, 16),
      overflow: "hidden",
      marginTop: vscale(6),
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
      height: clamp(vscale(44), 42, 50),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: clamp(scale(14), 12, 16),
    },

    btnText: {
      color: "#FFFFFF",
      fontSize: clamp(scale(12), 11, 13),
      fontWeight: "900",
    },

    backLink: {
      marginTop: vscale(10),
      alignItems: "center",
    },

    backText: {
      fontSize: clamp(scale(11), 10, 12),
      fontWeight: "900",
      color: "#1D4ED8",
    },
  });
}
