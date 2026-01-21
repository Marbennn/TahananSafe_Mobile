// src/screens/IncidentLogConfirmationScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

// ✅ preview card
import IncidentPreviewCard, {
  IncidentPreviewData,
} from "../components/IncidentLogConfirmationScreen/IncidentPreviewCard";

type Props = {
  data: IncidentPreviewData;
  onBack?: () => void;
  onConfirm?: () => void; // ✅ will transition to IncidentLogConfirmedScreen
};

export default function IncidentLogConfirmationScreen({
  data,
  onBack,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();

  // ✅ fixed bottom button height (keep in sync with styles.confirmBtn.height)
  const BTN_H = 44;
  const BTN_TOP_PAD = 10;
  const BTN_MARGIN = 16;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </Pressable>

          <Text style={styles.topTitle}>Incident Log Preview</Text>

          <View style={{ width: 36, height: 36 }} />
        </View>

        {/* ✅ Content area + fixed bottom button */}
        <View style={styles.body}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              // ✅ ensures preview content never hides behind the fixed button
              {
                paddingBottom:
                  BTN_TOP_PAD + BTN_H + BTN_MARGIN + Math.max(insets.bottom, 10),
              },
            ]}
          >
            <IncidentPreviewCard data={data} />
          </ScrollView>

          {/* ✅ Fixed bottom button */}
          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom, 10) },
            ]}
          >
            <Pressable
              onPress={onConfirm} // ✅ App.tsx will setScreen("incident_confirmed")
              style={({ pressed }) => [
                styles.confirmBtn,
                pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 },
              ]}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const BG = "#F5FAFE";
const TEXT_DARK = "#0B2B45";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  page: { flex: 1, backgroundColor: BG },

  topBar: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT_DARK,
  },

  body: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 6,
  },

  bottomBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: BG,
  },

  confirmBtn: {
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
