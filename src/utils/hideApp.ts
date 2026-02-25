import { Platform, PermissionsAndroid } from "react-native";
import HideAppModule from "../native/NativeHideAppModule";

async function ensureNotifPermissionAndroid13Plus() {
  if (Platform.OS !== "android") return true;

  // Android 13+ only needs runtime POST_NOTIFICATIONS
  // (Older Android ignores it)
  try {
    const granted = await PermissionsAndroid.request(
      // @ts-ignore
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function closeAndRemoveFromRecents() {
  if (Platform.OS !== "android") return;

  // Ask notification permission so the persistent notif can show
  await ensureNotifPermissionAndroid13Plus();

  HideAppModule.closeAndRemoveFromRecents();
}