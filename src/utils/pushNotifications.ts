// src/utils/pushNotifications.ts
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { requestJson } from "../api/http";

/**
 * Register for push notifications and return the Expo Push Token.
 * Returns null if permissions denied or not a physical device.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  console.log("[Push] isDevice:", Device.isDevice);
  // Push only works on physical devices
  if (!Device.isDevice) {
    console.log("[Push] Must use physical device for push notifications");
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
  console.log("[Push] existingStatus:", existingStatus);
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log("[Push] requestedStatus:", finalStatus);
  }

  if (finalStatus !== "granted") {
    console.log("[Push] Permission not granted");
    return null;
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  console.log("[Push] projectId:", projectId);
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  console.log("[Push] token:", tokenData.data);
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
    console.warn("[Push] Failed to register token with backend:", e);
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
  console.log("[Push] setupPushNotifications started");
  try {
    const token = await registerForPushNotificationsAsync();
    console.log("[Push] Token obtained:", token ? token.substring(0, 30) + "..." : "null");
    if (token) {
      await sendPushTokenToBackend(token);
      console.log("[Push] Token sent to backend successfully");
    } else {
      console.log("[Push] No token — skipping backend registration");
    }
  } catch (e) {
    console.error("[Push] setupPushNotifications error:", e);
  }
}
