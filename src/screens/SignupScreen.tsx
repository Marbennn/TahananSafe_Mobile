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

// ✅ popup
import EnterVerificationModal from "../components/SignupScreen/EnterVerificationModal";

// ✅ Signup card component
import SignupCard from "../components/SignupScreen/SignupCard";

// ✅ API (separated)
import { registerSendOtp } from "../api/auth";

type Props = {
  onGoLogin: () => void;
  onSignupSuccess: () => void;
  onBack?: () => void;
  progressActiveCount?: 1 | 2 | 3;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * ✅ Strict email rules (but ONLY 1 message shown when invalid):
 * - basic email format
 * - must end with .com
 * - domain must be gmail.com OR phinmaed.com
 *
 * UI requirement: show only "Please enter a valid email."
 */
function getEmailError(email: string) {
  // spaces are removed in the input, but keep this safe anyway
  const e = email.replace(/\s/g, "").trim().toLowerCase();
  if (e.length === 0) return null;

  const basicOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  if (!basicOk) return "Please enter a valid email.";

  if (!e.endsWith(".com")) return "Please enter a valid email.";

  const parts = e.split("@");
  if (parts.length !== 2) return "Please enter a valid email.";

  const domain = parts[1];
  const allowedDomains = ["gmail.com", "phinmaed.com"];
  if (!allowedDomains.includes(domain)) return "Please enter a valid email.";

  return null;
}

/** ✅ Password rules:
 * - 8 to 16 characters
 * - has at least 1 uppercase letter
 * - has at least 1 number
 * - has at least 1 special character
 */
function hasUppercase(p: string) {
  return /[A-Z]/.test(p);
}
function hasNumber(p: string) {
  return /[0-9]/.test(p);
}
function hasSpecialChar(p: string) {
  return /[^A-Za-z0-9]/.test(p);
}
function getPasswordError(p: string) {
  // spaces are removed in the input, but keep this safe anyway
  const pass = p.replace(/\s/g, "").trim();
  if (pass.length === 0) return null;

  if (pass.length < 8) return "Password must be at least 8 characters.";
  if (pass.length > 16) return "Password must not exceed 16 characters.";
  if (!hasUppercase(pass)) return "Password must include at least 1 uppercase letter (A-Z).";
  if (!hasNumber(pass)) return "Password must include at least 1 number (0-9).";
  if (!hasSpecialChar(pass))
    return "Password must include at least 1 special character (e.g. !@#$%).";

  return null;
}

/** ✅ Make logs consistent + easy to search */
function log(tag: string, ...args: any[]) {
  console.log(tag, ...args);
}

export default function SignupScreen({ onGoLogin, onSignupSuccess }: Props) {
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  // ✅ START EMPTY (no pre-filled email)
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailError = useMemo(() => getEmailError(email), [email]);
  const passwordError = useMemo(() => getPasswordError(password), [password]);

  const confirmError = useMemo(() => {
    const p = password.replace(/\s/g, "").trim();
    const c = confirmPassword.replace(/\s/g, "").trim();

    if (c.length === 0) return null;
    if (p.length === 0) return null;

    if (p !== c) return "Passwords do not match.";
    return null;
  }, [password, confirmPassword]);

  const canContinue = useMemo(() => {
    const e = email.replace(/\s/g, "").trim();
    const p = password.replace(/\s/g, "").trim();
    const c = confirmPassword.replace(/\s/g, "").trim();

    return (
      e.length > 0 &&
      p.length > 0 &&
      c.length > 0 &&
      !emailError &&
      !passwordError &&
      !confirmError &&
      !isSubmitting
    );
  }, [email, password, confirmPassword, emailError, passwordError, confirmError, isSubmitting]);

  const handleContinue = async () => {
    const e = email.replace(/\s/g, "").trim();
    const p = password.replace(/\s/g, "").trim();

    log("[SIGNUP] handleContinue()", {
      email: e,
      passwordLen: p.length,
      canContinue,
    });

    if (!e || !p) return;
    if (emailError || passwordError || confirmError) return;

    setIsSubmitting(true);
    log("[SIGNUP] submitting START");

    try {
      await registerSendOtp(e, p);

      setVerifyOpen(true);
      log("[SIGNUP] verify modal OPEN");

    } catch (err: any) {
      log("[SIGNUP] error", err);
      Alert.alert("Signup failed", err?.message ? String(err.message) : "Please try again.");
    } finally {
      setIsSubmitting(false);
      log("[SIGNUP] submitting END");
    }
  };

  const handleVerified = (code: string) => {
    log("[SIGNUP] OTP verified in modal. codeLen:", code?.length);
    setVerifyOpen(false);
    onSignupSuccess();
  };

  const handleResend = async () => {
    const e = email.replace(/\s/g, "").trim();
    const p = password.replace(/\s/g, "").trim();

    log("[RESEND] handleResend()", { email: e, passwordLen: p.length });

    if (!e || getEmailError(e)) return;
    if (!p || getPasswordError(p)) return;

    setIsSubmitting(true);
    log("[RESEND] submitting START");

    try {
      await registerSendOtp(e, p);
    } catch (err: any) {
      log("[RESEND] error", err);
      Alert.alert("Resend failed", err?.message ? String(err.message) : "Please try again.");
    } finally {
      setIsSubmitting(false);
      log("[RESEND] submitting END");
    }
  };

  const handleTerms = () => Alert.alert("Terms of use", "Open Terms of use screen/link.");
  const handlePrivacy = () => Alert.alert("Privacy Policy", "Open Privacy Policy screen/link.");

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
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
            canContinue={canContinue}
            onContinue={handleContinue}
            onGoLogin={onGoLogin}
            onTerms={handleTerms}
            onPrivacy={handlePrivacy}
            emailError={emailError}
            passwordError={passwordError}
            confirmError={confirmError}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <EnterVerificationModal
        visible={verifyOpen}
        email={email.replace(/\s/g, "").trim()}
        initialSeconds={34}
        onClose={() => setVerifyOpen(false)}
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
