// src/components/LoginScreen/LoginCard.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, useColors } from "../../theme/colors";

type Props = {
  // ✅ UPDATED: now receives email + password (supports async)
  onLoginSuccess: (email: string, password: string) => void | Promise<void>;
  onGoSignup: () => void;
  onForgotPassword: () => void;

  // ✅ Optional: so LoginScreen can disable UI while requesting
  loading?: boolean;
  autofillValues?: { email: string; password: string; nonce: number } | null;
  biometricAvailable?: boolean;
  biometricLoading?: boolean;
  onBiometricAutofill?: () => void | Promise<void>;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function LoginCard({
  onLoginSuccess,
  onGoSignup,
  onForgotPassword,
  loading = false,
  autofillValues = null,
  biometricAvailable = false,
  biometricLoading = false,
  onBiometricAutofill,
}: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();

  // ✅ Responsive scaling (same logic as Signup)
  const s = clamp(Math.min(width, 480) / 375, 0.84, 1.12);
  const vs = clamp(height / 812, 0.78, 1.08);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const canLogin = email.trim().length > 0 && password.trim().length > 0 && !loading;
  const canUseBiometrics = biometricAvailable && !!onBiometricAutofill && !loading && !biometricLoading;

  useEffect(() => {
    if (!autofillValues) return;
    setEmail(autofillValues.email);
    setPassword(autofillValues.password);
    setRememberMe(true);
  }, [autofillValues?.nonce]);

  const handleLogin = async () => {
    if (!canLogin) return;
    await onLoginSuccess(email.trim(), password);
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <Text style={[styles.title, { color: TC.text }]}>Login</Text>
      <Text style={[styles.subtitle, { color: TC.muted }]}>
        Welcome back! Log in to securely access your account and continue using the app.
      </Text>

      {/* Email */}
      <View style={styles.fieldBlock}>
        <Text style={[styles.label, { color: TC.text }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="JohnDoe@gmail.com"
          placeholderTextColor={TC.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.input, { backgroundColor: TC.inputBg, borderColor: TC.border, color: TC.text }, emailFocused && { borderColor: "#1D4ED8" }]}
          editable={!loading}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
        />
      </View>

      {/* Password */}
      <View style={styles.fieldBlock}>
        <Text style={[styles.label, { color: TC.text }]}>Password</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="********"
            placeholderTextColor={TC.placeholder}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            style={[styles.input, { paddingRight: scale(44), backgroundColor: TC.inputBg, borderColor: TC.border, color: TC.text }, passwordFocused && { borderColor: "#1D4ED8" }]}
            editable={!loading}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={10}
            disabled={loading}
            style={({ pressed }) => [
              styles.eyeBtn,
              pressed && !loading ? { opacity: 0.7 } : null,
            ]}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={scale(18)}
              color={TC.muted}
            />
          </Pressable>
        </View>
      </View>

      {/* Remember + Forgot */}
      <View style={styles.rowBetween}>
        <Pressable
          onPress={() => setRememberMe((v) => !v)}
          style={styles.rememberWrap}
          hitSlop={8}
          disabled={loading}
        >
          <View style={[styles.checkbox, { borderColor: TC.border }, rememberMe && [styles.checkboxChecked, { backgroundColor: TC.primary, borderColor: TC.primary }], loading && { opacity: 0.6 }]}>
            {rememberMe && (
              <Ionicons name="checkmark" size={scale(14)} color="#FFFFFF" />
            )}
          </View>
          <Text style={[styles.rememberText, { color: TC.muted }, loading && { opacity: 0.6 }]}>Remember me</Text>
        </Pressable>

        <Pressable onPress={onForgotPassword} hitSlop={10} disabled={loading}>
          <Text style={[styles.forgotText, { color: TC.link }, loading && { opacity: 0.6 }]}>
            Forgot Password?
          </Text>
        </Pressable>
      </View>

      {/* ✅ LOGIN BUTTON (EXACT SAME AS SIGNUP UI) */}
      {biometricAvailable ? (
        <Pressable
          onPress={onBiometricAutofill}
          disabled={!canUseBiometrics}
          hitSlop={8}
          style={({ pressed }) => [
            styles.bioAutofillBtn,
            { borderColor: TC.border, backgroundColor: TC.inputBg },
            (!canUseBiometrics || pressed) && { opacity: canUseBiometrics ? 0.75 : 0.55 },
          ]}
        >
          {biometricLoading ? (
            <ActivityIndicator size="small" color={TC.primary} />
          ) : (
            <Ionicons
              name={Platform.OS === "ios" ? "scan-outline" : "finger-print-outline"}
              size={scale(17)}
              color={TC.primary}
            />
          )}
          <Text style={[styles.bioAutofillText, { color: TC.primary }]}>
            {biometricLoading ? "Checking biometrics..." : "Fill saved login with biometrics"}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={handleLogin}
        disabled={!canLogin}
        hitSlop={10}
        style={({ pressed }) => [
          styles.ctaOuter,
          !canLogin && { opacity: 0.6 },
          pressed && canLogin ? { transform: [{ scale: 0.99 }] } : null,
        ]}
      >
        <View style={styles.ctaInnerClip}>
          <LinearGradient
            colors={TC.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            {loading ? <ActivityIndicator /> : <Text style={styles.ctaText}>Login</Text>}
          </LinearGradient>
        </View>
      </Pressable>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Not yet registered? </Text>
        <Pressable onPress={onGoSignup} hitSlop={10} disabled={loading}>
          <Text style={[styles.footerLink, loading && { opacity: 0.6 }]}>
            Create an account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  return StyleSheet.create({
    container: {
      marginTop: vscale(18),
    },

    title: {
      fontSize: scale(26),
      fontWeight: "800",
      color: Colors.text,
    },

    subtitle: {
      marginTop: vscale(8),
      fontSize: scale(13),
      lineHeight: scale(18),
      color: Colors.muted,
      maxWidth: scale(360),
      marginBottom: vscale(22),
    },

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
      minHeight: Math.max(44, vscale(50)),
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
      minHeight: Math.max(44, vscale(50)),
      width: scale(34),
      alignItems: "center",
      justifyContent: "center",
    },

    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: scale(10),
      marginBottom: vscale(18),
    },

    rememberWrap: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
      gap: scale(8),
    },

    checkbox: {
      width: scale(14),
      height: scale(14),
      borderRadius: scale(3),
      borderWidth: 1,
      borderColor: "#D1D5DB",
      alignItems: "center",
      justifyContent: "center",
    },

    checkboxChecked: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },

    rememberText: {
      fontSize: scale(12),
      color: Colors.muted,
    },

    forgotText: {
      fontSize: scale(12),
      fontWeight: "700",
      color: Colors.link,
    },

    /* ✅ BUTTON STYLES (MATCH SIGNUP) */
    bioAutofillBtn: {
      minHeight: Math.max(44, vscale(44)),
      borderRadius: scale(14),
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: scale(8),
      marginBottom: vscale(14),
      paddingHorizontal: scale(12),
    },

    bioAutofillText: {
      flexShrink: 1,
      textAlign: "center",
      fontSize: scale(12),
      fontWeight: "800",
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
      minHeight: Math.max(46, vscale(52)),
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
  });
}
