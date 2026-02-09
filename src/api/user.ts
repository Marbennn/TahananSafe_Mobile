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
