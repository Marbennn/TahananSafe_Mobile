import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://192.168.5.137:5000/api/mobile/v1";

export type User = {
  id: string;
  email: string;

  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  contactNumber?: string;
  profileImage?: string;
};

export type PersonalInfoPayload = {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO string
  gender: "male" | "female" | "other";
  contactNumber: string;
  profileImage?: string;
};

export type SecurityQuestionPayload = {
  securityQuestion: string;
  securityAnswer: string;
};

type AuthResponse<T = any> = {
  success: boolean;
  message?: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
};

type AuthStore = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;

  bootstrap: () => Promise<void>;

  register: (email: string, password: string) => Promise<AuthResponse>;
  verifyRegistrationOtp: (email: string, otp: string) => Promise<AuthResponse>;
  resendOtp: (email: string) => Promise<AuthResponse>;

  login: (email: string, password: string) => Promise<AuthResponse>;
  verifyLoginOtp: (email: string, otp: string) => Promise<AuthResponse>;

  updatePersonalInfo: (payload: PersonalInfoPayload) => Promise<AuthResponse>;
  setSecurityQuestion: (
    payload: SecurityQuestionPayload,
  ) => Promise<AuthResponse>;

  setPin: (pin: string) => Promise<AuthResponse>;
  verifyPin: (pin: string) => Promise<AuthResponse>;

  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<void>;
};

const jsonFetch = async (url: string, options: RequestInit = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};

const authFetch = async (
  url: string,
  token: string,
  options: RequestInit = {},
) => {
  return jsonFetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,

  bootstrap: async () => {
    const [user, accessToken, refreshToken] = await AsyncStorage.multiGet([
      "user",
      "accessToken",
      "refreshToken",
    ]);

    set({
      user: user[1] ? JSON.parse(user[1]) : null,
      accessToken: accessToken[1],
      refreshToken: refreshToken[1],
    });
  },

  register: async (email, password) => {
    try {
      set({ isLoading: true });
      const data = await jsonFetch(`${API_URL}/register`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      return { success: true, message: data.message };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      set({ isLoading: false });
    }
  },

  verifyRegistrationOtp: async (email, otp) => {
    try {
      set({ isLoading: true });
      const data = await jsonFetch(`${API_URL}/verify-registration-otp`, {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });

      await AsyncStorage.multiSet([
        ["user", JSON.stringify(data.user)],
        ["accessToken", data.accessToken],
        ["refreshToken", data.refreshToken],
      ]);

      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      return { success: true, user: data.user };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      set({ isLoading: false });
    }
  },

  resendOtp: async (email) => {
    try {
      set({ isLoading: true });
      const data = await jsonFetch(`${API_URL}/resend-verification-otp`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      return { success: true, message: data.message };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    try {
      set({ isLoading: true });
      const data = await jsonFetch(`${API_URL}/login`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      return { success: true, message: data.message };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      set({ isLoading: false });
    }
  },

  verifyLoginOtp: async (email, otp) => {
    try {
      set({ isLoading: true });
      const data = await jsonFetch(`${API_URL}/verify-login-otp`, {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });

      await AsyncStorage.multiSet([
        ["user", JSON.stringify(data.user)],
        ["accessToken", data.accessToken],
        ["refreshToken", data.refreshToken],
      ]);

      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      return { success: true, user: data.user };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      set({ isLoading: false });
    }
  },

  updatePersonalInfo: async (payload) => {
    try {
      const token = get().accessToken!;
      const data = await authFetch(`${API_URL}/personal-info`, token, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      set({ user: data.user });
      await AsyncStorage.setItem("user", JSON.stringify(data.user));

      return { success: true, user: data.user };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  setSecurityQuestion: async (payload) => {
    try {
      const token = get().accessToken!;
      await authFetch(`${API_URL}/security-question`, token, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  setPin: async (pin) => {
    try {
      const token = get().accessToken!;
      await authFetch(`${API_URL}/set-pin`, token, {
        method: "PUT",
        body: JSON.stringify({ pin }),
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  verifyPin: async (pin) => {
    try {
      const token = get().accessToken!;
      await authFetch(`${API_URL}/verify-pin`, token, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  refreshAccessToken: async () => {
    try {
      const refreshToken = get().refreshToken;
      if (!refreshToken) return false;

      const data = await jsonFetch(`${API_URL}/refresh-token`, {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });

      set({ accessToken: data.accessToken });
      await AsyncStorage.setItem("accessToken", data.accessToken);
      return true;
    } catch {
      return false;
    }
  },

  logout: async () => {
    await AsyncStorage.multiRemove(["user", "accessToken", "refreshToken"]);
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
