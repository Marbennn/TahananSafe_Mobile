// src/api/notifications.ts
import { Platform } from "react-native";
import { getAccessToken } from "../auth/session";

export type NotifType = "alert" | "report" | "system";

export type NotificationItem = {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  time: string; // ISO string from backend
  unread: boolean;
  incidentId?: string | null;
  meta?: { oldStatus?: string; newStatus?: string };
};

function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.replace(/\/+$/, "");
  }

  if (Platform.OS === "android") return "http://10.0.2.2:8000";
  return "http://localhost:8000";
}

const API_BASE_URL = getApiBaseUrl();

async function authHeaders() {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Please login again. (Missing access token)");
  }

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  } as Record<string, string>;
}

async function parseJsonSafe(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

export async function fetchMyNotifications(limit = 80): Promise<NotificationItem[]> {
  const headers = await authHeaders();
  const url = `${API_BASE_URL}/api/mobile/v1/notifications/my?limit=${encodeURIComponent(
    String(limit)
  )}`;

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers });
  } catch {
    throw new Error(
      `Network request failed.\n\nCheck EXPO_PUBLIC_API_URL:\n${API_BASE_URL}\n\nBackend port must match (8000).`
    );
  }

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);

  const items = Array.isArray(data?.items) ? data.items : [];
  return items as NotificationItem[];
}

export async function markAllNotificationsRead(): Promise<void> {
  const headers = await authHeaders();
  const url = `${API_BASE_URL}/api/mobile/v1/notifications/mark-all`;

  const res = await fetch(url, { method: "POST", headers });
  const data = await parseJsonSafe(res);

  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
}

export async function toggleNotificationRead(id: string): Promise<NotificationItem> {
  const headers = await authHeaders();
  const url = `${API_BASE_URL}/api/mobile/v1/notifications/${encodeURIComponent(id)}/toggle`;

  const res = await fetch(url, { method: "PATCH", headers });
  const data = await parseJsonSafe(res);

  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);

  const item = data?.item;
  if (!item) throw new Error("Unexpected response: missing item");
  return item as NotificationItem;
}

export async function clearAllNotifications(): Promise<void> {
  const headers = await authHeaders();
  const url = `${API_BASE_URL}/api/mobile/v1/notifications/clear`;

  const res = await fetch(url, { method: "DELETE", headers });
  const data = await parseJsonSafe(res);

  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
}

/**
 * ✅ NEW (put here so you don't need a new file)
 * GET /api/mobile/v1/reports/:id
 * Returns: { report: incident }
 */
export async function fetchMyReportDetailById(reportId: string): Promise<any | null> {
  const headers = await authHeaders();
  const url = `${API_BASE_URL}/api/mobile/v1/reports/${encodeURIComponent(reportId)}`;

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers });
  } catch {
    throw new Error(
      `Network request failed.\n\nCheck EXPO_PUBLIC_API_URL:\n${API_BASE_URL}\n\nBackend port must match (8000).`
    );
  }

  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);

  return (data?.report ?? null) as any | null;
}