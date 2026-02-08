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

export async function registerSendOtp(email: string, password: string): Promise<RegisterResponse> {
  return requestJson<RegisterResponse>({
    method: "POST",
    path: "/api/mobile/v1/register",
    body: { email, password },
  });
}

export async function verifyRegistrationOtp(email: string, otp: string): Promise<VerifyRegistrationResponse> {
  const data = await requestJson<VerifyRegistrationResponse>({
    method: "POST",
    path: "/api/mobile/v1/verify-registration-otp",
    body: { email, otp },
  });

  // ✅ Save tokens here so next screen (PersonalDetails) can use them
  if (!data.accessToken) {
    throw new Error("Signup verified but access token is missing. Please try again.");
  }

  await saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  if (data.user) await saveUser(data.user);

  return data;
}
