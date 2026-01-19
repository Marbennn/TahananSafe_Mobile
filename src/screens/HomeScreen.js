// src/screens/HomeScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  StatusBar,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../theme/colors";

// ✅ SVGs (make sure filenames match exactly in /assets)
import Logo2 from "../../assets/Logo2.svg";
import HomeScreenQuote from "../../assets/HomeScreenQuote.svg";
import ChevronUp from "../../assets/ChevronUp.svg"; // ✅ NEW

export default function HomeScreen({
  onQuickExit,
  onTabChange,
  initialTab = "Home",
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState(initialTab);

  const NAV_BASE_HEIGHT = 78; // bar height (without safe-area)
  const FAB_SIZE = 62;

  const navHeight = NAV_BASE_HEIGHT + Math.max(insets.bottom, 10);

  // keep quote visually centered even with nav overlay
  const centerPadBottom = Math.round(navHeight * 0.55);

  /**
   * ✅ FAB: Lower it a bit more by reducing overlap
   * In your current: navHeight - FAB/2 - 10
   * Lower = smaller bottom value
   */
  const FAB_LOWER_BY = 10; // tweak 6–14 if you want more/less
  const fabBottom = navHeight - FAB_SIZE / 2 - 10 - FAB_LOWER_BY;

  const handleTab = (key) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const pressInfo = () => Alert.alert("Info", "Welcome to TahananSafe.");
  const pressFab = () => handleTab("Incident");

  // Quote SVG sizing
  const quoteW = Math.min(width * 0.82, 380);
  const quoteH = Math.round(quoteW * 0.40);

  /**
   * ✅ Chevron position: center above nav like screenshot
   * place it slightly higher than the nav top edge
   */
  const CHEVRON_LIFT = 14; // tweak 10–20 if needed
  const chevronBottom = navHeight + CHEVRON_LIFT;

  return (
    // ✅ IMPORTANT: remove bottom edge so we don't double-add bottom safe area
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" />

      <ImageBackground
        source={require("../../assets/splash1.png")}
        style={styles.bg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(11, 94, 155, 0.70)", "rgba(11, 94, 155, 0.92)"]}
          style={styles.overlay}
        >
          {/* Top bar */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 10) }]}>
            <View style={styles.topSide} />

            <View style={styles.brandWrap}>
              <Logo2 width={200} height={44} />
            </View>

            <View style={styles.topSide}>
              <Pressable
                onPress={pressInfo}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.infoBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={22}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>
          </View>

          {/* Center quote */}
          <View style={[styles.centerContent, { paddingBottom: centerPadBottom }]}>
            <HomeScreenQuote width={quoteW} height={quoteH} />
          </View>

          {/* ✅ ChevronUp.svg (centered above nav) */}
          <View style={[styles.chevronWrap, { bottom: chevronBottom }]} pointerEvents="none">
            <ChevronUp width={22} height={22} />
          </View>

          {/* ✅ Nav pinned to bottom */}
          <View
            style={[
              styles.navWrap,
              {
                height: navHeight,
                paddingBottom: Math.max(insets.bottom, 10),
              },
            ]}
          >
            <NavItem
              icon="home-outline"
              label="Home"
              active={activeTab === "Home"}
              onPress={() => handleTab("Home")}
            />

            <NavItem
              icon="mail-outline"
              label="Inbox"
              active={activeTab === "Inbox"}
              onPress={() => handleTab("Inbox")}
            />

            {/* Center label under FAB */}
            <View style={styles.centerSlot}>
              <View style={{ height: 22 }} />
              <Text style={[styles.label, activeTab === "Incident" && styles.labelActive]}>
                Incident Log
              </Text>
            </View>

            <NavItem
              icon="book-outline"
              label="Ledger"
              active={activeTab === "Ledger"}
              onPress={() => handleTab("Ledger")}
            />

            <NavItem
              icon="settings-outline"
              label="Settings"
              active={activeTab === "Settings"}
              onPress={() => handleTab("Settings")}
            />
          </View>

          {/* ✅ FAB centered above “Incident Log” (lowered) */}
          <View style={[styles.fabWrap, { bottom: fabBottom }]}>
            <Pressable
              onPress={pressFab}
              onLongPress={() =>
                onQuickExit
                  ? onQuickExit()
                  : Alert.alert("Quick Exit", "Instantly hide the app (demo)")
              }
              delayLongPress={350}
              style={({ pressed }) => [
                styles.fab,
                {
                  width: FAB_SIZE,
                  height: FAB_SIZE,
                  borderRadius: FAB_SIZE / 2,
                },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="add" size={30} color="#FFFFFF" />
            </Pressable>
          </View>
        </LinearGradient>
      </ImageBackground>
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
  safe: {
    flex: 1,
    backgroundColor: "#0B5E9B",
  },
  bg: { flex: 1 },
  overlay: {
    flex: 1,
    position: "relative",
  },

  // Top bar
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  topSide: {
    width: 48,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  brandWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  // Center quote
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: -10,
  },

  // Chevron above nav
  chevronWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  // ✅ Nav pinned to bottom
  navWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E7EEF7",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: 10,
  },

  // 5 equal columns
  item: {
    flex: 1,
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

  // Center slot under FAB
  centerSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // FAB wrapper (full width so it centers)
  fabWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  fab: {
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 10,
      },
    }),
  },
});
