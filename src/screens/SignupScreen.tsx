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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import InputField from "../components/InputField";
import PrimaryButton from "../components/PrimaryButton";
import { Colors } from "../theme/colors";
import { Layout } from "../theme/layout";

// ✅ same logo preset as other screens
import LogoSvg from "../../assets/SecurityQuestionsScreen/Logo.svg";

type Props = {
  onGoLogin: () => void;
  onSignupSuccess: () => void; // ✅ Sign up → PersonalDetailsScreen
};

export default function SignupScreen({ onGoLogin, onSignupSuccess }: Props) {
  const [email, setEmail] = useState<string>("johndoe@gmail.com");
  const [password, setPassword] = useState<string>("password123");
  const [confirmPassword, setConfirmPassword] = useState<string>("password123");

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const passwordsMatch = password === confirmPassword;

  const canSignup = useMemo(() => {
    const e = email.trim();
    const p = password.trim();
    const c = confirmPassword.trim();
    return e.length > 0 && p.length >= 6 && c.length >= 6 && passwordsMatch;
  }, [email, password, confirmPassword, passwordsMatch]);

  const handleSignup = () => {
    const e = email.trim();
    const p = password.trim();
    const c = confirmPassword.trim();

    if (e.length === 0) {
      Alert.alert("Required", "Please enter your email.");
      return;
    }

    if (p.length < 6 || c.length < 6) {
      Alert.alert("Invalid", "Password must be at least 6 characters.");
      return;
    }

    if (!passwordsMatch) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }

    // ✅ TODO: replace with real signup API call later
    // For now, proceed to PersonalDetailsScreen
    onSignupSuccess();
  };

  return (
    <LinearGradient colors={Colors.gradient} style={styles.background}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" />

        {/* ✅ Logo header (same preset as SecurityQuestions/Login) */}
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
                <Text style={styles.title}>Sign Up</Text>

                <InputField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="johndoe@gmail.com"
                  keyboardType="email-address"
                />

                <InputField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="********"
                  secureTextEntry={!showPassword}
                  rightIconName={showPassword ? "eye-off-outline" : "eye-outline"}
                  onPressRightIcon={() => setShowPassword((v) => !v)}
                />

                <InputField
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="********"
                  secureTextEntry={!showConfirm}
                  rightIconName={showConfirm ? "eye-off-outline" : "eye-outline"}
                  onPressRightIcon={() => setShowConfirm((v) => !v)}
                />

                {!passwordsMatch ? (
                  <Text style={styles.errorText}>Passwords do not match.</Text>
                ) : (
                  <View style={{ height: 14 }} />
                )}

                <PrimaryButton
                  title="Sign up"
                  onPress={handleSignup}
                  disabled={!canSignup}
                />

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Already registered? </Text>
                  <Pressable onPress={onGoLogin}>
                    <Text style={styles.footerLink}>Login</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: { flex: 1 },
  safe: { flex: 1 },

  // ✅ same logo preset
  topBrand: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },

  scrollContent: { flexGrow: 1, justifyContent: "flex-end" },

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
    paddingBottom: 22,
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
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 16,
  },

  errorText: {
    marginTop: -6,
    marginBottom: 12,
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
  },

  footer: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  footerText: { color: Colors.muted, fontSize: 12.5 },
  footerLink: { color: Colors.link, fontSize: 12.5, fontWeight: "700" },
});
