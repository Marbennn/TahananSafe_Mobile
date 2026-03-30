// src/components/PinScreen/ForgotPinModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  Animated,
  useWindowDimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, useColors } from "../../theme/colors";
import {
  forgotPinSendOtp,
  forgotPinVerifyOtp,
  forgotPinReset,
} from "../../api/pin";

type Step = "email" | "otp" | "newPin" | "success";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPinReset: () => void; // called after successful reset
  prefillEmail?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const BLUE = Colors.primary;

export default function ForgotPinModal({
  visible,
  onClose,
  onPinReset,
  prefillEmail,
}: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale, TC), [width, height, TC]);

  // Animation
  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;

  // State
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(prefillEmail || "");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Refs
  const otpRef = useRef<TextInput>(null);
  const pinRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const confirmRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];

  // Reset everything when modal opens/closes
  useEffect(() => {
    if (visible) {
      setStep("email");
      setEmail(prefillEmail || "");
      setOtp("");
      setResetToken("");
      setNewPin("");
      setConfirmPin("");
      setError("");
      setLoading(false);

      fade.setValue(0);
      pop.setValue(0.96);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, speed: 18, bounciness: 6, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const closeWithAnim = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 0.98, duration: 120, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) cb();
    });
  };

  const handleClose = () => closeWithAnim(onClose);

  /* ---- Step handlers ---- */

  const handleSendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await forgotPinSendOtp(trimmed);
      setEmail(trimmed);
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const trimmed = otp.trim();
    if (trimmed.length !== 4) {
      setError("Please enter the 4-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await forgotPinVerifyOtp(email, trimmed);
      setResetToken(res.resetToken);
      setStep("newPin");
      setTimeout(() => pinRefs[0].current?.focus(), 300);
    } catch (err: any) {
      setError(err.message || "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await forgotPinReset(email, resetToken, newPin);
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Failed to reset PIN.");
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    closeWithAnim(() => {
      onPinReset();
    });
  };

  /* ---- Renderers ---- */

  const renderEmail = () => (
    <>
      <View style={styles.iconCircle}>
        <Ionicons name="mail-outline" size={scale(30)} color={BLUE} />
      </View>
      <Text style={styles.title}>Reset Your PIN</Text>
      <Text style={styles.sub}>
        Enter the email address linked to your account. We'll send a verification code.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor={TC.placeholder}
        value={email}
        onChangeText={(t) => { setEmail(t); setError(""); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        editable={!loading}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={handleSendOtp}
        disabled={loading}
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && { opacity: 0.85 },
          loading && { opacity: 0.6 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.primaryBtnText}>Send Code</Text>
        )}
      </Pressable>
    </>
  );

  const renderOtp = () => (
    <>
      <View style={styles.iconCircle}>
        <Ionicons name="keypad-outline" size={scale(30)} color={BLUE} />
      </View>
      <Text style={styles.title}>Enter Verification Code</Text>
      <Text style={styles.sub}>
        We sent a 4-digit code to{"\n"}
        <Text style={{ fontWeight: "700", color: TC.textDark }}>{email}</Text>
      </Text>

      <TextInput
        ref={otpRef}
        style={[styles.input, styles.otpInput]}
        placeholder="0000"
        placeholderTextColor={TC.placeholder}
        value={otp}
        onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, "").slice(0, 4)); setError(""); }}
        keyboardType="number-pad"
        maxLength={4}
        editable={!loading}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={handleVerifyOtp}
        disabled={loading}
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && { opacity: 0.85 },
          loading && { opacity: 0.6 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.primaryBtnText}>Verify</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => { setStep("email"); setOtp(""); setError(""); }}
        style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.linkText}>Use a different email</Text>
      </Pressable>
    </>
  );

  const handlePinBoxChange = (
    text: string,
    index: number,
    value: string,
    setValue: (v: string) => void,
    refs: React.RefObject<TextInput | null>[],
    nextGroupRefs?: React.RefObject<TextInput | null>[],
  ) => {
    const digit = text.replace(/[^0-9]/g, "");
    if (!digit) {
      // Deletion: clear current box, move back
      const arr = value.split("");
      arr[index] = "";
      setValue(arr.join(""));
      if (index > 0) refs[index - 1].current?.focus();
      setError("");
      return;
    }
    const char = digit.charAt(digit.length - 1);
    const arr = value.padEnd(4, " ").split("");
    arr[index] = char;
    const next = arr.join("").replace(/ /g, "");
    setValue(next);
    setError("");

    if (index < 3) {
      refs[index + 1].current?.focus();
    } else if (next.length === 4 && nextGroupRefs) {
      setTimeout(() => nextGroupRefs[0].current?.focus(), 100);
    }
  };

  const handlePinBoxKey = (
    e: any,
    index: number,
    value: string,
    setValue: (v: string) => void,
    refs: React.RefObject<TextInput | null>[],
  ) => {
    if (e.nativeEvent.key === "Backspace" && !value[index] && index > 0) {
      const arr = value.split("");
      arr[index - 1] = "";
      setValue(arr.join(""));
      refs[index - 1].current?.focus();
    }
  };

  const renderPinBoxes = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    refs: React.RefObject<TextInput | null>[],
    nextGroupRefs?: React.RefObject<TextInput | null>[],
  ) => (
    <View style={{ width: "100%", marginBottom: scale(14) }}>
      <Text style={[styles.pinLabel, { color: TC.muted }]}>{label}</Text>
      <View style={styles.pinBoxRow}>
        {[0, 1, 2, 3].map((i) => (
          <TextInput
            key={i}
            ref={refs[i]}
            style={[
              styles.pinBox,
              value[i] ? { borderColor: BLUE } : {},
            ]}
            value={value[i] ? "\u2022" : ""}
            onChangeText={(t) => handlePinBoxChange(t, i, value, setValue, refs, nextGroupRefs)}
            onKeyPress={(e) => handlePinBoxKey(e, i, value, setValue, refs)}
            keyboardType="number-pad"
            maxLength={2}
            editable={!loading}
            selectTextOnFocus
          />
        ))}
      </View>
    </View>
  );

  const renderNewPin = () => (
    <>
      <View style={styles.iconCircle}>
        <Ionicons name="lock-open-outline" size={scale(30)} color={BLUE} />
      </View>
      <Text style={styles.title}>Create New PIN</Text>
      <Text style={styles.sub}>Enter a new 4-digit PIN for your account.</Text>

      {renderPinBoxes("New PIN", newPin, setNewPin, pinRefs, confirmRefs)}
      {renderPinBoxes("Confirm PIN", confirmPin, setConfirmPin, confirmRefs)}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={handleResetPin}
        disabled={loading}
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && { opacity: 0.85 },
          loading && { opacity: 0.6 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.primaryBtnText}>Reset PIN</Text>
        )}
      </Pressable>
    </>
  );

  const renderSuccess = () => (
    <>
      <View style={[styles.iconCircle, { backgroundColor: "#D1FAE5" }]}>
        <Ionicons name="checkmark-circle" size={scale(34)} color="#059669" />
      </View>
      <Text style={styles.title}>PIN Reset Successful</Text>
      <Text style={styles.sub}>
        Your PIN has been updated. You can now log in with your new PIN.
      </Text>

      <Pressable
        onPress={handleDone}
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.primaryBtnText}>Continue</Text>
      </Pressable>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.backdrop, { opacity: fade }]} />

          <Animated.View
            style={[
              styles.card,
              {
                opacity: fade,
                transform: [{ scale: pop }],
                backgroundColor: TC.surface,
              },
            ]}
          >
            {/* Close X */}
            {step !== "success" && (
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={scale(20)} color={TC.muted} />
              </Pressable>
            )}

            {step === "email" && renderEmail()}
            {step === "otp" && renderOtp()}
            {step === "newPin" && renderNewPin()}
            {step === "success" && renderSuccess()}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number,
  TC: ReturnType<typeof useColors>,
) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: scale(24),
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.32)",
    },
    card: {
      width: "100%",
      maxWidth: scale(340),
      borderRadius: scale(20),
      paddingHorizontal: scale(24),
      paddingTop: scale(32),
      paddingBottom: scale(24),
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
        },
        android: { elevation: 10 },
      }),
    },
    closeBtn: {
      position: "absolute",
      top: scale(14),
      right: scale(14),
      padding: 4,
    },

    iconCircle: {
      width: scale(64),
      height: scale(64),
      borderRadius: scale(32),
      backgroundColor: "#DBEAFE",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: scale(16),
    },

    title: {
      textAlign: "center",
      fontSize: scale(17),
      fontWeight: "900",
      color: TC.textDark,
      marginBottom: scale(8),
    },
    sub: {
      textAlign: "center",
      fontSize: scale(12.5),
      lineHeight: scale(18),
      color: TC.muted,
      marginBottom: scale(20),
    },

    input: {
      width: "100%",
      height: vscale(48),
      borderRadius: scale(14),
      borderWidth: 1.5,
      borderColor: TC.border,
      backgroundColor: TC.inputBg,
      paddingHorizontal: scale(14),
      fontSize: scale(14),
      color: TC.textDark,
    },
    otpInput: {
      textAlign: "center",
      fontSize: scale(22),
      letterSpacing: 10,
      fontWeight: "700",
    },

    pinLabel: {
      fontSize: scale(12),
      fontWeight: "700",
      marginBottom: scale(8),
    },
    pinBoxRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: scale(12),
    },
    pinBox: {
      width: scale(52),
      height: scale(56),
      borderRadius: scale(14),
      borderWidth: 1.5,
      borderColor: TC.border,
      backgroundColor: TC.inputBg,
      textAlign: "center",
      fontSize: scale(22),
      fontWeight: "700",
      color: TC.textDark,
    },

    error: {
      color: "#DC2626",
      fontSize: scale(12),
      fontWeight: "600",
      textAlign: "center",
      marginTop: scale(8),
    },

    primaryBtn: {
      width: "100%",
      height: vscale(48),
      borderRadius: scale(14),
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: scale(16),
      ...Platform.select({
        ios: {
          shadowColor: Colors.primary,
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        android: { elevation: 5 },
      }),
    },
    primaryBtnText: {
      fontSize: scale(14),
      fontWeight: "900",
      color: "#FFFFFF",
    },

    linkBtn: {
      marginTop: scale(12),
      paddingVertical: scale(4),
    },
    linkText: {
      fontSize: scale(12),
      fontWeight: "700",
      color: Colors.primary,
    },
  });
}
