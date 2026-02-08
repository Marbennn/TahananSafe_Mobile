// src/api/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const STORAGE_KEYS = {
  accessToken: "accessToken",
  refreshToken: "refreshToken",
  user: "user",
} as const;

export async function saveTokens(args: { accessToken: string; refreshToken?: string }) {
  await AsyncStorage.setItem(STORAGE_KEYS.accessToken, args.accessToken);
  if (args.refreshToken) await AsyncStorage.setItem(STORAGE_KEYS.refreshToken, args.refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.accessToken);
}

export async function saveUser(user: any) {
  await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

export async function clearAuth() {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.refreshToken,
    STORAGE_KEYS.user,
  ]);
}
