// src/screens/PersonalDetailsScreen.tsx
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";

type GenderOption = {
  id: "male" | "female";
  label: string;
};

type SubmitPayload = {
  firstName: string;
  lastName: string;
  dob: string; // MM / DD / YYYY
  contactNumber: string;
  gender: "male" | "female";
};

type Props = {
  initialValues?: Partial<SubmitPayload>;
  onBack?: () => void;
  onSubmit?: (payload: SubmitPayload) => void;
  progressActiveCount?: 1 | 2 | 3; // default 2
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const BLUE = "#1D4ED8";
const BORDER_IDLE = "#E5E7EB";

export default function PersonalDetailsScreen({
  initialValues,
  onBack,
  onSubmit,
  progressActiveCount = 2,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ✅ same responsiveness pattern as SignupScreen
  const s = clamp(width / 375, 0.95, 1.45);
  const vs = clamp(height / 812, 0.95, 1.25);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const backIconSize = scale(22);
  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const genderOptions: GenderOption[] = useMemo(
    () => [
      { id: "male", label: "Male" },
      { id: "female", label: "Female" },
    ],
    []
  );

  const [firstName, setFirstName] = useState(initialValues?.firstName ?? "");
  const [lastName, setLastName] = useState(initialValues?.lastName ?? "");
  const [dob, setDob] = useState(initialValues?.dob ?? "");
  const [contactNumber, setContactNumber] = useState(
    initialValues?.contactNumber ?? ""
  );
  const [gender, setGender] = useState<"male" | "female">(
    initialValues?.gender ?? "male"
  );

  // focus states
  const [firstFocused, setFirstFocused] = useState(false);
  const [lastFocused, setLastFocused] = useState(false);
  const [dobFocused, setDobFocused] = useState(false);
  const [contactFocused, setContactFocused] = useState(false);

  const [genderOpen, setGenderOpen] = useState(false);

  const selectedGenderLabel =
    genderOptions.find((g) => g.id === gender)?.label ?? "Select your gender";

  const canContinue =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    dob.trim().length > 0 &&
    contactNumber.trim().length > 0 &&
    (gender === "male" || gender === "female");

  const handleContinue = () => {
    if (!canContinue) {
      Alert.alert("Required", "Please complete all fields.");
      return;
    }

    const payload: SubmitPayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob: dob.trim(),
      contactNumber: contactNumber.trim(),
      gender,
    };

    if (onSubmit) {
      onSubmit(payload);
      return;
    }

    Alert.alert("Saved", "Personal details saved (demo).");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ✅ Header EXACT like SignupScreen (back arrow position matches) */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={backIconSize} color="#111827" />
        </Pressable>

        <View style={styles.progressRow}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.progressSeg,
                i <= progressActiveCount ? styles.progressActive : null,
              ]}
            />
          ))}
        </View>

        <View style={styles.headerSpacer} />
      </View>

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
              {/* ✅ Title block EXACT like SignupScreen */}
              <View style={styles.titleBlock}>
                <Text style={styles.screenTitle}>Enter Your Details</Text>
                <Text style={styles.screenSub}>
                  Enter your personal information. This will be kept{"\n"}
                  private and secure.
                </Text>
              </View>

              <View style={styles.form}>
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>First Name</Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Enter your legal first name"
                    placeholderTextColor={Colors.placeholder}
                    autoCapitalize="words"
                    style={[
                      styles.input,
                      firstFocused ? styles.inputFocused : styles.inputIdle,
                    ]}
                    onFocus={() => setFirstFocused(true)}
                    onBlur={() => setFirstFocused(false)}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Last Name</Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Enter your legal last name"
                    placeholderTextColor={Colors.placeholder}
                    autoCapitalize="words"
                    style={[
                      styles.input,
                      lastFocused ? styles.inputFocused : styles.inputIdle,
                    ]}
                    onFocus={() => setLastFocused(true)}
                    onBlur={() => setLastFocused(false)}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Date of Birth</Text>
                  <TextInput
                    value={dob}
                    onChangeText={setDob}
                    placeholder="02 / 24 / 2000"
                    placeholderTextColor={Colors.placeholder}
                    keyboardType="numbers-and-punctuation"
                    style={[
                      styles.input,
                      dobFocused ? styles.inputFocused : styles.inputIdle,
                    ]}
                    onFocus={() => setDobFocused(true)}
                    onBlur={() => setDobFocused(false)}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Contact Number</Text>
                  <TextInput
                    value={contactNumber}
                    onChangeText={setContactNumber}
                    placeholder="+63 909 000 0000"
                    placeholderTextColor={Colors.placeholder}
                    keyboardType="phone-pad"
                    style={[
                      styles.input,
                      contactFocused ? styles.inputFocused : styles.inputIdle,
                    ]}
                    onFocus={() => setContactFocused(true)}
                    onBlur={() => setContactFocused(false)}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Gender</Text>
                  <Pressable
                    onPress={() => setGenderOpen(true)}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.select,
                      pressed ? { opacity: 0.95 } : null,
                    ]}
                  >
                    <Text style={styles.selectText} numberOfLines={1}>
                      {selectedGenderLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={scale(18)} color="#6B7280" />
                  </Pressable>
                </View>

                <View style={{ height: vscale(80) }} />
              </View>
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
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={genderOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGenderOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setGenderOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Select Gender</Text>

            {genderOptions.map((opt) => {
              const active = opt.id === gender;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    setGender(opt.id);
                    setGenderOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.modalItem,
                    active ? styles.modalItemActive : null,
                    pressed ? { opacity: 0.92 } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      active ? styles.modalItemTextActive : null,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark" size={scale(18)} color={BLUE} />
                  ) : null}
                </Pressable>
              );
            })}

            <Pressable onPress={() => setGenderOpen(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1, backgroundColor: "#FFFFFF" },

    // ✅ header EXACT like SignupScreen
    header: {
      paddingHorizontal: scale(18),
      paddingTop: vscale(6),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    backBtn: {
      width: scale(36),
      height: scale(36),
      alignItems: "flex-start",
      justifyContent: "center",
    },

    headerSpacer: { width: scale(36), height: scale(36) },

    progressRow: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      gap: scale(8),
      marginTop: vscale(2),
    },

    progressSeg: {
      width: scale(46),
      height: scale(3),
      borderRadius: 999,
      backgroundColor: BORDER_IDLE,
    },

    progressActive: { backgroundColor: BLUE },

    body: { flex: 1 },

    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: scale(22),
      paddingTop: vscale(6),
      paddingBottom: vscale(14),
    },

    page: { flexGrow: 1 },

    // ✅ title block EXACT like SignupScreen
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

    inputIdle: { borderColor: BORDER_IDLE },
    inputFocused: { borderColor: BLUE },

    select: {
      height: vscale(50),
      borderRadius: scale(14),
      paddingHorizontal: scale(14),
      borderWidth: 1.4,
      borderColor: BORDER_IDLE,
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

    modalItemTextActive: { fontWeight: "800", color: BLUE },

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
