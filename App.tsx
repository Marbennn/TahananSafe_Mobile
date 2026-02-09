// App.tsx
import "react-native-gesture-handler";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Screens
import AppSplashScreen from "./src/screens/AppSplashScreen";
import LoginScreen from "./src/screens/LoginScreen";
import AuthFlowShell from "./src/screens/AuthFlowShell";
import OnboardingPagerScreen from "./src/screens/OnboardingPagerScreen";
import PinScreen from "./src/screens/PinScreen";
import CreatePinScreen from "./src/screens/CreatePinScreen";

import HomeScreen from "./src/screens/HomeScreen";
import InboxScreen from "./src/screens/HotlinesScreen";
import ReportScreen from "./src/screens/ReportScreen";
import ReportDetailScreen from "./src/screens/ReportDetailScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";

import IncidentLogScreen from "./src/screens/IncidentLogScreen";
import IncidentLogConfirmationScreen from "./src/screens/IncidentLogConfirmationScreen";
import IncidentLogConfirmedScreen from "./src/screens/IncidentLogConfirmedScreen";

// Session helpers
import {
  isLoggedIn,
  setLoggedIn,
  getAccessToken,
  setHasPin,
  // ✅ NEW in-memory run flag
  isPinUnlockedThisRun,
  setPinUnlockedThisRun,
  resetPinUnlockedThisRun,
} from "./src/auth/session";

// APIs for PIN & profile
import { getMeApi, verifyPinApi } from "./src/api/pin";

// Types
import type { TabKey } from "./src/components/BottomNavBar";
import type { IncidentPreviewData } from "./src/components/IncidentLogConfirmationScreen/IncidentPreviewCard";
import type { ReportItem } from "./src/screens/ReportScreen";

enableScreens(true);

type RootStackParamList = {
  Splash: undefined;
  OnboardingPager: undefined;
  AuthFlow: undefined;
  Login: undefined;
  CreatePin: undefined;
  Pin: undefined;
  Main: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type IncidentStep = "form" | "confirm" | "confirmed";
type ReportStep = "list" | "detail";

/* ===================== MAIN SHELL ===================== */

function MainShell({
  onLogout,
  onOpenNotifications,
}: {
  onLogout: () => void;
  onOpenNotifications: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("Home");

  const [incidentStep, setIncidentStep] = useState<IncidentStep>("form");
  const [incidentPreview, setIncidentPreview] =
    useState<IncidentPreviewData | null>(null);

  const [reportStep, setReportStep] = useState<ReportStep>("list");
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const alertNo = useMemo(() => "676767", []);
  const confirmedDateLine = useMemo(() => new Date().toLocaleString(), []);

  const handleQuickExit = () => {
    Alert.alert("Quick Exit", "Returning to Login", [
      { text: "OK", onPress: onLogout },
    ]);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab !== "Incident") setIncidentStep("form");
    if (tab !== "Reports") setReportStep("list");
  };

  if (activeTab === "Home") {
    return (
      <HomeScreen
        initialTab="Home"
        onQuickExit={handleQuickExit}
        onTabChange={handleTabChange}
        onOpenNotifications={onOpenNotifications}
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

  if (activeTab === "Reports") {
    if (reportStep === "list") {
      return (
        <ReportScreen
          initialTab="Reports"
          onQuickExit={handleQuickExit}
          onTabChange={handleTabChange}
          onOpenReport={(item) => {
            setSelectedReport(item);
            setReportStep("detail");
          }}
        />
      );
    }

    if (!selectedReport) return null;

    return (
      <ReportDetailScreen
        initialTab="Reports"
        report={selectedReport}
        onBack={() => setReportStep("list")}
        onQuickExit={handleQuickExit}
        onTabChange={handleTabChange}
      />
    );
  }

  if (activeTab === "Settings") {
    return (
      <SettingsScreen
        initialTab="Settings"
        onTabChange={handleTabChange}
        onQuickExit={handleQuickExit}
        onLogout={onLogout}
      />
    );
  }

  if (activeTab === "Incident") {
    if (incidentStep === "form") {
      return (
        <IncidentLogScreen
          onBack={() => setActiveTab("Home")}
          onProceedConfirm={(data) => {
            setIncidentPreview(data);
            setIncidentStep("confirm");
          }}
        />
      );
    }

    if (incidentStep === "confirm" && incidentPreview) {
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
          setActiveTab("Home");
        }}
      />
    );
  }

  return null;
}

/* ===================== APP ROOT ===================== */

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            id="root-stack"
            initialRouteName="Splash"
            screenOptions={{ headerShown: false, gestureEnabled: true }}
          >
            {/* ✅ Splash decides where to go */}
            <Stack.Screen name="Splash">
              {({ navigation }) => (
                <AppSplashScreenWrapper
                  onGoMain={() =>
                    navigation.reset({ index: 0, routes: [{ name: "Main" }] })
                  }
                  onGoPin={() =>
                    navigation.reset({ index: 0, routes: [{ name: "Pin" }] })
                  }
                  onGoCreatePin={() =>
                    navigation.reset({ index: 0, routes: [{ name: "CreatePin" }] })
                  }
                  onGoOnboarding={() => navigation.replace("OnboardingPager")}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="OnboardingPager">
              {({ navigation }) => (
                <OnboardingPagerScreen
                  onDone={() => navigation.navigate("AuthFlow")}
                />
              )}
            </Stack.Screen>

            {/* ✅ AuthFlow */}
            <Stack.Screen name="AuthFlow">
              {({ navigation }) => (
                <AuthFlowShell
                  onExitToOnboarding={() => navigation.goBack()}
                  onGoLogin={() => navigation.navigate("Login")}
                  onAuthDone={async () => {
                    await setLoggedIn(true);

                    try {
                      const token = await getAccessToken();
                      if (token) {
                        const me = await getMeApi({ accessToken: token });
                        const hasPin = !!me.user.hasPin;
                        await setHasPin(hasPin);

                        if (hasPin) {
                          // ✅ If already unlocked this run, go Main immediately
                          if (isPinUnlockedThisRun()) {
                            navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                            return;
                          }

                          navigation.reset({ index: 0, routes: [{ name: "Pin" }] });
                          return;
                        }

                        navigation.reset({ index: 0, routes: [{ name: "CreatePin" }] });
                        return;
                      }
                    } catch {
                      // ignore
                    }

                    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                  }}
                />
              )}
            </Stack.Screen>

            {/* ✅ Login */}
            <Stack.Screen name="Login">
              {({ navigation }) => (
                <LoginScreen
                  onGoSignup={() => navigation.replace("AuthFlow")}
                  onLoginSuccess={async () => {
                    await setLoggedIn(true);

                    try {
                      const token = await getAccessToken();
                      if (token) {
                        const me = await getMeApi({ accessToken: token });
                        const hasPin = !!me.user.hasPin;
                        await setHasPin(hasPin);

                        if (hasPin) {
                          if (isPinUnlockedThisRun()) {
                            navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                            return;
                          }

                          navigation.reset({ index: 0, routes: [{ name: "Pin" }] });
                          return;
                        }

                        navigation.reset({ index: 0, routes: [{ name: "CreatePin" }] });
                        return;
                      }
                    } catch {
                      // ignore
                    }

                    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                  }}
                />
              )}
            </Stack.Screen>

            {/* ✅ Root Create PIN (optional / keep) */}
            <Stack.Screen name="CreatePin">
              {({ navigation }) => (
                <CreatePinScreen
                  onContinue={() => {
                    setPinUnlockedThisRun(true);
                    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                  }}
                  onSkip={() => {
                    setPinUnlockedThisRun(true);
                    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                  }}
                />
              )}
            </Stack.Screen>

            {/* ✅ PIN Gate */}
            <Stack.Screen name="Pin">
              {({ navigation }) => (
                <PinScreen
                  onBack={() =>
                    navigation.reset({ index: 0, routes: [{ name: "Login" }] })
                  }
                  onForgotPin={() => {
                    Alert.alert("Forgot PIN", "Recovery coming soon.");
                  }}
                  onVerified={async (pin) => {
                    try {
                      const token = await getAccessToken();
                      if (!token) {
                        await setLoggedIn(false);
                        resetPinUnlockedThisRun();
                        navigation.reset({
                          index: 0,
                          routes: [{ name: "AuthFlow" }],
                        });
                        return;
                      }

                      await verifyPinApi({ accessToken: token, pin });

                      setPinUnlockedThisRun(true);
                      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                    } catch (e: any) {
                      Alert.alert("Invalid PIN", e?.message || "Try again.");
                    }
                  }}
                />
              )}
            </Stack.Screen>

            {/* ✅ Main */}
            <Stack.Screen name="Main">
              {({ navigation }) => (
                <MainShell
                  onLogout={async () => {
                    // ✅ logout -> Signup/AuthFlow
                    resetPinUnlockedThisRun();
                    await setLoggedIn(false);
                    await setHasPin(false);

                    navigation.reset({
                      index: 0,
                      routes: [{ name: "AuthFlow" }],
                    });
                  }}
                  onOpenNotifications={() => navigation.navigate("Notifications")}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Notifications">
              {({ navigation }) => (
                <NotificationsScreen onBack={() => navigation.goBack()} />
              )}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/* ===================== SPLASH WRAPPER ===================== */

function AppSplashScreenWrapper({
  onGoMain,
  onGoPin,
  onGoCreatePin,
  onGoOnboarding,
}: {
  onGoMain: () => void;
  onGoPin: () => void;
  onGoCreatePin: () => void;
  onGoOnboarding: () => void;
}) {
  React.useEffect(() => {
    let mounted = true;

    const t = setTimeout(async () => {
      try {
        const logged = await isLoggedIn();
        if (!mounted) return;

        if (!logged) {
          onGoOnboarding();
          return;
        }

        const token = await getAccessToken();
        if (!token) {
          onGoOnboarding();
          return;
        }

        const me = await getMeApi({ accessToken: token });
        const hasPin = !!me.user.hasPin;

        await setHasPin(hasPin);

        if (!mounted) return;

        if (hasPin) {
          // ✅ if unlocked this run -> Main else Pin
          if (isPinUnlockedThisRun()) onGoMain();
          else onGoPin();
        } else {
          onGoCreatePin();
        }
      } catch {
        if (!mounted) return;
        onGoOnboarding();
      }
    }, 1200);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [onGoMain, onGoPin, onGoCreatePin, onGoOnboarding]);

  return <AppSplashScreen />;
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
