// App.js
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AppSplashScreen from "./src/screens/AppSplashScreen";
import LoginScreen from "./src/screens/LoginScreen";
import SignupScreen from "./src/screens/SignupScreen";
import PinScreen from "./src/screens/PinScreen";
import HomeScreen from "./src/screens/HomeScreen";

export default function App() {
  const [screen, setScreen] = useState("splash");
  const SPLASH_MS = 5000;

  useEffect(() => {
    const t = setTimeout(() => setScreen("login"), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      {screen === "splash" ? (
        <AppSplashScreen />
      ) : screen === "signup" ? (
        <SignupScreen onGoLogin={() => setScreen("login")} />
      ) : screen === "pin" ? (
        <PinScreen
          onVerified={(pin) => {
            Alert.alert("Verified!", `PIN: ${pin}`);
            setScreen("home");
          }}
          onForgotPin={() => Alert.alert("Forgot PIN", "Go to reset PIN flow")}
        />
      ) : screen === "home" ? (
        <HomeScreen />
      ) : (
        <LoginScreen
          onGoSignup={() => setScreen("signup")}
          onLoginSuccess={() => setScreen("pin")}
        />
      )}
    </SafeAreaProvider>
  );
}
