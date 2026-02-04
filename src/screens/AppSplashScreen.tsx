// src/screens/AppSplashScreen.tsx
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import NewLogo from "../../assets/NewLogo.svg";

export default function AppSplashScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {/* Put the SVG inside a box, then scale it to fit */}
        <View style={styles.logoBox}>
          <NewLogo
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
          />
        </View>

        <ActivityIndicator
          size="large"
          color="#0B4D8C"
          style={styles.spinner}
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
    transform: [{ translateY: -20 }],
  },

  // ✅ adjust these to match your screenshot
  logoBox: {
    width: 230,
    height: 70,
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
  },

  spinner: {
    marginTop: 38,
    transform: [{ scale: 1.1 }],
  },
});
