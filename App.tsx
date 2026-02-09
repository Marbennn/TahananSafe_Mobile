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

// ✅ New: Stationary header auth shell
import AuthFlowShell from "./src/screens/AuthFlowShell";

import HomeScreen from "./src/screens/HomeScreen";
import InboxScreen from "./src/screens/HotlinesScreen";
import ReportScreen from "./src/screens/ReportScreen";
import ReportDetailScreen from "./src/screens/ReportDetailScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";

// ✅ Onboarding pager screen
import OnboardingPagerScreen from "./src/screens/OnboardingPagerScreen";

// ✅ PIN screen
import PinScreen from "./src/screens/PinScreen";

// Incident flow screens (inside Main)
import IncidentLogScreen from "./src/screens/IncidentLogScreen";
import IncidentLogConfirmationScreen from "./src/screens/IncidentLogConfirmationScreen";
import IncidentLogConfirmedScreen from "./src/screens/IncidentLogConfirmedScreen";

// ✅ Persist login/session
import {
  isLoggedIn,
  setLoggedIn,
  getAccessToken,
  setHasPin,
} from "./src/auth/session";

// ✅ APIs for PIN & profile
import { getMeApi, verifyPinApi } from "./src/api/pin";

// Types
import type { TabKey } from "./src/components/BottomNavBar";
import type { IncidentPreviewData } from "./src/components/IncidentLogConfirmationScreen/IncidentPreviewCard";
import type { ReportItem } from "./src/screens/ReportScreen";

enableScreens(true);

type RootStackParamList = {
  Splash: undefined;

  // ✅ Onboarding
  OnboardingPager: undefined;

  // ✅ Stationary auth flow wrapper
  AuthFlow: undefined;

  // Login flow (optional)
  Login: undefined;

  // ✅ PIN gate
  Pin: undefined;

  // App shell
  Main: undefined;

  // Extra
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type IncidentStep = "form" | "confirm" | "confirmed";
type ReportStep = "list" | "detail";

function MainShell({
  onLogout,
  onOpenNotifications,
}: {
  onLogout: () => void;
  onOpenNotifications: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("Home");

  // Incident flow state
  const [incidentStep, setIncidentStep] = useState<IncidentStep>("form");
  const [incidentPreview, setIncidentPreview] =
    useState<IncidentPreviewData | null>(null);

  // Reports flow state
  const [reportStep, setReportStep] = useState<ReportStep>("list");
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

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

  const handleQuickExit = () => {
    Alert.alert("Quick Exit", "Returning to Login", [
      {
        text: "OK",
        onPress: () => {
          setActiveTab("Home");

          // reset incident flow
          setIncidentStep("form");
          setIncidentPreview(null);

          // reset reports flow
          setReportStep("list");
          setSelectedReport(null);

          onLogout();
        },
      },
    ]);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);

    if (tab !== "Incident") {
      setIncidentStep("form");
      setIncidentPreview(null);
    }

    if (tab !== "Reports") {
      setReportStep("list");
      setSelectedReport(null);
    }
  };

  const Placeholder = ({ title }: { title: string }) => (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderText}>Screen coming soon…</Text>
    </View>
  );

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

    if (!selectedReport) {
      setReportStep("list");
      return null;
    }

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
  return <Placeholder title="Unknown" />;
}

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
            {/* ✅ Splash -> (Pin/Main if logged in) else OnboardingPager */}
            <Stack.Screen name="Splash">
              {({ navigation }) => (
                <AppSplashScreenWrapper
                  onGoMain={() =>
                    navigation.reset({ index: 0, routes: [{ name: "Main" }] })
                  }
                  onGoPin={() =>
                    navigation.reset({ index: 0, routes: [{ name: "Pin" }] })
                  }
                  onGoOnboarding={() => navigation.replace("OnboardingPager")}
                />
              )}
            </Stack.Screen>

            {/* ✅ Onboarding -> AuthFlow */}
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
                    // ✅ logged in flag should already be set in your auth logic
                    // but keep this as fallback
                    await setLoggedIn(true);

                    // After auth, decide if Pin is needed
                    try {
                      const token = await getAccessToken();
                      if (token) {
                        const me = await getMeApi({ accessToken: token });
                        await setHasPin(!!me.user.hasPin);
                        if (me.user.hasPin) {
                          navigation.reset({
                            index: 0,
                            routes: [{ name: "Pin" }],
                          });
                          return;
                        }
                      }
                    } catch {
                      // ignore, go main
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

                    // After login, decide if Pin is needed
                    try {
                      const token = await getAccessToken();
                      if (token) {
                        const me = await getMeApi({ accessToken: token });
                        await setHasPin(!!me.user.hasPin);
                        if (me.user.hasPin) {
                          navigation.reset({
                            index: 0,
                            routes: [{ name: "Pin" }],
                          });
                          return;
                        }
                      }
                    } catch {
                      // ignore, go main
                    }

                    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                  }}
                />
              )}
            </Stack.Screen>

            {/* ✅ PIN Gate */}
            <Stack.Screen name="Pin">
              {({ navigation }) => (
                <PinScreen
                  onBack={() => {
                    // optional: prevent going back to app without PIN
                    // You can keep this disabled or send to Login:
                    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
                  }}
                  onForgotPin={() => {
                    Alert.alert(
                      "Forgot PIN",
                      "Feature coming soon. Please contact support or use recovery flow."
                    );
                  }}
                  onVerified={async (pin) => {
                    try {
                      const token = await getAccessToken();
                      if (!token) {
                        Alert.alert("Session expired", "Please log in again.");
                        await setLoggedIn(false);
                        navigation.reset({
                          index: 0,
                          routes: [{ name: "Login" }],
                        });
                        return;
                      }

                      await verifyPinApi({ accessToken: token, pin });
                      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
                    } catch (e: any) {
                      Alert.alert("Invalid PIN", e?.message || "Try again.");
                      // PinScreen already clears digits when user types again,
                      // so we just show the error.
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
                    await setLoggedIn(false);
                    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
                  }}
                  onOpenNotifications={() =>
                    navigation.navigate("Notifications")
                  }
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

function AppSplashScreenWrapper({
  onGoMain,
  onGoPin,
  onGoOnboarding,
}: {
  onGoMain: () => void;
  onGoPin: () => void;
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

        // ✅ ask backend if user has PIN
        const me = await getMeApi({ accessToken: token });
        const hasPin = !!me.user.hasPin;

        await setHasPin(hasPin);

        if (!mounted) return;
        if (hasPin) onGoPin();
        else onGoMain();
      } catch {
        if (!mounted) return;
        onGoOnboarding();
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [onGoMain, onGoPin, onGoOnboarding]);

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
