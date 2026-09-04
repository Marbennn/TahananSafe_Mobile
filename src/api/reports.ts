// src/api/reports.ts
import { requestRaw } from "./http";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000")
  .trim()
  .replace(/\/+$/, "");

export type ThreadAttachmentKind = "image" | "video";

export type ThreadAttachmentDto = {
  fileId: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  kind?: ThreadAttachmentKind;
  url?: string;
};

export type ThreadDto = {
  _id: string;
  reportId: string;
  senderRole: "resident" | "staff";
  senderOfficialRole?: "captain" | "secretary" | null;
  senderName: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  deletedByRole?: "resident" | "staff" | null;
  attachment?: ThreadAttachmentDto | null;
  replyTo?: {
    threadId?: string | null;
    senderName?: string;
    senderRole?: "resident" | "staff";
    senderOfficialRole?: "captain" | "secretary" | null;
    text?: string;
  } | null;
};

export type ReportThreadAttachmentInput = {
  uri: string;
  name: string;
  type: string;
  file?: Blob | null;
};

export type SendReportThreadMessagePayload = {
  text?: string;
  replyToThreadId?: string | null;
  attachment?: ReportThreadAttachmentInput | null;
};

export type CaseDocumentDto = {
  _id?: string;
  type?: string;
  title?: string;
  status?: string;
  fields?: Record<string, unknown>;
  releasedAt?: string | null;
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
  caseStatus?: "Submitted" | "Active" | "Completed" | "Archived" | string;
  currentProcessStage?: string;
  firstViewedByOfficialAt?: string | null;
  handling?: {
    type?: "initial-mediation" | "other-barangay-action" | string;
    selectedAt?: string | null;
  } | null;
  mediationSchedule?: {
    type?: string;
    status?: string;
    scheduledAt?: string;
    venue?: string;
    rescheduleCount?: number;
    confirmedAt?: string | null;
    completedAt?: string | null;
    rescheduledAt?: string | null;
    history?: Array<{
      scheduledAt?: string;
      venue?: string;
      changedAt?: string;
    }>;
  } | null;
  mediationRecord?: {
    outcome?: "settlement-reached" | "no-settlement" | "rescheduled" | "did-not-proceed" | string;
    status?: "confirmed" | string;
    confirmedAt?: string | null;
    captainRemarks?: string;
    complainantAttendance?: "present" | "absent" | string;
    respondentAttendance?: "present" | "absent" | string;
    otherAttendees?: string;
    remarks?: string;
    recordedAt?: string | null;
    conductedAt?: string | null;
    reviewedAt?: string | null;
    finalizedAt?: string | null;
  } | null;
  caseDocuments?: CaseDocumentDto[];
  actionLog?: Array<{
    status?: string;
    action?: string;
    result?: string;
    actorName?: string;
    actorRole?: string;
    date?: string;
  }>;
  photos?: any[]; // [{ fileId, url, fileName, mimeType, size }]
  videos?: any[]; // [{ fileId, url, fileName, mimeType, size }]
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
  const res = await requestRaw({
    path: "/api/mobile/v1/reports/my",
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
    auth: true,
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
  // Try: GET /api/mobile/incidents/:id  (you mounted incidentRoute at /api/mobile/incidents)
  let res = await requestRaw({
    path: `/api/mobile/incidents/${encodeURIComponent(reportId)}`,
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
    auth: true,
  });

  // Fallback: GET /api/mobile/v1/reports/:id  (if you later add it)
  if (res.status === 404) {
    res = await requestRaw({
      path: `/api/mobile/v1/reports/${encodeURIComponent(reportId)}`,
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
      auth: true,
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
  // You mounted threads at: app.use("/api/mobile/reports", reportThreadRoute);
  const res = await requestRaw({
      path: `/api/mobile/reports/${encodeURIComponent(reportId)}/threads`,
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
      auth: true,
    });

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.message || `Failed (${res.status})`);
  }

  return (data?.threads || []) as ThreadDto[];
}

export async function fetchReportTyping(
  reportId: string,
  signal?: AbortSignal
): Promise<{ isTyping: boolean; role?: "staff" | "resident" | null }> {
  const res = await requestRaw({
    path: `/api/mobile/reports/${encodeURIComponent(reportId)}/typing`,
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
    auth: true,
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);

  return {
    isTyping: data?.isTyping === true,
    role: data?.role === "staff" ? "staff" : data?.role === "resident" ? "resident" : null,
  };
}

export async function setReportTyping(
  reportId: string,
  isTyping: boolean,
  signal?: AbortSignal
): Promise<void> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const res = await requestRaw({
      path: `/api/mobile/reports/${encodeURIComponent(reportId)}/typing`,
      method: "POST",
      headers,
      body: JSON.stringify({ isTyping }),
      signal,
      auth: true,
    });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);
}

/**
 * ✅ Send a message to report threads
 *
 * ✅ UPDATED: accepts optional AbortSignal
 */
export async function sendReportThreadMessage(
  reportId: string,
  message: string | SendReportThreadMessagePayload,
  signal?: AbortSignal
) {
  const payload: SendReportThreadMessagePayload =
    typeof message === "string" ? { text: message } : message;
  const headers: Record<string, string> = { Accept: "application/json" };

  let body: FormData | string;
  if (payload.attachment) {
    const form = new FormData();
    form.append("text", String(payload.text || ""));
    if (payload.replyToThreadId) {
      form.append("replyToThreadId", payload.replyToThreadId);
    }
    if (payload.attachment.file) {
      (form.append as any)(
        "attachment",
        payload.attachment.file,
        payload.attachment.name
      );
    } else {
      form.append("attachment", {
        uri: payload.attachment.uri,
        name: payload.attachment.name,
        type: payload.attachment.type,
      } as any);
    }
    body = form;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      text: String(payload.text || ""),
      replyToThreadId: payload.replyToThreadId || undefined,
    });
  }

  const res = await requestRaw({
      path: `/api/mobile/reports/${encodeURIComponent(reportId)}/threads`,
      method: "POST",
      headers,
      body,
      signal,
      auth: true,
    });

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.message || `Failed (${res.status})`);
  }

  return data; // { message, thread }
}

export function buildReportThreadAttachmentUrl(
  reportId: string,
  threadId: string,
  attachment: ThreadAttachmentDto | null | undefined
): string | null {
  const rawFileId = (attachment as any)?.fileId?.$oid ?? attachment?.fileId;
  const fileId = String(rawFileId || "").trim();
  if (!reportId || !threadId || !fileId) return null;
  return `${API_URL}/api/mobile/reports/${encodeURIComponent(
    reportId
  )}/threads/${encodeURIComponent(threadId)}/attachment/${encodeURIComponent(fileId)}`;
}

export async function deleteReportThreadMessage(
  reportId: string,
  threadId: string,
  signal?: AbortSignal
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const res = await requestRaw({
      path: `/api/mobile/reports/${encodeURIComponent(reportId)}/threads/${encodeURIComponent(threadId)}`,
      method: "DELETE",
      headers,
      signal,
      auth: true,
    });

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
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const res = await requestRaw({
      path: `/api/mobile/reports/${encodeURIComponent(reportId)}/threads/${encodeURIComponent(threadId)}`,
      method: "PUT",
      headers,
      body: JSON.stringify({ text: message }),
      signal,
      auth: true,
    });

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
    return `${API_URL}/api/mobile/v1/reports/${encodeURIComponent(reportId)}/photos/${encodeURIComponent(s)}`;
  }

  // 2) object form (your case)
  if (typeof photo === "object") {
    // Prefer fileId always (works across devices)
    const rawFileId = (photo as any)?.fileId?.$oid ?? (photo as any)?.fileId;
    if (rawFileId) {
      const fileIdStr = String(rawFileId).trim();
      if (fileIdStr) {
        return `${API_URL}/api/mobile/v1/reports/${encodeURIComponent(reportId)}/photos/${encodeURIComponent(fileIdStr)}`;
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
      return `${API_URL}/api/mobile/v1/reports/${encodeURIComponent(reportId)}/photos/file/${encodeURIComponent(
        (photo as any).fileName.trim()
      )}`;
    }
  }

  return null;
}
