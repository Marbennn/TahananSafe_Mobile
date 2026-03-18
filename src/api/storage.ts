// src/api/storage.ts
// ✅ SECURITY FIX: Tokens stored in SecureStore (encrypted)
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * ✅ IMPORTANT:
 * Token keys MUST match src/auth/session.ts (SecureStore keys)
 */
export const STORAGE_KEYS = {
  accessToken: "tahanansafe_access_token",   // SecureStore
  refreshToken: "tahanansafe_refresh_token", // SecureStore
  user: "@tahanansafe_user",
} as const;

const LEGACY_KEYS = {
  accessToken: "@tahanansafe_access_token",
  refreshToken: "@tahanansafe_refresh_token",
} as const;

export async function saveTokens(args: {
  accessToken: string;
  refreshToken?: string;
}) {
  await SecureStore.setItemAsync(STORAGE_KEYS.accessToken, args.accessToken);
  if (args.refreshToken) {
    await SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, args.refreshToken);
  }
  // Clean legacy plaintext copies
  await AsyncStorage.multiRemove([LEGACY_KEYS.accessToken, LEGACY_KEYS.refreshToken]).catch(() => {});
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.accessToken);
    if (token) return token;
  } catch {}
  // Migration fallback
  const legacy = await AsyncStorage.getItem(LEGACY_KEYS.accessToken);
  if (legacy) {
    await SecureStore.setItemAsync(STORAGE_KEYS.accessToken, legacy);
    await AsyncStorage.removeItem(LEGACY_KEYS.accessToken);
    return legacy;
  }
  return null;
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.refreshToken);
    if (token) return token;
  } catch {}
  const legacy = await AsyncStorage.getItem(LEGACY_KEYS.refreshToken);
  if (legacy) {
    await SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, legacy);
    await AsyncStorage.removeItem(LEGACY_KEYS.refreshToken);
    return legacy;
  }
  return null;
}

export async function saveUser(user: any) {
  // ✅ Strip sensitive fields before storing
  const { phoneNumber, dateOfBirth, ...safe } = user || {};
  await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(safe));
}

export async function getUser(): Promise<any | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.user);
  return raw ? JSON.parse(raw) : null;
}

export async function clearAuth() {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken).catch(() => {}),
    SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken).catch(() => {}),
    AsyncStorage.removeItem(STORAGE_KEYS.user),
    AsyncStorage.removeItem(LEGACY_KEYS.accessToken).catch(() => {}),
    AsyncStorage.removeItem(LEGACY_KEYS.refreshToken).catch(() => {}),
  ]);
}
