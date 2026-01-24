// src/screens/VerifyAccountScreen.tsx
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "../theme/colors";
import { Layout } from "../theme/layout";

// ✅ Reuse your logo (same placement as other screens)
import LogoSvg from "../../assets/SecurityQuestionsScreen/Logo.svg";

type Props = {
  email?: string; // used for masking in the message
  onVerify?: (code: string) => void;
  onResendCode?: () => void;
};

export default function VerifyAccountScreen({
  email = "johndoe@gmail.com",
  onVerify,
  onResendCode,
}: Props) {
  const [code, setCode] = useState<string>("");

  const maskedEmail = useMemo(() => maskEmail(email), [email]);

  const normalizedCode = useMemo(() => code.replace(/[^\d]/g, ""), [code]);

  const canVerify = normalizedCode.length === 6;

  const handleVerify = () => {
    if (!canVerify) {
      Alert.alert("Invalid code", "Please enter the 6-digit verification code.");
      return;
    }

    // ✅ Let App.tsx control navigation via callback
    if (onVerify) {
      onVerify(normalizedCode);
      return;
    }

    Alert.alert("Verified", "Account verified (demo).");
  };

  const handleResend = () => {
    if (onResendCode) {
      onResendCode();
      return;
    }
    Alert.alert("Resent", `A new code was sent to ${maskedEmail} (demo).`);
  };

  return (
    <LinearGradient colors={Colors.gradient} style={styles.background}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" />

        {/* Header (same placement as your other screens) */}
        <View style={styles.topBrand}>
          <LogoSvg width={160} height={34} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.cardStack}>
              <View style={styles.cardGhost} />

              <View style={styles.card}>
                <Text style={styles.title}>Verify your Account</Text>

                <Text style={styles.subtitle}>
                  Enter the verification code sent to{"\n"}
                  <Text style={styles.emailStrong}>{maskedEmail}</Text>. If it
                  doesn’t appear within a few minutes, check your spam folder.
                </Text>

                <TextInput
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/[^\d]/g, ""))}
                  placeholder="XXXXXX"
                  placeholderTextColor="#9AA6B2"
                  style={styles.input}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  returnKeyType="done"
                />

                <Pressable
                  onPress={handleVerify}
                  disabled={!canVerify}
                  style={({ pressed }) => [
                    styles.btnOuter,
                    !canVerify ? styles.btnOuterDisabled : null,
                    pressed && canVerify ? { opacity: 0.92 } : null,
                  ]}
                >
                  <LinearGradient
                    colors={
                      canVerify
                        ? ["#0E5FA8", "#0B4B86", "#083A69"]
                        : ["#9FB2C6", "#8FA4B9", "#8299AF"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.btn}
                  >
                    <Text style={styles.btnText}>Verify</Text>
                  </LinearGradient>
                </Pressable>

                <View style={styles.resendRow}>
                  <Text style={styles.resendText}>Having Problems? </Text>
                  <Pressable onPress={handleResend} hitSlop={10}>
                    <Text style={styles.resendLink}>Resend code</Text>
                  </Pressable>
                </View>

                <Text style={styles.finePrint}>
                  By verifying your account, you agree to our Terms and
                  Conditions and acknowledge that you have read our Privacy
                  Policy.
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/** Mask email like u************@gmail.com */
function maskEmail(email: string) {
  const clean = (email || "").trim();
  const at = clean.indexOf("@");
  if (at <= 0) return clean;

  const name = clean.slice(0, at);
  const domain = clean.slice(at + 1);

  const first = name[0] ?? "u";
  const stars = "*".repeat(Math.min(Math.max(name.length - 1, 6), 18)); // nice-looking mask
  return `${first}${stars}@${domain}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: { flex: 1 },
  safe: { flex: 1 },

  scrollContent: { flexGrow: 1, justifyContent: "flex-end" },

  topBrand: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },

  cardStack: { width: "100%", position: "relative" },

  cardGhost: {
    position: "absolute",
    left: 16,
    right: 16,
    top: -14,
    bottom: 14,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  card: {
    width: "100%",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    minHeight: Layout.cardMinHeight,

    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,

    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  title: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 10,
  },

  subtitle: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 12,
  },

  emailStrong: {
    fontWeight: "800",
    color: "#111827",
  },

  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D6DEE7",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#111827",
    letterSpacing: 1.5,
    textAlign: "left",
    marginBottom: 14,
  },

  btnOuter: {
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#083A69",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    marginTop: 4,
  },
  btnOuterDisabled: { shadowOpacity: 0, elevation: 0 },
  btn: {
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13.5 },

  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 10,
  },
  resendText: { color: "#6B7280", fontSize: 11.5, fontWeight: "600" },
  resendLink: {
    color: Colors.link,
    fontSize: 11.5,
    fontWeight: "800",
    textDecorationLine: "underline",
  },

  finePrint: {
    textAlign: "center",
    fontSize: 9.5,
    lineHeight: 13,
    color: "#9AA6B2",
    fontWeight: "600",
    paddingHorizontal: 6,
  },
});
