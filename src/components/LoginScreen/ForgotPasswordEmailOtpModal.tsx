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
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";

type Props = {
  visible: boolean;

  email: string;
  setEmail: (v: string) => void;

  onClose: () => void;

  // ✅ will return resetToken instead of just OTP code
  onVerified: (resetToken: string) => void;

  scale: (n: number) => number;
  vscale: (n: number) => number;

  initialSeconds?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

const TAG = "[ForgotPasswordEmailOtpModal]";
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

const SEND_OTP_PATH = "/api/mobile/v1/forgot-password/send-otp";
const VERIFY_OTP_PATH = "/api/mobile/v1/forgot-password/verify-otp";

async function sendForgotOtp(email: string) {
  const url = `${API_URL}${SEND_OTP_PATH}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const raw = await res.text().catch(() => "");
  let data: any = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
  }
  if (!res.ok) throw new Error(data?.message || `Failed (HTTP ${res.status})`);
  return data as { message?: string; expiresInSeconds?: number };
}

async function verifyForgotOtp(email: string, otp: string) {
  const url = `${API_URL}${VERIFY_OTP_PATH}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });

  const raw = await res.text().catch(() => "");
  let data: any = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
  }
  if (!res.ok) throw new Error(data?.message || `Failed (HTTP ${res.status})`);

  return data as { message?: string; resetToken: string; expiresInSeconds?: number };
}

export default function ForgotPasswordEmailOtpModal({
  visible,
  email,
  setEmail,
  onClose,
  onVerified,
  scale,
  vscale,
  initialSeconds = 34,
}: Props) {
  const styles = useMemo(() => createStyles(scale, vscale), [scale, vscale]);

  const [otpVisible, setOtpVisible] = useState(false);
  const OTP_LEN = 4;
  const [otp, setOtp] = useState<string[]>(
    Array.from({ length: OTP_LEN }, () => "")
  );

  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const refs = useRef<Array<TextInput | null>>([]);

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const resetAll = () => {
    setOtpVisible(false);
    setOtp(Array.from({ length: OTP_LEN }, () => ""));
    setSecondsLeft(initialSeconds);
    refs.current = [];
    setSending(false);
    setVerifying(false);
  };

  useEffect(() => {
    if (!visible) return;
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (!otpVisible) return;
    if (secondsLeft <= 0) return;

    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [visible, otpVisible, secondsLeft]);

  const canSend = email.trim().length > 0 && isValidEmail(email.trim());
  const codeJoined = otp.join("");
  const canVerify =
    codeJoined.length === OTP_LEN && otp.every((d) => d.length === 1);

  const handleSendCode = async () => {
    if (!canSend) return Alert.alert("Invalid", "Please enter a valid email.");
    if (sending) return;

    const emailNorm = email.trim().toLowerCase();

    try {
      setSending(true);
      console.log(`${TAG} send OTP`, { email: emailNorm });

      await sendForgotOtp(emailNorm);

      setOtpVisible(true);
      setSecondsLeft(initialSeconds);
      setOtp(Array.from({ length: OTP_LEN }, () => ""));
      setTimeout(() => refs.current?.[0]?.focus?.(), 120);

      Alert.alert("Sent", "Verification code sent to your email.");
    } catch (err: any) {
      console.log(`${TAG} send ERROR`, err?.message || err);
      Alert.alert("Failed", err?.message || "Could not send code.");
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    if (!canSend) return Alert.alert("Invalid", "Please enter a valid email.");
    if (sending) return;

    const emailNorm = email.trim().toLowerCase();

    try {
      setSending(true);
      console.log(`${TAG} resend OTP`, { email: emailNorm });

      await sendForgotOtp(emailNorm);

      setSecondsLeft(initialSeconds);
      setOtp(Array.from({ length: OTP_LEN }, () => ""));
      setTimeout(() => refs.current?.[0]?.focus?.(), 120);

      Alert.alert("Resent", "Verification code resent to your email.");
    } catch (err: any) {
      console.log(`${TAG} resend ERROR`, err?.message || err);
      Alert.alert("Failed", err?.message || "Could not resend code.");
    } finally {
      setSending(false);
    }
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

  const handleVerify = async () => {
    if (!canVerify)
      return Alert.alert("Invalid", "Please enter the 4-digit code.");
    if (verifying) return;

    const emailNorm = email.trim().toLowerCase();

    try {
      setVerifying(true);
      console.log(`${TAG} verify OTP`, { email: emailNorm });

      const data = await verifyForgotOtp(emailNorm, codeJoined);

      // ✅ pass resetToken to next step
      onVerified(data.resetToken);
    } catch (err: any) {
      console.log(`${TAG} verify ERROR`, err?.message || err);
      Alert.alert("Invalid", err?.message || "OTP verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const buttonDisabled = otpVisible ? !canVerify || verifying : !canSend || sending;

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
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close" size={scale(18)} color="#111827" />
              </Pressable>

              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Forgot your password? Enter your email{"\n"}
                address and we’ll help you reset it.
              </Text>

              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(v) => {
                  setEmail(v);

                  if (otpVisible) {
                    setOtpVisible(false);
                    setOtp(Array.from({ length: OTP_LEN }, () => ""));
                    setSecondsLeft(initialSeconds);
                    refs.current = [];
                  }
                }}
                placeholder="JohnDoe@gmail.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />

              {otpVisible ? (
                <View style={styles.otpBlock}>
                  <View style={styles.otpInfoRow}>
                    <Text style={styles.smallText}>
                      Remaining Time: 00:{pad2(Math.max(secondsLeft, 0))}
                    </Text>

                    <View style={styles.resendRow}>
                      <Text style={styles.smallText}>Didn't get the code? </Text>
                      <Pressable
                        onPress={handleResend}
                        disabled={secondsLeft > 0 || sending}
                        hitSlop={8}
                        style={({ pressed }) => [
                          pressed && secondsLeft <= 0 ? { opacity: 0.7 } : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.resendText,
                            (secondsLeft > 0 || sending) && { opacity: 0.45 },
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
                          refs.current[i] = r;
                        }}
                        value={d}
                        placeholder="*"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={1}
                        style={styles.otpBox}
                        onChangeText={(v) => handleOtpChange(i, v)}
                        onKeyPress={({ nativeEvent }) =>
                          handleOtpKeyPress(i, nativeEvent.key)
                        }
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={otpVisible ? handleVerify : handleSendCode}
                hitSlop={10}
                disabled={buttonDisabled}
                style={({ pressed }) => [
                  styles.btnOuter,
                  buttonDisabled && { opacity: 0.55 },
                  pressed ? { transform: [{ scale: 0.99 }], opacity: 0.98 } : null,
                ]}
              >
                <LinearGradient
                  colors={Colors.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  {sending || verifying ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.btnText}>
                      {otpVisible ? "Verify OTP" : "Send Verification Code"}
                    </Text>
                  )}
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
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const cardW = clamp(scale(332), 292, 396);
  const inputH = clamp(vscale(46), 42, 54);

  const otpSize = clamp(scale(54), 44, 66);
  const otpGap = clamp(scale(10), 8, 14);

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
      paddingHorizontal: clamp(scale(18), 14, 22),
      paddingTop: clamp(vscale(16), 14, 18),
      paddingBottom: clamp(vscale(16), 14, 18),
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
    closeBtn: {
      position: "absolute",
      top: vscale(8),
      right: scale(8),
      width: scale(34),
      height: scale(34),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
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
      width: "100%",
      height: inputH,
      borderRadius: clamp(scale(12), 10, 14),
      paddingHorizontal: clamp(scale(14), 12, 16),
      borderWidth: 1.2,
      borderColor: "#93C5FD",
      backgroundColor: "#FFFFFF",
      fontSize: clamp(scale(13), 12, 14),
      color: "#111827",
    },
    otpBlock: {
      width: "100%",
      marginTop: vscale(10),
      marginBottom: vscale(12),
    },
    otpInfoRow: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: vscale(10),
    },
    resendRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      flexShrink: 1,
    },
    smallText: {
      fontSize: clamp(scale(9.5), 9, 11),
      color: "#6B7280",
      fontWeight: "700",
    },
    resendText: {
      fontSize: clamp(scale(9.5), 9, 11),
      color: "#1D4ED8",
      fontWeight: "900",
      textDecorationLine: "underline",
    },
    otpRow: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: otpGap,
    },
    otpBox: {
      flex: 1,
      height: otpSize,
      minWidth: 0,
      borderRadius: clamp(scale(12), 10, 14),
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
      height: clamp(vscale(44), 42, 52),
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
