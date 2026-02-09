// src/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { clearSession, getSession, saveSession, StoredUser } from "./authStorage";

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
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isBooting, setIsBooting] = useState(true);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);

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
      } catch (e) {
        // if storage fails, we just start logged out
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
    setUser(payload.user ?? null);

    await saveSession({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: payload.user,
    });
  };

  // ✅ Only logs out when user taps logout
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
