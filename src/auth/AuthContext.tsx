// src/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearSession, getSession, saveSession, StoredUser } from "./authStorage";

// ✅ use your existing /me api
import { getMeApi } from "../api/pin";

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

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);

  const refreshMe = async () => {
    if (!accessToken) return;

    try {
      const me = await getMeApi({ accessToken });
      const normalized = normalizeUser(me);

      if (normalized) {
        setUser(normalized);

        // keep storage in sync
        await saveSession({
          accessToken,
          refreshToken: refreshToken ?? undefined,
          user: normalized,
        });
      }
    } catch {
      // ignore - home can still load
    }
  };

  // ✅ Restore session on app start
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const session = await getSession();
        if (!mounted) return;

        if (session.accessToken) setAccessToken(session.accessToken);
        if (session.refreshToken) setRefreshToken(session.refreshToken);
        if (session.user) setUser(session.user);

        // ✅ If user missing but token exists -> fetch /me
        if (session.accessToken && !session.user) {
          try {
            const me = await getMeApi({ accessToken: session.accessToken });
            const normalized = normalizeUser(me);
            if (!mounted) return;

            if (normalized) {
              setUser(normalized);
              await saveSession({
                accessToken: session.accessToken,
                refreshToken: session.refreshToken ?? undefined,
                user: normalized,
              });
            }
          } catch {
            // ignore
          }
        }
      } finally {
        if (mounted) setIsBooting(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (payload: {
    accessToken: string;
    refreshToken?: string;
    user?: StoredUser;
  }) => {
    setAccessToken(payload.accessToken);
    setRefreshToken(payload.refreshToken ?? null);

    const normalized = normalizeUser(payload.user);
    setUser(normalized);

    await saveSession({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: normalized ?? null,
    });

    // ✅ If login didn't provide user -> fetch /me immediately
    if (!normalized) {
      try {
        const me = await getMeApi({ accessToken: payload.accessToken });
        const fromMe = normalizeUser(me);
        if (fromMe) {
          setUser(fromMe);
          await saveSession({
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            user: fromMe,
          });
        }
      } catch {
        // ignore
      }
    }
  };

  const logout = async () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    await clearSession();
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
