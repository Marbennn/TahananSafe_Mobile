// src/api/verification.ts
import { Platform } from "react-native";

export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export type VerificationStatusResponse = {
  status: VerificationStatus;
  updatedAt?: string;
  reason?: string; // if rejected
  idType?: string;
};

type ApiBaseOpts = {
  baseUrl?: string;
};

function getApiBaseUrl(opts?: ApiBaseOpts) {
  // If you already have a central API base in http.ts, you can replace this.
  const envBase =
    (process.env as any)?.EXPO_PUBLIC_API_URL ||
    (process.env as any)?.EXPO_PUBLIC_BACKEND_URL ||
    "";
  const base = (opts?.baseUrl || envBase || "").trim();

  // fallback: local dev (adjust if you use a LAN IP)
  return base || "http://localhost:8000";
}

// ✅ SECURITY FIX: Whitelist allowed image types
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/heic"]);

function mimeFromUri(uri: string) {
  const u = String(uri || "").toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
  if (u.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

function validateFileUri(uri: string): void {
  const mime = mimeFromUri(uri);
  if (!ALLOWED_IMAGE_TYPES.has(mime)) {
    throw new Error(`Unsupported file type: ${mime}. Only JPEG, PNG, and HEIC are allowed.`);
  }
}

function filenameFromUri(uri: string) {
  const clean = String(uri || "").split("?")[0];
  const last = clean.split("/").pop();
  if (last && last.includes(".")) return last;
  return `id_${Date.now()}.jpg`;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function getVerificationStatusApi(args: {
  accessToken: string;
  baseUrl?: string;
}): Promise<VerificationStatusResponse> {
  const baseUrl = getApiBaseUrl({ baseUrl: args.baseUrl });
  const res = await fetch(`${baseUrl}/api/mobile/v1/verification/status`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
  });

  const data = await safeJson(res);

  if (!res.ok) {
    const msg = data?.message || `Status fetch failed (${res.status})`;
    throw new Error(msg);
  }

  // Expected shape:
  // { status: "none"|"pending"|"approved"|"rejected", updatedAt, reason, idType }
  return {
    status: (data?.status as any) || "none",
    updatedAt: data?.updatedAt,
    reason: data?.reason,
    idType: data?.idType,
  };
}

export async function submitVerificationApi(args: {
  accessToken: string;
  idType: string; // e.g. "passport", "drivers_license", "phil_id"
  fileUri: string;
  baseUrl?: string;
}): Promise<{ status: VerificationStatus }> {
  const baseUrl = getApiBaseUrl({ baseUrl: args.baseUrl });

  // ✅ SECURITY: Validate file type before upload
  validateFileUri(args.fileUri);

  const form = new FormData();
  form.append("idType", args.idType);

  // RN FormData file
  form.append("file" as any, {
    uri: args.fileUri,
    name: filenameFromUri(args.fileUri),
    type: mimeFromUri(args.fileUri),
  } as any);

  const res = await fetch(`${baseUrl}/api/mobile/v1/verification/submit`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
      // NOTE: Do NOT set Content-Type manually for multipart in RN
    },
    body: form,
  });

  const data = await safeJson(res);

  if (!res.ok) {
    const msg = data?.message || `Submit failed (${res.status})`;
    throw new Error(msg);
  }

  // Expected: { status: "pending" }
  return { status: (data?.status as any) || "pending" };
}