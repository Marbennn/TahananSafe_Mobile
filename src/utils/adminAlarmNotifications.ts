import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import type { NotificationItem } from "../api/notifications";

const ADMIN_ALARM_CHANNEL_ID = "admin-alarms";

let handlerConfigured = false;
let permissionsReady: boolean | null = null;

function configureNotificationHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

function hasPermission(status: Notifications.NotificationPermissionsStatus) {
  return !!(
    status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function ensureAdminAlarmNotificationPermissions(): Promise<boolean> {
  configureNotificationHandler();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ADMIN_ALARM_CHANNEL_ID, {
      name: "Admin alarms",
      importance: Notifications.AndroidImportance.HIGH,
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  if (permissionsReady !== null) {
    return permissionsReady;
  }

  const current = await Notifications.getPermissionsAsync();
  if (hasPermission(current)) {
    permissionsReady = true;
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  permissionsReady = hasPermission(requested);
  return permissionsReady;
}

export async function showAdminAlarmNotification(
  notification: Pick<NotificationItem, "id" | "title" | "message" | "time">
): Promise<boolean> {
  const allowed = await ensureAdminAlarmNotificationPermissions();
  if (!allowed) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title || "New alarm received",
      body: notification.message || "A resident sent an SOS alarm.",
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: {
        notificationId: notification.id,
        receivedAt: notification.time,
        type: "admin-alert",
      },
    },
    trigger: null,
  });

  return true;
}
