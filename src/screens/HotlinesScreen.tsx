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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors } from "../theme/colors";

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

export default function HotlinesScreen({
  onTabChange,
  initialTab = "Inbox", // Inbox = Hotlines
}: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const [query, setQuery] = useState("");

  // ✅ MATCH HomeScreen nav sizing exactly
  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  // ✅ Same idea as HomeScreen so content sits nicely above navbar
  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + 6;

  const sections: HotlineSection[] = useMemo(
    () => [
      {
        title: "Philippine Emergency Hotlines",
        items: [
          { number: "911", label: "National Emergency Hotline" },
          { number: "117", label: "Philippine National Police (PNP)" },
          { number: "143", label: "Philippine Red Cross (PRC)" },
          { number: "(02) 8426-0219", label: "Bureau of Fire Protection (BFP)" },
          { number: "(02) 8527-3877", label: "Philippine Coast Guard (PCG)" },
        ],
      },
      {
        title: "Municipal Hotlines",
        items: [
          { number: "098786543210", label: "Example Hotline" },
          { number: "098786543210", label: "Example Hotline" },
        ],
      },
      {
        title: "Barangay Hotlines",
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
        items: sec.items.filter((h) =>
          `${h.number} ${h.label}`.toLowerCase().includes(q)
        ),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [query, sections]);

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  return (
    // ✅ MATCH HomeScreen: only top safe area; navbar handles bottom inset itself
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <Text style={styles.title}>Hotlines</Text>
        </View>

        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#9AA4B2" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor="#9AA4B2"
              style={styles.searchInput}
              returnKeyType="search"
            />
          </View>

          <Pressable
            onPress={() => Alert.alert("Filters", "Filter options coming soon.")}
            style={({ pressed }) => [
              styles.filterBtn,
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
            hitSlop={10}
          >
            <Ionicons name="options-outline" size={18} color="#9AA4B2" />
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
        >
          {filteredSections.map((sec) => (
            <View key={sec.title} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{sec.title}</Text>
              </View>

              {sec.items.map((h, idx) => (
                <View key={`${h.number}-${idx}`} style={styles.card}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardNumber}>{h.number}</Text>
                    <Text style={styles.cardLabel}>{h.label}</Text>
                  </View>

                  <Pressable
                    onPress={() => callNumber(h.number)}
                    style={({ pressed }) => [
                      styles.callBtn,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                    hitSlop={10}
                  >
                    <Ionicons name="call" size={18} color={Colors.primary} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
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
          centerLabel="Incident Log"
        />
      </View>
    </SafeAreaView>
  );
}

const BG = "#F6F8FC";
const BORDER = "#E7EEF7";
const NAVY = "#0A2E57";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  page: { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2A37",
  },

  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBox: {
    flex: 1,
    height: 36,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
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
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 2,
  },

  section: { marginBottom: 10 },
  sectionHeader: {
    height: 22,
    borderRadius: 11,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionHeaderText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: { flex: 1, paddingRight: 10 },
  cardNumber: { fontSize: 14, fontWeight: "900", color: "#111827" },
  cardLabel: { marginTop: 2, fontSize: 10, fontWeight: "600", color: "#6B7280" },

  callBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F2F6FF",
    alignItems: "center",
    justifyContent: "center",
  },
});
