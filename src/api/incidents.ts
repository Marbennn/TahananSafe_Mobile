// src/api/incidents.ts
import { getAccessToken } from "../auth/session";

export type IncidentMode = "complain" | "emergency";

export type CreateIncidentPayload = {
  mode: IncidentMode;
  incidentType?: string;
  details: string;

  witnessName?: string;
  witnessType?: string;

  dateStr?: string;
  timeStr?: string;
  locationStr?: string;

  // URIs from Expo ImagePicker (result.assets[].uri)
  photos?: string[];
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

function guessMimeType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

function fileNameFromUri(uri: string, index: number) {
  const clean = uri.split("?")[0];
  const parts = clean.split("/");
  const last = parts[parts.length - 1] || `photo_${index}.jpg`;
  if (!last.includes(".")) return `${last}.jpg`;
  return last;
}

export async function submitIncident(payload: CreateIncidentPayload) {
  const token = await getAccessToken();

  const form = new FormData();

  form.append("mode", payload.mode);
  form.append("details", payload.details);

  if (payload.mode === "complain") {
    form.append("incidentType", payload.incidentType || "");
  }

  if (payload.witnessName) form.append("witnessName", payload.witnessName);
  if (payload.witnessType) form.append("witnessType", payload.witnessType);
  if (payload.dateStr) form.append("dateStr", payload.dateStr);
  if (payload.timeStr) form.append("timeStr", payload.timeStr);
  if (payload.locationStr) form.append("locationStr", payload.locationStr);

  const uris = (payload.photos || []).slice(0, 3);

  // ✅ IMPORTANT: keep uri AS-IS (do NOT strip file:// on iOS)
  uris.forEach((uri, idx) => {
    const name = fileNameFromUri(uri, idx);
    const type = guessMimeType(uri);

    form.append("photos", {
      uri,
      name,
      type,
    } as any);
  });

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/mobile/incidents`, {
    method: "POST",
    headers,
    // NOTE: do NOT set Content-Type manually; fetch will set multipart boundary
    body: form,
  });

  const text = await res.text();
  let data: any;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    throw new Error(data?.message || `Failed (${res.status})`);
  }

  return data;
}
