// src/utils/pushNotifications.ts
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { requestJson } from "../api/http";
import { devLog } from "./safeLog";

/**
 * Register for push notifications and return the Expo Push Token.
 * Returns null if permissions denied or not a physical device.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  devLog("[Push] isDevice:", Device.isDevice);
  // Push only works on physical devices
  if (!Device.isDevice) {
    devLog("[Push] Must use physical device for push notifications");
    return null;
  }

  // Set up Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });
  }

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  devLog("[Push] existingStatus:", existingStatus);
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    devLog("[Push] requestedStatus:", finalStatus);
  }

  if (finalStatus !== "granted") {
    devLog("[Push] Permission not granted");
    return null;
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  devLog("[Push] projectId:", projectId);
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  // ✅ SECURITY: Don't log full push token in production
  return tokenData.data; // e.g. "ExponentPushToken[xxxxx]"
}

/**
 * Send the push token to the backend to associate with the current user.
 */
export async function sendPushTokenToBackend(token: string): Promise<void> {
  try {
    await requestJson({
      method: "POST",
      path: "/api/mobile/v1/notifications/push-token",
      body: { token },
      auth: true,
    });
  } catch (e) {
    devLog("[Push] Failed to register token with backend:", e);
  }
}

/**
 * Remove push token from backend (call on logout).
 */
export async function removePushTokenFromBackend(): Promise<void> {
  try {
    await requestJson({
      method: "DELETE",
      path: "/api/mobile/v1/notifications/push-token",
      auth: true,
    });
  } catch {
    // ignore — user is logging out anyway
  }
}

/**
 * Full registration flow: get token + send to backend.
 */
export async function setupPushNotifications(): Promise<void> {
  devLog("[Push] setupPushNotifications started");
  try {
    const token = await registerForPushNotificationsAsync();
    devLog("[Push] Token obtained:", token ? token.substring(0, 30) + "..." : "null");
    if (token) {
      await sendPushTokenToBackend(token);
      devLog("[Push] Token sent to backend successfully");
    } else {
      devLog("[Push] No token — skipping backend registration");
    }
  } catch (e) {
    devLog("[Push] setupPushNotifications error:", e);
  }
}
