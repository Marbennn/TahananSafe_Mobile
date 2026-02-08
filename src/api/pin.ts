// src/api/pin.ts
import { Platform } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

type SetPinResponse = {
  message: string;
};

export async function setPinApi(params: { accessToken: string; pin: string }) {
  const res = await fetch(`${API_URL}/api/mobile/v1/users/set-pin`, {
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

  if (!res.ok) {
    throw new Error(data.message || "Failed to set PIN");
  }

  return data as SetPinResponse;
}
