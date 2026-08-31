import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../auth/AuthContext";
import AppAlertProvider from "../components/AppAlertProvider";
import { ThemeProvider } from "../theme/ThemeContext";
import MobileLifecycle from "./MobileLifecycle";
import { mobileQueryClient } from "./queryClient";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={mobileQueryClient}>
        <MobileLifecycle />
        <ThemeProvider>
          <AuthProvider>
            <AppAlertProvider>{children}</AppAlertProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
