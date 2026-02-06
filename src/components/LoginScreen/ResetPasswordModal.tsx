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
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";

// ✅ use your existing badge (check icon)
import ChecklistBadge from "../ChecklistBadge";

type Props = {
  visible: boolean;
  email: string;
  setEmail: (v: string) => void;

  onClose: () => void;

  // optional callbacks (demo-ready)
  onOtpVerified?: (code: string) => void;
  onResetPassword?: (email: string, newPassword: string) => void;

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

type Step = "email" | "otp" | "newpass" | "success";

export default function ResetPasswordModal({
  visible,
  email,
  setEmail,
  onClose,
  onOtpVerified,
  onResetPassword,
  scale,
  vscale,
}: Props) {
  const styles = useMemo(() => createStyles(scale, vscale), [scale, vscale]);

  const [step, setStep] = useState<Step>("email");

  // OTP
  const OTP_LEN = 4;
  const [otp, setOtp] = useState<string[]>(Array.from({ length: OTP_LEN }, () => ""));
  const [secondsLeft, setSecondsLeft] = useState(34);
  const refs = useRef<Array<TextInput | null>>([]);

  // New password step
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const resetAll = () => {
    setStep("email");
    setOtp(Array.from({ length: OTP_LEN }, () => ""));
    setSecondsLeft(34);
    refs.current = [];
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
  };

  useEffect(() => {
    if (!visible) resetAll();
  }, [visible]);

  useEffect(() => {
    if (step !== "otp") return;
    if (secondsLeft <= 0) return;

    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, secondsLeft]);

  const canSend = email.trim().length > 0 && isValidEmail(email.trim());

  const codeJoined = otp.join("");
  const canVerify = codeJoined.length === OTP_LEN && otp.every((d) => d.length === 1);

  const passwordsMatch = newPassword === confirmPassword;
  const canReset =
    newPassword.trim().length >= 6 &&
    confirmPassword.trim().length >= 6 &&
    passwordsMatch;

  const handleSendCode = () => {
    if (!canSend) {
      Alert.alert("Invalid", "Please enter a valid email.");
      return;
    }

    setStep("otp");
    setSecondsLeft(34);
    setOtp(Array.from({ length: OTP_LEN }, () => ""));

    setTimeout(() => refs.current?.[0]?.focus?.(), 60);
  };

  const handleResend = () => {
    if (secondsLeft > 0) return;

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

  const handleVerifyOtp = () => {
    if (!canVerify) return;

    onOtpVerified?.(codeJoined);
    setStep("newpass");
  };

  const handleResetPassword = () => {
    if (!canReset) {
      if (newPassword.trim().length < 6) {
        Alert.alert("Invalid", "Password must be at least 6 characters.");
        return;
      }
      if (!passwordsMatch) {
        Alert.alert("Mismatch", "Passwords do not match.");
        return;
      }
      return;
    }

    // ✅ fire callback (optional)
    onResetPassword?.(email.trim(), newPassword.trim());

    // ✅ go to success UI (your screenshot)
    setStep("success");
  };

  const renderEmailStep = () => (
    <>
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

      <Pressable
        onPress={handleSendCode}
        hitSlop={10}
        disabled={!canSend}
        style={({ pressed }) => [
          styles.btnOuter,
          !canSend && { opacity: 0.55 },
          pressed ? { transform: [{ scale: 0.99 }], opacity: 0.98 } : null,
        ]}
      >
        <LinearGradient
          colors={Colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Send Verification Code</Text>
        </LinearGradient>
      </Pressable>
    </>
  );

  const renderOtpStep = () => (
    <>
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
              <Text style={[styles.resendText, secondsLeft > 0 && { opacity: 0.45 }]}>
                Resend it
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ✅ match email input width */}
        <View style={styles.otpRow}>
          {otp.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => {
                refs.current[i] = r;
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

      <Pressable
        onPress={handleVerifyOtp}
        hitSlop={10}
        disabled={!canVerify}
        style={({ pressed }) => [
          styles.btnOuter,
          !canVerify && { opacity: 0.55 },
          pressed ? { transform: [{ scale: 0.99 }], opacity: 0.98 } : null,
        ]}
      >
        <LinearGradient
          colors={Colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Verify OTP</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={onClose}
        hitSlop={10}
        style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.backText}>Back to Login</Text>
      </Pressable>
    </>
  );

  const renderNewPassStep = () => (
    <>
      <Text style={styles.subtitle}>Create a new password for your account.</Text>

      <Text style={styles.label}>New Password</Text>
      <View style={styles.passWrap}>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="********"
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!showNew}
          autoCapitalize="none"
          style={styles.input}
        />
        <Pressable
          onPress={() => setShowNew((v) => !v)}
          hitSlop={10}
          style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons
            name={showNew ? "eye-off-outline" : "eye-outline"}
            size={scale(18)}
            color="#6B7280"
          />
        </Pressable>
      </View>

      <Text style={[styles.label, { marginTop: vscale(10) }]}>Confirm Password</Text>
      <View style={styles.passWrap}>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="********"
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!showConfirm}
          autoCapitalize="none"
          style={styles.input}
        />
        <Pressable
          onPress={() => setShowConfirm((v) => !v)}
          hitSlop={10}
          style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons
            name={showConfirm ? "eye-off-outline" : "eye-outline"}
            size={scale(18)}
            color="#6B7280"
          />
        </Pressable>
      </View>

      {!passwordsMatch && confirmPassword.length > 0 ? (
        <Text style={styles.errorText}>Passwords do not match</Text>
      ) : null}

      <Pressable
        onPress={handleResetPassword}
        hitSlop={10}
        disabled={!canReset}
        style={({ pressed }) => [
          styles.btnOuter,
          !canReset && { opacity: 0.55 },
          pressed ? { transform: [{ scale: 0.99 }], opacity: 0.98 } : null,
        ]}
      >
        <LinearGradient
          colors={Colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Reset Password</Text>
        </LinearGradient>
      </Pressable>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <View style={styles.successWrap}>
        <ChecklistBadge size={clamp(scale(74), 62, 84)} />
      </View>

      <Text style={styles.successTitle}>Password Reset{"\n"}Successfully</Text>

      <Pressable
        onPress={onClose}
        hitSlop={10}
        style={({ pressed }) => [
          styles.btnOuter,
          pressed ? { transform: [{ scale: 0.99 }], opacity: 0.98 } : null,
        ]}
      >
        <LinearGradient
          colors={Colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Back to Login</Text>
        </LinearGradient>
      </Pressable>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          {/* small close only for non-success */}
          {step !== "success" ? (
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="close" size={scale(18)} color="#111827" />
            </Pressable>
          ) : null}

          <Text style={styles.title}>Reset Password</Text>

          {step === "email" ? renderEmailStep() : null}
          {step === "otp" ? renderOtpStep() : null}
          {step === "newpass" ? renderNewPassStep() : null}
          {step === "success" ? renderSuccessStep() : null}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const cardW = clamp(scale(320), 280, 380);
  const inputH = clamp(vscale(44), 42, 52);
  const radius = clamp(scale(16), 14, 20);

  const otpMin = clamp(scale(46), 40, 56);
  const otpGap = clamp(scale(10), 8, 14);

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
      paddingBottom: clamp(vscale(16), 14, 18),

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
      borderColor: "#E5E7EB",
      backgroundColor: "#FFFFFF",
      fontSize: clamp(scale(13), 12, 14),
      color: "#111827",
    },

    passWrap: {
      position: "relative",
      width: "100%",
      justifyContent: "center",
    },

    eyeBtn: {
      position: "absolute",
      right: clamp(scale(10), 8, 12),
      height: inputH,
      width: clamp(scale(36), 32, 40),
      alignItems: "center",
      justifyContent: "center",
    },

    errorText: {
      marginTop: vscale(6),
      fontSize: clamp(scale(10), 9, 11),
      fontWeight: "800",
      color: "#DC2626",
      textAlign: "center",
    },

    otpSection: {
      marginTop: vscale(10),
      marginBottom: vscale(10),
      width: "100%",
    },

    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: vscale(10),
      width: "100%",
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

    // ✅ matches email input width
    otpRow: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: otpGap,
    },

    otpBox: {
      flex: 1,
      minWidth: otpMin,
      height: otpMin,
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
      marginTop: vscale(12),
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

    successWrap: {
      marginTop: vscale(12),
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: vscale(10),
    },

    successTitle: {
      marginTop: vscale(6),
      textAlign: "center",
      fontSize: clamp(scale(14), 13, 16),
      fontWeight: "900",
      color: "#111827",
      marginBottom: vscale(8),
    },
  });
}
