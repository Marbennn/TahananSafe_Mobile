// src/auth/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus, View } from "react-native";

import { getMeApi } from "../api/pin";
import { refreshAccessTokenApi, logoutApi } from "../api/auth";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  setLoggedIn,
  isLoggedIn as isLoggedInFlag,
  clearSession,
} from "./session";

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
  const lastActivityRef = useRef<number>(Date.now());
  const backgroundedAtRef = useRef<number | null>(null);

  const refreshMe = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) return;

    try {
      const me = await getMeApi({ accessToken: token });
      const normalized = normalizeUser(me);
      if (normalized) {
        setUser(normalized);
      }
    } catch {
      // ignore
    }
  };

  const logout = async () => {
    logoutApi().catch(() => {}); // revoke refresh token on backend (fire-and-forget)

    setAccessTokenState(null);
    setRefreshTokenState(null);
    setUser(null);

    await clearSession().catch(() => {});
    await setLoggedIn(false).catch(() => {});
  };

  const performRefresh = async (): Promise<string | null> => {
    const currentRefreshToken = refreshToken || (await getRefreshToken());

    if (!currentRefreshToken) {
      await logout();
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
          const me = await getMeApi({ accessToken: nextAccessToken });
          const normalized = normalizeUser(me);
          if (normalized) setUser(normalized);
        } catch {
          // ignore
        }
      }

      return nextAccessToken;
    } catch {
      await logout();
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
              const me = await getMeApi({ accessToken: validToken });
              const normalized = normalizeUser(me);
              if (normalized && mounted) setUser(normalized);
            } catch {
              // ignore
            }
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

  // AppState: record background time, check idle on resume
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState: AppStateStatus) => {
      if (nextState === "active") {
        const backgroundedAt = backgroundedAtRef.current;
        if (backgroundedAt !== null && Date.now() - backgroundedAt >= IDLE_TIMEOUT_MS) {
          await logout();
          return;
        }
        backgroundedAtRef.current = null;
        lastActivityRef.current = Date.now();
        await ensureValidAccessToken();
      } else if (nextState === "background" || nextState === "inactive") {
        backgroundedAtRef.current = Date.now();
      }
    });

    return () => {
      sub.remove();
    };
  }, [accessToken, refreshToken]);

  // Foreground idle check every 30 s
  useEffect(() => {
    const interval = setInterval(() => {
      if (accessToken && Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        logout().catch(() => {});
        return;
      }
      ensureValidAccessToken().catch(() => {});
    }, 30 * 1000);

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
        const me = await getMeApi({ accessToken: payload.accessToken });
        const normalizedMe = normalizeUser(me);
        if (normalizedMe) setUser(normalizedMe);
      } catch {
        // ignore
      }
    }
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

  return (
    <AuthContext.Provider value={value}>
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          lastActivityRef.current = Date.now();
          return false; // don't steal touches from children
        }}
        onMoveShouldSetResponderCapture={() => {
          lastActivityRef.current = Date.now();
          return false;
        }}
      >
        {children}
      </View>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}