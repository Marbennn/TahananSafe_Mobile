// src/auth/authStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  accessToken: "@tahanansafe_access_token",
  refreshToken: "@tahanansafe_refresh_token",
  user: "@tahanansafe_user",
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

export async function saveSession(params: {
  accessToken: string;
  refreshToken?: string;
  user?: StoredUser | null;
}) {
  await AsyncStorage.setItem(KEYS.accessToken, params.accessToken);

  if (params.refreshToken) {
    await AsyncStorage.setItem(KEYS.refreshToken, params.refreshToken);
  }

  if (params.user) {
    await AsyncStorage.setItem(KEYS.user, JSON.stringify(params.user));
  }
}

export async function getSession(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  user: StoredUser | null;
}> {
  const [accessToken, refreshToken, userStr] = await Promise.all([
    AsyncStorage.getItem(KEYS.accessToken),
    AsyncStorage.getItem(KEYS.refreshToken),
    AsyncStorage.getItem(KEYS.user),
  ]);

  return {
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
    user: userStr ? (JSON.parse(userStr) as StoredUser) : null,
  };
}

export async function clearSession() {
  await Promise.all([
    AsyncStorage.removeItem(KEYS.accessToken),
    AsyncStorage.removeItem(KEYS.refreshToken),
    AsyncStorage.removeItem(KEYS.user),
  ]);
}
