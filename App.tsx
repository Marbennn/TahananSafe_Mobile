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
import SignupScreen from "./src/screens/SignupScreen";
import PersonalDetailsScreen from "./src/screens/PersonalDetailsScreen";
import SecurityQuestionsScreen from "./src/screens/SecurityQuestionsScreen";
import VerifyAccountScreen from "./src/screens/VerifyAccountScreen";
import CreatePinScreen from "./src/screens/CreatePinScreen";
import PinScreen from "./src/screens/PinScreen";

import HomeScreen from "./src/screens/HomeScreen";
import InboxScreen from "./src/screens/HotlinesScreen";
import ReportScreen from "./src/screens/ReportScreen";
import ReportDetailScreen from "./src/screens/ReportDetailScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";

// Incident flow screens (inside Main)
import IncidentLogScreen from "./src/screens/IncidentLogScreen";
import IncidentLogConfirmationScreen from "./src/screens/IncidentLogConfirmationScreen";
import IncidentLogConfirmedScreen from "./src/screens/IncidentLogConfirmedScreen";

// Types
import type { TabKey } from "./src/components/BottomNavBar";
import type { IncidentPreviewData } from "./src/components/IncidentLogConfirmationScreen/IncidentPreviewCard";
import type { ReportItem } from "./src/screens/ReportScreen";

enableScreens(true);

type RootStackParamList = {
  Splash: undefined;

  // Onboarding flow
  Signup: undefined;
  Verify: { email?: string; next: "PersonalDetails" | "Main" };
  PersonalDetails: undefined;
  Security: undefined;
  CreatePin: undefined;
  Pin: undefined;

  // Login flow
  Login: undefined;

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
            {/* ✅ Splash -> Signup */}
            <Stack.Screen name="Splash">
              {({ navigation }) => (
                <AppSplashScreenWrapper
                  onDone={() => navigation.replace("Signup")}
                />
              )}
            </Stack.Screen>

            {/* ✅ Signup -> Verify -> PersonalDetails */}
            <Stack.Screen name="Signup">
              {({ navigation }) => (
                <SignupScreen
                  onGoLogin={() => navigation.replace("Login")}
                  onSignupSuccess={(
                    registeredEmail, // <-- receive actual email
                  ) =>
                    navigation.navigate("Verify", {
                      email: registeredEmail, // <-- pass the real email here
                      next: "PersonalDetails",
                    })
                  }
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Verify">
              {({ navigation, route }) => (
                <VerifyAccountScreen
                  email={route.params?.email ?? "johndoe@gmail.com"}
                  onVerify={() => {
                    const next = route.params?.next ?? "PersonalDetails";

                    if (next === "Main") {
                      navigation.reset({
                        index: 0,
                        routes: [{ name: "Main" }],
                      });
                    } else {
                      navigation.replace("PersonalDetails");
                    }
                  }}
                  onResendCode={() =>
                    Alert.alert("Resent", "Verification code resent (demo).")
                  }
                />
              )}
            </Stack.Screen>

            {/* ✅ PersonalDetails -> Security */}
            <Stack.Screen name="PersonalDetails">
              {() => <PersonalDetailsScreen />}
            </Stack.Screen>

            {/* ✅ Security -> CreatePin */}
            <Stack.Screen name="Security">
              {({ navigation }) => (
                <SecurityQuestionsScreen
                  currentIndex={1}
                  totalQuestions={3}
                  onContinue={() => navigation.navigate("CreatePin")}
                />
              )}
            </Stack.Screen>

            {/* ✅ CreatePin -> Pin */}
            <Stack.Screen name="CreatePin">
              {({ navigation }) => {
                const CreatePinAny =
                  CreatePinScreen as unknown as React.ComponentType<any>;
                return (
                  <CreatePinAny
                    onContinue={() => navigation.navigate("Pin")}
                    onBack={() => navigation.goBack()}
                  />
                );
              }}
            </Stack.Screen>

            {/* ✅ Pin -> Login */}
            <Stack.Screen name="Pin">
              {({ navigation }) => (
                <PinScreen
                  onVerified={(pin: string) => {
                    Alert.alert("PIN Saved!", `PIN: ${pin}`);
                    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
                  }}
                  onForgotPin={() =>
                    Alert.alert("Forgot PIN", "Go to reset PIN flow")
                  }
                />
              )}
            </Stack.Screen>

            {/* ✅ Login -> Verify -> Home(Main) */}
            <Stack.Screen name="Login">
              {({ navigation }) => (
                <LoginScreen
                  onGoSignup={() => navigation.replace("Signup")}
                  onLoginSuccess={() =>
                    navigation.navigate("Verify", {
                      email: "johndoe@gmail.com",
                      next: "Main",
                    })
                  }
                />
              )}
            </Stack.Screen>

            {/* ✅ Main (Home lives inside this shell) */}
            <Stack.Screen name="Main">
              {({ navigation }) => (
                <MainShell
                  onLogout={() =>
                    navigation.reset({ index: 0, routes: [{ name: "Login" }] })
                  }
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

function AppSplashScreenWrapper({ onDone }: { onDone: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [onDone]);

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
