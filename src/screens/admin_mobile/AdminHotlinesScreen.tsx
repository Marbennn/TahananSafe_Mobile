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
import BottomNavBar, { TabKey } from "../../components/BottomNavBar";
import { Colors, useColors } from "../../theme/colors";

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
  onBack?: () => void;
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
  initialTab = "Inbox", // Inbox = Hotlines
}: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // ===== Responsive scaling helpers =====
  const wScale = Math.min(Math.max(Math.min(width / 375, height / 700), 0.86), 1.2);
  const hScale = Math.min(Math.max(height / 812, 0.78), 1.12);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  // Sizes
  const iconSize = scale(20);
  const callIconSize = scale(18);

  const SEARCH_H = vscale(46);
  const FILTER_SIZE = vscale(46);

  const styles = useMemo(
    () => makeStyles(scale, vscale, { SEARCH_H, FILTER_SIZE }),
    [width, height]
  );

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState("");

  // ✅ MATCH HomeScreen nav sizing exactly
  const NAV_BASE_HEIGHT = height < 500 ? 66 : 78;
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  const CONTENT_BOTTOM_PAD =
    Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + 6;

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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} />

      <View style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Hotlines</Text>
          <Text style={styles.subtitle}>Quick-dial emergency and local contacts</Text>
        </View>

        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={iconSize} color={SUBTLE} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search hotlines"
              placeholderTextColor={SUBTLE}
              style={styles.searchInput}
              returnKeyType="search"
            />
          </View>

          <Pressable
            onPress={() => Alert.alert("Filters", "Filter options coming soon.")}
            style={({ pressed }) => [styles.filterBtn, pressed && { transform: [{ scale: 0.98 }] }]}
            hitSlop={10}
          >
            <Ionicons name="options-outline" size={iconSize} color={SUBTLE} />
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {filteredSections.map((sec) => (
            <View key={sec.title} style={styles.section}>
              {/* Minimal section header */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{sec.title}</Text>
                <View style={styles.sectionLine} />
              </View>

              {sec.items.map((h, idx) => (
                <View key={`${h.number}-${idx}`} style={styles.card}>
                  <View style={styles.leftIcon}>
                    <Ionicons name="call-outline" size={scale(18)} color={Colors.primary} />
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardNumber} numberOfLines={1}>
                      {h.number}
                    </Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>
                      {h.label}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => callNumber(h.number)}
                    style={({ pressed }) => [styles.callPill, pressed && { transform: [{ scale: 0.98 }] }]}
                    hitSlop={10}
                  >
                    <Ionicons name="call" size={callIconSize} color={Colors.primary} />
                    <Text style={styles.callText}>Call</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))}

          {/* Empty state */}
          {filteredSections.length === 0 && (
            <View style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={scale(34)} color={SUBTLE} />
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptyText}>Try searching by number or label.</Text>
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
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={() => handleTab("Incident")}
          centerLabel="Services"
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number,
  dims: { SEARCH_H: number; FILTER_SIZE: number }
) {
  const { SEARCH_H, FILTER_SIZE } = dims;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    header: {
      width: "100%",
      maxWidth: 760,
      alignSelf: "center",
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
      width: "100%",
      maxWidth: 760,
      alignSelf: "center",
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
      minWidth: 0,
      fontSize: scale(15),
      fontWeight: "400",
      color: TEXT,
      paddingVertical: 0,
    },
    filterBtn: {
      width: FILTER_SIZE,
      height: FILTER_SIZE,
      borderRadius: Math.round(FILTER_SIZE / 2),
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: "center",
      justifyContent: "center",
    },

    content: {
      width: "100%",
      maxWidth: 760,
      alignSelf: "center",
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
