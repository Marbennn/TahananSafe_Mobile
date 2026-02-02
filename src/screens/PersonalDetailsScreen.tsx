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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "../theme/colors";
import { Layout } from "../theme/layout";

// ✅ Reuse your logo (same as Login/SecurityQuestions)
import LogoSvg from "../../assets/SecurityQuestionsScreen/Logo.svg";

import { useAuthStore, PersonalInfoPayload } from "../../store/authStore";

import { useNavigation } from "@react-navigation/native";

type GenderOption = {
  id: "male" | "female";
  label: string;
};

export default function PersonalDetailsScreen() {
  const navigation = useNavigation<any>();

  const genderOptions: GenderOption[] = useMemo(
    () => [
      { id: "male", label: "Male" },
      { id: "female", label: "Female" },
    ],
    [],
  );

  const { user, updatePersonalInfo, token } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [middleName, setMiddleName] = useState(user?.middleName ?? "");
  const [suffix, setSuffix] = useState(user?.suffix ?? "");
  const [age, setAge] = useState(user?.age ?? "");
  const [gender, setGender] = useState<"male" | "female">(
    user?.gender ?? "male",
  );

  // ✅ IMPORTANT: don't use "09*********" if you're validating digits
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? "");

  const [genderOpen, setGenderOpen] = useState(false);

  const selectedGenderLabel =
    genderOptions.find((g) => g.id === gender)?.label ?? "Male/Female";

  const toDigits = (v: string) => v.replace(/[^\d]/g, "");

  // ✅ PH validation:
  // 09xxxxxxxxx (11 digits) OR 63xxxxxxxxxx (12 digits) OR 9xxxxxxxxx (10 digits)
  const isPhoneValid = (value: string) => {
    const digits = toDigits(value);
    if (digits.startsWith("09")) return digits.length === 11;
    if (digits.startsWith("63")) return digits.length === 12;
    if (digits.startsWith("9")) return digits.length === 10;
    return false;
  };

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    middleName.trim().length > 0 &&
    age.trim().length > 0 &&
    isPhoneValid(phoneNumber) &&
    (gender === "male" || gender === "female");

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert("Required", "Please complete all required fields.");
      return;
    }

    if (!token) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }

    const payload: PersonalInfoPayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName.trim(),
      suffix: suffix.trim() || undefined,
      age: age.trim(),
      gender,
      phoneNumber: toDigits(phoneNumber), // ✅ digits only
    };

    // ✅ Let App.tsx decide where to go next
    setLoading(true);
    const {
      success,
      user: updatedUser,
      error,
    } = await updatePersonalInfo(payload);
    setLoading(false);

    if (success) {
      Alert.alert("Success", "Personal details updated successfully.", [
        {
          text: "OK",
          onPress: () => navigation.navigate("Security"),
        },
      ]);
    } else {
      Alert.alert("Error", error || "Failed to update personal details.");
    }
  };

  return (
    <LinearGradient colors={Colors.gradient} style={styles.background}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" />

        {/* Header (same placement as other screens) */}
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
                <Text style={styles.title}>Personal Details</Text>

                {/* First Name */}
                <Text style={styles.label}>
                  First Name <Text style={styles.req}>*</Text>
                </Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor="#9AA6B2"
                  style={styles.input}
                  autoCapitalize="words"
                />
                {/* Last Name */}
                <Text style={styles.label}>
                  Last Name <Text style={styles.req}>*</Text>
                </Text>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor="#9AA6B2"
                  style={styles.input}
                  autoCapitalize="words"
                />

                {/* Middle + Suffix row */}
                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.label}>
                      Middle Name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      value={middleName}
                      onChangeText={setMiddleName}
                      placeholder="Middle"
                      placeholderTextColor="#9AA6B2"
                      style={styles.input}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.col}>
                    <Text style={styles.label}>
                      Suffix <Text style={styles.optional}>(optional)</Text>
                    </Text>
                    <TextInput
                      value={suffix}
                      onChangeText={setSuffix}
                      placeholder="Jr / Sr"
                      placeholderTextColor="#9AA6B2"
                      style={styles.input}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                {/* Age + Gender row */}
                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.label}>
                      Age <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      value={age}
                      onChangeText={(t) => setAge(t.replace(/[^\d]/g, ""))}
                      placeholder="20"
                      placeholderTextColor="#9AA6B2"
                      style={styles.input}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>

                  <View style={styles.col}>
                    <Text style={styles.label}>
                      Gender <Text style={styles.req}>*</Text>
                    </Text>
                    <Pressable
                      onPress={() => setGenderOpen(true)}
                      style={({ pressed }) => [
                        styles.select,
                        pressed ? { opacity: 0.95 } : null,
                      ]}
                    >
                      <Text style={styles.selectText} numberOfLines={1}>
                        {selectedGenderLabel}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#1F4D85" />
                    </Pressable>
                  </View>
                </View>

                {/* Phone Number */}
                <Text style={styles.label}>
                  Phone Number <Text style={styles.req}>*</Text>
                </Text>
                <TextInput
                  value={phoneNumber}
                  onChangeText={(t) => setPhoneNumber(toDigits(t))}
                  placeholder="09XXXXXXXXX"
                  placeholderTextColor="#9AA6B2"
                  style={styles.input}
                  keyboardType="phone-pad"
                  maxLength={12}
                />

                {/* Submit */}
                <Pressable
                  onPress={handleSubmit}
                  disabled={!canSubmit || loading}
                  style={({ pressed }) => [
                    styles.btnOuter,
                    !canSubmit ? styles.btnOuterDisabled : null,
                    pressed && canSubmit ? { opacity: 0.92 } : null,
                  ]}
                >
                  <LinearGradient
                    colors={
                      canSubmit
                        ? ["#0E5FA8", "#0B4B86", "#083A69"]
                        : ["#9FB2C6", "#8FA4B9", "#8299AF"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.btn}
                  >
                    <Text style={styles.btnText}>
                      {loading ? "Submitting..." : "Submit"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Gender modal */}
        <Modal
          visible={genderOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setGenderOpen(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setGenderOpen(false)}
          >
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
                    {active && (
                      <Ionicons name="checkmark" size={18} color="#0B4B86" />
                    )}
                  </Pressable>
                );
              })}

              <Pressable
                onPress={() => setGenderOpen(false)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "flex-end" },
  topBrand: { alignItems: "center", paddingTop: 10, paddingBottom: 8 },
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
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.muted,
    marginBottom: 6,
  },
  req: { color: "#EF4444", fontWeight: "800" },
  optional: { color: "#9AA6B2", fontWeight: "700" },
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1.3,
    borderColor: "#2F6FB1",
    backgroundColor: "#F7FBFF",
    paddingHorizontal: 12,
    fontSize: 12.5,
    color: "#111827",
    marginBottom: 12,
  },
  row: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  select: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1.3,
    borderColor: "#2F6FB1",
    backgroundColor: "#F7FBFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  selectText: { flex: 1, paddingRight: 10, fontSize: 12.5, color: "#4B5563" },
  btnOuter: {
    marginTop: 6,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#083A69",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  btnOuterDisabled: { shadowOpacity: 0, elevation: 0 },
  btn: {
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  modalItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalItemActive: { backgroundColor: "rgba(11, 75, 134, 0.08)" },
  modalItemText: { color: "#111827", fontSize: 13, flex: 1, paddingRight: 10 },
  modalItemTextActive: { fontWeight: "800", color: "#0B4B86" },
  modalCancel: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  modalCancelText: { fontWeight: "800", color: "#111827" },
});
