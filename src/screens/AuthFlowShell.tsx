// src/screens/AuthFlowShell.tsx
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, StatusBar, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  NavigationContainer,
  NavigationIndependentTree,
  useNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AuthProgressHeader from "../components/AuthFlow/SignupProgressHeader";

import SignupScreen from "./SignupScreen";
import PersonalDetailsScreen from "./PersonalDetailsScreen";
import CreatePinScreen from "./CreatePinScreen";

// ✅ IMPORTANT: unlock pin for THIS RUN so App.tsx won't force PinScreen right away
import { setPinUnlockedThisRun } from "../auth/session";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type AuthStackParamList = {
  Signup: undefined;
  PersonalDetails: undefined;
  CreatePin: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

type Props = {
  onExitToOnboarding: () => void;
  onGoLogin: () => void;
  onAuthDone: () => void;
};

export default function AuthFlowShell({
  onExitToOnboarding,
  onGoLogin,
  onAuthDone,
}: Props) {
  const { width, height } = useWindowDimensions();

  const s = clamp(width / 375, 0.95, 1.6);
  const vs = clamp(height / 812, 0.95, 1.35);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const navRef = useNavigationContainerRef<AuthStackParamList>();
  const [routeName, setRouteName] =
    useState<keyof AuthStackParamList>("Signup");

  const progressActiveCount = useMemo<1 | 2 | 3>(() => {
    if (routeName === "Signup") return 1;
    if (routeName === "PersonalDetails") return 2;
    return 3;
  }, [routeName]);

  const handleStateChange = useCallback(() => {
    const name = navRef.getCurrentRoute()?.name as
      | keyof AuthStackParamList
      | undefined;
    if (name) setRouteName(name);
  }, [navRef]);

  const handleBack = useCallback(() => {
    if (navRef.isReady() && navRef.canGoBack()) navRef.goBack();
    else onExitToOnboarding();
  }, [navRef, onExitToOnboarding]);

  const goTo = useCallback(
    (name: keyof AuthStackParamList) => {
      if (navRef.isReady()) navRef.navigate(name);
    },
    [navRef]
  );

  // ✅ helper: finish auth and unlock for this run
  const finishAuth = useCallback(() => {
    // This prevents App.tsx from forcing PinScreen immediately after CreatePin.
    setPinUnlockedThisRun(true);
    onAuthDone();
  }, [onAuthDone]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <AuthProgressHeader
        onBack={handleBack}
        progressActiveCount={progressActiveCount}
        scale={scale}
        vscale={vscale}
      />

      <View style={styles.body}>
        <NavigationIndependentTree>
          <NavigationContainer ref={navRef} onStateChange={handleStateChange}>
            <Stack.Navigator
              id="auth-flow-stack"
              screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
                contentStyle: { backgroundColor: "#FFFFFF" },
              }}
            >
              <Stack.Screen name="Signup">
                {() => (
                  <SignupScreen
                    onBack={onExitToOnboarding}
                    onGoLogin={onGoLogin}
                    onSignupSuccess={() => goTo("PersonalDetails")}
                    progressActiveCount={1}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="PersonalDetails">
                {() => (
                  <PersonalDetailsScreen
                    onBack={handleBack}
                    onSubmit={() => goTo("CreatePin")}
                    progressActiveCount={2}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="CreatePin">
                {() => (
                  <CreatePinScreen
                    onBack={handleBack}
                    onContinue={() => finishAuth()}
                    onSkip={() => finishAuth()}
                    progressActiveCount={3}
                  />
                )}
              </Stack.Screen>
            </Stack.Navigator>
          </NavigationContainer>
        </NavigationIndependentTree>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  body: { flex: 1, backgroundColor: "#FFFFFF" },
});
