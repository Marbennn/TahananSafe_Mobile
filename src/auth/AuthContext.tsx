// src/auth/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";

import { getMeApi } from "../api/pin";
import { refreshAccessTokenApi } from "../api/auth";

import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  setLoggedIn,
  isLoggedIn as isLoggedInFlag,
  clearSession,
} from "./session";

import { setupPushNotifications, removePushTokenFromBackend } from "../utils/pushNotifications";

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
  role?: string;
  [key: string]: any;
};

type AuthState = {
  isBooting: boolean;
  isLoggedIn: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: StoredUser | null;
};

type AuthContextType = AuthState & {
  login: (payload: {
    accessToken: string;
    refreshToken?: string;
    user?: StoredUser;
  }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: StoredUser | null) => void;
  refreshMe: () => Promise<void>;
  ensureValidAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function normalizeUser(input: any): StoredUser | null {
  if (!input) return null;

  const u = input?.user ?? input;

  const firstName =
    (typeof u?.firstName === "string" && u.firstName.trim()) ||
    (typeof u?.profile?.firstName === "string" && u.profile.firstName.trim()) ||
    (typeof u?.personalInfo?.firstName === "string" &&
      u.personalInfo.firstName.trim()) ||
    "";

  const lastName =
    (typeof u?.lastName === "string" && u.lastName.trim()) ||
    (typeof u?.profile?.lastName === "string" && u.profile.lastName.trim()) ||
    (typeof u?.personalInfo?.lastName === "string" &&
      u.personalInfo.lastName.trim()) ||
    "";

  return {
    _id: u?._id ? String(u._id) : undefined,
    id: u?.id ? String(u.id) : undefined,
    email: typeof u?.email === "string" ? u.email : undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: typeof u?.name === "string" ? u.name : undefined,
    hasPin: !!u?.hasPin,
    profileImage: u?.profileImage,
    phoneNumber: u?.phoneNumber,
    dateOfBirth: u?.dateOfBirth,
    gender: u?.gender,
    age: u?.age,
    role: typeof u?.role === "string" ? u.role : undefined,
    ...u,
  };
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    if (typeof globalThis.atob === "function") {
      return JSON.parse(globalThis.atob(padded));
    }

    return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function getTokenExpiryMs(token: string | null): number | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp);

  if (!Number.isFinite(exp) || exp <= 0) return null;
  return exp * 1000;
}

function isTokenExpiringSoon(token: string | null, bufferMs = 2 * 60 * 1000): boolean {
  const expiryMs = getTokenExpiryMs(token);
  if (!expiryMs) return true;

  const now = Date.now();
  return expiryMs - now <= bufferMs;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isBooting, setIsBooting] = useState(true);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);

  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

  const refreshMe = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) return;

    try {
      const me = await getMeApi();
      const normalized = normalizeUser(me);
      if (normalized) {
        setUser(normalized);
      }
    } catch {
      // ignore
    }
  };

  const logout = async () => {
    // Remove push token from backend before clearing session
    await removePushTokenFromBackend().catch(() => {});

    setAccessTokenState(null);
    setRefreshTokenState(null);
    setUser(null);

    await clearSession().catch(() => {});
    await setLoggedIn(false).catch(() => {});
  };

  const performRefresh = async (): Promise<string | null> => {
    const currentRefreshToken = refreshToken || (await getRefreshToken());

    if (!currentRefreshToken) {
      // Don't logout — preserve session so PinScreen can still show
      return null;
    }

    try {
      const data = await refreshAccessTokenApi(currentRefreshToken);

      const nextAccessToken = data.accessToken;
      const nextRefreshToken = data.refreshToken || currentRefreshToken;

      await saveTokens({
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
      });
      await setLoggedIn(true);

      setAccessTokenState(nextAccessToken);
      setRefreshTokenState(nextRefreshToken);

      if (data.user) {
        const normalized = normalizeUser(data.user);
        if (normalized) {
          setUser(normalized);
        }
      } else {
        try {
          const me = await getMeApi();
          const normalized = normalizeUser(me);
          if (normalized) setUser(normalized);
        } catch {
          // ignore
        }
      }

      return nextAccessToken;
    } catch {
      // Don't logout here — preserve session so PinScreen can still show
      return null;
    }
  };

  const ensureValidAccessToken = async (): Promise<string | null> => {
    const token = accessToken || (await getAccessToken());

    if (token && !isTokenExpiringSoon(token)) {
      return token;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    refreshInFlightRef.current = performRefresh();

    try {
      return await refreshInFlightRef.current;
    } finally {
      refreshInFlightRef.current = null;
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = await getAccessToken();
        const rToken = await getRefreshToken();
        const logged = await isLoggedInFlag();

        if (!mounted) return;

        if (logged && token) {
          setAccessTokenState(token);
          setRefreshTokenState(rToken);
          await setLoggedIn(true);

          const validToken = await ensureValidAccessToken();
          if (validToken) {
            try {
              const me = await getMeApi();
              const normalized = normalizeUser(me);
              if (normalized && mounted) setUser(normalized);
            } catch {
              // ignore
            }
            // Re-register push token on app boot (token may have changed)
            setupPushNotifications().catch(() => {});
          }
        } else {
          setAccessTokenState(null);
          setRefreshTokenState(null);
          setUser(null);
        }
      } finally {
        if (mounted) setIsBooting(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState: AppStateStatus) => {
      if (nextState === "active") {
        await ensureValidAccessToken();
      }
    });

    return () => {
      sub.remove();
    };
  }, [accessToken, refreshToken]);

  useEffect(() => {
    const interval = setInterval(() => {
      ensureValidAccessToken().catch(() => {});
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [accessToken, refreshToken]);

  const login = async (payload: {
    accessToken: string;
    refreshToken?: string;
    user?: StoredUser;
  }) => {
    await clearSession().catch(() => {});

    await saveTokens({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
    });
    await setLoggedIn(true);

    setAccessTokenState(payload.accessToken);
    setRefreshTokenState(payload.refreshToken ?? null);

    const normalized = normalizeUser(payload.user);
    if (normalized) {
      setUser(normalized);
    } else {
      try {
        const me = await getMeApi();
        const normalizedMe = normalizeUser(me);
        if (normalizedMe) setUser(normalizedMe);
      } catch {
        // ignore
      }
    }

    // Register push token after login — small delay to ensure tokens are persisted
    setTimeout(() => {
      setupPushNotifications().catch((e) => console.error("[Push] login registration error:", e));
    }, 1500);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      isBooting,
      isLoggedIn: !!accessToken,
      accessToken,
      refreshToken,
      user,
      login,
      logout,
      setUser,
      refreshMe,
      ensureValidAccessToken,
    }),
    [isBooting, accessToken, refreshToken, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}