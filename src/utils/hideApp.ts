// src/utils/hideApp.ts
import { Alert, NativeModules, Platform } from "react-native";

type HideAppModuleType = {
  hide: () => void;
};

const HideAppModule = NativeModules.HideAppModule as HideAppModuleType | undefined;

export function hideApp() {
  // ✅ Debug logs (to confirm you're running the Dev Build, not Expo Go)
  console.log("[hideApp] Platform:", Platform.OS);
  console.log("[hideApp] NativeModules.HideAppModule =", NativeModules.HideAppModule);
  console.log(
    "[hideApp] NativeModules keys (first 30) =",
    Object.keys(NativeModules).slice(0, 30)
  );

  if (Platform.OS === "android") {
    if (!HideAppModule?.hide) {
      Alert.alert(
        "Hide App not available",
        "This feature requires a Development Build / EAS build (not Expo Go).\n\n" +
          "If you're using tunnel, start Metro with:\n" +
          "npx expo start --dev-client --tunnel\n\n" +
          "Then open your installed Dev Build app (NOT Expo Go)."
      );
      return;
    }

    // ✅ send app to background (hide)
    HideAppModule.hide();
    return;
  }

  // iOS does not allow apps to programmatically close/minimize.
  Alert.alert("Not supported", "iOS does not allow apps to hide/minimize programmatically.");
}