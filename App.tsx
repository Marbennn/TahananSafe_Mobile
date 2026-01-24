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
import SignupScreen from "./src/screens/SignupScreen";
import PersonalDetailsScreen from "./src/screens/PersonalDetailsScreen";
import SecurityQuestionsScreen from "./src/screens/SecurityQuestionsScreen";
import VerifyAccountScreen from "./src/screens/VerifyAccountScreen";
import PinScreen from "./src/screens/PinScreen";
import HomeScreen from "./src/screens/HomeScreen";
import InboxScreen from "./src/screens/HotlinesScreen";
import ReportScreen from "./src/screens/ReportScreen";

// Incident flow screens (inside Main)
import IncidentLogScreen from "./src/screens/IncidentLogScreen";
import IncidentLogConfirmationScreen from "./src/screens/IncidentLogConfirmationScreen";
import IncidentLogConfirmedScreen from "./src/screens/IncidentLogConfirmedScreen";

// Types
import type { TabKey } from "./src/components/BottomNavBar";
import type { IncidentPreviewData } from "./src/components/IncidentLogConfirmationScreen/IncidentPreviewCard";

enableScreens(true);

type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Signup: undefined;
  PersonalDetails: undefined;
  Security: undefined;
  Verify: { email?: string } | undefined;
  Pin: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type IncidentStep = "form" | "confirm" | "confirmed";

function MainShell({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>("Home");

  const [incidentStep, setIncidentStep] = useState<IncidentStep>("form");
  const [incidentPreview, setIncidentPreview] =
    useState<IncidentPreviewData | null>(null);

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
          setIncidentStep("form");
          setIncidentPreview(null);
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

  // ✅ NEW: Reports tab opens ReportScreen
  if (activeTab === "Reports") {
    return (
      <ReportScreen
        initialTab="Reports"
        onQuickExit={handleQuickExit}
        onTabChange={handleTabChange}
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
  return <Placeholder title="Settings" />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            id="root-stack"
            initialRouteName="Splash"
            screenOptions={{
              headerShown: false,
              gestureEnabled: true,
            }}
          >
            <Stack.Screen name="Splash">
              {({ navigation }) => (
                <AppSplashScreenWrapper
                  onDone={() => navigation.replace("Login")}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Login">
              {({ navigation }) => (
                <LoginScreen
                  onGoSignup={() => navigation.navigate("Signup")}
                  onLoginSuccess={() => navigation.navigate("Security")}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Signup">
              {({ navigation }) => (
                <SignupScreen
                  onGoLogin={() => navigation.navigate("Login")}
                  onSignupSuccess={() => navigation.navigate("PersonalDetails")}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="PersonalDetails">
              {({ navigation }) => (
                <PersonalDetailsScreen onSubmit={() => navigation.replace("Login")} />
              )}
            </Stack.Screen>

            <Stack.Screen name="Security">
              {({ navigation }) => (
                <SecurityQuestionsScreen
                  currentIndex={1}
                  totalQuestions={3}
                  onContinue={() =>
                    navigation.navigate("Verify", { email: "johndoe@gmail.com" })
                  }
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Verify">
              {({ navigation, route }) => (
                <VerifyAccountScreen
                  email={route.params?.email ?? "johndoe@gmail.com"}
                  onVerify={() => navigation.navigate("Pin")}
                  onResendCode={() =>
                    Alert.alert("Resent", "Verification code resent (demo).")
                  }
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Pin">
              {({ navigation }) => (
                <PinScreen
                  onVerified={(pin: string) => {
                    Alert.alert("Verified!", `PIN: ${pin}`);
                    navigation.reset({
                      index: 0,
                      routes: [{ name: "Main" }],
                    });
                  }}
                  onForgotPin={() =>
                    Alert.alert("Forgot PIN", "Go to reset PIN flow")
                  }
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Main">
              {({ navigation }) => (
                <MainShell
                  onLogout={() => {
                    navigation.reset({
                      index: 0,
                      routes: [{ name: "Login" }],
                    });
                  }}
                />
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
