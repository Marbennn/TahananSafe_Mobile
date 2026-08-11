// App.tsx
import "react-native-gesture-handler";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// ✅ Auth
import { AuthProvider, useAuth } from "./src/auth/AuthContext";

// ✅ Theme
import { ThemeProvider } from "./src/theme/ThemeContext";
import { Typography } from "./src/theme/typography";

// ✅ SecureStore (for local PIN enable/disable toggle)
import * as SecureStore from "expo-secure-store";

// Screens
import AppSplashScreen from "./src/screens/AppSplashScreen";
import LoginScreen from "./src/screens/LoginScreen";
import AuthFlowShell from "./src/screens/AuthFlowShell";
import OnboardingPagerScreen from "./src/screens/OnboardingPagerScreen";
import PinScreen, { resetPinAttempts } from "./src/screens/PinScreen";
import CreatePinScreen from "./src/screens/CreatePinScreen";
import VerifyPinScreen from "./src/screens/VerifyPinScreen";


import HomeScreen from "./src/screens/HomeScreen";
import InboxScreen from "./src/screens/HotlinesScreen";
import ReportScreen from "./src/screens/ReportScreen";
import ReportDetailScreen from "./src/screens/ReportDetailScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import AdminNotificationsScreen from "./src/screens/admin_mobile/AdminNotificationsScreen";
import AppAlertProvider from "./src/components/AppAlertProvider";
import GlobalReportMessaging from "./src/components/GlobalReportMessaging";

import IncidentLogScreen from "./src/screens/IncidentLogScreen";
import IncidentLogConfirmedScreen from "./src/screens/IncidentLogConfirmedScreen";
import CommunityScreen from "./src/screens/CommunityScreen";

// ✅ Admin
import AdminShell from "./src/screens/admin_mobile/AdminShell";

// Session helpers
import {
  isLoggedIn,
  setLoggedIn,
  getAccessToken,
  setHasPin,
  getHasPin,
  setStoredUser,
  getStoredUser,
  setAppLockRequired,
  isAppLockRequired,
  isPinUnlockedThisRun,
  setPinUnlockedThisRun,
  resetPinUnlockedThisRun,
  isOnboardingSeen,
  isPinSkippedForUser,
} from "./src/auth/session";

// APIs for PIN & profile
import { getMeApi, unlockWithPinApi } from "./src/api/pin";

// Push notifications
import * as Notifications from "expo-notifications";

// Types
import type { TabKey } from "./src/components/BottomNavBar";
import type { ReportItem } from "./src/screens/ReportScreen";

enableScreens(true);

// Configure how push notifications behave when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type RootStackParamList = {
  Splash: undefined;
  OnboardingPager: undefined;
  AuthFlow: undefined;
  Login: undefined;
  CreatePin: undefined;
  Pin: undefined;

  Main: { openReport?: ReportItem } | undefined;
  AdminHomeScreen: undefined;

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

function getErrorMessage(error: any): string {
  return String(error?.message || error?.payload?.message || "");
}

function isInvalidPinError(error: any): boolean {
  return getErrorMessage(error).toLowerCase().includes("invalid pin");
}

function isSessionAuthError(error: any): boolean {
  if (isInvalidPinError(error)) return false;

  const message = getErrorMessage(error).toLowerCase();
  return (
    error?.status === 401 ||
    message.includes("session expired") ||
    message.includes("invalid or expired access token") ||
    message.includes("invalid refresh token") ||
    message.includes("expired refresh token") ||
    message.includes("access token required")
  );
}

async function clearInvalidSession(auth: any) {
  resetPinUnlockedThisRun();
  try {
    await auth?.logout?.();
  } catch {}
  await setLoggedIn(false).catch(() => {});
  await setHasPin(false).catch(() => {});
  try {
    auth?.setUser?.(null);
  } catch {}
}

function AuthenticatedIdleBoundary({
  children,
}: {
  navigation: any;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

/* ===================== ROLE HELPERS ===================== */

function normalizeRole(role?: string) {
  return String(role || "").trim().toLowerCase();
}

function isBarangayOfficial(role?: string) {
  return normalizeRole(role) === "barangay official";
}

function getHomeRouteNameByRole(
  role?: string
): "Main" | "AdminHomeScreen" {
  return isBarangayOfficial(role) ? "AdminHomeScreen" : "Main";
}


/* ===================== ✅ LOCAL PIN ENABLE FLAG (DEVICE-LEVEL) ===================== */
/** SecureStore keys must only contain: A-Z a-z 0-9 . - _ */
function safeKeyPart(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
}

function pinEnabledKeyForEmail(email: string) {
  return `tahanansafe_pin_enabled_${safeKeyPart(email)}`;
}

/**
 * If key is missing, default to TRUE so existing users are not blocked.
 * Settings toggle writes "1" (enabled) or "0" (disabled).
 */
async function isPinEnabledLocally(email: string): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(pinEnabledKeyForEmail(email));
    if (v === null || v === undefined || String(v).trim() === "") return true;
    return v === "1";
  } catch {
    return true;
  }
}

/* ===================== MAIN SHELL ===================== */

function MainShell({
  onLogout,
  onOpenNotifications,
  incomingReport,
  clearIncomingReport,
  onGlobalMessagingHiddenChange,
}: {
  onLogout: () => void;
  onOpenNotifications: () => void;
  incomingReport?: ReportItem | null;
  clearIncomingReport: () => void;
  onGlobalMessagingHiddenChange: (hidden: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("Home");

  const [incidentStep, setIncidentStep] = useState<IncidentStep>("form");
  const [lastIncident, setLastIncident] = useState<LastIncident | null>(null);

  const [reportStep, setReportStep] = useState<ReportStep>("list");
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const isReportDetailScreen =
    activeTab === "Reports" && reportStep === "detail" && !!selectedReport;
  const shouldHideGlobalMessaging =
    isReportDetailScreen ||
    activeTab === "Incident" ||
    activeTab === "Settings";

  React.useLayoutEffect(() => {
    onGlobalMessagingHiddenChange(shouldHideGlobalMessaging);
    return () => onGlobalMessagingHiddenChange(false);
  }, [onGlobalMessagingHiddenChange, shouldHideGlobalMessaging]);

  const handleQuickExit = () => {
    Alert.alert("Quick Exit", "Returning to Login", [{ text: "OK", onPress: onLogout }]);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab !== "Incident") setIncidentStep("form");
    if (tab !== "Reports") setReportStep("list");
  };

  const openReportDetail = (item: ReportItem) => {
    setSelectedReport(item);
    setReportStep("detail");
    setActiveTab("Reports");
  };

  useEffect(() => {
    if (!incomingReport) return;

    try {
      setSelectedReport(incomingReport);
      setActiveTab("Reports");
      setReportStep("detail");
    } finally {
      clearIncomingReport();
    }
  }, [incomingReport, clearIncomingReport]);

  let foregroundScreen: React.ReactNode = null;

  if (activeTab === "Inbox") {
    foregroundScreen = (
      <InboxScreen initialTab="Inbox" onQuickExit={handleQuickExit} onTabChange={handleTabChange} />
    );
  } else if (activeTab === "Settings") {
    foregroundScreen = (
      <SettingsScreen
        initialTab="Settings"
        onTabChange={handleTabChange}
        onQuickExit={handleQuickExit}
        onLogout={onLogout}
      />
    );
  } else if (activeTab === "Community") {
    foregroundScreen = (
      <CommunityScreen initialTab="Community" onTabChange={handleTabChange} />
    );
  } else if (activeTab === "Incident") {
    foregroundScreen = incidentStep === "form" ? (
      <IncidentLogScreen
        onBack={() => setActiveTab("Home")}
        onSubmitted={(payload) => {
          setLastIncident(payload);
          setIncidentStep("confirmed");
        }}
      />
    ) : (
      <IncidentLogConfirmedScreen
        alertNo={formatAlertNo(lastIncident?.incidentId)}
        dateLine={formatDateLine(lastIncident?.createdAt)}
        onGoHome={() => {
          setActiveTab("Home");
          setIncidentStep("form");
        }}
      />
    );
  } else if (isReportDetailScreen && selectedReport) {
    foregroundScreen = (
      <ReportDetailScreen
        initialTab="Reports"
        report={selectedReport}
        onBack={() => setReportStep("list")}
        onQuickExit={handleQuickExit}
        onTabChange={handleTabChange}
      />
    );
  }

  const showReportList =
    activeTab === "Reports" && (reportStep === "list" || !selectedReport);

  return (
    <View style={styles.mainShell}>
      <View style={[styles.mainShellScreen, activeTab !== "Home" && styles.mainShellScreenHidden]}>
        <HomeScreen
          initialTab="Home"
          isActive={activeTab === "Home"}
          onQuickExit={handleQuickExit}
          onTabChange={handleTabChange}
          onOpenNotifications={onOpenNotifications}
          onOpenReport={openReportDetail}
        />
      </View>

      <View style={[styles.mainShellScreen, !showReportList && styles.mainShellScreenHidden]}>
        <ReportScreen
          initialTab="Reports"
          isActive={showReportList}
          onQuickExit={handleQuickExit}
          onTabChange={handleTabChange}
          onOpenReport={(item) => {
            setSelectedReport(item);
            setReportStep("detail");
          }}
        />
      </View>

      {foregroundScreen ? (
        <View style={styles.mainShellScreen}>{foregroundScreen}</View>
      ) : null}
    </View>
  );
}

/* ===================== HELPERS ===================== */

async function bootstrapAfterLogin({
  navigation,
  auth,
}: {
  navigation: any;
  auth: any;
}) {
  await setLoggedIn(true);

  try {
    const token = await getAccessToken();
    if (token) {
      const me = await getMeApi();

      try {
        auth?.setUser?.(me.user);
      } catch {
        // ignore
      }

      const hasPin = !!me.user.hasPin;
      const role = me?.user?.role;
      const targetHome = getHomeRouteNameByRole(role);

      await setHasPin(hasPin);
      await setStoredUser({ ...me.user, hasPin });

      const email = String(me?.user?.email || "").trim().toLowerCase();
      const pinLocalEnabled = email ? await isPinEnabledLocally(email) : true;

      if (hasPin && pinLocalEnabled) {
        if (isPinUnlockedThisRun()) {
          await setAppLockRequired(false).catch(() => {});
          navigation.reset({ index: 0, routes: [{ name: targetHome }] });
          return;
        }
        await setAppLockRequired(true).catch(() => {});
        navigation.reset({ index: 0, routes: [{ name: "Pin" }] });
        return;
      }

      if (hasPin && !pinLocalEnabled) {
        await setAppLockRequired(false).catch(() => {});
        setPinUnlockedThisRun(true);
        navigation.reset({ index: 0, routes: [{ name: targetHome }] });
        return;
      }

      const userId = String(me.user._id);
      const skipped = await isPinSkippedForUser(userId);
      if (skipped) {
        await setAppLockRequired(false).catch(() => {});
        navigation.reset({ index: 0, routes: [{ name: targetHome }] });
        return;
      }

      await setAppLockRequired(false).catch(() => {});
      navigation.reset({ index: 0, routes: [{ name: "CreatePin" }] });
      return;
    }
  } catch {}

  const hasPin = await getHasPin().catch(() => false);
  if (hasPin) {
    await setAppLockRequired(true).catch(() => {});
    navigation.reset({ index: 0, routes: [{ name: "Pin" }] });
    return;
  }

  await setAppLockRequired(false).catch(() => {});
  navigation.reset({ index: 0, routes: [{ name: "Main" }] });
}

/* ===================== MAIN SCREEN WRAPPER ===================== */

function MainScreenWrapper({
  navigation,
  route,
  onGlobalMessagingHiddenChange,
}: {
  navigation: any;
  route: any;
  onGlobalMessagingHiddenChange: (hidden: boolean) => void;
}) {
  const auth = useAuth() as any;

  const incomingReport: ReportItem | null = route?.params?.openReport ?? null;

  const handleLogout = async () => {
    resetPinUnlockedThisRun();
    try { await auth.logout(); } catch { /* ignore */ }
    await setLoggedIn(false);
    await setHasPin(false);
    navigation.reset({ index: 0, routes: [{ name: "AuthFlow" }] });
  };

  // PIN stays unlocked while this app process is alive; a fresh launch after process kill shows PinScreen.
  return (
    <AuthenticatedIdleBoundary navigation={navigation}>
      <MainShell
        onLogout={handleLogout}
        onOpenNotifications={() => navigation.navigate("Notifications")}
        incomingReport={incomingReport}
        clearIncomingReport={() => {
          try { navigation.setParams({ openReport: undefined }); } catch { /* ignore */ }
        }}
        onGlobalMessagingHiddenChange={onGlobalMessagingHiddenChange}
      />
    </AuthenticatedIdleBoundary>
  );
}

/* ===================== ADMIN HOME WRAPPER ===================== */

function AdminHomeWrapper({ navigation }: { navigation: any }) {
  const auth = useAuth() as any;

  const handleLogout = async () => {
    resetPinUnlockedThisRun();
    try { await auth.logout(); } catch { /* ignore */ }
    await setLoggedIn(false);
    await setHasPin(false);
    navigation.reset({ index: 0, routes: [{ name: "AuthFlow" }] });
  };

  // PIN stays unlocked while this app process is alive; a fresh launch after process kill shows PinScreen.
  return (
    <AuthenticatedIdleBoundary navigation={navigation}>
      <AdminShell
        onOpenNotifications={() => navigation.navigate("Notifications")}
        onLogout={handleLogout}
      />
    </AuthenticatedIdleBoundary>
  );
}

function NotificationsWrapper({ navigation }: { navigation: any }) {
  const auth = useAuth() as any;
  if (isBarangayOfficial(auth?.user?.role)) {
    return (
      <AuthenticatedIdleBoundary navigation={navigation}>
        <AdminNotificationsScreen onBack={() => navigation.goBack()} />
      </AuthenticatedIdleBoundary>
    );
  }

  return (
    <AuthenticatedIdleBoundary navigation={navigation}>
      <NotificationsScreen onBack={() => navigation.goBack()} />
    </AuthenticatedIdleBoundary>
  );
}

function ResidentMessagingHost({
  routeName,
  mainScreenHidden,
}: {
  routeName: string;
  mainScreenHidden: boolean;
}) {
  const auth = useAuth() as any;
  const residentRoute =
    routeName === "Main" || routeName === "Notifications";

  if (
    !residentRoute ||
    !auth?.user ||
    isBarangayOfficial(auth.user.role)
  ) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.messagingOverlay}>
      <GlobalReportMessaging
        hidden={routeName === "Main" && mainScreenHidden}
      />
    </View>
  );
}

/* ===================== ✅ PIN SCREEN WRAPPER ===================== */

function PinScreenWrapper({ navigation }: { navigation: any }) {
  const auth = useAuth() as any;
  const [storedUser, setStoredUserState] = React.useState<any>(null);
  const resolvedUser = auth?.user || storedUser;
  const accountEmail = String(resolvedUser?.email || "").trim().toLowerCase();
  const targetHome = getHomeRouteNameByRole(resolvedUser?.role);
  const [pinErrVisible, setPinErrVisible] = React.useState(false);
  const [pinErrMsg, setPinErrMsg] = React.useState("");
  const failCountRef = React.useRef(0);

  const MAX_PIN_ATTEMPTS = 3;

  React.useEffect(() => {
    let mounted = true;

    getStoredUser()
      .then((user) => {
        if (mounted) setStoredUserState(user);
      })
      .catch(() => {
        if (mounted) setStoredUserState(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const redirectToAuthFlow = React.useCallback(
    async () => {
      await clearInvalidSession(auth);
      navigation.reset({ index: 0, routes: [{ name: "AuthFlow" }] });
    },
    [auth, navigation]
  );

  const forceLogout = React.useCallback(async () => {
    resetPinUnlockedThisRun();
    try { await auth.logout(); } catch {}
    await setLoggedIn(false);
    await setHasPin(false);
    Alert.alert(
      "Logged Out",
      "Too many incorrect PIN attempts. Please log in again.",
      [{ text: "OK", onPress: () => navigation.reset({ index: 0, routes: [{ name: "AuthFlow" }] }) }],
    );
  }, [auth, navigation]);

  const handleBack = async () => {
    resetPinUnlockedThisRun();
    try { await auth.logout(); } catch {}
    await setLoggedIn(false);
    await setHasPin(false);
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  return (
    <PinScreen
      accountEmail={accountEmail}
      onBack={handleBack}
      onForgotPin={async () => {
        if (accountEmail) {
          await SecureStore.setItemAsync(pinEnabledKeyForEmail(accountEmail), "0").catch(() => {});
          await resetPinAttempts(accountEmail).catch(() => {});
        }

        resetPinUnlockedThisRun();
        try { await auth.logout(); } catch {}
        await setLoggedIn(false);
        await setHasPin(false);
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }}
      onBypass={() => {
        setAppLockRequired(false).catch(() => {});
        setPinUnlockedThisRun(true);
        navigation.reset({ index: 0, routes: [{ name: targetHome }] });
      }}
      invalidPinVisible={pinErrVisible}
      invalidPinMsg={pinErrMsg}
      onInvalidPinDismiss={() => setPinErrVisible(false)}
      onVerified={async (pin) => {
        try {
          // Unlock by account email + PIN so the app can recover even when
          // the previously stored access token has already expired.
          if (!accountEmail) {
            setPinErrMsg("Unable to determine which account to unlock. Please log in again.");
            setPinErrVisible(true);
            return;
          }

          const unlocked = await unlockWithPinApi({ email: accountEmail, pin });
          await auth.login({
            accessToken: unlocked.accessToken,
            refreshToken: unlocked.refreshToken,
            user: unlocked.user,
          });
          await setHasPin(!!unlocked.user?.hasPin);
          await setStoredUser(unlocked.user);

          // Reset brute-force counter only after successful verification
          failCountRef.current = 0;
          if (accountEmail) await resetPinAttempts(accountEmail);

          await setAppLockRequired(false).catch(() => {});
          setPinUnlockedThisRun(true);
          navigation.reset({ index: 0, routes: [{ name: targetHome }] });
        } catch (e: any) {
          if (isSessionAuthError(e)) {
            await redirectToAuthFlow();
            return;
          }

          const errMsg = String(e?.message || e?.payload?.message || "").toLowerCase();
          const isPinError = isInvalidPinError(e) || errMsg.includes("invalid pin");

          if (isPinError) {
            // Actual wrong PIN — count attempt
            failCountRef.current += 1;
            if (failCountRef.current >= MAX_PIN_ATTEMPTS) {
              forceLogout();
              return;
            }
            const remaining = MAX_PIN_ATTEMPTS - failCountRef.current;
            setPinErrMsg(`Incorrect PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
          } else {
            // Token/network error — show actual error for debugging
            setPinErrMsg(getErrorMessage(e) || "Connection error. Please try again.");
          }
          setPinErrVisible(true);
        }
      }}
    />
  );
}

/* ===================== CREATE PIN WRAPPER ===================== */

function CreatePinWrapper({ navigation }: { navigation: any }) {
  const auth = useAuth() as any;
  const targetHome = getHomeRouteNameByRole(auth?.user?.role);
  const [draftPin, setDraftPin] = useState<string | null>(null);

  const finishPinFlow = () => {
    setAppLockRequired(false).catch(() => {});
    setPinUnlockedThisRun(true);
    navigation.reset({ index: 0, routes: [{ name: targetHome }] });
  };

  if (draftPin !== null) {
    return (
      <VerifyPinScreen
        expectedPin={draftPin}
        onContinue={finishPinFlow}
        onSkip={finishPinFlow}
      />
    );
  }

  return (
    <CreatePinScreen
      onContinue={(pin) => setDraftPin(pin)}
      onSkip={finishPinFlow}
    />
  );
}

/* ===================== AUTH FLOW WRAPPER ===================== */

function AuthFlowWrapper({ navigation }: { navigation: any }) {
  const auth = useAuth() as any;

  return (
    <AuthFlowShell
      onExitToOnboarding={() => navigation.goBack()}
      onGoLogin={() => navigation.navigate("Login")}
      onAuthDone={async () => {
        await bootstrapAfterLogin({ navigation, auth });
      }}
    />
  );
}

/* ===================== LOGIN WRAPPER ===================== */

function LoginWrapper({ navigation }: { navigation: any }) {
  const auth = useAuth() as any;

  return (
    <LoginScreen
      onGoSignup={() => navigation.replace("AuthFlow")}
      onLoginSuccess={async () => {
        await bootstrapAfterLogin({ navigation, auth });
      }}
    />
  );
}

/* ===================== SPLASH WRAPPER ===================== */

function AppSplashScreenWrapper({
  onGoMain,
  onGoAdminHome,
  onGoPin,
  onGoCreatePin,
  onGoOnboarding,
  onGoAuthFlow,
}: {
  onGoMain: () => void;
  onGoAdminHome: () => void;
  onGoPin: () => void;
  onGoCreatePin: () => void;
  onGoOnboarding: () => void;
  onGoAuthFlow: () => void;
}) {
  const auth = useAuth() as any;

  React.useEffect(() => {
    let mounted = true;

    const t = setTimeout(async () => {
      try {
        const appLockRequired = await isAppLockRequired();
        const seenOnboarding = await isOnboardingSeen();
        if (!mounted) return;

        const logged = await isLoggedIn();
        if (!mounted) return;

        if (!logged) {
          try {
            auth?.setUser?.(null);
          } catch {}

          if (!seenOnboarding) onGoOnboarding();
          else onGoAuthFlow();
          return;
        }

        const token = await auth.ensureValidAccessToken();
        if (!token) {
          // If user was previously logged in with a PIN, go to PinScreen
          // instead of wiping session — PinScreenWrapper handles re-auth
          const hadPin = await getHasPin();
          if (logged && hadPin && (appLockRequired || !isPinUnlockedThisRun())) {
            onGoPin();
            return;
          }

          await clearInvalidSession(auth);
          if (!seenOnboarding) onGoOnboarding();
          else onGoAuthFlow();
          return;
        }

        const me = await getMeApi();

        try {
          auth?.setUser?.(me.user);
        } catch {}

        const hasPin = !!me.user.hasPin;
        const role = me?.user?.role;
        const isAdmin = isBarangayOfficial(role);

        await setHasPin(hasPin);
        await setStoredUser({ ...me.user, hasPin });
        if (!mounted) return;

        const email = String(me?.user?.email || "").trim().toLowerCase();
        const pinLocalEnabled = email ? await isPinEnabledLocally(email) : true;

        if (hasPin && pinLocalEnabled) {
          if (appLockRequired || !isPinUnlockedThisRun()) {
            onGoPin();
          } else {
            if (isAdmin) onGoAdminHome();
            else onGoMain();
          }
          return;
        }

        if (hasPin && !pinLocalEnabled) {
          await setAppLockRequired(false).catch(() => {});
          setPinUnlockedThisRun(true);
          if (isAdmin) onGoAdminHome();
          else onGoMain();
          return;
        }

        const userId = String(me.user._id);
        const skipped = await isPinSkippedForUser(userId);
        if (skipped) {
          await setAppLockRequired(false).catch(() => {});
          if (isAdmin) onGoAdminHome();
          else onGoMain();
          return;
        }

        await setAppLockRequired(false).catch(() => {});
        onGoCreatePin();
      } catch (error) {
        if (!mounted) return;

        try {
          if (isSessionAuthError(error)) {
            // If user had a PIN, show PinScreen instead of wiping session
            const wasLoggedInAuth = await isLoggedIn();
            const hadPinAuth = await getHasPin();
            const appLockRequired = await isAppLockRequired();
            if (wasLoggedInAuth && hadPinAuth && (appLockRequired || !isPinUnlockedThisRun())) {
              onGoPin();
              return;
            }

            await clearInvalidSession(auth);
            const seenOnboarding = await isOnboardingSeen();
            if (!seenOnboarding) onGoOnboarding();
            else onGoAuthFlow();
            return;
          }

          // If user was previously logged in with a PIN, go to PinScreen
          // instead of auth flow — PinScreenWrapper will handle token refresh
          const wasLoggedIn = await isLoggedIn();
          const hadPin = await getHasPin();
          const appLockRequired = await isAppLockRequired();

          if (wasLoggedIn && hadPin && (appLockRequired || !isPinUnlockedThisRun())) {
            onGoPin();
            return;
          }

          try {
            auth?.setUser?.(null);
          } catch {}

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
  }, [onGoMain, onGoAdminHome, onGoPin, onGoCreatePin, onGoOnboarding, onGoAuthFlow]);

  return <AppSplashScreen />;
}

/* ===================== APP ROOT ===================== */

export default function App() {
  const navigationRef = React.useRef<any>(null);
  const [activeRootRoute, setActiveRootRoute] = useState("Splash");
  const [mainScreenMessagingHidden, setMainScreenMessagingHidden] =
    useState(false);

  const syncActiveRootRoute = useCallback(() => {
    const nextRoute = navigationRef.current?.getCurrentRoute?.()?.name;
    if (!nextRoute) return;
    setActiveRootRoute((current) =>
      current === nextRoute ? current : nextRoute
    );
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppAlertProvider>
              <NavigationContainer
                ref={navigationRef}
                onReady={syncActiveRootRoute}
                onStateChange={syncActiveRootRoute}
              >
                <View style={styles.navigationRoot}>
                  <Stack.Navigator
                    id="root-stack"
                    initialRouteName="Splash"
                    screenOptions={{ headerShown: false, gestureEnabled: true }}
                  >
                  <Stack.Screen name="Splash">
                    {({ navigation }) => (
                      <AppSplashScreenWrapper
                        onGoMain={() => navigation.reset({ index: 0, routes: [{ name: "Main" }] })}
                        onGoAdminHome={() =>
                          navigation.reset({ index: 0, routes: [{ name: "AdminHomeScreen" }] })
                        }
                        onGoPin={() => navigation.reset({ index: 0, routes: [{ name: "Pin" }] })}
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
                        onDone={() => navigation.reset({ index: 0, routes: [{ name: "AuthFlow" }] })}
                      />
                    )}
                  </Stack.Screen>

                  <Stack.Screen name="AuthFlow">
                    {({ navigation }) => <AuthFlowWrapper navigation={navigation} />}
                  </Stack.Screen>

                  <Stack.Screen name="Login">
                    {({ navigation }) => <LoginWrapper navigation={navigation} />}
                  </Stack.Screen>

                  <Stack.Screen name="CreatePin">
                    {({ navigation }) => <CreatePinWrapper navigation={navigation} />}
                  </Stack.Screen>

                  <Stack.Screen name="Pin">
                    {({ navigation }) => <PinScreenWrapper navigation={navigation} />}
                  </Stack.Screen>

                  <Stack.Screen name="Main">
                    {({ navigation, route }) => (
                      <MainScreenWrapper
                        navigation={navigation}
                        route={route}
                        onGlobalMessagingHiddenChange={setMainScreenMessagingHidden}
                      />
                    )}
                  </Stack.Screen>

                  <Stack.Screen name="AdminHomeScreen">
                    {({ navigation }) => <AdminHomeWrapper navigation={navigation} />}
                  </Stack.Screen>

                  <Stack.Screen name="Notifications">
                    {({ navigation }) => <NotificationsWrapper navigation={navigation} />}
                  </Stack.Screen>
                  </Stack.Navigator>
                  <ResidentMessagingHost
                    routeName={activeRootRoute}
                    mainScreenHidden={mainScreenMessagingHidden}
                  />
                </View>
              </NavigationContainer>
            </AppAlertProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  navigationRoot: {
    flex: 1,
  },
  messagingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  mainShell: {
    flex: 1,
  },
  mainShellScreen: {
    flex: 1,
  },
  mainShellScreenHidden: {
    display: "none",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "#F5FAFE",
  },
  placeholderTitle: {
    ...Typography.flowTitle,
    color: "#0B2B45",
    marginBottom: 8,
  },
  placeholderText: {
    ...Typography.captionStrong,
    color: "#6B7280",
  },
});
