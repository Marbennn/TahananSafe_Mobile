// src/api/notifications.ts
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAccessToken } from "../auth/session";

export type NotifType = "alert" | "report" | "system" | "thread";

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
 * JWT helpers (no extra libs)
 * ------------------------------ */
function base64UrlDecode(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  try {
    // atob is available in RN JS runtime
    return globalThis.atob(b64);
  } catch {
    return "";
  }
}

function decodeJwtPayload(token: string): any | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const json = base64UrlDecode(parts[1]);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function getUserScopeKeySuffix(): Promise<string> {
  const token = await getAccessToken();
  if (!token) return "anon";

  const payload = decodeJwtPayload(token) || {};
  // support common backend fields
  const uid = String(payload?.userId ?? payload?.id ?? payload?._id ?? payload?.sub ?? "").trim();

  return uid || "anon";
}

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

// POST /api/mobile/v1/notifications/send-sos
export async function sendSosAlert(address?: string): Promise<{ sent: number; message: string }> {
  const headers = await authHeaders();
  const url = `${API_BASE_URL}/api/mobile/v1/notifications/send-sos`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ address: address ?? null }),
  });
  const data = await parseJsonSafe(res);

  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);

  return { sent: data?.sent ?? 0, message: data?.message ?? "Alert sent." };
}

// delete one REMOTE notification
export async function deleteNotification(id: string): Promise<void> {
  const headers = await authHeaders();
  const url = `${API_BASE_URL}/api/mobile/v1/notifications/${encodeURIComponent(id)}`;

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
 * ✅ LOCAL (AsyncStorage) notifications (USER-SCOPED)
 * ------------------------------ */

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

async function localKeys() {
  const suf = await getUserScopeKeySuffix();
  return {
    notifs: `tahanansafe_local_notifications_v1_${suf}`,
    status: `tahanansafe_report_status_cache_v1_${suf}`,
  };
}

async function getLocalNotifications(): Promise<NotificationItem[]> {
  const { notifs } = await localKeys();
  const list = await readJsonSafe<NotificationItem[]>(notifs, []);
  return Array.isArray(list) ? list : [];
}

async function setLocalNotifications(list: NotificationItem[]): Promise<void> {
  const { notifs } = await localKeys();
  await writeJsonSafe(notifs, list);
}

async function getStatusCache(): Promise<StatusCache> {
  const { status } = await localKeys();
  const cache = await readJsonSafe<StatusCache>(status, {});
  return cache && typeof cache === "object" ? cache : {};
}

async function setStatusCache(cache: StatusCache): Promise<void> {
  const { status } = await localKeys();
  await writeJsonSafe(status, cache);
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

    if (!oldStatus) {
      nextCache[reportId] = newStatus;
      continue;
    }

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
    const merged = [...newNotifs, ...existingLocal].slice(0, 200);
    await setLocalNotifications(merged);
  }

  await setStatusCache(nextCache);
}

/**
 * ✅ Combined (remote + local)
 */
export async function fetchMyNotificationsCombined(limit = 80): Promise<NotificationItem[]> {
  const [remote, local] = await Promise.all([fetchMyNotifications(limit), getLocalNotifications()]);

  const all = [...local, ...remote];

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
  const local = await getLocalNotifications();
  if (local.length > 0) {
    await setLocalNotifications(local.map((n) => ({ ...n, unread: false })));
  }
  await markAllNotificationsRead();
}

export async function toggleNotificationReadCombined(id: string): Promise<NotificationItem | null> {
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

  return await toggleNotificationRead(id);
}

// ✅ NEW: delete single notification (combined)
export async function deleteNotificationCombined(id: string): Promise<void> {
  const sid = String(id);

  // local delete
  if (sid.startsWith("local-")) {
    const local = await getLocalNotifications();
    const next = local.filter((n) => n.id !== sid);
    await setLocalNotifications(next);
    return;
  }

  // remote delete
  await deleteNotification(sid);
}

export async function clearAllNotificationsCombined(): Promise<void> {
  await setLocalNotifications([]);
  await setStatusCache({});
  await clearAllNotifications();
}