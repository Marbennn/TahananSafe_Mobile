import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerPushToken, unregisterPushToken } from "../api/notifications";

const PUSH_TOKEN_STORAGE_KEY = "tahanansafe_push_token_registration_v1";

export const NOTIFICATION_CHANGED_EVENT = "tahanan:notifChanged";

type StoredPushRegistration = {
  token: string;
  userId: string;
};

type SyncPushTokenArgs = {
  accessToken: string;
  userId: string;
};

let setupDone = false;
let handlerConfigured = false;

function ensureNotificationHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function readStoredRegistration(): Promise<StoredPushRegistration | null> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredPushRegistration | null;
    if (!parsed?.token || !parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeStoredRegistration(value: StoredPushRegistration | null): Promise<void> {
  try {
    if (!value) {
      await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
      return;
    }

    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore local cache failures
  }
}

function getExpoProjectId(): string | undefined {
  const easProjectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

  return typeof easProjectId === "string" && easProjectId.trim().length > 0
    ? easProjectId
    : undefined;
}

async function requestPermissionsAndToken(): Promise<string | null> {
  ensureNotificationHandler();
  await ensurePushNotificationSetup();

  const current = await Notifications.getPermissionsAsync();
  console.log("[push] current permissions", {
    granted: current.granted,
    canAskAgain: current.canAskAgain,
    iosStatus: current.ios?.status ?? null,
    androidImportance: current.android?.importance ?? null,
  });
  let granted =
    current.granted ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    console.log("[push] requested permissions result", {
      granted: requested.granted,
      canAskAgain: requested.canAskAgain,
      iosStatus: requested.ios?.status ?? null,
      androidImportance: requested.android?.importance ?? null,
    });

    granted =
      requested.granted ||
      requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }

  if (!granted) {
    console.log("[push] notification permission not granted");
    return null;
  }

  const projectId = getExpoProjectId();
  console.log("[push] requesting Expo push token", {
    projectId: projectId ?? null,
    platform: Platform.OS,
  });
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  console.log("[push] Expo push token received", {
    token: token.data ?? null,
  });

  return token.data || null;
}

export async function ensurePushNotificationSetup(): Promise<void> {
  ensureNotificationHandler();
  if (setupDone) return;
  setupDone = true;

  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
  });
}

export async function syncPushTokenForSession({
  accessToken,
  userId,
}: SyncPushTokenArgs): Promise<string | null> {
  const normalizedUserId = String(userId || "").trim();
  if (!accessToken || !normalizedUserId) {
    console.log("[push] skipped sync because session is incomplete", {
      hasAccessToken: !!accessToken,
      userId: normalizedUserId || null,
    });
    return null;
  }

  const expoPushToken = await requestPermissionsAndToken().catch((error) => {
    console.log("[push] failed to get Expo push token", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
  if (!expoPushToken) {
    console.log("[push] no Expo push token available; unregistering cached token if present");
    await unregisterStoredPushToken(accessToken).catch(() => {});
    return null;
  }

  const previous = await readStoredRegistration();
  if (previous?.token === expoPushToken && previous.userId === normalizedUserId) {
    console.log("[push] token already synced for current user", {
      userId: normalizedUserId,
      token: expoPushToken,
    });
    return expoPushToken;
  }

  console.log("[push] registering token with backend", {
    userId: normalizedUserId,
    token: expoPushToken,
    platform: Platform.OS,
    deviceName: Constants.deviceName ?? null,
  });
  await registerPushToken(
    {
      token: expoPushToken,
      platform: Platform.OS,
      deviceName: Constants.deviceName ?? null,
    },
    accessToken
  );
  console.log("[push] backend token registration complete", {
    userId: normalizedUserId,
    token: expoPushToken,
  });

  await writeStoredRegistration({ token: expoPushToken, userId: normalizedUserId });
  return expoPushToken;
}

export async function unregisterStoredPushToken(
  explicitAccessToken?: string | null
): Promise<void> {
  const previous = await readStoredRegistration();
  if (!previous?.token) {
    console.log("[push] no stored token to unregister");
    await writeStoredRegistration(null);
    return;
  }

  if (explicitAccessToken) {
    console.log("[push] unregistering token from backend", {
      userId: previous.userId,
      token: previous.token,
    });
    await unregisterPushToken({ token: previous.token }, explicitAccessToken).catch(() => {});
  }

  await writeStoredRegistration(null);
  console.log("[push] cleared locally stored push token", {
    userId: previous.userId,
    token: previous.token,
  });
}
