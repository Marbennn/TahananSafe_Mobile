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

// ✅ Biometrics
import * as LocalAuthentication from "expo-local-authentication";

// ✅ SecureStore (for refresh token saved after OTP verify)
import * as SecureStore from "expo-secure-store";

// ✅ React Navigation
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

import LoginCard from "../components/LoginScreen/LoginCard";

// ✅ Login OTP modal
import EnterVerificationModal from "../components/LoginScreen/EnterVerificationModal";

// ✅ Forgot password modals
import ForgotPasswordEmailOtpModal from "../components/LoginScreen/ForgotPasswordEmailOtpModal";
import ForgotPasswordNewPasswordModal from "../components/LoginScreen/ForgotPasswordNewPasswordModal";
import ForgotPasswordSuccessModal from "../components/LoginScreen/ForgotPasswordSuccessModal";

// ✅ Legal modal
import LegalModal, { type LegalMode } from "../components/LoginScreen/LegalModal";

// ✅ Session storage (AsyncStorage)
import { saveTokens, setLoggedIn } from "../auth/session";

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

const LOGIN_PATH = "/api/mobile/v1/login";
const REFRESH_PATH = "/api/mobile/v1/refresh-token";

// Backend response shapes (loose)
type LoginCheckResponse = { message?: string };
type LoginSendOtpResponse = { message?: string };

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

  return { res, raw, data };
}

/**
 * ✅ NEW: check credentials ONLY (NO OTP email)
 * Calls: POST /login with { purpose: "check" }
 */
async function loginCheckRequest(email: string, password: string) {
  const url = `${API_URL}${LOGIN_PATH}`;
  console.log(`${TAG} loginCheck URL:`, url);
  console.log(`${TAG} loginCheck email:`, email);

  const { res, raw, data } = await postJson(url, {
    email,
    password,
    purpose: "check",
  });

  console.log(`${TAG} loginCheck status:`, res.status);
  console.log(`${TAG} loginCheck raw:`, raw);

  if (!res.ok) {
    const msg =
      data?.message ||
      (res.status === 403
        ? "Access denied."
        : `Login check failed (HTTP ${res.status})`);
    throw new Error(msg);
  }

  return data as LoginCheckResponse;
}

/**
 * ✅ Sends OTP email
 * Calls: POST /login with { purpose: "otp" } (or default)
 */
async function loginSendOtpRequest(email: string, password: string) {
  const url = `${API_URL}${LOGIN_PATH}`;
  console.log(`${TAG} loginSendOtp URL:`, url);
  console.log(`${TAG} loginSendOtp email:`, email);

  const { res, raw, data } = await postJson(url, {
    email,
    password,
    purpose: "otp",
  });

  console.log(`${TAG} loginSendOtp status:`, res.status);
  console.log(`${TAG} loginSendOtp raw:`, raw);

  if (!res.ok) {
    const msg =
      data?.message ||
      (res.status === 403
        ? "Access denied."
        : `Login failed (HTTP ${res.status})`);
    throw new Error(msg);
  }

  return data as LoginSendOtpResponse;
}

async function refreshAccessToken(refreshToken: string) {
  const url = `${API_URL}${REFRESH_PATH}`;
  console.log(`${TAG} refresh URL:`, url);

  const { res, raw, data } = await postJson(url, { refreshToken });

  console.log(`${TAG} refresh status:`, res.status);
  console.log(`${TAG} refresh raw:`, raw);

  if (!res.ok) {
    const msg = data?.message || `Refresh failed (HTTP ${res.status})`;
    throw new Error(msg);
  }

  if (!data?.accessToken) {
    throw new Error("Refresh did not return accessToken.");
  }

  return data.accessToken as string;
}

/** SecureStore keys must only contain: A-Z a-z 0-9 . - _ */
function safeKeyPart(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
}

/** Must match EnterVerificationModal.tsx */
function refreshKeyForEmail(email: string) {
  return `tahanansafe_refresh_${safeKeyPart(email)}`;
}

async function getRefreshTokenForEmail(email: string): Promise<string | null> {
  const key = refreshKeyForEmail(email);
  try {
    const v = await SecureStore.getItemAsync(key);
    console.log(`${TAG} SecureStore refresh lookup`, { key, found: !!v });
    return v ?? null;
  } catch (e: any) {
    console.log(`${TAG} SecureStore get refresh failed:`, e?.message);
    return null;
  }
}

async function runBiometricsGate(): Promise<{
  ok: boolean;
  reason:
    | "success"
    | "not_available"
    | "not_enrolled"
    | "failed"
    | "cancelled"
    | "lockout"
    | "unknown";
}> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    console.log(`${TAG} biometrics hw/enrolled:`, { hasHardware, enrolled });

    if (!hasHardware) return { ok: false, reason: "not_available" };
    if (!enrolled) return { ok: false, reason: "not_enrolled" };

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage:
        Platform.OS === "ios"
          ? "Use Face ID to continue"
          : "Use fingerprint to continue",
      cancelLabel: "Cancel",
      disableDeviceFallback: true,
    });

    console.log(`${TAG} biometrics result:`, result);

    if (result.success) return { ok: true, reason: "success" };

    const err = (result as any)?.error as string | undefined;

    if (
      err === "user_cancel" ||
      err === "system_cancel" ||
      err === "app_cancel"
    ) {
      return { ok: false, reason: "cancelled" };
    }

    if (err === "lockout") {
      return { ok: false, reason: "lockout" };
    }

    return { ok: false, reason: "failed" };
  } catch (e: any) {
    console.log(`${TAG} biometrics exception:`, e?.message || e);
    return { ok: false, reason: "unknown" };
  }
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

  // ✅ OTP modal state
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string>("");
  const [verifyPassword, setVerifyPassword] = useState<string>(""); // for resend
  const [sendingOtp, setSendingOtp] = useState(false);

  // ✅ Forgot password flow
  const [forgotStep, setForgotStep] = useState<ForgotStep>("none");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");

  // ✅ Legal modal
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalMode, setLegalMode] = useState<LegalMode>("terms");

  const closeForgotFlow = () => {
    setForgotStep("none");
    setResetEmail("");
    setResetToken("");
  };

  const handleBack = () => {
    if (legalOpen) {
      setLegalOpen(false);
      return;
    }
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

  const openOtpModal = (emailNorm: string, password: string) => {
    setVerifyEmail(emailNorm);
    setVerifyPassword(password);
    setVerifyOpen(true);
    console.log(`${TAG} OTP modal opened`);
  };

  const handleLoginPressed = async (email: string, password: string) => {
    if (sendingOtp) return;

    const emailNorm = String(email).trim().toLowerCase();

    try {
      setSendingOtp(true);
      console.log(`${TAG} handleLoginPressed START`, { email: emailNorm });

      // ✅ STEP 1: Always validate email+password FIRST (NO OTP EMAIL)
      await loginCheckRequest(emailNorm, password);

      // ✅ STEP 2: If refresh token exists, try biometrics quick-login (NO OTP)
      const storedRefresh = await getRefreshTokenForEmail(emailNorm);

      if (storedRefresh) {
        const bio = await runBiometricsGate();

        if (bio.ok) {
          console.log(`${TAG} biometrics SUCCESS -> refresh token login`);

          const newAccess = await refreshAccessToken(storedRefresh);

          await saveTokens({ accessToken: newAccess });
          await setLoggedIn(true);

          console.log(`${TAG} refreshed access token saved -> go Home`);
          onLoginSuccess();
          return;
        }

        console.log(`${TAG} biometrics not ok (${bio.reason}) -> send OTP fallback`);

        if (bio.reason === "lockout") {
          Alert.alert(
            "Biometrics Locked",
            "Biometrics is temporarily locked. Please unlock your phone using your passcode once, then try again."
          );
        }
      } else {
        console.log(`${TAG} no stored refresh token yet -> OTP required`);
      }

      // ✅ STEP 3: Only NOW send OTP email (fallback / first-time login)
      await loginSendOtpRequest(emailNorm, password);
      openOtpModal(emailNorm, password);
    } catch (err: any) {
      const msg = err?.message || "Something went wrong.";

      const pretty =
        /role|allowed|access denied|not allowed/i.test(msg) ||
        msg.includes("403")
          ? "This account is not allowed to login in the mobile app. Please use a USER account."
          : msg;

      console.log(`${TAG} handleLoginPressed ERROR:`, msg);
      Alert.alert("Login Failed", pretty);
    } finally {
      setSendingOtp(false);
      console.log(`${TAG} handleLoginPressed END`);
    }
  };

  const handleResend = async () => {
    if (!verifyEmail || !verifyPassword) {
      Alert.alert("Resend Failed", "Missing login info. Please login again.");
      return;
    }

    try {
      console.log(`${TAG} resend START`, { verifyEmail });
      await loginSendOtpRequest(verifyEmail, verifyPassword);
      Alert.alert("Resent", "Verification code resent to your email.");
      console.log(`${TAG} resend END`);
    } catch (err: any) {
      const msg = err?.message || "Something went wrong.";
      const pretty =
        /role|allowed|access denied|not allowed/i.test(msg) ||
        msg.includes("403")
          ? "This account is not allowed to login in the mobile app. Please use a USER account."
          : msg;

      console.log(`${TAG} resend ERROR:`, msg);
      Alert.alert("Resend Failed", pretty);
    }
  };

  const handleVerified = (_code: string) => {
    setVerifyOpen(false);
    onLoginSuccess();
  };

  const handleForgotPassword = () => {
    setResetEmail("");
    setResetToken("");
    setForgotStep("emailOtp");
  };

  const handleTerms = () => {
    setLegalMode("terms");
    setLegalOpen(true);
  };
  const handlePrivacy = () => {
    setLegalMode("privacy");
    setLegalOpen(true);
  };

  const handleForgotOtpVerified = (token: string) => {
    setResetToken(token);
    setForgotStep("newpass");
  };

  const handleResetSuccess = () => {
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

      <LegalModal
        visible={legalOpen}
        mode={legalMode}
        onClose={() => setLegalOpen(false)}
        scale={scale}
        vscale={vscale}
      />

      <EnterVerificationModal
        visible={verifyOpen}
        email={verifyEmail}
        initialSeconds={34}
        onClose={() => setVerifyOpen(false)}
        onResend={handleResend}
        onVerified={handleVerified}
      />

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

      <ForgotPasswordNewPasswordModal
        visible={forgotStep === "newpass"}
        email={resetEmail}
        resetToken={resetToken}
        onClose={closeForgotFlow}
        onBack={() => setForgotStep("emailOtp")}
        onResetSuccess={handleResetSuccess}
        scale={scale}
        vscale={vscale}
      />

      <ForgotPasswordSuccessModal
        visible={forgotStep === "success"}
        onClose={closeForgotFlow}
        scale={scale}
        vscale={vscale}
      />
    </SafeAreaView>
  );
}

function createStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number
) {
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
