// src/screens/HomeScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

export default function HomeScreen({
  onQuickExit,
  onTabChange,
  initialTab = "Home",
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTab = (key) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const isIncidentActive = activeTab === "Incident";

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top blue header */}
      <View style={styles.header} />

      {/* Main content */}
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardText}>No active incident logs</Text>
        </View>

        <Pressable
          onPress={() =>
            onQuickExit
              ? onQuickExit()
              : Alert.alert("Quick Exit", "Hiding the app…")
          }
          style={({ pressed }) => [
            styles.quickExitBtn,
            pressed && { transform: [{ scale: 0.99 }] },
          ]}
        >
          <Text style={styles.quickExitTitle}>Quick Exit</Text>
          <Text style={styles.quickExitSub}>Instantly hide the app</Text>
        </Pressable>
      </View>

      {/* Bottom navigation (like your screenshot) */}
      <View style={styles.navWrap}>
        {/* Home */}
        <NavItem
          icon="home-outline"
          label="Home"
          active={activeTab === "Home"}
          onPress={() => handleTab("Home")}
        />

        {/* Inbox */}
        <NavItem
          icon="mail-outline"
          label="Inbox"
          active={activeTab === "Inbox"}
          onPress={() => handleTab("Inbox")}
        />

        {/* Center Incident Log (floating circle) */}
        <View style={styles.centerNavItem}>
          <Pressable
            onPress={() => handleTab("Incident")}
            style={({ pressed }) => [
              styles.fab,
              isIncidentActive && styles.fabActive,
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={22}
              color={isIncidentActive ? "#FFFFFF" : Colors.primary}
            />
          </Pressable>

          <Text
            style={[
              styles.centerLabel,
              isIncidentActive && styles.centerLabelActive,
            ]}
          >
            Incident Log
          </Text>
        </View>

        {/* Ledger */}
        <NavItem
          icon="book-outline"
          label="Ledger"
          active={activeTab === "Ledger"}
          onPress={() => handleTab("Ledger")}
        />

        {/* Profile */}
        <NavItem
          icon="person-outline"
          label="Profile"
          active={activeTab === "Profile"}
          onPress={() => handleTab("Profile")}
        />
      </View>
    </SafeAreaView>
  );
}

function NavItem({ icon, label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.item} hitSlop={10}>
      <Ionicons name={icon} size={22} color={active ? Colors.primary : "#9AA4B2"} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    height: 86,
    backgroundColor: Colors.primary,
  },

  body: {
    flex: 1,
    backgroundColor: "#F6FAFF",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },

  card: {
    height: 120,
    borderRadius: 14,
    backgroundColor: "#F6FAFF",
    borderWidth: 1,
    borderColor: "#E6EEF8",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardText: {
    color: Colors.primary,
    fontSize: 12.5,
    fontWeight: "600",
  },

  quickExitBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  quickExitTitle: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "800",
    lineHeight: 18,
  },
  quickExitSub: {
    marginTop: 2,
    color: "rgba(255,255,255,0.75)",
    fontSize: 10.5,
    fontWeight: "600",
  },

  /* ✅ NAV BAR MATCHING YOUR SCREENSHOT */
  navWrap: {
    height: 78,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E7EEF7",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingBottom: 8,
  },

  item: {
    width: 70,
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    marginTop: 4,
    fontSize: 10,
    color: "#9AA4B2",
    fontWeight: "600",
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: "800",
  },

  // Center item slot (holds the floating circle + label)
  centerNavItem: {
    width: 88,
    alignItems: "center",
    justifyContent: "flex-end",
  },

  // The big circle
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    marginTop: -24, // ✅ lifts the circle above the bar like your screenshot

    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabActive: {
    backgroundColor: Colors.primary,
  },

  centerLabel: {
    fontSize: 10,
    color: "#9AA4B2",
    fontWeight: "600",
  },
  centerLabelActive: {
    color: Colors.primary,
    fontWeight: "800",
  },
});
