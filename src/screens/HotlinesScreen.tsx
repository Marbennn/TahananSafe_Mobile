// src/screens/HotlinesScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
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
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { useColors } from "../theme/colors";

type Hotline = {
  id?: string;
  number: string;
  label: string;
  custom?: boolean;
};

type HotlineSectionKey = "custom" | "philippine" | "municipal" | "barangay";
type HotlineFilter = "all" | HotlineSectionKey;

type HotlineSection = {
  key: HotlineSectionKey;
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
const CUSTOM_HOTLINES_KEY = "@tahanansafe_custom_hotlines_v1";

export default function HotlinesScreen({
  onTabChange,
  onQuickExit,
  initialTab = "Inbox", // Inbox = Hotlines
}: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.min(width, 720);

  // Match the Reports page density without letting tablets over-scale the UI.
  const compactHeight = height < 500;
  const designWidth = Math.min(width, compactHeight ? 390 : 430);
  const wScale = Math.min(Math.max(designWidth / 375, 0.9), 1.12);
  const hScale = Math.min(Math.max(height / 812, 0.9), compactHeight ? 1 : 1.12);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);
  const compactScale = (n: number) => Math.min(scale(n), vscale(n));

  const iconSize = compactScale(18);
  const callIconSize = compactScale(23);

  const SEARCH_H = compactScale(40);
  const styles = useMemo(
    () =>
      makeStyles(scale, vscale, compactScale, {
        SEARCH_H,
        contentWidth,
        compactHeight,
        modalMaxHeight: Math.max(220, height - insets.top - insets.bottom - 32),
      }),
    [width, height, contentWidth, SEARCH_H, compactHeight, insets.top, insets.bottom]
  );

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState("");
  const [customHotlines, setCustomHotlines] = useState<Hotline[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<HotlineFilter>("all");
  const [contactLabel, setContactLabel] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_HOTLINES_KEY)
      .then((value) => {
        if (!value) return;
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) setCustomHotlines(parsed);
      })
      .catch(() => {
        Alert.alert("Unable to load contacts", "Your saved emergency contacts could not be loaded.");
      });
  }, []);

  const saveCustomHotlines = async (next: Hotline[]) => {
    await AsyncStorage.setItem(CUSTOM_HOTLINES_KEY, JSON.stringify(next));
    setCustomHotlines(next);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setContactLabel("");
    setContactNumber("");
  };

  const addCustomHotline = async () => {
    const label = contactLabel.trim();
    const number = contactNumber.trim();
    const cleaned = cleanTel(number);

    if (!label || !number) {
      Alert.alert("Missing information", "Enter a contact name and phone number.");
      return;
    }
    if (!/^\+?\d{3,15}$/.test(cleaned)) {
      Alert.alert("Invalid phone number", "Enter a valid phone number with 3 to 15 digits.");
      return;
    }

    const next = [
      ...customHotlines,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label, number, custom: true },
    ];

    try {
      await saveCustomHotlines(next);
      setQuery("");
      setSectionFilter("custom");
      closeAddModal();
    } catch {
      Alert.alert("Unable to save", "Please try adding the emergency contact again.");
    }
  };

  const removeCustomHotline = (hotline: Hotline) => {
    Alert.alert("Delete emergency contact?", `${hotline.label} will be removed from this device.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const next = customHotlines.filter((item) => item.id !== hotline.id);
            await saveCustomHotlines(next);
            if (next.length === 0) setSectionFilter("all");
          } catch {
            Alert.alert("Unable to delete", "Please try again.");
          }
        },
      },
    ]);
  };

  // ✅ MATCH HomeScreen nav sizing exactly
  const NAV_BASE_HEIGHT = compactHeight ? 66 : 78;
  const FAB_SIZE = compactHeight ? 60 : 68;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + (compactHeight ? 70 : 90);
  const fabBottom = navHeight - FAB_SIZE / 2 - (compactHeight ? 6 : 10);

  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + vscale(64);

  const sections: HotlineSection[] = useMemo(
    () => [
      ...(customHotlines.length
        ? [{ key: "custom" as const, title: "My Emergency Contacts", items: customHotlines }]
        : []),
      {
        key: "philippine",
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
        key: "municipal",
        title: "Municipal Hotlines",
        items: [
          { number: "098786543210", label: "Example Hotline" },
          { number: "098786543210", label: "Example Hotline" },
        ],
      },
      {
        key: "barangay",
        title: "Barangay Hotlines",
        items: [
          { number: "098786543210", label: "Example Hotline" },
          { number: "098786543210", label: "Example Hotline" },
        ],
      },
    ],
    [customHotlines]
  );

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visibleSections = sectionFilter === "all" ? sections : sections.filter((section) => section.key === sectionFilter);
    if (!q) return visibleSections;

    return visibleSections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((h) => `${h.number} ${h.label}`.toLowerCase().includes(q)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [query, sectionFilter, sections]);

  const filterOptions = useMemo(
    () => [
      { key: "all" as const, label: "All hotlines" },
      ...(customHotlines.length ? [{ key: "custom" as const, label: "My Emergency Contacts" }] : []),
      { key: "philippine" as const, label: "Philippine Emergency Hotlines" },
      { key: "municipal" as const, label: "Municipal Hotlines" },
      { key: "barangay" as const, label: "Barangay Hotlines" },
    ],
    [customHotlines.length]
  );

  const selectSectionFilter = (nextFilter: HotlineFilter) => {
    setSectionFilter(nextFilter);
    setShowFilterModal(false);
  };

  const openAddContact = () => {
    setShowFilterModal(false);
    setTimeout(() => setShowAddModal(true), 180);
  };

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: TC.screenBg }]} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} translucent backgroundColor="transparent" />

      <View style={[styles.page, { backgroundColor: TC.screenBg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: TC.heading }]}>Hotlines</Text>

          <View style={styles.searchRow}>
            <View style={[styles.searchBox, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
              <Ionicons name="search-outline" size={iconSize} color={TC.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor={TC.muted}
                style={[styles.searchInput, { color: TC.textDark }]}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {!!query && (
                <Pressable
                  onPress={() => setQuery("")}
                  style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.65 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Clear hotline search"
                >
                  <Ionicons name="close" size={iconSize} color={TC.muted} />
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={() => setShowFilterModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Filter hotlines and manage emergency contacts"
              style={({ pressed }) => [
                styles.filterButton,
                { backgroundColor: TC.surface, borderColor: TC.divider },
                pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Ionicons name="options-outline" size={compactScale(21)} color={TC.muted} />
              {sectionFilter !== "all" ? <View style={[styles.filterActiveDot, { backgroundColor: TC.primary }]} /> : null}
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
        >
          {filteredSections.map((sec) => (
            <View key={sec.key} style={styles.section}>
              <LinearGradient
                colors={["#06223F", "#0A3657", "#06223F"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.sectionHeader}
              >
                <Text style={styles.sectionTitle}>{sec.title}</Text>
              </LinearGradient>

              {sec.items.map((h, idx) => (
                <View key={h.id ?? `${sec.key}-${h.number}-${idx}`} style={[styles.card, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardNumber, { color: TC.textDark }]} numberOfLines={1}>
                      {h.number}
                    </Text>
                    <Text style={[styles.cardLabel, { color: TC.muted }]} numberOfLines={2}>
                      {h.label}
                    </Text>
                  </View>

                  {h.custom ? (
                    <Pressable
                      onPress={() => removeCustomHotline(h)}
                      style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.6 }]}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${h.label}`}
                    >
                      <Ionicons name="trash-outline" size={compactScale(18)} color="#DC2626" />
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => callNumber(h.number)}
                    style={({ pressed }) => [styles.callButton, pressed && { opacity: 0.6, transform: [{ scale: 0.96 }] }]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${h.label} at ${h.number}`}
                  >
                    <Ionicons name="call" size={callIconSize} color={TC.primary} />
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

        <Modal visible={showFilterModal} transparent animationType="fade" onRequestClose={() => setShowFilterModal(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFilterModal(false)} />
            <View style={[styles.filterModalCard, { backgroundColor: TC.surface }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <Text style={[styles.modalTitle, { color: TC.textDark }]}>Hotline options</Text>
                  <Text style={[styles.modalSubtitle, { color: TC.muted }]}>Choose which contacts to show.</Text>
                </View>
                <Pressable onPress={() => setShowFilterModal(false)} hitSlop={10} accessibilityLabel="Close hotline options">
                  <Ionicons name="close" size={compactScale(24)} color={TC.muted} />
                </Pressable>
              </View>

              <ScrollView style={styles.filterOptionsScroll} showsVerticalScrollIndicator={false} bounces={false}>
                {filterOptions.map((option) => {
                  const selected = sectionFilter === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => selectSectionFilter(option.key)}
                      style={({ pressed }) => [
                        styles.filterOption,
                        { borderColor: TC.divider, backgroundColor: selected ? TC.chipBg : TC.surface },
                        pressed && { opacity: 0.72 },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <Text style={[styles.filterOptionText, { color: selected ? TC.primary : TC.textDark }]} numberOfLines={1}>
                        {option.label}
                      </Text>
                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={compactScale(20)}
                        color={selected ? TC.primary : TC.muted}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable
                onPress={openAddContact}
                style={({ pressed }) => [styles.addContactOption, { backgroundColor: TC.primary }, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel="Add emergency contact"
              >
                <Ionicons name="add" size={compactScale(20)} color="#FFFFFF" />
                <Text style={styles.addContactOptionText}>Add emergency contact</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={closeAddModal}>
          <KeyboardAvoidingView
            style={styles.modalBackdrop}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeAddModal} />
            <View style={[styles.modalCard, { backgroundColor: TC.surface }]}>
              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: TC.textDark }]}>Add emergency contact</Text>
                  <Pressable onPress={closeAddModal} hitSlop={10} accessibilityLabel="Close add contact">
                    <Ionicons name="close" size={compactScale(24)} color={TC.muted} />
                  </Pressable>
                </View>
                <Text style={[styles.inputLabel, { color: TC.muted }]}>Contact name</Text>
                <TextInput
                  value={contactLabel}
                  onChangeText={setContactLabel}
                  placeholder="e.g. Mom, Barangay Office"
                  placeholderTextColor={TC.placeholder}
                  style={[styles.modalInput, { color: TC.textDark, borderColor: TC.divider }]}
                  maxLength={50}
                />
                <Text style={[styles.inputLabel, { color: TC.muted }]}>Phone number</Text>
                <TextInput
                  value={contactNumber}
                  onChangeText={setContactNumber}
                  placeholder="e.g. 09171234567"
                  placeholderTextColor={TC.placeholder}
                  style={[styles.modalInput, { color: TC.textDark, borderColor: TC.divider }]}
                  keyboardType="phone-pad"
                  maxLength={24}
                />
                <Pressable
                  onPress={addCustomHotline}
                  style={({ pressed }) => [styles.saveButton, { backgroundColor: TC.primary }, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.saveButtonText}>Save contact</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

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
  compactScale: (n: number) => number,
  dims: { SEARCH_H: number; contentWidth: number; compactHeight: boolean; modalMaxHeight: number }
) {
  const { SEARCH_H, contentWidth, compactHeight, modalMaxHeight } = dims;
  const filterOptionsMaxHeight = Math.max(96, Math.min(vscale(280), modalMaxHeight - vscale(150)));

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    header: {
      width: "100%",
      maxWidth: contentWidth,
      alignSelf: "center",
      paddingHorizontal: scale(20),
      paddingTop: vscale(compactHeight ? 10 : 18),
      paddingBottom: vscale(compactHeight ? 7 : 10),
    },
    title: {
      marginBottom: vscale(compactHeight ? 12 : 16),
      fontSize: scale(28),
      fontWeight: "700",
      color: TEXT,
      letterSpacing: -0.2,
    },
    // ✅ unbold regular text
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(9),
    },
    searchBox: {
      flex: 1,
      minWidth: 0,
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
    clearButton: {
      width: compactScale(28),
      height: compactScale(28),
      borderRadius: compactScale(14),
      alignItems: "center",
      justifyContent: "center",
    },
    filterButton: {
      width: SEARCH_H,
      height: SEARCH_H,
      flexShrink: 0,
      borderRadius: SEARCH_H / 2,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#64748B",
      shadowOpacity: 0.13,
      shadowRadius: scale(5),
      shadowOffset: { width: 0, height: vscale(2) },
      elevation: 2,
    },
    filterActiveDot: {
      position: "absolute",
      top: compactScale(6),
      right: compactScale(6),
      width: compactScale(6),
      height: compactScale(6),
      borderRadius: compactScale(3),
    },
    // ✅ unbold regular text
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: scale(14),
      fontWeight: "400",
      color: TEXT,
      paddingVertical: 0,
    },

    content: {
      width: "100%",
      maxWidth: contentWidth,
      alignSelf: "center",
      paddingHorizontal: scale(14),
      paddingTop: vscale(6),
    },

    section: { marginBottom: 0 },

    sectionHeader: {
      height: compactScale(24),
      borderRadius: compactScale(12),
      alignItems: "center",
      justifyContent: "center",
      marginBottom: vscale(6),
      overflow: "hidden",
    },
    // ✅ unbold regular text
    sectionTitle: {
      fontSize: scale(11.5),
      fontWeight: "500",
      color: "#FFFFFF",
      letterSpacing: 0.1,
    },

    card: {
      minHeight: compactScale(70),
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: compactScale(13),
      paddingVertical: vscale(12),
      paddingLeft: scale(18),
      paddingRight: scale(10),
      marginBottom: vscale(9),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(4),
    },

    cardBody: {
      flex: 1,
      minWidth: 0,
      paddingRight: scale(6),
    },
    // ✅ unbold regular text (number is not a label)
    cardNumber: {
      fontSize: scale(17),
      fontWeight: "800",
      color: TEXT,
      lineHeight: compactScale(21),
      letterSpacing: 0.2,
    },
    // ✅ KEEP labels bold
    cardLabel: {
      marginTop: vscale(3),
      fontSize: scale(11.5),
      fontWeight: "400",
      color: MUTED,
      lineHeight: compactScale(15),
    },

    callButton: {
      width: compactScale(50),
      height: compactScale(48),
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    // ✅ KEEP label bold
    deleteButton: {
      width: compactScale(42),
      height: compactScale(48),
      alignItems: "center",
      justifyContent: "center",
    },

    modalBackdrop: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: scale(20),
      backgroundColor: "rgba(3, 20, 35, 0.48)",
    },
    modalCard: {
      width: "100%",
      maxWidth: 480,
      maxHeight: modalMaxHeight,
      flexShrink: 1,
      borderRadius: scale(18),
      paddingHorizontal: scale(18),
      paddingVertical: vscale(18),
      overflow: "hidden",
      elevation: 8,
      shadowColor: "#000000",
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    modalContent: {
      flexGrow: 1,
    },
    filterModalCard: {
      width: "100%",
      maxWidth: 480,
      maxHeight: modalMaxHeight,
      flexShrink: 1,
      borderRadius: scale(18),
      paddingHorizontal: scale(18),
      paddingVertical: vscale(18),
      elevation: 8,
      shadowColor: "#000000",
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: vscale(16),
    },
    modalTitle: {
      flex: 1,
      fontSize: scale(19),
      fontWeight: "900",
    },
    modalTitleWrap: {
      flex: 1,
      minWidth: 0,
      paddingRight: scale(12),
    },
    modalSubtitle: {
      marginTop: vscale(3),
      fontSize: scale(12),
      fontWeight: "400",
    },
    filterOptionsScroll: {
      maxHeight: filterOptionsMaxHeight,
      marginBottom: vscale(4),
    },
    filterOption: {
      minHeight: compactScale(42),
      marginBottom: vscale(8),
      borderWidth: 1,
      borderRadius: compactScale(11),
      paddingHorizontal: scale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(10),
    },
    filterOptionText: {
      flex: 1,
      minWidth: 0,
      fontSize: scale(13),
      fontWeight: "700",
    },
    addContactOption: {
      minHeight: compactScale(44),
      borderRadius: compactScale(11),
      marginTop: vscale(4),
      paddingHorizontal: scale(14),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: scale(7),
    },
    addContactOptionText: {
      color: "#FFFFFF",
      fontSize: scale(13),
      fontWeight: "800",
    },
    inputLabel: {
      marginBottom: vscale(6),
      fontSize: scale(12),
      fontWeight: "700",
    },
    modalInput: {
      height: vscale(46),
      borderWidth: 1,
      borderRadius: scale(12),
      paddingHorizontal: scale(13),
      marginBottom: vscale(14),
      fontSize: scale(15),
    },
    saveButton: {
      height: vscale(46),
      borderRadius: scale(12),
      alignItems: "center",
      justifyContent: "center",
      marginTop: vscale(2),
    },
    saveButtonText: {
      color: "#FFFFFF",
      fontSize: scale(14),
      fontWeight: "900",
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
