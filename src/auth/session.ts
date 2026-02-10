// src/auth/session.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  loggedIn: "@tahanansafe_logged_in",
  accessToken: "@tahanansafe_access_token",
  refreshToken: "@tahanansafe_refresh_token",
  hasPin: "@tahanansafe_has_pin",

  // ✅ onboarding shown flag
  onboardingSeen: "@tahanansafe_onboarding_seen",

  // ✅ legacy: global skip pin (keep for backward compatibility)
  pinSkipped: "@tahanansafe_pin_skipped",
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
    // ✅ logging out clears session tokens + login flags
    // ✅ but it should NOT delete per-user pinSkipped_*
    pinUnlockedThisRun = false;

    await AsyncStorage.multiRemove([
      KEYS.loggedIn,
      KEYS.accessToken,
      KEYS.refreshToken,
      KEYS.hasPin,
      // ✅ don't remove KEYS.pinSkipped (legacy) OR per-user keys
    ]);

    // ✅ NOTE: we do NOT remove onboardingSeen (so onboarding stays one-time)
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
  // ✅ clearing session resets in-memory unlock too
  pinUnlockedThisRun = false;

  await AsyncStorage.multiRemove([
    KEYS.loggedIn,
    KEYS.accessToken,
    KEYS.refreshToken,
    KEYS.hasPin,
    // ✅ do NOT remove per-user pinSkipped_*
  ]);

  // ✅ NOTE: do NOT remove onboardingSeen
}
