// src/screens/LoginScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Alert,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// ✅ React Navigation
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

import LoginCard from "../components/LoginScreen/LoginCard";

// ✅ Login OTP modal (THIS modal already calls /verify-login-otp and saves tokens)
import EnterVerificationModal from "../components/LoginScreen/EnterVerificationModal";

// ✅ Forgot password (email + otp in one)
import ForgotPasswordEmailOtpModal from "../components/LoginScreen/ForgotPasswordEmailOtpModal";

// ✅ Next modals (kept separate)
import ForgotPasswordNewPasswordModal from "../components/LoginScreen/ForgotPasswordNewPasswordModal";
import ForgotPasswordSuccessModal from "../components/LoginScreen/ForgotPasswordSuccessModal";

type Props = {
  onGoSignup: () => void;
  onLoginSuccess: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type ForgotStep = "none" | "emailOtp" | "newpass" | "success";

const TAG = "[LoginScreen]";
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

// ✅ Backend is mounted at: /api/mobile/v1  (from your backend index.js)
const LOGIN_PATH = "/api/mobile/v1/login";

async function loginRequest(email: string, password: string) {
  const url = `${API_URL}${LOGIN_PATH}`;
  console.log(`${TAG} loginRequest URL:`, url);
  console.log(`${TAG} loginRequest email:`, email);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const raw = await res.text().catch(() => "");
  console.log(`${TAG} loginRequest status:`, res.status);
  console.log(`${TAG} loginRequest raw:`, raw);

  let data: any = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    throw new Error(data?.message || `Login failed (HTTP ${res.status})`);
  }

  return data as { message?: string };
}

export default function LoginScreen({ onGoSignup, onLoginSuccess }: Props) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const backIconSize = scale(22);
  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  // ✅ Login OTP modal state
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string>("");
  const [verifyPassword, setVerifyPassword] = useState<string>(""); // only for resend
  const [sendingOtp, setSendingOtp] = useState(false);

  // ✅ Forgot password flow (demo)
  const [forgotStep, setForgotStep] = useState<ForgotStep>("none");
  const [resetEmail, setResetEmail] = useState("");

  const closeForgotFlow = () => {
    setForgotStep("none");
    setResetEmail("");
  };

  const handleBack = () => {
    if (verifyOpen) {
      setVerifyOpen(false);
      return;
    }
    if (forgotStep !== "none") {
      closeForgotFlow();
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    onGoSignup();
  };

  // ✅ Called by LoginCard after user types email+password
  const handleLoginPressed = async (email: string, password: string) => {
    if (sendingOtp) return;

    const emailNorm = String(email).trim().toLowerCase();

    try {
      setSendingOtp(true);
      console.log(`${TAG} handleLoginPressed START`, { email: emailNorm });

      // Step 1: call backend /login to send OTP
      await loginRequest(emailNorm, password);

      // Step 2: open OTP modal with correct email (store password for resend)
      setVerifyEmail(emailNorm);
      setVerifyPassword(password);
      setVerifyOpen(true);

      console.log(`${TAG} OTP modal opened`);
    } catch (err: any) {
      console.log(`${TAG} handleLoginPressed ERROR:`, err?.message || err);
      Alert.alert("Login Failed", err?.message || "Something went wrong.");
    } finally {
      setSendingOtp(false);
      console.log(`${TAG} handleLoginPressed END`);
    }
  };

  // ✅ Resend OTP (calls /login again)
  const handleResend = async () => {
    if (!verifyEmail || !verifyPassword) {
      Alert.alert("Resend Failed", "Missing login info. Please login again.");
      return;
    }

    try {
      console.log(`${TAG} resend START`, { verifyEmail });
      await loginRequest(verifyEmail, verifyPassword);
      Alert.alert("Resent", "Verification code resent to your email.");
      console.log(`${TAG} resend END`);
    } catch (err: any) {
      console.log(`${TAG} resend ERROR:`, err?.message || err);
      Alert.alert("Resend Failed", err?.message || "Something went wrong.");
    }
  };

  /**
   * ✅ IMPORTANT FIX:
   * EnterVerificationModal already:
   *  - calls /verify-login-otp
   *  - saves accessToken & refreshToken
   *
   * So LoginScreen MUST NOT verify again (or OTP becomes "expired").
   *
   * This handler now only proceeds to app after modal success.
   */
  const handleVerified = (_code: string) => {
    setVerifyOpen(false);
    onLoginSuccess();
  };

  // ✅ Forgot password flow (still demo)
  const handleForgotPassword = () => {
    setResetEmail("");
    setForgotStep("emailOtp");
  };

  const handleTerms = () =>
    Alert.alert("Terms of use", "Open Terms of use screen/link.");
  const handlePrivacy = () =>
    Alert.alert("Privacy Policy", "Open Privacy Policy screen/link.");

  const handleForgotOtpVerified = (code: string) => {
    Alert.alert("OTP Verified", `Code: ${code} (demo)`);
    setForgotStep("newpass");
  };

  const handleResetPassword = (newPass: string) => {
    Alert.alert("Password Updated", `Email: ${resetEmail}\nNew: ${newPass} (demo)`);
    setForgotStep("success");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={backIconSize} color="#111827" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.page}>
            <LoginCard
              onLoginSuccess={handleLoginPressed}
              onGoSignup={onGoSignup}
              onForgotPassword={handleForgotPassword}
              loading={sendingOtp}
            />

            <View style={styles.termsWrap}>
              <Text style={styles.termsText}>
                By clicking create account you agree to recognizes
              </Text>

              <View style={styles.termsRow}>
                <Pressable onPress={handleTerms} hitSlop={8}>
                  <Text style={styles.termsLink}>Terms of use</Text>
                </Pressable>
                <Text style={styles.termsText}> and </Text>
                <Pressable onPress={handlePrivacy} hitSlop={8}>
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ✅ Login OTP modal */}
      <EnterVerificationModal
        visible={verifyOpen}
        email={verifyEmail}
        initialSeconds={34}
        onClose={() => setVerifyOpen(false)}
        onResend={handleResend}
        onVerified={handleVerified}
      />

      {/* ✅ Forgot Password: Email + OTP in ONE modal */}
      <ForgotPasswordEmailOtpModal
        visible={forgotStep === "emailOtp"}
        email={resetEmail}
        setEmail={setResetEmail}
        onClose={closeForgotFlow}
        onVerified={handleForgotOtpVerified}
        scale={scale}
        vscale={vscale}
        initialSeconds={34}
      />

      {/* ✅ New password modal */}
      <ForgotPasswordNewPasswordModal
        visible={forgotStep === "newpass"}
        onClose={closeForgotFlow}
        onBack={() => setForgotStep("emailOtp")}
        onReset={handleResetPassword}
        scale={scale}
        vscale={vscale}
      />

      {/* ✅ Success modal */}
      <ForgotPasswordSuccessModal
        visible={forgotStep === "success"}
        onClose={closeForgotFlow}
        scale={scale}
        vscale={vscale}
      />
    </SafeAreaView>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1, backgroundColor: "#FFFFFF" },

    header: {
      paddingHorizontal: scale(18),
      paddingTop: vscale(6),
    },

    backBtn: {
      width: scale(36),
      height: scale(36),
      alignItems: "flex-start",
      justifyContent: "center",
    },

    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: scale(22),
      paddingTop: vscale(6),
      paddingBottom: vscale(14),
    },

    page: { flexGrow: 1 },

    termsWrap: {
      marginTop: "auto",
      alignItems: "center",
      paddingTop: vscale(18),
      paddingBottom: vscale(6),
    },

    termsText: {
      fontSize: scale(11),
      color: "#6B7280",
      textAlign: "center",
      lineHeight: scale(14),
    },

    termsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: vscale(2),
    },

    termsLink: {
      fontSize: scale(11),
      color: "#1D4ED8",
      fontWeight: "700",
      textDecorationLine: "underline",
      lineHeight: scale(14),
    },
  });
}
