// src/screens/SecurityQuestionsScreen.tsx
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { Colors } from "../theme/colors";
import { Layout } from "../theme/layout";
import { useAuthStore, SECURITY_QUESTIONS, SecurityQuestionId } from "../../store/authStore";

import LogoSvg from "../../assets/SecurityQuestionsScreen/Logo.svg";

type SecurityQuestionOption = {
  id: SecurityQuestionId;
  label: string;
};

type SecurityQuestionsScreenProps = {
  currentIndex?: number;
  totalQuestions?: number;
  onContinue?: () => void;
};

export default function SecurityQuestionsScreen({
  currentIndex = 1,
  totalQuestions = 1,
  onContinue,
}: SecurityQuestionsScreenProps) {
  const navigation = useNavigation<any>();
  const setSecurityQuestion = useAuthStore((state) => state.setSecurityQuestion);
  const isLoading = useAuthStore((state) => state.isLoading);

  // ✅ Copy readonly SECURITY_QUESTIONS to mutable array
  const questionOptions: SecurityQuestionOption[] = useMemo(
    () => [...SECURITY_QUESTIONS],
    []
  );

  const [selectedId, setSelectedId] = useState<SecurityQuestionId>(questionOptions[0]?.id);
  const [answer, setAnswer] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedLabel =
    questionOptions.find((o) => o.id === selectedId)?.label ?? "Choose a question";

  const canContinue = selectedId && answer.trim().length > 0 && !isLoading;

  const handleContinue = async () => {
    if (!canContinue) return;

    try {
      const result = await setSecurityQuestion({
        securityQuestion: selectedId,
        securityAnswer: answer.trim(),
      });

      if (!result.success) {
        Alert.alert("Error", result.error || "Failed to save security question");
        return;
      }

      if (onContinue) {
        onContinue();
      } else {
        navigation.navigate("CreatePin");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Unexpected error occurred");
    }
  };

  return (
    <LinearGradient colors={Colors.gradient} style={styles.background}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" />

        <View style={styles.topBrand}>
          <LogoSvg width={160} height={34} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          keyboardVerticalOffset={0}
        >
          <View style={styles.contentBottom}>
            <View style={styles.cardStack}>
              <View style={styles.cardGhost} />

              <View style={styles.card}>
                <Text style={styles.title}>Security Questions</Text>

                <Text style={styles.progress}>
                  Question {currentIndex} of {totalQuestions} <Text style={styles.req}>*</Text>
                </Text>

                <Text style={styles.label}>Choose a question:</Text>

                <Pressable
                  onPress={() => setPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.select,
                    pressed ? { opacity: 0.95 } : null,
                  ]}
                >
                  <Text style={styles.selectText} numberOfLines={1}>
                    {selectedLabel}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#1F4D85" />
                </Pressable>

                <Text style={[styles.label, { marginTop: 12 }]}>
                  Your Answer: <Text style={styles.req}>*</Text>
                </Text>

                <TextInput
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="Enter your answer"
                  placeholderTextColor="#9AA6B2"
                  style={styles.input}
                  autoCapitalize="words"
                  returnKeyType="done"
                />

                <Pressable
                  onPress={handleContinue}
                  disabled={!canContinue}
                  style={({ pressed }) => [
                    styles.btnOuter,
                    !canContinue ? styles.btnOuterDisabled : null,
                    pressed && canContinue ? { opacity: 0.92 } : null,
                  ]}
                >
                  <LinearGradient
                    colors={
                      canContinue
                        ? ["#0E5FA8", "#0B4B86", "#083A69"]
                        : ["#9FB2C6", "#8FA4B9", "#8299AF"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.btn}
                  >
                    <Text style={styles.btnText}>
                      {isLoading ? "Saving..." : "Continue"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>

        <Modal
          visible={pickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerOpen(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setPickerOpen(false)}
          >
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <Text style={styles.modalTitle}>Choose a question</Text>

              {questionOptions.map((opt) => {
                const active = opt.id === selectedId;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setSelectedId(opt.id);
                      setPickerOpen(false);
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
                      <Ionicons name="checkmark" size={18} color="#0B4B86" />
                    ) : null}
                  </Pressable>
                );
              })}

              <Pressable
                onPress={() => setPickerOpen(false)}
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

/* 🔽 STYLES UNCHANGED */
const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: { flex: 1 },
  safe: { flex: 1 },
  contentBottom: { flex: 1, justifyContent: "flex-end" },
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
  progress: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
  },
  req: { color: "#EF4444", fontWeight: "800" },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.muted,
    marginBottom: 6,
  },
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
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D6DEE7",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    fontSize: 12.5,
    color: "#111827",
    marginBottom: 18,
  },
  btnOuter: {
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
