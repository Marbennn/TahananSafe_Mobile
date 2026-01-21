// src/screens/AppSplashScreen.tsx
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  StyleSheet,
  View,
} from "react-native";

export default function AppSplashScreen() {
  const [bgReady, setBgReady] = useState<boolean>(false);

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require("../../assets/splash1.png")}
        style={styles.bg}
        resizeMode="cover"
        onLoadEnd={() => setBgReady(true)}
      >
        {bgReady && (
          <View style={styles.overlay}>
            <Image
              source={require("../../assets/Logo1.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <ActivityIndicator size="large" color="#ffffff" style={styles.spinner} />
          </View>
        )}
      </ImageBackground>

      {!bgReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bg: { flex: 1 },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logo: { width: 140, height: 140 },
  spinner: { marginTop: 18 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
