// src/screens/SignupScreen.tsx
import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  useWindowDimensions,
  View,
} from "react-native";
import { Colors } from "../theme/colors";

// ✅ API base url helper
import { apiUrl } from "../config/api";

// ✅ popup
import EnterVerificationModal from "../components/SignupScreen/EnterVerificationModal";

// ✅ Signup card component
import SignupCard from "../components/SignupScreen/SignupCard";

type Props = {
  onGoLogin: () => void;
  onSignupSuccess: () => void;
  onBack?: () => void;
  progressActiveCount?: 1 | 2 | 3;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** ✅ Make logs consistent + easy to search */
function log(tag: string, ...args: any[]) {
  console.log(tag, ...args);
}

async function safeReadJson(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return res.json().catch(() => null);
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await res.json().catch(() => null);
      if (j && typeof j === "object") return String(j.message || j.error || JSON.stringify(j));
      return "Request failed.";
    }
    const t = await res.text().catch(() => "");
    return t || "Request failed.";
  } catch {
    return "Request failed.";
  }
}

type VerifyResponse = {
  message?: string;
  user?: { id: string; email: string; profileImage?: string };
  accessToken?: string;
  refreshToken?: string;
};

export default function SignupScreen({ onGoLogin, onSignupSuccess }: Props) {
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const [email, setEmail] = useState("JohnDoe@gmail.com");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch = password === confirmPassword;

  const canContinue = useMemo(() => {
    const e = email.trim();
    const p = password.trim();
    const c = confirmPassword.trim();
    return e.length > 0 && p.length >= 6 && c.length >= 6 && passwordsMatch && !isSubmitting;
  }, [email, password, confirmPassword, passwordsMatch, isSubmitting]);

  /**
   * ✅ Step 1: send OTP email
   * Correct backend route: POST /api/mobile/v1/register
   */
  const handleContinue = async () => {
    const e = email.trim();
    const p = password.trim();
    const c = confirmPassword.trim();

    log("[SIGNUP] handleContinue()", {
      email: e,
      passwordLen: p.length,
      confirmPasswordLen: c.length,
      passwordsMatch: p === c,
      canContinue,
    });

    if (!e) return Alert.alert("Required", "Please enter your email.");
    if (!isValidEmail(e)) return Alert.alert("Invalid", "Please enter a valid email.");
    if (p.length < 6) return Alert.alert("Invalid", "Password must be at least 6 characters.");
    if (c.length < 6) return Alert.alert("Invalid", "Confirm password must be at least 6 characters.");
    if (p !== c) return Alert.alert("Password mismatch", "Passwords do not match.");

    const path = "/api/mobile/v1/register";
    const url = apiUrl(path);

    setIsSubmitting(true);
    log("[SIGNUP] submitting START", { url, path });

    try {
      log("[SIGNUP] request body", { email: e, password: "********" });

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password: p }),
      });

      log("[SIGNUP] response status", { status: res.status, ok: res.ok });

      if (!res.ok) {
        const msg = await readErrorMessage(res);
        log("[SIGNUP] error body", msg);
        return Alert.alert("Signup failed", msg);
      }

      const json = await safeReadJson(res);
      log("[SIGNUP] success body", json);

      setVerifyOpen(true);
      log("[SIGNUP] verify modal OPEN");

      // ✅ Updated to 4-digit (matches your modal + backend)
      Alert.alert("Verification", "We sent a 4-digit OTP to your email. Enter it to verify.");
    } catch (err: any) {
      log("[SIGNUP] network error", err);
      Alert.alert("Network error", err?.message ? String(err.message) : "Please try again.");
    } finally {
      setIsSubmitting(false);
      log("[SIGNUP] submitting END");
    }
  };

  /**
   * ✅ Step 2: verify OTP + create user + receive tokens
   * Correct backend route: POST /api/mobile/v1/verify-registration-otp
   */
  const handleVerified = async (code: string) => {
    const e = email.trim();
    const otp = code.trim();

    log("[VERIFY] handleVerified()", { email: e, otpLen: otp.length });

    if (!otp) return Alert.alert("Required", "Please enter the OTP code.");

    const path = "/api/mobile/v1/verify-registration-otp";
    const url = apiUrl(path);

    setIsSubmitting(true);
    log("[VERIFY] submitting START", { url, path });

    try {
      log("[VERIFY] request body", { email: e, otp: "****" });

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, otp }),
      });

      log("[VERIFY] response status", { status: res.status, ok: res.ok });

      if (!res.ok) {
        const msg = await readErrorMessage(res);
        log("[VERIFY] error body", msg);
        return Alert.alert("Verification failed", msg);
      }

      const data = (await res.json().catch(() => ({}))) as VerifyResponse;
      log("[VERIFY] success body", data);

      if (data.accessToken) log("[VERIFY] accessToken (len)", data.accessToken.length);
      if (data.refreshToken) log("[VERIFY] refreshToken (len)", data.refreshToken.length);
      if (data.user) log("[VERIFY] user", data.user);

      setVerifyOpen(false);
      log("[VERIFY] verify modal CLOSE");

      onSignupSuccess();
      log("[VERIFY] onSignupSuccess() called");
    } catch (err: any) {
      log("[VERIFY] network error", err);
      Alert.alert("Network error", err?.message ? String(err.message) : "Please try again.");
    } finally {
      setIsSubmitting(false);
      log("[VERIFY] submitting END");
    }
  };

  /**
   * ✅ Resend OTP: call /register again
   */
  const handleResend = async () => {
    const e = email.trim();
    const p = password.trim();

    log("[RESEND] handleResend()", { email: e, passwordLen: p.length });

    if (!e || !isValidEmail(e)) return Alert.alert("Invalid", "Please enter a valid email first.");
    if (!p || p.length < 6) return Alert.alert("Invalid", "Please enter your password again to resend OTP.");

    const path = "/api/mobile/v1/register";
    const url = apiUrl(path);

    setIsSubmitting(true);
    log("[RESEND] submitting START", { url, path });

    try {
      log("[RESEND] request body", { email: e, password: "********" });

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password: p }),
      });

      log("[RESEND] response status", { status: res.status, ok: res.ok });

      if (!res.ok) {
        const msg = await readErrorMessage(res);
        log("[RESEND] error body", msg);
        return Alert.alert("Resend failed", msg);
      }

      const json = await safeReadJson(res);
      log("[RESEND] success body", json);

      Alert.alert("Resent", "A new OTP was sent to your email.");
    } catch (err: any) {
      log("[RESEND] network error", err);
      Alert.alert("Network error", err?.message ? String(err.message) : "Please try again.");
    } finally {
      setIsSubmitting(false);
      log("[RESEND] submitting END");
    }
  };

  const handleTerms = () => Alert.alert("Terms of use", "Open Terms of use screen/link.");
  const handlePrivacy = () => Alert.alert("Privacy Policy", "Open Privacy Policy screen/link.");

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <SignupCard
            scale={scale}
            vscale={vscale}
            styles={styles}
            email={email}
            password={password}
            confirmPassword={confirmPassword}
            setEmail={setEmail}
            setPassword={setPassword}
            setConfirmPassword={setConfirmPassword}
            showPassword={showPassword}
            showConfirm={showConfirm}
            toggleShowPassword={() => setShowPassword((v) => !v)}
            toggleShowConfirm={() => setShowConfirm((v) => !v)}
            passwordsMatch={passwordsMatch}
            canContinue={canContinue}
            onContinue={handleContinue}
            onGoLogin={onGoLogin}
            onTerms={handleTerms}
            onPrivacy={handlePrivacy}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <EnterVerificationModal
        visible={verifyOpen}
        email={email.trim()}
        initialSeconds={34}
        onClose={() => {
          log("[VERIFY] verify modal CLOSE (manual)");
          setVerifyOpen(false);
        }}
        onResend={handleResend}
        onVerified={handleVerified}
      />
    </View>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1, backgroundColor: "#FFFFFF" },

    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: scale(22),
      paddingTop: vscale(6),
      paddingBottom: vscale(14),
    },

    page: { flexGrow: 1 },

    titleBlock: { marginTop: vscale(18), marginBottom: vscale(22) },

    screenTitle: {
      fontSize: scale(26),
      fontWeight: "800",
      color: Colors.text,
    },

    screenSub: {
      marginTop: vscale(8),
      fontSize: scale(13),
      lineHeight: scale(18),
      color: Colors.muted,
      maxWidth: scale(360),
    },

    form: {},
    fieldBlock: { marginBottom: vscale(14) },

    label: {
      marginBottom: vscale(8),
      fontSize: scale(13),
      fontWeight: "700",
      color: Colors.text,
    },

    inputWrap: { position: "relative" },

    input: {
      height: vscale(50),
      borderRadius: scale(14),
      paddingHorizontal: scale(14),
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: "#FFFFFF",
      fontSize: scale(14),
      color: Colors.text,
    },

    eyeBtn: {
      position: "absolute",
      right: scale(10),
      top: 0,
      height: vscale(50),
      width: scale(34),
      alignItems: "center",
      justifyContent: "center",
    },

    errorText: {
      marginTop: vscale(2),
      fontSize: scale(11),
      color: "#DC2626",
      fontWeight: "700",
    },

    ctaOuter: {
      marginTop: vscale(4),
      borderRadius: scale(14),
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 7 },
        },
        android: { elevation: 7 },
      }),
    },

    ctaInnerClip: { borderRadius: scale(14), overflow: "hidden" },

    ctaGradient: { height: vscale(52), alignItems: "center", justifyContent: "center" },

    ctaText: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "800" },

    footer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: vscale(18),
    },

    footerText: { fontSize: scale(12), color: Colors.muted },

    footerLink: { fontSize: scale(12), fontWeight: "800", color: Colors.link },

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

    termsRow: { flexDirection: "row", alignItems: "center", marginTop: vscale(2) },

    termsLink: {
      fontSize: scale(11),
      color: Colors.link,
      fontWeight: "700",
      textDecorationLine: "underline",
      lineHeight: scale(14),
    },
  });
}
