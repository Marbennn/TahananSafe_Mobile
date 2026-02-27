// src/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

// ✅ use your existing /me api
import { getMeApi } from "../api/pin";

// ✅ SINGLE source of truth for tokens/session (used by notifications.ts too)
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
  login: (payload: { accessToken: string; refreshToken?: string; user?: StoredUser }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: StoredUser | null) => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function normalizeUser(input: any): StoredUser | null {
  if (!input) return null;

  const u = input?.user ?? input; // supports {user:{...}} or {...}

  const firstName =
    (typeof u?.firstName === "string" && u.firstName.trim()) ||
    (typeof u?.profile?.firstName === "string" && u.profile.firstName.trim()) ||
    (typeof u?.personalInfo?.firstName === "string" && u.personalInfo.firstName.trim()) ||
    "";

  const lastName =
    (typeof u?.lastName === "string" && u.lastName.trim()) ||
    (typeof u?.profile?.lastName === "string" && u.profile.lastName.trim()) ||
    (typeof u?.personalInfo?.lastName === "string" && u.personalInfo.lastName.trim()) ||
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
    ...u,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isBooting, setIsBooting] = useState(true);

  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);

  const refreshMe = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) return;

    try {
      const me = await getMeApi({ accessToken: token });
      const normalized = normalizeUser(me);
      if (normalized) setUser(normalized);
    } catch {
      // ignore
    }
  };

  // ✅ Restore session on app start (from session.ts only)
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
          await setLoggedIn(true); // keep flag consistent
          await refreshMe();
        } else {
          // ensure clean state
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (payload: { accessToken: string; refreshToken?: string; user?: StoredUser }) => {
    // ✅ wipe any previous account session first
    await clearSession().catch(() => {});

    // ✅ store tokens where notifications.ts reads them
    await saveTokens({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
    });
    await setLoggedIn(true);

    setAccessTokenState(payload.accessToken);
    setRefreshTokenState(payload.refreshToken ?? null);

    const normalized = normalizeUser(payload.user);
    if (normalized) setUser(normalized);
    else await refreshMe(); // if no user payload, fetch /me
  };

  const logout = async () => {
    setAccessTokenState(null);
    setRefreshTokenState(null);
    setUser(null);

    await clearSession().catch(() => {});
    await setLoggedIn(false).catch(() => {});
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
    }),
    [isBooting, accessToken, refreshToken, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}