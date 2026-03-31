// src/api/reports.ts
import { getAccessToken } from "../auth/session";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000")
  .trim()
  .replace(/\/+$/, "");

export type ThreadDto = {
  _id: string;
  reportId: string;
  senderRole: "resident" | "staff";
  senderName: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  deletedByRole?: "resident" | "staff" | null;
  replyTo?: {
    threadId?: string | null;
    senderName?: string;
    senderRole?: "resident" | "staff";
    text?: string;
  } | null;
};

// ✅ matches your Mongo incident document fields
export type ReportDetailDto = {
  _id: string;
  user: string;
  mode?: string; // "complain" | "emergency"
  incidentType?: string; // "Other"
  details?: string;
  offenderName?: string;
  witnessName?: string;
  witnessType?: string;
  dateStr?: string; // "02/17/2026"
  timeStr?: string; // "3:41PM"
  locationStr?: string; // "2420, ... Philippines"
  latitude?: number | null;
  longitude?: number | null;
  status?: string; // "submitted" | "reviewing" | "resolved"
  photos?: any[]; // [{ fileId, url, fileName, mimeType, size }]
  createdAt?: string;
  updatedAt?: string;
};

async function parseJsonSafe(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

/**
 * ✅ NEW: Get logged-in user's reports
 * Backend: GET /api/mobile/v1/reports/my
 *
 * ✅ UPDATED: accepts optional AbortSignal
 */
export async function fetchMyReports(signal?: AbortSignal): Promise<ReportDetailDto[]> {
  const token = await getAccessToken();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/mobile/v1/reports/my`, {
    method: "GET",
    headers,
    signal,
  });

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.message || `Failed (${res.status})`);
  }

  // backend returns { incidents: [...] }
  const list = Array.isArray(data?.incidents) ? data.incidents : [];
  return list as ReportDetailDto[];
}

/**
 * ✅ Get single report detail.
 * NOTE: You did NOT show a mobile detail endpoint,
 * so we try common ones safely.
 *
 * ✅ UPDATED: accepts optional AbortSignal
 */
export async function fetchReportDetail(
  reportId: string,
  signal?: AbortSignal
): Promise<ReportDetailDto> {
  const token = await getAccessToken();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Try: GET /api/mobile/incidents/:id  (you mounted incidentRoute at /api/mobile/incidents)
  let res = await fetch(`${API_URL}/api/mobile/incidents/${encodeURIComponent(reportId)}`, {
    method: "GET",
    headers,
    signal,
  });

  // Fallback: GET /api/mobile/v1/reports/:id  (if you later add it)
  if (res.status === 404) {
    res = await fetch(`${API_URL}/api/mobile/v1/reports/${encodeURIComponent(reportId)}`, {
      method: "GET",
      headers,
      signal,
    });
  }

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.message || `Failed (${res.status})`);
  }

  // Allow multiple backend shapes:
  // { report: {...} } OR { incident: {...} } OR direct doc
  return (data?.report || data?.incident || data) as ReportDetailDto;
}

/**
 * ✅ Get report threads
 *
 * ✅ UPDATED: accepts optional AbortSignal
 */
export async function fetchReportThreads(
  reportId: string,
  signal?: AbortSignal
): Promise<ThreadDto[]> {
  const token = await getAccessToken();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  // You mounted threads at: app.use("/api/mobile/reports", reportThreadRoute);
  const res = await fetch(
    `${API_URL}/api/mobile/reports/${encodeURIComponent(reportId)}/threads`,
    {
      method: "GET",
      headers,
      signal,
    }
  );

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.message || `Failed (${res.status})`);
  }

  return (data?.threads || []) as ThreadDto[];
}

/**
 * ✅ Send a message to report threads
 *
 * ✅ UPDATED: accepts optional AbortSignal
 */
export async function sendReportThreadMessage(
  reportId: string,
  message: string | { text: string; replyToThreadId?: string | null },
  signal?: AbortSignal
) {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `${API_URL}/api/mobile/reports/${encodeURIComponent(reportId)}/threads`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(
        typeof message === "string"
          ? { text: message }
          : { text: message.text, replyToThreadId: message.replyToThreadId || undefined }
      ),
      signal,
    }
  );

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.message || `Failed (${res.status})`);
  }

  return data; // { message, thread }
}

export async function deleteReportThreadMessage(
  reportId: string,
  threadId: string,
  signal?: AbortSignal
) {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `${API_URL}/api/mobile/reports/${encodeURIComponent(reportId)}/threads/${encodeURIComponent(threadId)}`,
    {
      method: "DELETE",
      headers,
      signal,
    }
  );

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.message || `Failed (${res.status})`);
  }

  return data; // { message, thread }
}

export async function updateReportThreadMessage(
  reportId: string,
  threadId: string,
  message: string,
  signal?: AbortSignal
) {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `${API_URL}/api/mobile/reports/${encodeURIComponent(reportId)}/threads/${encodeURIComponent(threadId)}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ text: message }),
      signal,
    }
  );

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.message || `Failed (${res.status})`);
  }

  return data; // { message, thread }
}

/**
 * ✅ FIX: Build photo URL that works on PHONE (no localhost problem)
 *
 * Your Mongo photos are like:
 * { fileId, url, fileName, mimeType, size }
 *
 * Best strategy on mobile:
 * ✅ ALWAYS use fileId and build URL using CURRENT API_URL
 * so it works even if DB saved url="http://localhost:8000/..."
 */
export function buildReportPhotoUrl(reportId: string, photo: any): string | null {
  if (!photo) return null;

  // 1) string form (rare)
  if (typeof photo === "string") {
    const s = photo.trim();
    if (!s) return null;

    // If it's already absolute and NOT localhost, allow it
    if (s.startsWith("http://") || s.startsWith("https://")) {
      // But if it contains localhost/127, rewrite to API_URL origin
      if (s.includes("localhost") || s.includes("127.0.0.1")) {
        try {
          const u = new URL(s);
          return `${API_URL}${u.pathname}${u.search}`;
        } catch {
          return `${API_URL}${s.startsWith("/") ? "" : "/"}${s}`;
        }
      }
      return s;
    }

    // assume it's a fileId
    return `${API_URL}/api/web/v1/evidence/id/${encodeURIComponent(s)}`;
  }

  // 2) object form (your case)
  if (typeof photo === "object") {
    // Prefer fileId always (works across devices)
    const rawFileId = (photo as any)?.fileId?.$oid ?? (photo as any)?.fileId;
    if (rawFileId) {
      const fileIdStr = String(rawFileId).trim();
      if (fileIdStr) {
        return `${API_URL}/api/web/v1/evidence/id/${encodeURIComponent(fileIdStr)}`;
      }
    }

    // If no fileId, fallback to url but normalize it
    if (typeof (photo as any).url === "string" && (photo as any).url.trim()) {
      const u = (photo as any).url.trim();

      // relative url -> make absolute
      if (u.startsWith("/")) return `${API_URL}${u}`;

      // absolute but localhost -> rewrite to API_URL origin
      if (u.startsWith("http://") || u.startsWith("https://")) {
        if (u.includes("localhost") || u.includes("127.0.0.1")) {
          try {
            const parsed = new URL(u);
            return `${API_URL}${parsed.pathname}${parsed.search}`;
          } catch {
            return `${API_URL}${u.startsWith("/") ? "" : "/"}${u}`;
          }
        }
        return u;
      }
    }

    // Fallback to filename endpoint (optional)
    if (typeof (photo as any).fileName === "string" && (photo as any).fileName.trim()) {
      return `${API_URL}/api/web/v1/evidence/file/${encodeURIComponent(
        (photo as any).fileName.trim()
      )}`;
    }
  }

  return null;
}
