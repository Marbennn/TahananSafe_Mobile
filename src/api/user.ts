// src/api/user.ts
import { apiUrl } from "../config/api";
import { getAccessToken } from "../auth/session";
import { requestJson } from "./http";

export type PersonalDetailsPayload = {
  firstName: string;
  lastName: string;
  dob: string; // MM/DD/YYYY
  contactNumber: string;
  gender: "male" | "female";
};

export type PersonalDetailsResponse = {
  message?: string;
  user?: any;
};

export type ProfileSettingsPayload = {
  firstName: string;
  lastName: string;
  contactNumber: string;
};

function guessMimeType(uri: string): string {
  const lower = String(uri || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

function fileNameFromUri(uri: string): string {
  const clean = String(uri || "").split("?")[0];
  const parts = clean.split("/");
  return parts[parts.length - 1] || "profile.jpg";
}

export async function savePersonalDetails(
  payload: PersonalDetailsPayload
): Promise<PersonalDetailsResponse> {
  const token = await getAccessToken();
  if (!token) throw new Error("Missing access token. Please login again.");

  // ✅ IMPORTANT: must match backend zod personalDetailsSchema exactly:
  // { firstName, lastName, dob, contactNumber, gender }
  const body = {
    firstName: payload.firstName,
    lastName: payload.lastName,
    dob: payload.dob, // keep MM/DD/YYYY
    contactNumber: payload.contactNumber,
    gender: payload.gender,
  };

  return requestJson<PersonalDetailsResponse>({
    method: "PUT",
    path: "/api/mobile/v1/personal-details",
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function saveProfileSettings(
  payload: ProfileSettingsPayload,
  profileImageUri?: string,
): Promise<PersonalDetailsResponse> {
  const token = await getAccessToken();
  if (!token) throw new Error("Missing access token. Please login again.");

  const form = new FormData();
  form.append("firstName", payload.firstName);
  form.append("lastName", payload.lastName);
  form.append("contactNumber", payload.contactNumber);

  const normalizedUri = String(profileImageUri || "").trim();
  if (normalizedUri) {
    form.append("profileImage", {
      uri: normalizedUri,
      name: fileNameFromUri(normalizedUri),
      type: guessMimeType(normalizedUri),
    } as any);
  }

  const res = await fetch(apiUrl("/api/mobile/v1/profile"), {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  return data as PersonalDetailsResponse;
}
