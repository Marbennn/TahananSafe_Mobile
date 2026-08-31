import { requestJson, requestRaw } from "./http";

export type PersonalDetailsPayload = {
  firstName: string;
  lastName: string;
  dob: string;
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
  contactNumber?: string;
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
  payload: PersonalDetailsPayload,
): Promise<PersonalDetailsResponse> {
  return requestJson<PersonalDetailsResponse>({
    method: "PUT",
    path: "/api/mobile/v1/personal-details",
    body: payload,
    auth: true,
  });
}

export async function saveProfileSettings(
  payload: ProfileSettingsPayload,
  profileImageUri?: string,
): Promise<PersonalDetailsResponse> {
  const form = new FormData();
  form.append("firstName", payload.firstName);
  form.append("lastName", payload.lastName);

  const contactNumber = String(payload.contactNumber || "").trim();
  if (contactNumber) form.append("contactNumber", contactNumber);

  const imageUri = String(profileImageUri || "").trim();
  if (imageUri) {
    form.append("profileImage", {
      uri: imageUri,
      name: fileNameFromUri(imageUri),
      type: guessMimeType(imageUri),
    } as any);
  }

  const response = await requestRaw({
    method: "PUT",
    path: "/api/mobile/v1/profile",
    headers: { Accept: "application/json" },
    body: form,
    auth: true,
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }
  return data as PersonalDetailsResponse;
}
