// src/components/LoginScreen/LoginCard.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../theme/colors";

type Props = {
  onLoginSuccess: () => void;
  onGoSignup: () => void;
  onForgotPassword: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function LoginCard({
  onLoginSuccess,
  onGoSignup,
  onForgotPassword,
}: Props) {
  const { width, height } = useWindowDimensions();

  // ✅ Responsive scaling (same logic as Signup)
  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = () => {
    onLoginSuccess(); // ✅ always active
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <Text style={styles.title}>Login</Text>
      <Text style={styles.subtitle}>
        Welcome back! Log in to securely access your{"\n"}
        account and continue using the app.
      </Text>

      {/* Email */}
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="JohnDoe@gmail.com"
          placeholderTextColor={Colors.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
      </View>

      {/* Password */}
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

      {/* Remember + Forgot */}
      <View style={styles.rowBetween}>
        <Pressable
          onPress={() => setRememberMe((v) => !v)}
          style={styles.rememberWrap}
          hitSlop={8}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
            {rememberMe && (
              <Ionicons name="checkmark" size={scale(14)} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.rememberText}>Remember me</Text>
        </Pressable>

        <Pressable onPress={onForgotPassword} hitSlop={10}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </Pressable>
      </View>

      {/* ✅ LOGIN BUTTON (EXACT SAME AS SIGNUP) */}
      <Pressable
        onPress={handleLogin}
        hitSlop={10}
        style={({ pressed }) => [
          styles.ctaOuter,
          pressed ? { transform: [{ scale: 0.99 }] } : null,
        ]}
      >
        <View style={styles.ctaInnerClip}>
          <LinearGradient
            colors={Colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>Login</Text>
          </LinearGradient>
        </View>
      </Pressable>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Not yet registered? </Text>
        <Pressable onPress={onGoSignup} hitSlop={10}>
          <Text style={styles.footerLink}>Create an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number
) {
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

    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: vscale(18),
    },

    rememberWrap: {
      flexDirection: "row",
      alignItems: "center",
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
  });
}
