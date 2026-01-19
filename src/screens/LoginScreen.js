// src/screens/LoginScreen.js
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
import InputField from "../components/InputField";
import PrimaryButton from "../components/PrimaryButton";
import Checkbox from "../components/Checkbox";
import { Colors } from "../theme/colors";
import { Layout } from "../theme/layout";

export default function LoginScreen({ onGoSignup, onLoginSuccess }) {
  const [email, setEmail] = useState("johndoe@gmail.com");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const canLogin = useMemo(() => {
    const e = email.trim();
    const p = password.trim();
    return e.length > 0 && p.length >= 6;
  }, [email, password]);

  const handleLogin = () => {
    // ✅ here you will call your backend later
    // for now, treat it as success:
    // Alert.alert("Login success", "Proceeding to PIN...");
    onLoginSuccess?.(); // ✅ go to PIN screen
  };

  const handleForgot = () => Alert.alert("Forgot Password", "Go to Forgot screen.");

  return (
    <LinearGradient colors={Colors.gradient} style={styles.background}>
      <StatusBar barStyle="light-content" />

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
              <Text style={styles.title}>Login</Text>

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

              <View style={styles.rowBetween}>
                <Checkbox
                  value={rememberMe}
                  onToggle={() => setRememberMe((v) => !v)}
                  label="Remember me"
                />

                <Pressable onPress={handleForgot} hitSlop={10}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>
              </View>

              <PrimaryButton title="Login" onPress={handleLogin} disabled={!canLogin} />

              <View style={styles.footer}>
                <Text style={styles.footerText}>Not yet registered? </Text>
                <Pressable onPress={onGoSignup}>
                  <Text style={styles.footerLink}>Create an account</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },

  cardStack: {
    width: "100%",
    position: "relative",
  },

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

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 18,
  },

  forgotText: {
    color: Colors.link,
    fontSize: 12,
    fontWeight: "600",
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },
  footerText: { color: Colors.muted, fontSize: 12.5 },
  footerLink: { color: Colors.link, fontSize: 12.5, fontWeight: "700" },
});
