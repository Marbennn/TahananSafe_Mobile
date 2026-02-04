// src/screens/SignupScreen.tsx
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
  TextInput,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";

// ✅ NEW: separated popup component
import EnterVerificationModal from "../components/SignupScreen/EnterVerificationModal";

type Props = {
  onGoLogin: () => void;
  onSignupSuccess: () => void;
  onBack?: () => void;

  // ✅ Progress tablet (same as PersonalDetails)
  progressActiveCount?: 1 | 2 | 3; // default 1 for Signup
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

const BLUE = "#1D4ED8";
const BORDER_IDLE = "#E5E7EB";

export default function SignupScreen({
  onGoLogin,
  onSignupSuccess,
  onBack,
  progressActiveCount = 1,
}: Props) {
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const backIconSize = scale(22);
  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const [email, setEmail] = useState("JohnDoe@gmail.com");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ✅ popup state
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

    // ✅ open popup instead of navigating immediately
    setVerifyOpen(true);
  };

  const handleVerified = (code: string) => {
    // demo only
    onSignupSuccess();
  };

  const handleResend = () => {
    Alert.alert("Resent", "Verification code resent (demo).");
  };

  const handleTerms = () => Alert.alert("Terms of use", "Open Terms of use screen/link.");
  const handlePrivacy = () => Alert.alert("Privacy Policy", "Open Privacy Policy screen/link.");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ✅ Header row: back + progress (same as PersonalDetailsScreen) */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={backIconSize} color="#111827" />
        </Pressable>

        <View style={styles.progressRow}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.progressSeg,
                i <= progressActiveCount ? styles.progressActive : null,
              ]}
            />
          ))}
        </View>

        <View style={styles.headerSpacer} />
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
            <View style={styles.titleBlock}>
              <Text style={styles.screenTitle}>Create An Account</Text>
              <Text style={styles.screenSub}>
                Create an account to securely store information{"\n"}
                and access support when needed.
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="JohnDoe@gmail.com"
                  placeholderTextColor={Colors.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="********"
                    placeholderTextColor={Colors.placeholder}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, { paddingRight: scale(44) }]}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={10}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={scale(18)}
                      color={Colors.muted}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="********"
                    placeholderTextColor={Colors.placeholder}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, { paddingRight: scale(44) }]}
                  />
                  <Pressable
                    onPress={() => setShowConfirm((v) => !v)}
                    hitSlop={10}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showConfirm ? "eye-off-outline" : "eye-outline"}
                      size={scale(18)}
                      color={Colors.muted}
                    />
                  </Pressable>
                </View>
              </View>

              {!passwordsMatch && confirmPassword.length > 0 ? (
                <Text style={styles.errorText}>Passwords do not match.</Text>
              ) : (
                <View style={{ height: vscale(10) }} />
              )}

              <Pressable
                onPress={handleContinue}
                disabled={!canContinue}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.ctaOuter,
                  !canContinue && { opacity: 0.55 },
                  pressed && canContinue ? { transform: [{ scale: 0.99 }] } : null,
                ]}
              >
                <View style={styles.ctaInnerClip}>
                  <LinearGradient
                    colors={Colors.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaGradient}
                  >
                    <Text style={styles.ctaText}>Continue</Text>
                  </LinearGradient>
                </View>
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Pressable onPress={onGoLogin} hitSlop={10}>
                  <Text style={styles.footerLink}>Login</Text>
                </Pressable>
              </View>
            </View>

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

      {/* ✅ POPUP (separate component) */}
      <EnterVerificationModal
        visible={verifyOpen}
        email={email.trim()}
        initialSeconds={34}
        onClose={() => setVerifyOpen(false)}
        onResend={handleResend}
        onVerified={handleVerified}
      />
    </SafeAreaView>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1, backgroundColor: "#FFFFFF" },

    // ✅ same header structure as PersonalDetailsScreen.tsx
    header: {
      paddingHorizontal: scale(18),
      paddingTop: vscale(6),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    backBtn: {
      width: scale(36),
      height: scale(36),
      alignItems: "flex-start",
      justifyContent: "center",
    },

    headerSpacer: { width: scale(36), height: scale(36) },

    progressRow: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      gap: scale(8),
      marginTop: vscale(2),
    },

    progressSeg: {
      width: scale(46),
      height: scale(3),
      borderRadius: 999,
      backgroundColor: BORDER_IDLE,
    },

    progressActive: {
      backgroundColor: BLUE,
    },

    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: scale(22),
      paddingTop: vscale(6),
      paddingBottom: vscale(14),
    },

    page: {
      flexGrow: 1,
    },

    titleBlock: {
      marginTop: vscale(18),
      marginBottom: vscale(22),
    },

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

    fieldBlock: {
      marginBottom: vscale(14),
    },

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

    ctaInnerClip: {
      borderRadius: scale(14),
      overflow: "hidden",
    },

    ctaGradient: {
      height: vscale(52),
      alignItems: "center",
      justifyContent: "center",
    },

    ctaText: {
      color: "#FFFFFF",
      fontSize: scale(14),
      fontWeight: "800",
    },

    footer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: vscale(18),
    },

    footerText: {
      fontSize: scale(12),
      color: Colors.muted,
    },

    footerLink: {
      fontSize: scale(12),
      fontWeight: "800",
      color: Colors.link,
    },

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
      color: Colors.link,
      fontWeight: "700",
      textDecorationLine: "underline",
      lineHeight: scale(14),
    },
  });
}
