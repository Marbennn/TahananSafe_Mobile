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
 * auth: true — lets the HTTP interceptor auto-attach the stored token
 * and auto-refresh on 401.
 */
export async function setPinApi(params: { pin: string }): Promise<SetPinResponse> {
  return requestJson<SetPinResponse>({
    method: "PUT",
    path: "/api/mobile/v1/set-pin",
    body: { pin: params.pin },
    auth: true,
  });
}

/**
 * ✅ POST /verify-pin
 * auth: true — lets the HTTP interceptor auto-refresh an expired access token
 * before retrying. A wrong PIN still returns 401 on the retry, which is then
 * thrown as an ApiError for the caller to handle.
 */
export async function verifyPinApi(params: { pin: string }): Promise<VerifyPinResponse> {
  return requestJson<VerifyPinResponse>({
    method: "POST",
    path: "/api/mobile/v1/verify-pin",
    body: { pin: params.pin },
    auth: true,
  });
}

/**
 * ✅ GET /me
 * auth: true — lets the HTTP interceptor auto-attach the stored token
 * and auto-refresh on 401.
 */
export async function getMeApi(): Promise<GetMeResponse> {
  return requestJson<GetMeResponse>({
    method: "GET",
    path: "/api/mobile/v1/me",
    auth: true,
  });
}