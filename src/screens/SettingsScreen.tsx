// src/screens/SettingsScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors } from "../theme/colors";

type Props = {
  onAccountPress?: () => void;
  onPrivacyPress?: () => void;
  onHelpPress?: () => void;
  onTermsPress?: () => void;

  onAboutPress?: () => void;
  onContactPress?: () => void;
  onFeedbackPress?: () => void;

  onLogout?: () => void;
  onQuickExit?: () => void;

  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;

  onFabPress?: () => void;
};

type SettingItem = {
  key: string;
  label: string;
  onPress?: () => void;
};

export default function SettingsScreen({
  onAccountPress,
  onPrivacyPress,
  onHelpPress,
  onTermsPress,
  onAboutPress,
  onContactPress,
  onFeedbackPress,
  onLogout,
  onQuickExit,
  onTabChange,
  initialTab = "Settings",
  onFabPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const C = Colors as any;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState("");

  // ✅ MATCH Hotlines/Reports sizing
  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + 6;

  const group1: SettingItem[] = useMemo(
    () => [
      { key: "account", label: "Account", onPress: onAccountPress },
      { key: "privacy", label: "Privacy and Security", onPress: onPrivacyPress },
      { key: "help", label: "Help and Support", onPress: onHelpPress },
      { key: "terms", label: "Terms and Conditions", onPress: onTermsPress },
    ],
    [onAccountPress, onPrivacyPress, onHelpPress, onTermsPress]
  );

  const group2: SettingItem[] = useMemo(
    () => [
      { key: "about", label: "About", onPress: onAboutPress },
      { key: "contact", label: "Contact", onPress: onContactPress },
      { key: "feedback", label: "Feedback", onPress: onFeedbackPress },
    ],
    [onAboutPress, onContactPress, onFeedbackPress]
  );

  const q = query.trim().toLowerCase();
  const filtered1 = useMemo(
    () => (q ? group1.filter((i) => i.label.toLowerCase().includes(q)) : group1),
    [group1, q]
  );
  const filtered2 = useMemo(
    () => (q ? group2.filter((i) => i.label.toLowerCase().includes(q)) : group2),
    [group2, q]
  );

  const screenBg = C.screenBg ?? C.background ?? "#F5FAFE";
  const surface = C.surface ?? C.card ?? "#FFFFFF";
  const textDark = "#1F2A37"; // same as Hotlines
  const muted = C.mutedText ?? C.muted ?? "#9AA4B2";
  const primary = C.primary ?? Colors.primary ?? "#1E63D0";
  const divider = C.divider ?? "#E7EEF7";

  const handleTab = (tab: TabKey) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: screenBg }]}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" />

      <View style={[styles.page, { backgroundColor: screenBg }]}>
        {/* ✅ Header now matches ReportScreen top bar spacing + title weight */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <Text style={[styles.topTitle, { color: textDark }]}>Settings</Text>

          {onQuickExit ? (
            <Pressable
              onPress={onQuickExit}
              hitSlop={10}
              style={({ pressed }) => [
                styles.quickExitBtn,
                { borderColor: divider, backgroundColor: surface },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="exit-outline" size={18} color={muted} />
            </Pressable>
          ) : null}
        </View>

        {/* Search row */}
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBox,
              { borderColor: divider, backgroundColor: surface },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={muted}
              style={styles.searchInput}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: CONTENT_BOTTOM_PAD },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Group 1 */}
          {filtered1.length > 0 && (
            <View
              style={[
                styles.card,
                { borderColor: divider, backgroundColor: surface },
              ]}
            >
              {filtered1.map((item, idx) => (
                <React.Fragment key={item.key}>
                  <Pressable
                    onPress={item.onPress}
                    android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                    style={styles.row}
                  >
                    <Text style={[styles.rowText, { color: primary }]}>
                      {item.label}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={primary} />
                  </Pressable>

                  {idx !== filtered1.length - 1 && (
                    <View
                      style={[styles.divider, { backgroundColor: divider }]}
                    />
                  )}
                </React.Fragment>
              ))}
            </View>
          )}

          {/* Group 2 */}
          {filtered2.length > 0 && (
            <View
              style={[
                styles.card,
                { borderColor: divider, backgroundColor: surface },
              ]}
            >
              {filtered2.map((item, idx) => (
                <React.Fragment key={item.key}>
                  <Pressable
                    onPress={item.onPress}
                    android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                    style={styles.row}
                  >
                    <Text style={[styles.rowText, { color: primary }]}>
                      {item.label}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={primary} />
                  </Pressable>

                  {idx !== filtered2.length - 1 && (
                    <View
                      style={[styles.divider, { backgroundColor: divider }]}
                    />
                  )}
                </React.Fragment>
              ))}
            </View>
          )}

          {/* Logout */}
          <View style={{ alignItems: "center", marginTop: 14 }}>
            <Pressable
              onPress={onLogout}
              style={[
                styles.logoutBtn,
                { borderColor: divider, backgroundColor: surface },
              ]}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            >
              <Ionicons name="log-out-outline" size={18} color={primary} />
              <Text style={[styles.logoutText, { color: primary }]}>
                Log out
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Bottom nav */}
        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={onFabPress ?? (() => handleTab("Incident"))}
          centerLabel="Incident Log"
        />
      </View>
    </SafeAreaView>
  );
}

const BG = "#F5FAFE";
const BORDER = "#E7EEF7";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  page: { flex: 1, backgroundColor: BG },

  // ✅ Now matches ReportScreen's top bar feel
  topBar: {
    paddingHorizontal: 14, // ReportScreen uses 14
    paddingBottom: 10, // ReportScreen uses 10
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // ✅ Same size + “font” feel (bold like Reports)
  topTitle: {
    fontSize: 22,
    fontWeight: "900",
  },

  quickExitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
    }),
  },

  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  searchBox: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
    paddingVertical: 0,
    fontWeight: "600",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 2,
  },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 2 },
    }),
  },
  row: {
    height: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: { fontSize: 14, fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth, opacity: 1 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 1 },
    }),
  },
  logoutText: { fontSize: 14, fontWeight: "700" },
});
