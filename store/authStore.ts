import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

// security questions
export const SECURITY_QUESTIONS = [
  { id: "first_school", label: "What was the name of your first school?" },
  { id: "first_pet", label: "What was the name of your first pet?" },
  { id: "birth_city", label: "In what city were you born?" },
  {
    id: "best_friend",
    label: "What is the name of your childhood best friend?",
  },
  {
    id: "favorite_teacher",
    label: "What is the name of your favorite teacher?",
  },
  { id: "mother_maiden", label: "What is your mother’s maiden name?" },
  { id: "first_car", label: "What was your first car?" },
] as const;

export type SecurityQuestionId = (typeof SECURITY_QUESTIONS)[number]["id"];

export type User = {
  id: string;
  email: string;
  profileImage: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  suffix?: string;
  age?: string;
  gender?: "male" | "female" | "other";
  phoneNumber?: string;
};

// payload
export type PersonalInfoPayload = {
  firstName: string;
  lastName: string;
  middleName: string;
  suffix?: string;
  age: string;
  gender: "male" | "female" | "other";
  phoneNumber: string;
};

export type SecurityQuestionPayload = {
  securityQuestion: SecurityQuestionId;
  securityAnswer: string;
};

type AuthStore = {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;

  register: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; message?: string; error?: string }>;

  verifyRegistrationOtp: (
    email: string,
    otp: string,
  ) => Promise<{
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
  }>;

  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; message?: string; error?: string }>;

  verifyLoginOtp: (
    email: string,
    otp: string,
  ) => Promise<{
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
  }>;

  updatePersonalInfo: (
    payload: PersonalInfoPayload,
  ) => Promise<{ success: boolean; user?: User; error?: string }>;

  setSecurityQuestion: (
    payload: SecurityQuestionPayload,
  ) => Promise<{ success: boolean; error?: string }>;

  setPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  verifyPin: (pin: string) => Promise<{ success: boolean; error?: string }>;

  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,

  // register
  register: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await fetch(
        "http://192.168.5.137:5000/api/mobile/v1/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );

      const data = await response.json();
      set({ isLoading: false });

      if (!response.ok) throw new Error(data.message || "Something went wrong");

      return { success: true, message: data.message };
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // verify register otp
  verifyRegistrationOtp: async (email, otp) => {
    set({ isLoading: true });
    try {
      const response = await fetch(
        "http://192.168.5.137:5000/api/mobile/v1/verify-registration-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        },
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "OTP verification failed");

      // store tokens and user
      await AsyncStorage.setItem("user", JSON.stringify(data.user));
      await AsyncStorage.setItem("token", data.accessToken);
      await AsyncStorage.setItem("refreshToken", data.refreshToken);

      set({
        user: data.user,
        token: data.accessToken,
        refreshToken: data.refreshToken,
        isLoading: false,
      });

      return { success: true, user: data.user, token: data.accessToken };
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // login
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await fetch(
        "http://192.168.5.137:5000/api/mobile/v1/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );

      const data = await response.json();
      set({ isLoading: false });

      if (!response.ok) throw new Error(data.message || "Login failed");

      return { success: true, message: data.message };
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // verify login otp
  verifyLoginOtp: async (email, otp) => {
    set({ isLoading: true });
    try {
      const response = await fetch(
        "http://192.168.5.137:5000/api/mobile/v1/verify-login-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        },
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "OTP verification failed");

      await AsyncStorage.setItem("user", JSON.stringify(data.user));
      await AsyncStorage.setItem("token", data.accessToken);
      await AsyncStorage.setItem("refreshToken", data.refreshToken);

      set({
        user: data.user,
        token: data.accessToken,
        refreshToken: data.refreshToken,
        isLoading: false,
      });

      return { success: true, user: data.user, token: data.accessToken };
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // update personal info
  updatePersonalInfo: async (payload) => {
    set({ isLoading: true });
    try {
      const token = get().token;
      if (!token) throw new Error("User not authenticated");

      const response = await fetch(
        "http://192.168.5.137:5000/api/mobile/v1/personal-info",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Failed to update info");

      await AsyncStorage.setItem("user", JSON.stringify(data.user));
      set({ user: data.user, isLoading: false });

      return { success: true, user: data.user };
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // set security question
  setSecurityQuestion: async (payload) => {
    set({ isLoading: true });
    try {
      const token = get().token;
      if (!token) throw new Error("User not authenticated");

      const response = await fetch(
        "http://192.168.5.137:5000/api/mobile/v1/security-question",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Failed to save security question");

      set({ isLoading: false });
      return { success: true };
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // set PIN
  setPin: async (pin) => {
    set({ isLoading: true });
    try {
      const token = get().token;
      if (!token) throw new Error("User not authenticated");

      const response = await fetch(
        "http://192.168.5.137:5000/api/mobile/v1/set-pin",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pin }),
        },
      );

      const data = await response.json();
      set({ isLoading: false });

      if (!response.ok) throw new Error(data.message || "Failed to set PIN");

      return { success: true };
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // verify PIN
  verifyPin: async (pin) => {
    set({ isLoading: true });
    try {
      const token = get().token;
      if (!token) throw new Error("User not authenticated");

      const response = await fetch(
        "http://192.168.5.137:5000/api/mobile/v1/verify-pin",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pin }),
        },
      );

      const data = await response.json();
      set({ isLoading: false });

      if (!response.ok) throw new Error(data.message || "Invalid PIN");

      return { success: true };
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // logout
  logout: async () => {
    await AsyncStorage.removeItem("user");
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("refreshToken");
    set({ user: null, token: null, refreshToken: null });
  },
}));
