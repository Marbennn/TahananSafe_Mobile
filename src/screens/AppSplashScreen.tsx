// src/screens/AppSplashScreen.tsx
import React from "react";
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from "react-native";
import NewLogo from "../../assets/NewLogo.svg";

export default function AppSplashScreen() {
  const { width, height } = useWindowDimensions();
  const logoWidth = Math.max(180, Math.min(280, Math.round(width * 0.62)));

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {/* Put the SVG inside a box, then scale it to fit */}
        <View style={[styles.logoBox, { width: logoWidth, height: Math.round(logoWidth * 0.31) }]}>
          <NewLogo
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
          />
        </View>

        <ActivityIndicator
          size="large"
          color="#0B4D8C"
          style={[styles.spinner, { marginTop: Math.max(24, Math.min(38, height * 0.045)) }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  // ✅ adjust these to match your screenshot
  logoBox: {
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
  },

  spinner: {
    transform: [{ scale: 1.1 }],
  },
});
