import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useAuthStore = create((set) => ({
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

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      return { success: true, message: data.message };
    } catch (error) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // verify regiter otp
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

      if (!response.ok) {
        throw new Error(data.message || "OTP verification failed");
      }

      // Store tokens and user
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
