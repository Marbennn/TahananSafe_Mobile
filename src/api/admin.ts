// src/api/admin.ts
import { getAccessToken } from "../auth/session";
import { apiUrl } from "../config/api";

export type AdminIncident = {
  _id: string;
  user:
    | string
    | { _id: string; firstName?: string; lastName?: string; email?: string };
  mode?: "complain" | "emergency";
  incidentType?: string;
  details?: string;
  offenderName?: string;
  witnessName?: string;
  witnessType?: string;
  dateStr?: string;
  timeStr?: string;
  locationStr?: string;
  status?: "submitted" | "reviewing" | "resolved" | "cancelled";
  photos?: any[];
  createdAt?: string;
  updatedAt?: string;
  ai_risk_level?: string;
  ai_priority_level?: string;
  ai_incident_type?: string;
  ai_children_involved?: boolean;
  ai_weapon_mentioned?: boolean;
  ai_confidence_score?: number;
};

export type AdminUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  isVerified?: boolean;
  hasPin?: boolean;
  createdAt?: string;
  contactNumber?: string;
  gender?: string;
};

export type AdminStats = {
  totalIncidents: number;
  pending: number;
  reviewing: number;
  resolved: number;
  cancelled: number;
  highRisk: number;
  totalUsers: number;
  verifiedUsers: number;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseJson(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

export async function fetchAdminIncidents(
  signal?: AbortSignal
): Promise<AdminIncident[]> {
  const headers = await authHeaders();
  const res = await fetch(apiUrl("/api/web/v1/incidents"), { headers, signal });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);
  return Array.isArray(data?.incidents)
    ? data.incidents
    : Array.isArray(data)
    ? data
    : [];
}

export async function fetchAdminIncidentById(
  id: string,
  signal?: AbortSignal
): Promise<AdminIncident> {
  const headers = await authHeaders();
  const res = await fetch(
    apiUrl(`/api/web/v1/incidents/${encodeURIComponent(id)}`),
    { headers, signal }
  );
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);
  return (data?.incident || data) as AdminIncident;
}

export async function updateIncidentStatus(
  incidentId: string,
  status: string,
  signal?: AbortSignal
): Promise<void> {
  const headers = {
    ...(await authHeaders()),
    "Content-Type": "application/json",
  };
  const res = await fetch(
    apiUrl(`/api/web/v1/incidents/${encodeURIComponent(incidentId)}/status`),
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ status }),
      signal,
    }
  );
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);
}

export async function fetchAdminUsers(
  signal?: AbortSignal
): Promise<AdminUser[]> {
  const headers = await authHeaders();
  const res = await fetch(apiUrl("/api/web/v1/users"), { headers, signal });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);
  return Array.isArray(data?.users)
    ? data.users
    : Array.isArray(data)
    ? data
    : [];
}

export async function fetchAdminStats(
  signal?: AbortSignal
): Promise<AdminStats> {
  const headers = await authHeaders();
  const res = await fetch(apiUrl("/api/web/v1/statistics"), { headers, signal });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);
  // Map backend statistics shape to AdminStats
  return {
    totalIncidents: data?.totalCases ?? 0,
    pending: data?.pending ?? 0,
    reviewing: data?.ongoing ?? 0,
    resolved: data?.resolved ?? 0,
    cancelled: data?.cancelled ?? 0,
    highRisk: data?.riskHigh ?? 0,
    totalUsers: data?.totalUsers ?? 0,
    verifiedUsers: data?.verifiedUsers ?? 0,
  } as AdminStats;
}
