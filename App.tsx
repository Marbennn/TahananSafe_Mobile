// App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Alert, View, Text, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AppSplashScreen from "./src/screens/AppSplashScreen";
import LoginScreen from "./src/screens/LoginScreen";
import SignupScreen from "./src/screens/SignupScreen";
import SecurityQuestionsScreen from "./src/screens/SecurityQuestionsScreen";
import PinScreen from "./src/screens/PinScreen";
import HomeScreen from "./src/screens/HomeScreen";
import InboxScreen from "./src/screens/HotlinesScreen";

// ✅ Incident flow screens
import IncidentLogScreen from "./src/screens/IncidentLogScreen";
import IncidentLogConfirmationScreen from "./src/screens/IncidentLogConfirmationScreen";
import IncidentLogConfirmedScreen from "./src/screens/IncidentLogConfirmedScreen";

// ✅ type for bottom tabs
import type { TabKey } from "./src/components/BottomNavBar";

// ✅ type from your preview card (used by confirmation screen)
import type { IncidentPreviewData } from "./src/components/IncidentLogConfirmationScreen/IncidentPreviewCard";

type ScreenKey = "splash" | "login" | "signup" | "security" | "pin" | "main";

// ✅ Incident flow steps (inside the Incident tab)
type IncidentStep = "form" | "confirm" | "confirmed";

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>("splash");
  const [activeTab, setActiveTab] = useState<TabKey>("Home");

  // ✅ Incident flow state
  const [incidentStep, setIncidentStep] = useState<IncidentStep>("form");
  const [incidentPreview, setIncidentPreview] = useState<IncidentPreviewData | null>(null);

  // ✅ demo values for Confirmed screen
  const alertNo = useMemo(() => "676767", []);
  const confirmedDateLine = useMemo(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
    const monthDayYear = now.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const time = now.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${weekday} | ${monthDayYear} | ${time}`;
  }, []);

  const SPLASH_MS = 5000;

  useEffect(() => {
    const t = setTimeout(() => setScreen("login"), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const handleQuickExit = () => {
    Alert.alert("Quick Exit", "Returning to Login", [
      {
        text: "OK",
        onPress: () => {
          setScreen("login");
          setActiveTab("Home");
          setIncidentStep("form");
          setIncidentPreview(null);
        },
      },
    ]);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);

    // ✅ if user leaves Incident tab, reset its flow so it starts fresh next time
    if (tab !== "Incident") {
      setIncidentStep("form");
      setIncidentPreview(null);
    }
  };

  // --- Simple placeholder screens for tabs you haven't built yet ---
  const Placeholder = ({ title }: { title: string }) => (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderText}>Screen coming soon…</Text>
    </View>
  );

  // --- Render MAIN tab screens ---
  const renderMain = () => {
    if (activeTab === "Home") {
      return (
        <HomeScreen
          initialTab="Home"
          onQuickExit={handleQuickExit}
          onTabChange={handleTabChange}
        />
      );
    }

    if (activeTab === "Inbox") {
      return (
        <InboxScreen
          initialTab="Inbox"
          onQuickExit={handleQuickExit}
          onTabChange={handleTabChange}
        />
      );
    }

    // ✅ Incident tab now has a 3-step flow
    if (activeTab === "Incident") {
      if (incidentStep === "form") {
        return (
          <IncidentLogScreen
            onBack={() => {
              setActiveTab("Home");
              setIncidentStep("form");
              setIncidentPreview(null);
            }}
            onProceedConfirm={(previewData: IncidentPreviewData) => {
              setIncidentPreview(previewData);
              setIncidentStep("confirm");
            }}
          />
        );
      }

      if (incidentStep === "confirm") {
        if (!incidentPreview) {
          setIncidentStep("form");
          return null;
        }

        return (
          <IncidentLogConfirmationScreen
            data={incidentPreview}
            onBack={() => setIncidentStep("form")}
            onConfirm={() => setIncidentStep("confirmed")}
          />
        );
      }

      return (
        <IncidentLogConfirmedScreen
          alertNo={alertNo}
          dateLine={confirmedDateLine}
          onGoHome={() => {
            setIncidentStep("form");
            setIncidentPreview(null);
            setActiveTab("Home");
          }}
        />
      );
    }

    if (activeTab === "Ledger") return <Placeholder title="Ledger" />;
    return <Placeholder title="Settings" />;
  };

  return (
    <SafeAreaProvider>
      {screen === "splash" ? (
        <AppSplashScreen />
      ) : screen === "signup" ? (
        <SignupScreen onGoLogin={() => setScreen("login")} />
      ) : screen === "security" ? (
        <SecurityQuestionsScreen
          currentIndex={1}
          totalQuestions={3}
          onContinue={() => {
            // After answering the security question, proceed to PIN
            setScreen("pin");
          }}
        />
      ) : screen === "pin" ? (
        <PinScreen
          onVerified={(pin: string) => {
            Alert.alert("Verified!", `PIN: ${pin}`);
            setActiveTab("Home");
            setIncidentStep("form");
            setIncidentPreview(null);
            setScreen("main");
          }}
          onForgotPin={() => Alert.alert("Forgot PIN", "Go to reset PIN flow")}
        />
      ) : screen === "main" ? (
        renderMain()
      ) : (
        <LoginScreen
          onGoSignup={() => setScreen("signup")}
          onLoginSuccess={() => setScreen("security")} // ✅ Login → Security Questions
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "#F5FAFE",
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0B2B45",
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
});
