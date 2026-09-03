import { setLoggedIn, setStoredUser, saveTokens } from "../auth/session";
import { requestJson } from "./http";
import type { PersonalDetailsPayload } from "./user";

export type RegisterResponse = {
  message?: string;
};

export type VerifyRegistrationResponse = {
  message?: string;
  registrationToken: string;
  expiresIn?: number;
};

export type CompleteRegistrationResponse = {
  message?: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
    role?: string;
  };
  accessToken?: string;
  refreshToken?: string;
};

export async function registerSendOtp(
  email: string,
  password: string,
): Promise<RegisterResponse> {
  return requestJson<RegisterResponse>({
    method: "POST",
    path: "/api/mobile/v1/register",
    body: { email, password },
  });
}

export async function verifyRegistrationOtp(
  email: string,
  otp: string,
): Promise<VerifyRegistrationResponse> {
  const data = await requestJson<VerifyRegistrationResponse>({
    method: "POST",
    path: "/api/mobile/v1/verify-registration-otp",
    body: { email, otp },
  });

  if (!data.registrationToken) {
    throw new Error(
      "Signup verified but registration token is missing. Please try again.",
    );
  }

  return data;
}

export async function completeRegistration(
  registrationToken: string,
  personalDetails: PersonalDetailsPayload,
): Promise<CompleteRegistrationResponse> {
  const data = await requestJson<CompleteRegistrationResponse>({
    method: "POST",
    path: "/api/mobile/v1/complete-registration",
    body: { registrationToken, ...personalDetails },
  });

  if (!data.accessToken) {
    throw new Error("Account created but access token is missing. Please log in.");
  }

  await saveTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  if (data.user) await setStoredUser(data.user);
  await setLoggedIn(true);

  return data;
}
