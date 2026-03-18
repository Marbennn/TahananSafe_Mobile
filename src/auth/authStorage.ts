// src/auth/authStorage.ts
// ✅ SECURITY FIX: Tokens now stored in SecureStore (encrypted) instead of AsyncStorage (plaintext)
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const KEYS = {
  accessToken: "tahanansafe_access_token",   // SecureStore key (no @ prefix)
  refreshToken: "tahanansafe_refresh_token", // SecureStore key
  user: "@tahanansafe_user",                 // AsyncStorage key (non-sensitive metadata only)
} as const;

// Legacy AsyncStorage keys for migration cleanup
const LEGACY_KEYS = {
  accessToken: "@tahanansafe_access_token",
  refreshToken: "@tahanansafe_refresh_token",
} as const;

export type StoredUser = {
  _id?: string;
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  hasPin?: boolean;
  profileImage?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  age?: number;
  [key: string]: any;
};

/**
 * ✅ Strips sensitive fields before persisting user object.
 * Only non-sensitive metadata is stored in AsyncStorage.
 */
function sanitizeUser(user: StoredUser): StoredUser {
  const { phoneNumber, dateOfBirth, ...safe } = user;
  return safe;
}

export async function saveSession(params: {
  accessToken: string;
  refreshToken?: string;
  user?: StoredUser | null;
}) {
  // ✅ Tokens go to SecureStore (encrypted)
  await SecureStore.setItemAsync(KEYS.accessToken, params.accessToken);

  if (params.refreshToken) {
    await SecureStore.setItemAsync(KEYS.refreshToken, params.refreshToken);
  }

  // ✅ User metadata (sanitized) goes to AsyncStorage
  if (params.user) {
    await AsyncStorage.setItem(KEYS.user, JSON.stringify(sanitizeUser(params.user)));
  }

  // ✅ Clean up legacy plaintext tokens from AsyncStorage
  await AsyncStorage.multiRemove([LEGACY_KEYS.accessToken, LEGACY_KEYS.refreshToken]).catch(() => {});
}

export async function getSession(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  user: StoredUser | null;
}> {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  try {
    accessToken = await SecureStore.getItemAsync(KEYS.accessToken);
  } catch {
    // Fallback: check legacy AsyncStorage (one-time migration)
    accessToken = await AsyncStorage.getItem(LEGACY_KEYS.accessToken);
    if (accessToken) {
      await SecureStore.setItemAsync(KEYS.accessToken, accessToken);
      await AsyncStorage.removeItem(LEGACY_KEYS.accessToken);
    }
  }

  try {
    refreshToken = await SecureStore.getItemAsync(KEYS.refreshToken);
  } catch {
    refreshToken = await AsyncStorage.getItem(LEGACY_KEYS.refreshToken);
    if (refreshToken) {
      await SecureStore.setItemAsync(KEYS.refreshToken, refreshToken);
      await AsyncStorage.removeItem(LEGACY_KEYS.refreshToken);
    }
  }

  const userStr = await AsyncStorage.getItem(KEYS.user);

  return {
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
    user: userStr ? (JSON.parse(userStr) as StoredUser) : null,
  };
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.accessToken).catch(() => {}),
    SecureStore.deleteItemAsync(KEYS.refreshToken).catch(() => {}),
    AsyncStorage.removeItem(KEYS.user),
    // Also clean legacy keys
    AsyncStorage.removeItem(LEGACY_KEYS.accessToken).catch(() => {}),
    AsyncStorage.removeItem(LEGACY_KEYS.refreshToken).catch(() => {}),
  ]);
}
