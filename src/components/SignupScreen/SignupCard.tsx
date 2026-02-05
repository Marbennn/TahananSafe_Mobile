// src/components/SignupScreen/SignupCard.tsx
import React from "react";
import { View, Text, Pressable, TextInput, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../theme/colors";

type Props = {
  // responsive helpers from SignupScreen
  scale: (n: number) => number;
  vscale: (n: number) => number;

  // styles from SignupScreen (so UI stays identical)
  styles: any;

  // values
  email: string;
  password: string;
  confirmPassword: string;

  // setters
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setConfirmPassword: (v: string) => void;

  // visibility toggles
  showPassword: boolean;
  showConfirm: boolean;
  toggleShowPassword: () => void;
  toggleShowConfirm: () => void;

  // validation + actions
  passwordsMatch: boolean;
  canContinue: boolean;
  onContinue: () => void;
  loading?: boolean; // support loading state

  // footer + links
  onGoLogin: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
};

export default function SignupCard({
  scale,
  vscale,
  styles,

  email,
  password,
  confirmPassword,
  setEmail,
  setPassword,
  setConfirmPassword,

  showPassword,
  showConfirm,
  toggleShowPassword,
  toggleShowConfirm,

  passwordsMatch,
  canContinue,
  onContinue,
  loading = false,

  onGoLogin,
  onTerms,
  onPrivacy,
}: Props) {
  return (
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
              onPress={toggleShowPassword}
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
              onPress={toggleShowConfirm}
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
          onPress={onContinue}
          disabled={!canContinue || loading} // disable if loading
          hitSlop={10}
          style={({ pressed }) => [
            styles.ctaOuter,
            (!canContinue || loading) && { opacity: 0.55 },
            pressed && canContinue && !loading
              ? { transform: [{ scale: 0.99 }] }
              : null,
          ]}
        >
          <View style={styles.ctaInnerClip}>
            <LinearGradient
              colors={Colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>
                {loading ? "Please wait..." : "Continue"}{" "}
              </Text>
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
          <Pressable onPress={onTerms} hitSlop={8}>
            <Text style={styles.termsLink}>Terms of use</Text>
          </Pressable>
          <Text style={styles.termsText}> and </Text>
          <Pressable onPress={onPrivacy} hitSlop={8}>
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
