// src/screens/PersonalDetailsScreen.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";

import PersonalDetailsForm from "../components/PersonalDetailsScreen/PersonalDetailsForm";
import { useAuthStore, PersonalInfoPayload } from "../store/authStore";

/**
 * Props are REQUIRED for AuthFlowShell navigation.
 * Do NOT remove — this is what advances the flow.
 */
type Props = {
  onBack?: () => void; // handled by AuthFlowShell header
  onSubmit?: () => void; // 🚀 MUST be called to go next screen
  progressActiveCount?: 1 | 2 | 3; // handled by AuthFlowShell header
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const BLUE = "#1D4ED8";

export default function PersonalDetailsScreen({ onSubmit }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Scaling for responsive design
  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  // Zustand store
  const { user, updatePersonalInfo, isLoading } = useAuthStore();

  // State initialized from user store (like initialValues)
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [dob, setDob] = useState(user?.dateOfBirth ?? "");
  const [contactNumber, setContactNumber] = useState(user?.contactNumber ?? "");
  const [gender, setGender] = useState<"male" | "female">(
    (user?.gender as "male" | "female") ?? "male",
  );

  // Update form state when user changes (like refreshing from backend)
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
      setDob(user.dateOfBirth ?? "");
      setContactNumber(user.contactNumber ?? "");
      setGender((user.gender as "male" | "female") ?? "male");
    }
  }, [user]);

  const canContinue =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    dob.trim().length > 0 &&
    contactNumber.trim().length > 0 &&
    (gender === "male" || gender === "female");

  const handleContinue = async () => {
    if (!canContinue || isLoading) {
      Alert.alert("Required", "Please complete all fields.");
      return;
    }

    const payload: PersonalInfoPayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dob.trim(),
      contactNumber: contactNumber.trim(),
      gender,
    };

    try {
      const response = await updatePersonalInfo(payload);

      if (!response.success) {
        Alert.alert("Error", response.error || "Failed to save details.");
        return;
      }

      // ✅ SUCCESS → ADVANCE AUTH FLOW
      // Do NOT block with alerts
      onSubmit?.();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Something went wrong.");
    }
  };

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.body}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.page}>
              <View style={styles.titleBlock}>
                <Text style={styles.screenTitle}>Enter Your Details</Text>
                <Text style={styles.screenSub}>
                  Enter your personal information. This will be kept{"\n"}
                  private and secure.
                </Text>
              </View>

              <PersonalDetailsForm
                scale={scale}
                vscale={vscale}
                styles={styles}
                firstName={firstName}
                lastName={lastName}
                dob={dob}
                contactNumber={contactNumber}
                gender={gender}
                setFirstName={setFirstName}
                setLastName={setLastName}
                setDob={setDob}
                setContactNumber={setContactNumber}
                setGender={setGender}
                activeBlue={BLUE}
              />
            </View>
          </ScrollView>

          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom, vscale(12)) },
            ]}
          >
            <Pressable
              onPress={handleContinue}
              disabled={!canContinue || isLoading}
              hitSlop={10}
              style={({ pressed }) => [
                styles.ctaOuter,
                (!canContinue || isLoading) && { opacity: 0.55 },
                pressed && canContinue && !isLoading
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
                    {isLoading ? "Saving..." : "Continue"}
                  </Text>
                </LinearGradient>
              </View>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number,
) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1, backgroundColor: "#FFFFFF" },

    body: { flex: 1 },

    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: scale(22),
      paddingTop: vscale(6),
      paddingBottom: vscale(14),
    },

    page: { flexGrow: 1 },

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
    fieldBlock: { marginBottom: vscale(14) },

    label: {
      marginBottom: vscale(8),
      fontSize: scale(13),
      fontWeight: "700",
      color: Colors.text,
    },

    input: {
      height: vscale(50),
      borderRadius: scale(14),
      paddingHorizontal: scale(14),
      borderWidth: 1.4,
      backgroundColor: "#FFFFFF",
      fontSize: scale(14),
      color: Colors.text,
    },

    inputIdle: { borderColor: "#E5E7EB" },
    inputFocused: { borderColor: "#1D4ED8" },

    select: {
      height: vscale(50),
      borderRadius: scale(14),
      paddingHorizontal: scale(14),
      borderWidth: 1.4,
      borderColor: "#E5E7EB",
      backgroundColor: "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    selectText: {
      flex: 1,
      paddingRight: scale(10),
      fontSize: scale(14),
      color: Colors.placeholder,
    },

    bottomBar: {
      paddingHorizontal: scale(22),
      paddingTop: vscale(10),
      backgroundColor: "#FFFFFF",
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

    ctaInnerClip: { borderRadius: scale(14), overflow: "hidden" },

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

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      paddingHorizontal: scale(18),
    },

    modalSheet: {
      backgroundColor: "#FFFFFF",
      borderRadius: scale(16),
      padding: scale(14),
      maxHeight: "70%",
    },

    modalTitle: {
      fontSize: scale(14),
      fontWeight: "800",
      color: "#111827",
      marginBottom: vscale(10),
    },

    modalItem: {
      paddingVertical: vscale(10),
      paddingHorizontal: scale(10),
      borderRadius: scale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    modalItemActive: { backgroundColor: "rgba(29, 78, 216, 0.08)" },

    modalItemText: {
      color: "#111827",
      fontSize: scale(13),
      flex: 1,
      paddingRight: scale(10),
    },

    modalItemTextActive: { fontWeight: "800", color: "#1D4ED8" },

    modalCancel: {
      marginTop: vscale(10),
      paddingVertical: vscale(10),
      alignItems: "center",
      borderRadius: scale(12),
      backgroundColor: "#F3F4F6",
    },

    modalCancelText: { fontWeight: "800", color: "#111827" },
  });
}
