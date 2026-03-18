// src/auth/session.ts
// ✅ SECURITY FIX: Tokens stored in SecureStore (encrypted) instead of AsyncStorage
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const KEYS = {
  loggedIn: "@tahanansafe_logged_in",
  accessToken: "tahanansafe_access_token",   // SecureStore
  refreshToken: "tahanansafe_refresh_token", // SecureStore
  hasPin: "@tahanansafe_has_pin",
  user: "@tahanansafe_user",
  onboardingSeen: "@tahanansafe_onboarding_seen",
  pinSkipped: "@tahanansafe_pin_skipped",
} as const;

// Legacy AsyncStorage keys for migration
const LEGACY_KEYS = {
  accessToken: "@tahanansafe_access_token",
  refreshToken: "@tahanansafe_refresh_token",
} as const;

/**
 * ✅ In-memory flag ONLY for current app run
 * - resets when app is fully closed
 * - used to bypass PinScreen after user just verified PIN
 */
let pinUnlockedThisRun = false;

export function setPinUnlockedThisRun(value: boolean) {
  pinUnlockedThisRun = value;
}

export function isPinUnlockedThisRun(): boolean {
  return pinUnlockedThisRun;
}

export function resetPinUnlockedThisRun() {
  pinUnlockedThisRun = false;
}

/* ===================== ONBOARDING FLAG ===================== */

export async function setOnboardingSeen(value: boolean) {
  await AsyncStorage.setItem(KEYS.onboardingSeen, value ? "1" : "0");
}

export async function isOnboardingSeen(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEYS.onboardingSeen);
  return v === "1";
}

/* ===================== PIN SKIP (LEGACY GLOBAL) ===================== */

export async function setPinSkipped(value: boolean) {
  await AsyncStorage.setItem(KEYS.pinSkipped, value ? "1" : "0");
}

export async function isPinSkipped(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEYS.pinSkipped);
  return v === "1";
}

/* ===================== PIN SKIP (PER USER) ===================== */

function keyPinSkippedForUser(userId: string) {
  return `@tahanansafe_pin_skipped_${userId}`;
}

export async function setPinSkippedForUser(userId: string, value: boolean) {
  if (!userId) return;
  await AsyncStorage.setItem(keyPinSkippedForUser(userId), value ? "1" : "0");
}

export async function isPinSkippedForUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  const v = await AsyncStorage.getItem(keyPinSkippedForUser(userId));
  return v === "1";
}

/* ===================== AUTH / TOKENS ===================== */

export async function setLoggedIn(value: boolean) {
  if (value) {
    await AsyncStorage.setItem(KEYS.loggedIn, "1");
  } else {
    pinUnlockedThisRun = false;

    await Promise.all([
      AsyncStorage.multiRemove([KEYS.loggedIn, KEYS.hasPin, KEYS.user]),
      SecureStore.deleteItemAsync(KEYS.accessToken).catch(() => {}),
      SecureStore.deleteItemAsync(KEYS.refreshToken).catch(() => {}),
      // Clean legacy keys
      AsyncStorage.removeItem(LEGACY_KEYS.accessToken).catch(() => {}),
      AsyncStorage.removeItem(LEGACY_KEYS.refreshToken).catch(() => {}),
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
  // ✅ Tokens stored in SecureStore (encrypted)
  await SecureStore.setItemAsync(KEYS.accessToken, params.accessToken);

  if (params.refreshToken) {
    await SecureStore.setItemAsync(KEYS.refreshToken, params.refreshToken);
  }

  // Clean legacy plaintext copies
  await AsyncStorage.multiRemove([LEGACY_KEYS.accessToken, LEGACY_KEYS.refreshToken]).catch(() => {});
}

export async function setAccessToken(accessToken: string) {
  await SecureStore.setItemAsync(KEYS.accessToken, accessToken);
  await AsyncStorage.removeItem(LEGACY_KEYS.accessToken).catch(() => {});
}

export async function setRefreshToken(refreshToken: string) {
  await SecureStore.setItemAsync(KEYS.refreshToken, refreshToken);
  await AsyncStorage.removeItem(LEGACY_KEYS.refreshToken).catch(() => {});
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(KEYS.accessToken);
    if (token) return token;
  } catch {}

  // One-time migration from legacy AsyncStorage
  const legacy = await AsyncStorage.getItem(LEGACY_KEYS.accessToken);
  if (legacy) {
    await SecureStore.setItemAsync(KEYS.accessToken, legacy);
    await AsyncStorage.removeItem(LEGACY_KEYS.accessToken);
    return legacy;
  }

  return null;
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(KEYS.refreshToken);
    if (token) return token;
  } catch {}

  const legacy = await AsyncStorage.getItem(LEGACY_KEYS.refreshToken);
  if (legacy) {
    await SecureStore.setItemAsync(KEYS.refreshToken, legacy);
    await AsyncStorage.removeItem(LEGACY_KEYS.refreshToken);
    return legacy;
  }

  return null;
}

export async function setHasPin(value: boolean) {
  await AsyncStorage.setItem(KEYS.hasPin, value ? "1" : "0");
}

export async function getHasPin(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEYS.hasPin);
  return v === "1";
}

export async function clearSession() {
  pinUnlockedThisRun = false;

  await Promise.all([
    AsyncStorage.multiRemove([KEYS.loggedIn, KEYS.hasPin, KEYS.user]),
    SecureStore.deleteItemAsync(KEYS.accessToken).catch(() => {}),
    SecureStore.deleteItemAsync(KEYS.refreshToken).catch(() => {}),
    AsyncStorage.removeItem(LEGACY_KEYS.accessToken).catch(() => {}),
    AsyncStorage.removeItem(LEGACY_KEYS.refreshToken).catch(() => {}),
  ]);
}
