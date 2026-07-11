// src/api/incidents.ts
import { getAccessToken } from "../auth/session";

export type IncidentMode = "complain" | "emergency";

export type CreateIncidentPayload = {
  mode: IncidentMode;
  incidentType?: string;
  details: string;

  offenderName?: string;
  witnessName?: string;
  witnessType?: string;

  dateStr?: string;
  timeStr?: string;
  locationStr?: string;
  latitude?: number;
  longitude?: number;

  // URIs from Expo ImagePicker (result.assets[].uri)
  photos?: string[];
  videos?: string[];

  // ✅ NEW: AI fields (match your AI API / README keys)
  ai_incident_type?: string;
  ai_language?: string;
  ai_risk_level?: string;
  ai_risk_percentage?: number;
  ai_priority_level?: string;
  ai_children_involved?: boolean;
  ai_weapon_mentioned?: boolean;
  ai_confidence_score?: number;
};

const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000")
  .trim()
  .replace(/\/+$/, "");

// ✅ SECURITY FIX: Whitelist allowed image MIME types
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/3gpp",
  "video/webm",
]);

const MAX_PHOTO_SIZE_MB = 10;

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  if (lower.endsWith(".3gp") || lower.endsWith(".3gpp")) return "video/3gpp";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

function validateImageUri(uri: string): void {
  const mime = guessMimeType(uri);
  if (!ALLOWED_IMAGE_TYPES.has(mime)) {
    throw new Error(`Unsupported file type: ${mime}. Only JPEG, PNG, WebP, and HEIC are allowed.`);
  }
}

function validateVideoUri(uri: string): void {
  const mime = guessMimeType(uri);
  if (!ALLOWED_VIDEO_TYPES.has(mime)) {
    throw new Error(`Unsupported video type: ${mime}. Only MP4, MOV, M4V, 3GP, and WebM are allowed.`);
  }
}

function fileNameFromUri(uri: string, index: number, fallbackPrefix = "photo", fallbackExt = "jpg") {
  const clean = uri.split("?")[0];
  const parts = clean.split("/");
  const last = parts[parts.length - 1] || `${fallbackPrefix}_${index}.${fallbackExt}`;
  if (!last.includes(".")) return `${last}.${fallbackExt}`;
  return last;
}

function appendIfDefined(form: FormData, key: string, value: any) {
  if (value === undefined || value === null) return;
  form.append(key, typeof value === "string" ? value : String(value));
}

export async function submitIncident(payload: CreateIncidentPayload) {
  const token = await getAccessToken();

  const form = new FormData();

  form.append("mode", payload.mode);
  form.append("details", payload.details);

  if (payload.mode === "complain") {
    form.append("incidentType", payload.incidentType || "");
  }

  if (payload.offenderName) form.append("offenderName", payload.offenderName);

  if (payload.witnessName) form.append("witnessName", payload.witnessName);
  if (payload.witnessType) form.append("witnessType", payload.witnessType);
  if (payload.dateStr) form.append("dateStr", payload.dateStr);
  if (payload.timeStr) form.append("timeStr", payload.timeStr);
  if (payload.locationStr) form.append("locationStr", payload.locationStr);
  appendIfDefined(form, "latitude", payload.latitude);
  appendIfDefined(form, "longitude", payload.longitude);

  // ✅ AI fields -> backend
  appendIfDefined(form, "ai_incident_type", payload.ai_incident_type);
  appendIfDefined(form, "ai_language", payload.ai_language);
  appendIfDefined(form, "ai_risk_level", payload.ai_risk_level);
  appendIfDefined(form, "ai_risk_percentage", payload.ai_risk_percentage);
  appendIfDefined(form, "ai_priority_level", payload.ai_priority_level);
  appendIfDefined(form, "ai_children_involved", payload.ai_children_involved);
  appendIfDefined(form, "ai_weapon_mentioned", payload.ai_weapon_mentioned);
  appendIfDefined(form, "ai_confidence_score", payload.ai_confidence_score);

  const uris = (payload.photos || []).slice(0, 3);
  const videoUris = (payload.videos || []).slice(0, 1);

  // ✅ SECURITY: Validate each photo before uploading
  uris.forEach((uri, idx) => {
    validateImageUri(uri);

    const name = fileNameFromUri(uri, idx, "photo", "jpg");
    const type = guessMimeType(uri);

    form.append("photos", {
      uri,
      name,
      type,
    } as any);
  });

  videoUris.forEach((uri, idx) => {
    validateVideoUri(uri);

    const name = fileNameFromUri(uri, idx, "video", "mp4");
    const type = guessMimeType(uri);

    form.append("videos", {
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
