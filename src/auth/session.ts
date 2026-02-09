// src/auth/session.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  loggedIn: "@tahanansafe_logged_in",
  accessToken: "@tahanansafe_access_token",
  refreshToken: "@tahanansafe_refresh_token",
  hasPin: "@tahanansafe_has_pin",
} as const;

export async function setLoggedIn(value: boolean) {
  if (value) {
    await AsyncStorage.setItem(KEYS.loggedIn, "1");
  } else {
    // logging out clears everything
    await AsyncStorage.multiRemove([
      KEYS.loggedIn,
      KEYS.accessToken,
      KEYS.refreshToken,
      KEYS.hasPin,
    ]);
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEYS.loggedIn);
  return v === "1";
}

export async function saveTokens(params: {
  accessToken: string;
  refreshToken?: string;
}) {
  await AsyncStorage.setItem(KEYS.accessToken, params.accessToken);
  if (params.refreshToken) {
    await AsyncStorage.setItem(KEYS.refreshToken, params.refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return (await AsyncStorage.getItem(KEYS.accessToken)) ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return (await AsyncStorage.getItem(KEYS.refreshToken)) ?? null;
}

export async function setHasPin(value: boolean) {
  await AsyncStorage.setItem(KEYS.hasPin, value ? "1" : "0");
}

export async function getHasPin(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEYS.hasPin);
  return v === "1";
}

export async function clearSession() {
  await AsyncStorage.multiRemove([
    KEYS.loggedIn,
    KEYS.accessToken,
    KEYS.refreshToken,
    KEYS.hasPin,
  ]);
}
