// src/api/notifications.ts
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAccessToken } from "../auth/session";

export type NotifType = "alert" | "report" | "system";

export type NotificationItem = {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  time: string; // ISO string
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

/** ------------------------------
 * Backend helpers
 * ------------------------------ */
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
  const url = `${API_BASE_URL}/api/mobile/v1/notifications/my?limit=${encodeURIComponent(String(limit))}`;

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
 * ✅ Existing helper (kept)
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

/** ------------------------------
 * ✅ LOCAL (AsyncStorage) notifications
 * - used for "report status changed" feature
 * ------------------------------ */

const STORAGE_LOCAL_NOTIFS_KEY = "tahanansafe_local_notifications_v1";
const STORAGE_REPORT_STATUS_KEY = "tahanansafe_report_status_cache_v1";

type StatusCache = Record<string, string>; // reportId -> lastKnownStatus

function statusLabel(s?: string) {
  const x = String(s ?? "").toUpperCase();
  if (x === "PENDING") return "Pending";
  if (x === "ONGOING") return "On going";
  if (x === "CANCELLED") return "Cancelled";
  if (x === "RESOLVED") return "Resolved";
  return x || "Unknown";
}

async function readJsonSafe<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonSafe<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

async function getLocalNotifications(): Promise<NotificationItem[]> {
  const list = await readJsonSafe<NotificationItem[]>(STORAGE_LOCAL_NOTIFS_KEY, []);
  return Array.isArray(list) ? list : [];
}

async function setLocalNotifications(list: NotificationItem[]): Promise<void> {
  await writeJsonSafe(STORAGE_LOCAL_NOTIFS_KEY, list);
}

async function getStatusCache(): Promise<StatusCache> {
  const cache = await readJsonSafe<StatusCache>(STORAGE_REPORT_STATUS_KEY, {});
  return cache && typeof cache === "object" ? cache : {};
}

async function setStatusCache(cache: StatusCache): Promise<void> {
  await writeJsonSafe(STORAGE_REPORT_STATUS_KEY, cache);
}

/**
 * ✅ Call this from ReportScreen right after you fetch the latest reports list.
 * It will create local notifications for any status changes.
 */
export async function syncLocalReportStatusNotifications(
  reports: Array<{ id: string; title?: string; status?: string; updatedAt?: string; createdAt?: string }>
): Promise<void> {
  if (!Array.isArray(reports) || reports.length === 0) return;

  const prevCache = await getStatusCache();
  const nextCache: StatusCache = { ...prevCache };

  const existingLocal = await getLocalNotifications();
  const localIds = new Set(existingLocal.map((n) => n.id));

  const newNotifs: NotificationItem[] = [];

  for (const r of reports) {
    const reportId = String((r as any)?.id ?? "").trim();
    if (!reportId) continue;

    const newStatus = String((r as any)?.status ?? "").trim().toUpperCase();
    if (!newStatus) continue;

    const oldStatus = String(prevCache[reportId] ?? "").trim().toUpperCase();

    // First time seeing this report -> just cache it, no notification
    if (!oldStatus) {
      nextCache[reportId] = newStatus;
      continue;
    }

    // Status changed -> create a local notification
    if (oldStatus !== newStatus) {
      nextCache[reportId] = newStatus;

      const title = String((r as any)?.title ?? "Incident Report");
      const timeIso = new Date().toISOString();

      const notifId = `local-report-status-${reportId}-${timeIso}`;
      if (localIds.has(notifId)) continue;

      const notif: NotificationItem = {
        id: notifId,
        type: "report",
        title: "Report status updated",
        message: `Your report "${title}" changed from ${statusLabel(oldStatus)} to ${statusLabel(newStatus)}.`,
        time: timeIso,
        unread: true,
        incidentId: reportId,
        meta: { oldStatus, newStatus },
      };

      newNotifs.push(notif);
      localIds.add(notifId);
    } else {
      nextCache[reportId] = newStatus;
    }
  }

  if (newNotifs.length > 0) {
    // newest first
    const merged = [...newNotifs, ...existingLocal].slice(0, 200);
    await setLocalNotifications(merged);
  }

  await setStatusCache(nextCache);
}

/**
 * ✅ NotificationsScreen should use these COMBINED functions
 * so it shows both backend notifications + local status-change notifications.
 */
export async function fetchMyNotificationsCombined(limit = 80): Promise<NotificationItem[]> {
  const [remote, local] = await Promise.all([fetchMyNotifications(limit), getLocalNotifications()]);

  // Merge + sort newest first
  const all = [...local, ...remote];

  // Dedupe by id (just in case)
  const seen = new Set<string>();
  const deduped: NotificationItem[] = [];
  for (const n of all) {
    if (!n?.id) continue;
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    deduped.push(n);
  }

  deduped.sort((a, b) => {
    const ta = new Date(a.time).getTime();
    const tb = new Date(b.time).getTime();
    return (tb || 0) - (ta || 0);
  });

  return deduped.slice(0, limit);
}

export async function markAllNotificationsReadCombined(): Promise<void> {
  // optimistic local + remote
  const local = await getLocalNotifications();
  if (local.length > 0) {
    await setLocalNotifications(local.map((n) => ({ ...n, unread: false })));
  }
  await markAllNotificationsRead();
}

export async function toggleNotificationReadCombined(id: string): Promise<NotificationItem | null> {
  // If local notif -> toggle locally
  if (String(id).startsWith("local-")) {
    const local = await getLocalNotifications();
    const idx = local.findIndex((n) => n.id === id);
    if (idx === -1) return null;

    const updated = { ...local[idx], unread: !local[idx].unread };
    const next = [...local];
    next[idx] = updated;
    await setLocalNotifications(next);
    return updated;
  }

  // else remote
  return await toggleNotificationRead(id);
}

export async function clearAllNotificationsCombined(): Promise<void> {
  await setLocalNotifications([]);
  await clearAllNotifications();
}