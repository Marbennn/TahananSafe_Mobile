// src/api/user.ts
import { requestJson } from "./http";
import { getAccessToken } from "./storage";

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

export async function savePersonalDetails(payload: PersonalDetailsPayload): Promise<PersonalDetailsResponse> {
  const token = await getAccessToken();
  if (!token) throw new Error("Missing access token. Please login again.");

  return requestJson<PersonalDetailsResponse>({
    method: "PUT",
    path: "/api/mobile/v1/personal-details",
    body: payload,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
