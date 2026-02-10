// src/components/SignupScreen/SignupCard.tsx
import React from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../theme/colors";

type Props = {
  scale: (n: number) => number;
  vscale: (n: number) => number;
  styles: any;

  email: string;
  password: string;
  confirmPassword: string;

  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setConfirmPassword: (v: string) => void;

  showPassword: boolean;
  showConfirm: boolean;
  toggleShowPassword: () => void;
  toggleShowConfirm: () => void;

  canContinue: boolean;
  onContinue: () => void;

  onGoLogin: () => void;
  onTerms: () => void;
  onPrivacy: () => void;

  emailError: string | null;
  passwordError: string | null;
  confirmError: string | null;
};

function removeSpaces(s: string) {
  return s.replace(/\s/g, "");
}

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

  canContinue,
  onContinue,

  onGoLogin,
  onTerms,
  onPrivacy,

  emailError,
  passwordError,
  confirmError,
}: Props) {
  const confirmTyped = confirmPassword.trim().length > 0;

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
        {/* EMAIL */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={(t) => setEmail(removeSpaces(t))}
            placeholder="JohnDoe@gmail.com"
            placeholderTextColor={Colors.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            style={styles.input}
          />
          {!!emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        </View>

        {/* PASSWORD */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={password}
              onChangeText={(t) => setPassword(removeSpaces(t))}
              placeholder="********"
              placeholderTextColor={Colors.placeholder}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={16}
              style={[styles.input, { paddingRight: scale(44) }]}
            />
            <Pressable onPress={toggleShowPassword} hitSlop={10} style={styles.eyeBtn}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={scale(18)}
                color={Colors.muted}
              />
            </Pressable>
          </View>
          {!!passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
        </View>

        {/* CONFIRM PASSWORD */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={confirmPassword}
              onChangeText={(t) => setConfirmPassword(removeSpaces(t))}
              placeholder="********"
              placeholderTextColor={Colors.placeholder}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={16}
              style={[styles.input, { paddingRight: scale(44) }]}
            />
            <Pressable onPress={toggleShowConfirm} hitSlop={10} style={styles.eyeBtn}>
              <Ionicons
                name={showConfirm ? "eye-off-outline" : "eye-outline"}
                size={scale(18)}
                color={Colors.muted}
              />
            </Pressable>
          </View>

          {confirmTyped && !!confirmError ? (
            <Text style={styles.errorText}>{confirmError}</Text>
          ) : null}
        </View>

        <View style={{ height: vscale(10) }} />

        {/* CONTINUE */}
        <Pressable
          onPress={onContinue}
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
        <Text style={styles.termsText}>By clicking create account you agree to recognizes</Text>

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
