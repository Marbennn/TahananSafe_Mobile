// src/api/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * ✅ IMPORTANT:
 * These keys MUST match src/auth/session.ts
 * Otherwise, APIs will not find the saved token.
 */
export const STORAGE_KEYS = {
  accessToken: "@tahanansafe_access_token",
  refreshToken: "@tahanansafe_refresh_token",
  user: "@tahanansafe_user", // (optional) if you also want to store user here
} as const;

export async function saveTokens(args: {
  accessToken: string;
  refreshToken?: string;
}) {
  await AsyncStorage.setItem(STORAGE_KEYS.accessToken, args.accessToken);
  if (args.refreshToken) {
    await AsyncStorage.setItem(STORAGE_KEYS.refreshToken, args.refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return (await AsyncStorage.getItem(STORAGE_KEYS.accessToken)) ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return (await AsyncStorage.getItem(STORAGE_KEYS.refreshToken)) ?? null;
}

export async function saveUser(user: any) {
  await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

export async function getUser(): Promise<any | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.user);
  return raw ? JSON.parse(raw) : null;
}

export async function clearAuth() {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.refreshToken,
    STORAGE_KEYS.user,
  ]);
}
