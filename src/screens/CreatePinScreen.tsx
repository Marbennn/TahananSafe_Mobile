// src/screens/CreatePinScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  StatusBar,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";

import PinScreenLogo from "../../assets/Logo2.svg";

type Props = {
  onContinue: (pin: string) => void;
  onBack?: () => void;
};

export default function CreatePinScreen({ onContinue, onBack }: Props) {
  const insets = useSafeAreaInsets();

  const PIN_LENGTH = 4;

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const canContinue = useMemo(() => {
    return pin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH;
  }, [pin, confirmPin]);

  const submit = () => {
    if (pin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH) {
      Alert.alert("Incomplete", `PIN must be ${PIN_LENGTH} digits.`);
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert("PIN mismatch", "Your PIN and Confirm PIN do not match.");
      return;
    }
    onContinue(pin);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={Colors.gradient} style={styles.background}>
        <StatusBar barStyle="light-content" />

        {/* ✅ SAME LOGO POSITION AS PinScreen.tsx */}
        <View style={styles.topBrand}>
          <PinScreenLogo width={150} height={150} />
        </View>

        {/* Card */}
        <View style={[styles.cardWrap, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create your Pin</Text>

            {/* Enter PIN */}
            <Text style={styles.label}>
              Enter your Pin <Text style={styles.req}>*</Text>
            </Text>
            <TextInput
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, PIN_LENGTH))}
              placeholder={"X ".repeat(PIN_LENGTH).trim()}
              placeholderTextColor="#9AA4B2"
              keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
              secureTextEntry
              maxLength={PIN_LENGTH}
              style={styles.input}
              returnKeyType="next"
            />

            {/* Confirm PIN */}
            <Text style={[styles.label, { marginTop: 12 }]}>
              Confirm your Pin <Text style={styles.req}>*</Text>
            </Text>
            <TextInput
              value={confirmPin}
              onChangeText={(t) =>
                setConfirmPin(t.replace(/\D/g, "").slice(0, PIN_LENGTH))
              }
              placeholder={"X ".repeat(PIN_LENGTH).trim()}
              placeholderTextColor="#9AA4B2"
              keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
              secureTextEntry
              maxLength={PIN_LENGTH}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={submit}
            />

            {/* Continue button */}
            <Pressable
              onPress={submit}
              disabled={!canContinue}
              style={({ pressed }) => [
                styles.btnOuter,
                !canContinue && { opacity: 0.55 },
                pressed && canContinue && { transform: [{ scale: 0.99 }] },
              ]}
            >
              <LinearGradient
                colors={["#0B5E9B", "#083B6B"]}
                style={styles.btnInner}
              >
                <Text style={styles.btnText}>Continue</Text>
              </LinearGradient>
            </Pressable>

            {onBack ? (
              <Pressable
                onPress={onBack}
                hitSlop={10}
                style={({ pressed }) => [styles.backWrap, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B5E9B" },
  background: { flex: 1 },

  // ✅ Copied from your PinScreen.tsx (logo position)
  topBrand: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
    marginBottom: 28,
  },

  cardWrap: {
    flex: 1,
    paddingHorizontal: 18,
    justifyContent: "flex-start",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  cardTitle: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 14,
  },

  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  req: { color: "#EF4444", fontWeight: "900" },

  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFD3EA",
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },

  btnOuter: {
    marginTop: 16,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(11,94,155,0.35)",
  },
  btnInner: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  backWrap: {
    marginTop: 10,
    alignItems: "center",
  },
  backText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0B5E9B",
  },
});
