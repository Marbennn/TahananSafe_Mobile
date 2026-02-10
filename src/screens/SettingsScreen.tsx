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
  useWindowDimensions,
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

const BG = "#F5FAFE";

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
  const { width, height } = useWindowDimensions();

  // ===== Responsive scaling helpers =====
  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  // icon sizes (numbers kept OUTSIDE styles)
  const iconSize = scale(22);

  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);

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

  const screenBg = C.screenBg ?? C.background ?? BG;
  const surface = C.surface ?? C.card ?? "#FFFFFF";
  const textDark = "#1F2A37";
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
        {/* ✅ FIX GAP: remove extra paddingTop using insets.top */}
        <View style={styles.topBar}>
          <Text style={[styles.topTitle, { color: textDark }]}>Settings</Text>
        </View>

        {/* Search row */}
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBox,
              { borderColor: divider, backgroundColor: surface },
            ]}
          >
            <Ionicons name="search-outline" size={iconSize} color={muted} />
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
                    <Ionicons name="chevron-forward" size={iconSize} color={primary} />
                  </Pressable>

                  {idx !== filtered1.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: divider }]} />
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
                    <Ionicons name="chevron-forward" size={iconSize} color={primary} />
                  </Pressable>

                  {idx !== filtered2.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: divider }]} />
                  )}
                </React.Fragment>
              ))}
            </View>
          )}

          {/* Logout */}
          <View style={{ alignItems: "center", marginTop: vscale(16) }}>
            <Pressable
              onPress={onLogout}
              style={[
                styles.logoutBtn,
                { borderColor: divider, backgroundColor: surface },
              ]}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            >
              <Ionicons name="log-out-outline" size={iconSize} color={primary} />
              <Text style={[styles.logoutText, { color: primary }]}>Log out</Text>
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

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const BORDER = "#E7EEF7";
  const SEARCH_H = vscale(44);
  const BTN_SIZE = vscale(44);
  const ROW_H = vscale(54);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    topBar: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
      paddingBottom: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    topTitle: {
      fontSize: scale(28),
      fontWeight: "900",
    },

    quickExitBtn: {
      width: BTN_SIZE,
      height: BTN_SIZE,
      borderRadius: Math.round(BTN_SIZE / 2),
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
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
      paddingBottom: vscale(10),
    },
    searchBox: {
      height: SEARCH_H,
      borderRadius: Math.round(SEARCH_H / 2),
      borderWidth: 1,
      paddingHorizontal: scale(14),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
    },
    searchInput: {
      flex: 1,
      fontSize: scale(16),
      color: "#111827",
      paddingVertical: 0,
      fontWeight: "600",
    },

    content: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(4),
    },

    card: {
      borderRadius: scale(16),
      borderWidth: 1,
      marginTop: vscale(12),
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
      height: ROW_H,
      paddingHorizontal: scale(16),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rowText: { fontSize: scale(16), fontWeight: "800" },
    divider: { height: StyleSheet.hairlineWidth, opacity: 1 },

    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
      paddingHorizontal: scale(18),
      height: vscale(44),
      borderRadius: vscale(22),
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
    logoutText: { fontSize: scale(16), fontWeight: "800" },

    // keep for compatibility if you still use BORDER constant above
    _border: { borderColor: BORDER },
  });
}
