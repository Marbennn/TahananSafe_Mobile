// src/screens/HotlinesScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Linking,
  Platform,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors, useColors } from "../theme/colors";

type Hotline = {
  number: string;
  label: string;
};

type HotlineSection = {
  title: string;
  items: Hotline[];
};

type Props = {
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
  onQuickExit?: () => void;
};

function cleanTel(num: string) {
  return num.replace(/[^\d+]/g, "");
}

async function callNumber(num: string) {
  const cleaned = cleanTel(num);

  if (Platform.OS === "web") {
    Alert.alert("Call not supported", "Calling is not supported on web.");
    return;
  }

  const url = `tel:${cleaned}`;
  const can = await Linking.canOpenURL(url);

  if (!can) {
    Alert.alert("Cannot place call", `Your device cannot call: ${num}`);
    return;
  }

  await Linking.openURL(url);
}

// Reimagined palette (still harmonious with your app)
const BG = "#F6F8FC";
const SURFACE = "#FFFFFF";
const BORDER = "#E7EEF7";
const TEXT = "#111827";
const MUTED = "#6B7280";
const SUBTLE = "#9AA4B2";
const ACCENT_SOFT = "#F2F6FF";

export default function HotlinesScreen({
  onTabChange,
  onQuickExit,
  initialTab = "Inbox", // Inbox = Hotlines
}: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // ===== Responsive scaling helpers =====
  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  // Sizes
  const iconSize = scale(20);
  const callIconSize = scale(18);

  const SEARCH_H = vscale(46);
  const styles = useMemo(() => makeStyles(scale, vscale, { SEARCH_H }), [width, height]);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState("");

  // ✅ MATCH HomeScreen nav sizing exactly
  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 68;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + 6;

  const sections: HotlineSection[] = useMemo(
    () => [
      {
        title: "Philippine Emergency",
        items: [
          { number: "911", label: "National Emergency Hotline" },
          { number: "117", label: "Philippine National Police (PNP)" },
          { number: "143", label: "Philippine Red Cross (PRC)" },
          { number: "(02) 8426-0219", label: "Bureau of Fire Protection (BFP)" },
          { number: "(02) 8527-3877", label: "Philippine Coast Guard (PCG)" },
        ],
      },
      {
        title: "Municipal",
        items: [
          { number: "098786543210", label: "Example Hotline" },
          { number: "098786543210", label: "Example Hotline" },
        ],
      },
      {
        title: "Barangay",
        items: [
          { number: "098786543210", label: "Example Hotline" },
          { number: "098786543210", label: "Example Hotline" },
        ],
      },
    ],
    []
  );

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;

    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((h) => `${h.number} ${h.label}`.toLowerCase().includes(q)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [query, sections]);

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: TC.screenBg }]} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

      <View style={[styles.page, { backgroundColor: TC.screenBg }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: TC.textDark }]}>Hotlines</Text>
          <Text style={[styles.subtitle, { color: TC.muted }]}>Quick-dial emergency and local contacts</Text>
        </View>

        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
            <Ionicons name="search-outline" size={iconSize} color={TC.placeholder} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search hotlines"
              placeholderTextColor={TC.placeholder}
              style={[styles.searchInput, { color: TC.textDark }]}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
        >
          {filteredSections.map((sec) => (
            <View key={sec.title} style={styles.section}>
              {/* Minimal section header */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: TC.muted }]}>{sec.title}</Text>
                <View style={[styles.sectionLine, { backgroundColor: TC.divider }]} />
              </View>

              {sec.items.map((h, idx) => (
                <View key={`${h.number}-${idx}`} style={[styles.card, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
                  <View style={[styles.leftIcon, { backgroundColor: TC.chipBg }]}>
                    <Ionicons name="call-outline" size={scale(18)} color={TC.primary} />
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={[styles.cardNumber, { color: TC.textDark }]} numberOfLines={1}>
                      {h.number}
                    </Text>
                    <Text style={[styles.cardLabel, { color: TC.muted }]} numberOfLines={2}>
                      {h.label}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => callNumber(h.number)}
                    style={({ pressed }) => [styles.callPill, { backgroundColor: TC.chipBg, borderColor: TC.divider }, pressed && { transform: [{ scale: 0.98 }] }]}
                    hitSlop={10}
                  >
                    <Ionicons name="call" size={callIconSize} color={TC.primary} />
                    <Text style={[styles.callText, { color: TC.primary }]}>Call</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))}

          {/* Empty state */}
          {filteredSections.length === 0 && (
            <View style={[styles.emptyWrap, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
              <Ionicons name="search-outline" size={scale(34)} color={TC.placeholder} />
              <Text style={[styles.emptyTitle, { color: TC.textDark }]}>No results</Text>
              <Text style={[styles.emptyText, { color: TC.muted }]}>Try searching by number or label.</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom nav */}
        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          centerLabel="Services"
          fabQuickActions
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={() => handleTab("Incident")}
          onQuickExit={onQuickExit}
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number,
  dims: { SEARCH_H: number }
) {
  const { SEARCH_H } = dims;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    header: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(8),
      paddingBottom: vscale(6),
    },
    title: {
      fontSize: scale(28),
      fontWeight: "900",
      color: TEXT,
      letterSpacing: 0.2,
    },
    // ✅ unbold regular text
    subtitle: {
      marginTop: vscale(4),
      fontSize: scale(13),
      fontWeight: "400",
      color: MUTED,
    },

    searchRow: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(10),
      paddingBottom: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
    },
    searchBox: {
      flex: 1,
      height: SEARCH_H,
      backgroundColor: SURFACE,
      borderRadius: Math.round(SEARCH_H / 2),
      borderWidth: 1,
      borderColor: BORDER,
      paddingHorizontal: scale(14),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
    },
    // ✅ unbold regular text
    searchInput: {
      flex: 1,
      fontSize: scale(15),
      fontWeight: "400",
      color: TEXT,
      paddingVertical: 0,
    },

    content: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
    },

    section: { marginBottom: vscale(16) },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
      marginBottom: vscale(10),
    },
    // ✅ unbold regular text
    sectionTitle: {
      fontSize: scale(13),
      fontWeight: "400",
      color: "#334155",
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    sectionLine: {
      flex: 1,
      height: 1,
      backgroundColor: BORDER,
      marginTop: 1,
    },

    card: {
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: scale(14),
      paddingVertical: vscale(12),
      paddingHorizontal: scale(12),
      marginBottom: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
    },

    leftIcon: {
      width: scale(38),
      height: scale(38),
      borderRadius: scale(12),
      backgroundColor: ACCENT_SOFT,
      alignItems: "center",
      justifyContent: "center",
    },

    cardBody: {
      flex: 1,
      paddingRight: scale(6),
    },
    // ✅ unbold regular text (number is not a label)
    cardNumber: {
      fontSize: scale(17),
      fontWeight: "400",
      color: TEXT,
    },
    // ✅ KEEP labels bold
    cardLabel: {
      marginTop: vscale(4),
      fontSize: scale(13),
      fontWeight: "900",
      color: MUTED,
      lineHeight: scale(18),
    },

    callPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(6),
      paddingHorizontal: scale(12),
      height: scale(36),
      borderRadius: scale(999),
      backgroundColor: ACCENT_SOFT,
      borderWidth: 1,
      borderColor: "#DDE7FF",
    },
    // ✅ KEEP label bold
    callText: {
      fontSize: scale(13),
      fontWeight: "900",
      color: Colors.primary,
      letterSpacing: 0.2,
    },

    emptyWrap: {
      marginTop: vscale(26),
      alignItems: "center",
      paddingHorizontal: scale(16),
      paddingVertical: vscale(18),
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: scale(14),
    },
    // ✅ unbold regular text
    emptyTitle: {
      marginTop: vscale(10),
      fontSize: scale(16),
      fontWeight: "400",
      color: TEXT,
    },
    // ✅ unbold regular text
    emptyText: {
      marginTop: vscale(6),
      fontSize: scale(13),
      fontWeight: "400",
      color: MUTED,
      textAlign: "center",
      lineHeight: scale(18),
    },
  });
}
