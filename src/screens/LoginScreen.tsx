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

// ✅ SecureStore
import * as SecureStore from "expo-secure-store";

// ✅ React Navigation
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

import { useColors } from "../theme/colors";
import LoginCard from "../components/LoginScreen/LoginCard";

// ✅ Login OTP modal
import EnterVerificationModal from "../components/LoginScreen/EnterVerificationModal";

// ✅ Forgot password modals
import ForgotPasswordEmailOtpModal from "../components/LoginScreen/ForgotPasswordEmailOtpModal";
import ForgotPasswordNewPasswordModal from "../components/LoginScreen/ForgotPasswordNewPasswordModal";
import ForgotPasswordSuccessModal from "../components/LoginScreen/ForgotPasswordSuccessModal";

// ✅ Legal modal
import LegalModal, { type LegalMode } from "../components/LoginScreen/LegalModal";

// ✅ custom biometrics modal
import BiometricsOptInModal from "../components/LoginScreen/BiometricsOptInModal";
import BiometricsEnabledModal from "../components/LoginScreen/BiometricsEnabledModal";

// ✅ invalid credentials modal
import SignupErrorModal from "../components/SignupScreen/SignupErrorModal";

// ✅ Session storage
import { saveTokens, setLoggedIn } from "../auth/session";
import { setupPushNotifications } from "../utils/pushNotifications";
import { devLog, maskEmail } from "../utils/safeLog";

type Props = {
  onGoSignup: () => void;
  onLoginSuccess: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type ForgotStep = "none" | "emailOtp" | "newpass" | "success";

const TAG = "[LoginScreen]";
const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000")
  .trim()
  .replace(/\/+$/, "");

const LOGIN_PATH = "/api/mobile/v1/login";
const REFRESH_PATH = "/api/mobile/v1/refresh-token";

// ✅ Updated backend response shape
type LoginCheckResponse = {
  message?: string;
  purpose?: string;
  user?: {
    id?: string;
    email?: string;
    profileImage?: string;
    role?: string;
  };
};

type LoginSendOtpResponse = { message?: string };


function showServerUnavailable() {
  Alert.alert("Server unavailable", "Please try again. (Tunnel/Server issue)");
}

function normalizeRole(role?: string) {
  return String(role || "").trim().toLowerCase();
}

function isBarangayOfficial(role?: string) {
  return normalizeRole(role) === "barangay official";
}

/**
 * ============================
 * ✅ Client-side Rate Limiting (Device-local)
 * ============================
 */
const RL_KEYS = {
  LOGIN_ATTEMPTS: "rl_login_attempts_v1",
  OTP_SENDS: "rl_otp_sends_v1",
  RESEND_LAST_MS: "rl_resend_last_ms_v1",
};

type WindowCounter = {
  windowStartMs: number;
  count: number;
};

// TUNING
const RL = {
  LOGIN_MAX: 5,
  LOGIN_WINDOW_MS: 2 * 60 * 1000, // 2 minutes

  OTP_SEND_MAX: 3,
  OTP_SEND_WINDOW_MS: 5 * 60 * 1000, // 5 minutes

  RESEND_MIN_GAP_MS: 30 * 1000, // 30 seconds
};

function nowMs() {
  return Date.now();
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: any) {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function remainingMs(windowStartMs: number, windowMs: number) {
  const elapsed = nowMs() - windowStartMs;
  return Math.max(0, windowMs - elapsed);
}

function formatCooldown(ms: number) {
  const s = Math.ceil(ms / 1000);
  if (s <= 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  return `${m}m`;
}

async function hitWindowCounter(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number; count: number }> {
  const current = (await readJson<WindowCounter>(key)) || {
    windowStartMs: nowMs(),
    count: 0,
  };

  const elapsed = nowMs() - current.windowStartMs;

  const next =
    elapsed >= windowMs
      ? { windowStartMs: nowMs(), count: 1 }
      : { windowStartMs: current.windowStartMs, count: current.count + 1 };

  await writeJson(key, next);

  if (next.count > limit) {
    const retryAfterMs = remainingMs(next.windowStartMs, windowMs);
    return { allowed: false, retryAfterMs, count: next.count };
  }

  return { allowed: true, retryAfterMs: 0, count: next.count };
}

async function canResend(): Promise<{ ok: boolean; waitMs: number }> {
  const last = await SecureStore.getItemAsync(RL_KEYS.RESEND_LAST_MS);
  const lastMs = last ? Number(last) : 0;
  const diff = nowMs() - lastMs;

  if (lastMs && diff < RL.RESEND_MIN_GAP_MS) {
    return { ok: false, waitMs: RL.RESEND_MIN_GAP_MS - diff };
  }
  return { ok: true, waitMs: 0 };
}

async function markResendNow() {
  try {
    await SecureStore.setItemAsync(RL_KEYS.RESEND_LAST_MS, String(nowMs()));
  } catch {
    // ignore
  }
}

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
 * ✅ check credentials ONLY (NO OTP email)
 */
async function loginCheckRequest(email: string, password: string) {
  const url = `${API_URL}${LOGIN_PATH}`;
  devLog(`${TAG} loginCheck`, maskEmail(email));

  const { res, data } = await postJson(url, {
    email,
    password,
    purpose: "check",
  });

  devLog(`${TAG} loginCheck status:`, res.status);

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
 */
async function loginSendOtpRequest(email: string, password: string) {
  const url = `${API_URL}${LOGIN_PATH}`;
  devLog(`${TAG} loginSendOtp`, maskEmail(email));

  const { res, data } = await postJson(url, {
    email,
    password,
    purpose: "otp",
  });

  devLog(`${TAG} loginSendOtp status:`, res.status);

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

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function refreshAccessToken(refreshToken: string) {
  const url = `${API_URL}${REFRESH_PATH}`;
  devLog(`${TAG} refresh URL:`, url);

  const { res, data } = await postJson(url, { refreshToken });

  devLog(`${TAG} refresh status:`, res.status);

  if (!res.ok) {
    const msg = data?.message || `Refresh failed (HTTP ${res.status})`;
    throw new HttpError(res.status, msg);
  }

  if (!data?.accessToken) {
    throw new HttpError(500, "Refresh did not return accessToken.");
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

/** ✅ per-email biometrics opt-in key */
function bioOptInKeyForEmail(email: string) {
  return `tahanansafe_bio_optin_${safeKeyPart(email)}`;
}

/** ✅ per-email biometrics prompt snooze key */
function bioSnoozeUntilKeyForEmail(email: string) {
  return `tahanansafe_bio_snooze_until_${safeKeyPart(email)}`;
}

/** ✅ per-email prompt-shown key */
function bioPromptShownKeyForEmail(email: string) {
  return `tahanansafe_bio_prompt_shown_${safeKeyPart(email)}`;
}

/** ✅ snooze duration (3 days) */
const BIO_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

async function getBioOptInForEmail(email: string): Promise<boolean> {
  const key = bioOptInKeyForEmail(email);
  try {
    const v = await SecureStore.getItemAsync(key);
    return v === "1";
  } catch {
    return false;
  }
}

async function setBioOptInForEmail(email: string, enabled: boolean) {
  const key = bioOptInKeyForEmail(email);
  try {
    await SecureStore.setItemAsync(key, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

async function getBioSnoozeUntilMs(email: string): Promise<number> {
  const key = bioSnoozeUntilKeyForEmail(email);
  try {
    const v = await SecureStore.getItemAsync(key);
    const n = v ? Number(v) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function setBioSnoozeUntilMs(email: string, untilMs: number) {
  const key = bioSnoozeUntilKeyForEmail(email);
  try {
    await SecureStore.setItemAsync(key, String(untilMs));
  } catch {
    // ignore
  }
}

async function canShowBioPromptNow(email: string): Promise<boolean> {
  const until = await getBioSnoozeUntilMs(email);
  return !until || nowMs() >= until;
}

async function hasBioPromptBeenShown(email: string): Promise<boolean> {
  const key = bioPromptShownKeyForEmail(email);
  try {
    const v = await SecureStore.getItemAsync(key);
    return v === "1";
  } catch {
    return false;
  }
}

async function setBioPromptShown(email: string, shown: boolean) {
  const key = bioPromptShownKeyForEmail(email);
  try {
    await SecureStore.setItemAsync(key, shown ? "1" : "0");
  } catch {
    // ignore
  }
}

async function getRefreshTokenForEmail(email: string): Promise<string | null> {
  const key = refreshKeyForEmail(email);
  try {
    const v = await SecureStore.getItemAsync(key);
    devLog(`${TAG} SecureStore refresh lookup`, { key, found: !!v });
    return v ?? null;
  } catch (e: any) {
    devLog(`${TAG} SecureStore get refresh failed:`, e?.message);
    return null;
  }
}

async function deleteRefreshTokenForEmail(email: string) {
  const key = refreshKeyForEmail(email);
  try {
    await SecureStore.deleteItemAsync(key);
    devLog(`${TAG} SecureStore refresh deleted`, { key });
  } catch (e: any) {
    devLog(`${TAG} SecureStore delete refresh failed:`, e?.message);
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

    devLog(`${TAG} biometrics hw/enrolled:`, { hasHardware, enrolled });

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

    devLog(`${TAG} biometrics result:`, result);

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
    devLog(`${TAG} biometrics exception:`, e?.message || e);
    return { ok: false, reason: "unknown" };
  }
}

export default function LoginScreen({ onGoSignup, onLoginSuccess }: Props) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const TC = useColors();
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
  const [verifyPassword, setVerifyPassword] = useState<string>("");
  const [sendingOtp, setSendingOtp] = useState(false);

  // ✅ store pending role before OTP verify
  const [pendingLoginRole, setPendingLoginRole] = useState<string>("user");

  // ✅ based on whether the user has already made a choice, not refresh token
  const [pendingFirstLoginBioPrompt, setPendingFirstLoginBioPrompt] =
    useState(false);

  // ✅ biometrics modal state
  const [bioModalVisible, setBioModalVisible] = useState(false);
  const [bioPromptEmail, setBioPromptEmail] = useState("");
  const [pendingRoleAfterBioModal, setPendingRoleAfterBioModal] =
    useState<string>("user");

  // ✅ Forgot password flow
  const [forgotStep, setForgotStep] = useState<ForgotStep>("none");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");

  // ✅ Legal modal
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalMode, setLegalMode] = useState<LegalMode>("terms");
  const [credErrorVisible, setCredErrorVisible] = useState(false);
  const [bioEnabledVisible, setBioEnabledVisible] = useState(false);
  const [pendingRoleAfterBioEnabled, setPendingRoleAfterBioEnabled] = useState<string>("user");

  const goAfterLoginByRole = (role?: string) => {
    // Register push token for whichever user just logged in
    setupPushNotifications().catch((e) => devLog("[Push] login registration error:", e));

    if (isBarangayOfficial(role)) {
      navigation.reset({
        index: 0,
        routes: [{ name: "AdminHomeScreen" }],
      });
      return;
    }

    onLoginSuccess();
  };

  const closeForgotFlow = () => {
    setForgotStep("none");
    setResetEmail("");
    setResetToken("");
  };

  const handleBack = () => {
    if (bioModalVisible) {
      handleBiometricsNotNow();
      return;
    }

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
    devLog(`${TAG} OTP modal opened`);
  };

  const maybeAskBiometricsOptIn = async (
    emailNorm: string
  ): Promise<boolean> => {
    try {
      const promptShown = await hasBioPromptBeenShown(emailNorm);
      if (promptShown) return false;

      const alreadyEnabled = await getBioOptInForEmail(emailNorm);
      if (alreadyEnabled) return false;

      const allowedBySnooze = await canShowBioPromptNow(emailNorm);
      if (!allowedBySnooze) return false;

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return false;

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) return false;

      setBioPromptEmail(emailNorm);
      setBioModalVisible(true);
      return true;
    } catch {
      return false;
    }
  };

  const handleEnableBiometrics = async () => {
    const emailNorm = String(bioPromptEmail || "").trim().toLowerCase();
    const roleToGo = pendingRoleAfterBioModal;

    try {
      if (emailNorm) {
        await setBioOptInForEmail(emailNorm, true);
        await setBioSnoozeUntilMs(emailNorm, 0);
        await setBioPromptShown(emailNorm, true);
      }
    } catch {
      // ignore
    } finally {
      setBioModalVisible(false);
      setBioPromptEmail("");
      setPendingRoleAfterBioModal("user");
      setPendingRoleAfterBioEnabled(roleToGo);
      setBioEnabledVisible(true);
    }
  };

  const handleBiometricsNotNow = async () => {
    const emailNorm = String(bioPromptEmail || "").trim().toLowerCase();
    const roleToGo = pendingRoleAfterBioModal;

    try {
      if (emailNorm) {
        const untilMs = nowMs() + BIO_SNOOZE_MS;

        await setBioOptInForEmail(emailNorm, false);
        await setBioSnoozeUntilMs(emailNorm, untilMs);
        await setBioPromptShown(emailNorm, true);
      }
    } catch {
      // ignore
    } finally {
      setBioModalVisible(false);
      setBioPromptEmail("");
      setPendingRoleAfterBioModal("user");
      goAfterLoginByRole(roleToGo);
    }
  };

  const handleLoginPressed = async (email: string, password: string) => {
    if (sendingOtp) return;

    const emailNorm = String(email ?? "").trim().toLowerCase();
    const passwordNorm = String(password ?? "");

    if (!emailNorm || !passwordNorm) {
      setCredErrorVisible(true);
      return;
    }

    const loginHit = await hitWindowCounter(
      RL_KEYS.LOGIN_ATTEMPTS,
      RL.LOGIN_MAX,
      RL.LOGIN_WINDOW_MS
    );
    if (!loginHit.allowed) {
      Alert.alert(
        "Please wait",
        `Too many attempts. Try again in ${formatCooldown(
          loginHit.retryAfterMs
        )}.`
      );
      return;
    }

    try {
      setSendingOtp(true);
      devLog(`${TAG} handleLoginPressed START`, { email: maskEmail(emailNorm) });

      // ✅ STEP 1: validate credentials FIRST
      const checkData = await loginCheckRequest(emailNorm, passwordNorm);
      const roleFromBackend = checkData?.user?.role || "user";

      setPendingLoginRole(roleFromBackend);

      // ✅ STEP 2: quick login only if refresh exists AND biometrics enabled
      const storedRefresh = await getRefreshTokenForEmail(emailNorm);
      const bioOptedIn = await getBioOptInForEmail(emailNorm);

      if (storedRefresh && bioOptedIn) {
        const bio = await runBiometricsGate();

        if (bio.ok) {
          devLog(`${TAG} biometrics SUCCESS -> refresh token login`);

          try {
            const newAccess = await refreshAccessToken(storedRefresh);

            await saveTokens({ accessToken: newAccess });
            await setLoggedIn(true);

            devLog(`${TAG} refreshed access token saved -> route by role`);
            goAfterLoginByRole(roleFromBackend);
            return;
          } catch (e: any) {
            const status = e?.status;

            devLog(`${TAG} refresh failed -> fallback to OTP`, { status });

            if (status === 401) {
              await deleteRefreshTokenForEmail(emailNorm);
            }

            if (status === 503) {
              showServerUnavailable();
            }
          }
        } else {
          devLog(
            `${TAG} biometrics not ok (${bio.reason}) -> send OTP fallback`
          );
        }
      }

      // ✅ STEP 3: send OTP
      const otpHit = await hitWindowCounter(
        RL_KEYS.OTP_SENDS,
        RL.OTP_SEND_MAX,
        RL.OTP_SEND_WINDOW_MS
      );
      if (!otpHit.allowed) {
        Alert.alert(
          "Please wait",
          `Too many OTP requests. Try again in ${formatCooldown(
            otpHit.retryAfterMs
          )}.`
        );
        return;
      }

      /**
       * ✅ Decide prompt based on whether the account already made a choice
       * NOT based on stored refresh token
       */
      const promptShown = await hasBioPromptBeenShown(emailNorm);
      setPendingFirstLoginBioPrompt(!promptShown);

      await loginSendOtpRequest(emailNorm, passwordNorm);
      openOtpModal(emailNorm, passwordNorm);
    } catch (err: any) {
      devLog(`${TAG} handleLoginPressed ERROR:`, err?.message || err);
      setCredErrorVisible(true);
    } finally {
      setSendingOtp(false);
      devLog(`${TAG} handleLoginPressed END`);
    }
  };

  const handleResend = async () => {
    if (!verifyEmail || !verifyPassword) {
      setCredErrorVisible(true);
      return;
    }

    const resendOk = await canResend();
    if (!resendOk.ok) {
      Alert.alert(
        "Please wait",
        `You can resend again in ${formatCooldown(resendOk.waitMs)}.`
      );
      return;
    }

    const otpHit = await hitWindowCounter(
      RL_KEYS.OTP_SENDS,
      RL.OTP_SEND_MAX,
      RL.OTP_SEND_WINDOW_MS
    );
    if (!otpHit.allowed) {
      Alert.alert(
        "Please wait",
        `Too many OTP requests. Try again in ${formatCooldown(
          otpHit.retryAfterMs
        )}.`
      );
      return;
    }

    try {
      devLog(`${TAG} resend START`);
      await loginSendOtpRequest(verifyEmail, verifyPassword);

      await markResendNow();

      Alert.alert("Resent", "Verification code resent to your email.");
      devLog(`${TAG} resend END`);
    } catch (err: any) {
      devLog(`${TAG} resend ERROR:`, err?.message || err);
      setCredErrorVisible(true);
    }
  };

  // ✅ Called after OTP verified
  const handleVerified = async (_code: string) => {
    setVerifyOpen(false);

    if (pendingFirstLoginBioPrompt && verifyEmail) {
      const opened = await maybeAskBiometricsOptIn(verifyEmail);

      if (opened) {
        setPendingRoleAfterBioModal(pendingLoginRole);
        setPendingFirstLoginBioPrompt(false);
        return;
      }
    }

    setPendingFirstLoginBioPrompt(false);
    goAfterLoginByRole(pendingLoginRole);
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
    <SafeAreaView style={[styles.safe, { backgroundColor: TC.surface }]} edges={["top", "bottom"]}>
      <StatusBar barStyle={TC.statusBar} backgroundColor={TC.surface} />

      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={backIconSize} color={TC.textDark} />
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
              <Text style={[styles.termsText, { color: TC.muted }]}>
                By clicking create account you agree to recognizes
              </Text>

              <View style={styles.termsRow}>
                <Pressable onPress={handleTerms} hitSlop={8}>
                  <Text style={[styles.termsLink, { color: TC.primary }]}>Terms of use</Text>
                </Pressable>
                <Text style={[styles.termsText, { color: TC.muted }]}> and </Text>
                <Pressable onPress={handlePrivacy} hitSlop={8}>
                  <Text style={[styles.termsLink, { color: TC.primary }]}>Privacy Policy</Text>
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

      <BiometricsOptInModal
        visible={bioModalVisible}
        onClose={handleBiometricsNotNow}
        onEnable={handleEnableBiometrics}
        onNotNow={handleBiometricsNotNow}
        scale={scale}
        vscale={vscale}
      />

      <BiometricsEnabledModal
        visible={bioEnabledVisible}
        onClose={() => {
          setBioEnabledVisible(false);
          goAfterLoginByRole(pendingRoleAfterBioEnabled);
        }}
      />

      <SignupErrorModal
        visible={credErrorVisible}
        title="Invalid Credentials"
        message="The email or password you entered is incorrect. Please try again."
        onClose={() => setCredErrorVisible(false)}
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
