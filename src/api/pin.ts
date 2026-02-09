// src/api/pin.ts
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

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
  };
};

export async function setPinApi(params: { accessToken: string; pin: string }) {
  const res = await fetch(`${API_URL}/api/mobile/v1/set-pin`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({ pin: params.pin }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<SetPinResponse> & {
    message?: string;
  };

  if (!res.ok) throw new Error(data.message || "Failed to set PIN");
  return data as SetPinResponse;
}

export async function verifyPinApi(params: { accessToken: string; pin: string }) {
  const res = await fetch(`${API_URL}/api/mobile/v1/verify-pin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({ pin: params.pin }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<VerifyPinResponse> & {
    message?: string;
  };

  if (!res.ok) throw new Error(data.message || "Invalid PIN");
  return data as VerifyPinResponse;
}

export async function getMeApi(params: { accessToken: string }) {
  const res = await fetch(`${API_URL}/api/mobile/v1/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  const data = (await res.json().catch(() => ({}))) as Partial<GetMeResponse> & {
    message?: string;
  };

  if (!res.ok) throw new Error(data.message || "Failed to load profile");
  return data as GetMeResponse;
}
