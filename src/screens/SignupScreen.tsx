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

type Props = {
  onGoLogin: () => void;
  onSignupSuccess: () => void;
  onBack?: () => void;
  progressActiveCount?: 1 | 2 | 3; // kept for compatibility (shell controls header)
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function SignupScreen({
  onGoLogin,
  onSignupSuccess,
  onBack,
}: Props) {
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

  const passwordsMatch = password === confirmPassword;

  const canContinue = useMemo(() => {
    const e = email.trim();
    const p = password.trim();
    const c = confirmPassword.trim();
    return e.length > 0 && p.length >= 6 && c.length >= 6 && passwordsMatch;
  }, [email, password, confirmPassword, passwordsMatch]);

  const handleBack = () => {
    if (onBack) onBack();
    else onGoLogin();
  };

  const handleContinue = () => {
    const e = email.trim();
    const p = password.trim();
    const c = confirmPassword.trim();

    if (!e) return Alert.alert("Required", "Please enter your email.");
    if (!isValidEmail(e)) return Alert.alert("Invalid", "Please enter a valid email.");
    if (p.length < 6)
      return Alert.alert("Invalid", "Password must be at least 6 characters.");
    if (c.length < 6)
      return Alert.alert("Invalid", "Confirm password must be at least 6 characters.");
    if (p !== c) return Alert.alert("Password mismatch", "Passwords do not match.");

    setVerifyOpen(true);
  };

  const handleVerified = (_code: string) => {
    onSignupSuccess();
  };

  const handleResend = () => {
    Alert.alert("Resent", "Verification code resent (demo).");
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
            passwordsMatch={passwordsMatch}
            canContinue={canContinue}
            onContinue={handleContinue}
            onGoLogin={handleBack}
            onTerms={handleTerms}
            onPrivacy={handlePrivacy}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <EnterVerificationModal
        visible={verifyOpen}
        email={email.trim()}
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

    // (rest kept as-is, since SignupCard uses these)
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

    termsText: { fontSize: scale(11), color: "#6B7280", textAlign: "center", lineHeight: scale(14) },

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
