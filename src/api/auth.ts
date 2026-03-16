// src/api/auth.ts
import { requestJson } from "./http";
import { saveTokens, saveUser } from "./storage";

export type RegisterResponse = {
  message?: string;
};

export type VerifyRegistrationResponse = {
  message?: string;
  user?: { id: string; email: string; profileImage?: string };
  accessToken?: string;
  refreshToken?: string;
};

export type RefreshTokenResponse = {
  message?: string;
  accessToken: string;
  refreshToken?: string;
  user?: any;
};

export async function registerSendOtp(
  email: string,
  password: string
): Promise<RegisterResponse> {
  return requestJson<RegisterResponse>({
    method: "POST",
    path: "/api/mobile/v1/register",
    body: { email, password },
  });
}

export async function verifyRegistrationOtp(
  email: string,
  otp: string
): Promise<VerifyRegistrationResponse> {
  const data = await requestJson<VerifyRegistrationResponse>({
    method: "POST",
    path: "/api/mobile/v1/verify-registration-otp",
    body: { email, otp },
  });

  if (!data.accessToken) {
    throw new Error("Signup verified but access token is missing. Please try again.");
  }

  await saveTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });

  if (data.user) {
    await saveUser(data.user);
  }

  return data;
}

/**
 * ✅ IMPORTANT:
 * Change the path below if your backend uses a different refresh route.
 * Common examples:
 * - /api/mobile/v1/refresh-token
 * - /api/mobile/v1/auth/refresh
 * - /api/auth/refresh-token
 */
export async function logoutApi(): Promise<void> {
  try {
    await requestJson({
      method: "POST",
      path: "/api/mobile/v1/logout",
      auth: true,
    });
  } catch {
    // fire-and-forget — backend revocation is best-effort
  }
}

export async function refreshAccessTokenApi(
  refreshToken: string
): Promise<RefreshTokenResponse> {
  const data = await requestJson<RefreshTokenResponse>({
    method: "POST",
    path: "/api/mobile/v1/refresh-token",
    body: { refreshToken },
  });

  if (!data?.accessToken) {
    throw new Error("Refresh failed: no access token returned.");
  }

  await saveTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || refreshToken,
  });

  if (data.user) {
    await saveUser(data.user);
  }

  return data;
}