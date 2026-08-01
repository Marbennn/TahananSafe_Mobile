import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, useColors } from "../theme/colors";

type TabKey = "Domestic" | "Emergency";

type Props = {
  activeTab?: TabKey;
  onBack?: () => void;
  onTabChange?: (tab: TabKey) => void;

  onSmsAlert?: () => void;
  onCallHotline?: () => void;

  onReviewComplaint?: (payload: {
    emergencyDetail: string;
    witnessName: string;
    witnessPhone: string;
    dateText: string;
    timeText: string;
  }) => void;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateMMDDYYYY(d: Date) {
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatTime12h(d: Date) {
  let h = d.getHours();
  const m = pad2(d.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m}${ampm}`;
}

export default function EmergencyScreen({
  activeTab = "Emergency",
  onBack,
  onTabChange,
  onSmsAlert,
  onCallHotline,
  onReviewComplaint,
}: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 350;
  const now = useMemo(() => new Date(), []);

  const [detail, setDetail] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [witnessPhone, setWitnessPhone] = useState("");

  const dateText = useMemo(() => formatDateMMDDYYYY(now), [now]);
  const timeText = useMemo(() => formatTime12h(now), [now]);

  const handleReview = () => {
    onReviewComplaint?.({
      emergencyDetail: detail.trim(),
      witnessName: witnessName.trim(),
      witnessPhone: witnessPhone.trim(),
      dateText,
      timeText,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: TC.surface }]} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

      <KeyboardAvoidingView
        style={[
          styles.page,
          isCompact && styles.pageCompact,
          { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: TC.surface },
        ]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onBack ?? (() => {})}
            hitSlop={10}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={22} color={TC.heading} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: TC.heading }]}>Incident Log</Text>

          <View style={styles.headerRightSpacer} />
        </View>

        {/* Tabs */}
        <View style={styles.tabsWrap}>
          <View style={styles.tabs}>
            <Pressable
              onPress={() => onTabChange?.("Domestic")}
              style={[
                styles.tabPill,
                activeTab === "Domestic" ? styles.tabActive : styles.tabInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "Domestic" ? styles.tabTextActive : styles.tabTextInactive,
                ]}
              >
                Domestic
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onTabChange?.("Emergency")}
              style={[
                styles.tabPill,
                activeTab === "Emergency" ? styles.tabActive : styles.tabInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "Emergency" ? styles.tabTextActive : styles.tabTextInactive,
                ]}
              >
                Emergency
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          {/* Emergency detail card */}
          <View style={[styles.card, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
            <Text style={[styles.cardTitle, { color: TC.heading }]}>Emergency Detail *</Text>

            <TextInput
              value={detail}
              onChangeText={setDetail}
              placeholder="Describe the emergency"
              placeholderTextColor={TC.placeholder}
              multiline
              style={[styles.textArea, { backgroundColor: TC.surface, borderColor: TC.divider, color: TC.body }]}
              textAlignVertical="top"
            />

            <Text style={[styles.helperText, { color: TC.muted }]}>
              A brief explanation of what happened, including location, injuries, and any
              urgent threats.
            </Text>

            {/* Actions */}
            <View style={styles.actionRow}>
              <Pressable onPress={onSmsAlert ?? (() => {})} style={[styles.actionBtnLight, { borderColor: TC.primary }]}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color={TC.primary}
                />
                <Text style={[styles.actionBtnLightText, { color: TC.primary }]}>SMS Alert</Text>
              </Pressable>

              <Pressable onPress={onCallHotline ?? (() => {})} style={[styles.actionBtnLight, { borderColor: TC.primary }]}>
                <Ionicons name="call-outline" size={16} color={TC.primary} />
                <Text style={[styles.actionBtnLightText, { color: TC.primary }]}>Hotline</Text>
              </Pressable>
            </View>
          </View>

          {/* Witnesses */}
          <View style={[styles.card, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
            <Text style={[styles.cardTitle, { color: TC.heading }]}>Witnesses</Text>

            <TextInput
              value={witnessName}
              onChangeText={setWitnessName}
              placeholder="Name (optional)"
              placeholderTextColor={TC.placeholder}
              style={[styles.input, { backgroundColor: TC.surface, borderColor: TC.divider, color: TC.body }]}
            />

            <View style={{ height: 10 }} />

            <TextInput
              value={witnessPhone}
              onChangeText={setWitnessPhone}
              placeholder="Your Phone (optional)"
              placeholderTextColor={TC.placeholder}
              keyboardType={Platform.select({ ios: "number-pad", android: "phone-pad" })}
              style={[styles.input, { backgroundColor: TC.surface, borderColor: TC.divider, color: TC.body }]}
            />

            <View style={{ height: 12 }} />

            {/* Date + Time */}
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.metaLabel}>Date:</Text>
                <View style={styles.metaBox}>
                  <Text style={styles.metaValue}>{dateText}</Text>
                </View>
              </View>

              <View style={styles.col}>
                <Text style={styles.metaLabel}>Time:</Text>
                <View style={styles.metaBox}>
                  <Text style={styles.metaValue}>{timeText}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Bottom button */}
          <Pressable
            onPress={handleReview}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.92 },
              { backgroundColor: TC.actionPrimary },
            ]}
          >
            <Text style={styles.primaryBtnText}>Review Complaint</Text>
          </Pressable>

          <View style={{ height: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ✅ Use colors that exist in your Colors file:
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  page: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  pageCompact: {
    paddingHorizontal: 12,
  },

  header: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: Colors.heading,
  },
  headerRightSpacer: {
    width: 36,
    height: 36,
  },

  tabsWrap: {
    alignItems: "center",
    marginBottom: 10,
  },
  tabs: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    padding: 4,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tabPill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabInactive: {
    backgroundColor: "transparent",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#fff",
  },
  tabTextInactive: {
    color: Colors.muted,
  },

  scrollContent: {
    paddingBottom: 18,
    alignItems: "center",
    width: "100%",
  },

  card: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.heading,
    marginBottom: 8,
  },

  textArea: {
    minHeight: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.body,
  },
  helperText: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.muted,
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  actionBtnLight: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: "transparent",
  },
  actionBtnLightText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primary,
  },

  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.body,
  },

  twoCol: {
    flexDirection: "row",
    gap: 12,
  },
  col: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.muted,
    marginBottom: 6,
  },
  metaBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.heading,
  },

  primaryBtn: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: Colors.actionPrimary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
