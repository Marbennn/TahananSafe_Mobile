// src/api/pin.ts
// ✅ FIXED: Uses requestJson with auth:true for automatic token refresh on 401
// Keeps the same types and function signatures so nothing else breaks.
import { requestJson } from "./http";

type SetPinResponse = { message: string };
type VerifyPinResponse = { message: string };

type GetMeResponse = {
  user: {
    _id: string;
    email: string;
    profileImage?: string;
    firstName?: string;
    lastName?: string;
    gender?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    age?: number;
    hasPin: boolean;
    role?: string;
  };
};

/**
 * ✅ PUT /set-pin
 * Same signature as before: { accessToken, pin }
 * Now auto-refreshes token on 401.
 * If an explicit accessToken is passed (e.g. right after login), it's used directly.
 * Otherwise requestJson reads from AsyncStorage automatically.
 */
export async function setPinApi(params: { accessToken: string; pin: string }): Promise<SetPinResponse> {
  return requestJson<SetPinResponse>({
    method: "PUT",
    path: "/api/mobile/v1/set-pin",
    body: { pin: params.pin },
    auth: true,
    // Use the explicit token if provided (keeps backward compatibility)
    headers: params.accessToken
      ? { Authorization: `Bearer ${params.accessToken}` }
      : undefined,
  });
}

/**
 * ✅ POST /verify-pin
 * Same signature as before: { accessToken, pin }
 */
export async function verifyPinApi(params: { accessToken: string; pin: string }): Promise<VerifyPinResponse> {
  return requestJson<VerifyPinResponse>({
    method: "POST",
    path: "/api/mobile/v1/verify-pin",
    body: { pin: params.pin },
    auth: true,
    headers: params.accessToken
      ? { Authorization: `Bearer ${params.accessToken}` }
      : undefined,
  });
}

/**
 * ✅ GET /me
 * Same signature as before: { accessToken }
 */
export async function getMeApi(params: { accessToken: string }): Promise<GetMeResponse> {
  return requestJson<GetMeResponse>({
    method: "GET",
    path: "/api/mobile/v1/me",
    auth: true,
    headers: params.accessToken
      ? { Authorization: `Bearer ${params.accessToken}` }
      : undefined,
  });
}