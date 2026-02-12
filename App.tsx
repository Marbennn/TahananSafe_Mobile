// App.tsx
import "react-native-gesture-handler";
import React, { useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// ✅ ADD THIS
import { AuthProvider } from "./src/auth/AuthContext";

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
import IncidentLogConfirmedScreen from "./src/screens/IncidentLogConfirmedScreen";

// Session helpers
import {
  isLoggedIn,
  setLoggedIn,
  getAccessToken,
  setHasPin,
  isPinUnlockedThisRun,
  setPinUnlockedThisRun,
  resetPinUnlockedThisRun,
  isOnboardingSeen,
  isPinSkippedForUser,
} from "./src/auth/session";

// APIs for PIN & profile
import { getMeApi, verifyPinApi } from "./src/api/pin";

// Types
import type { TabKey } from "./src/components/BottomNavBar";
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

type IncidentStep = "form" | "confirmed";
type ReportStep = "list" | "detail";

type LastIncident = {
  incidentId: string;
  createdAt?: string;
};

function formatAlertNo(incidentId?: string) {
  if (!incidentId) return "—";
  // looks nicer than a full ObjectId
  return incidentId.slice(-6).toUpperCase();
}

function formatDateLine(createdAt?: string) {
  try {
    if (!createdAt) return new Date().toLocaleString();
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return new Date().toLocaleString();
    return d.toLocaleString();
  } catch {
    return new Date().toLocaleString();
  }
}

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
  const [lastIncident, setLastIncident] = useState<LastIncident | null>(null);

  const [reportStep, setReportStep] = useState<ReportStep>("list");
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const handleQuickExit = () => {
    Alert.alert("Quick Exit", "Returning to Login", [{ text: "OK", onPress: onLogout }]);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab !== "Incident") setIncidentStep("form");
    if (tab !== "Reports") setReportStep("list");
  };

  // ✅ Helper: open report detail from ANY tab (Home recent logs, Reports list, etc.)
  const openReportDetail = (item: ReportItem) => {
    setSelectedReport(item);
    setReportStep("detail");
    setActiveTab("Reports");
  };

  if (activeTab === "Home") {
    return (
      <HomeScreen
        initialTab="Home"
        onQuickExit={handleQuickExit}
        onTabChange={handleTabChange}
        onOpenNotifications={onOpenNotifications}
        // ✅ NEW: this makes RecentLogCard open ReportDetailScreen
        onOpenReport={openReportDetail}
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
          onSubmitted={(payload) => {
            // ✅ store real mongo data here
            setLastIncident(payload);
            setIncidentStep("confirmed");
          }}
        />
      );
    }

    return (
      <IncidentLogConfirmedScreen
        alertNo={formatAlertNo(lastIncident?.incidentId)}
        dateLine={formatDateLine(lastIncident?.createdAt)}
        onGoHome={() => {
          setActiveTab("Home");
          setIncidentStep("form");
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
        <AuthProvider>
          <NavigationContainer>
            <Stack.Navigator
              id="root-stack"
              initialRouteName="Splash"
              screenOptions={{ headerShown: false, gestureEnabled: true }}
            >
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
                    onGoAuthFlow={() =>
                      navigation.reset({ index: 0, routes: [{ name: "AuthFlow" }] })
                    }
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="OnboardingPager">
                {({ navigation }) => (
                  <OnboardingPagerScreen
                    onDone={() =>
                      navigation.reset({ index: 0, routes: [{ name: "AuthFlow" }] })
                    }
                  />
                )}
              </Stack.Screen>

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
                            if (isPinUnlockedThisRun()) {
                              navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                              return;
                            }
                            navigation.reset({ index: 0, routes: [{ name: "Pin" }] });
                            return;
                          }

                          const userId = String(me.user._id);
                          const skipped = await isPinSkippedForUser(userId);
                          if (skipped) {
                            navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                            return;
                          }

                          navigation.reset({ index: 0, routes: [{ name: "CreatePin" }] });
                          return;
                        }
                      } catch {}

                      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                    }}
                  />
                )}
              </Stack.Screen>

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

                          const userId = String(me.user._id);
                          const skipped = await isPinSkippedForUser(userId);
                          if (skipped) {
                            navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                            return;
                          }

                          navigation.reset({ index: 0, routes: [{ name: "CreatePin" }] });
                          return;
                        }
                      } catch {}

                      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                    }}
                  />
                )}
              </Stack.Screen>

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

              <Stack.Screen name="Pin">
                {({ navigation }) => (
                  <PinScreen
                    onBack={() => navigation.reset({ index: 0, routes: [{ name: "Login" }] })}
                    onForgotPin={() => {
                      Alert.alert("Forgot PIN", "Recovery coming soon.");
                    }}
                    onVerified={async (pin) => {
                      try {
                        const token = await getAccessToken();
                        if (!token) {
                          await setLoggedIn(false);
                          resetPinUnlockedThisRun();
                          navigation.reset({ index: 0, routes: [{ name: "AuthFlow" }] });
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

              <Stack.Screen name="Main">
                {({ navigation }) => (
                  <MainShell
                    onLogout={async () => {
                      resetPinUnlockedThisRun();
                      await setLoggedIn(false);
                      await setHasPin(false);

                      navigation.reset({ index: 0, routes: [{ name: "AuthFlow" }] });
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
        </AuthProvider>
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
  onGoAuthFlow,
}: {
  onGoMain: () => void;
  onGoPin: () => void;
  onGoCreatePin: () => void;
  onGoOnboarding: () => void;
  onGoAuthFlow: () => void;
}) {
  React.useEffect(() => {
    let mounted = true;

    const t = setTimeout(async () => {
      try {
        const seenOnboarding = await isOnboardingSeen();
        if (!mounted) return;

        const logged = await isLoggedIn();
        if (!mounted) return;

        if (!logged) {
          if (!seenOnboarding) onGoOnboarding();
          else onGoAuthFlow();
          return;
        }

        const token = await getAccessToken();
        if (!token) {
          if (!seenOnboarding) onGoOnboarding();
          else onGoAuthFlow();
          return;
        }

        const me = await getMeApi({ accessToken: token });
        const hasPin = !!me.user.hasPin;

        await setHasPin(hasPin);
        if (!mounted) return;

        if (hasPin) {
          if (isPinUnlockedThisRun()) onGoMain();
          else onGoPin();
          return;
        }

        const userId = String(me.user._id);
        const skipped = await isPinSkippedForUser(userId);
        if (skipped) {
          onGoMain();
          return;
        }

        onGoCreatePin();
      } catch {
        if (!mounted) return;

        try {
          const seenOnboarding = await isOnboardingSeen();
          if (!seenOnboarding) onGoOnboarding();
          else onGoAuthFlow();
        } catch {
          onGoOnboarding();
        }
      }
    }, 1200);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [onGoMain, onGoPin, onGoCreatePin, onGoOnboarding, onGoAuthFlow]);

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
