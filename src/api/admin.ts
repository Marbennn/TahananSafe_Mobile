import { requestJson } from "./http";

export type AdminIncident = {
  _id: string;
  id?: string;
  complainId?: string;
  user: string | { _id: string; firstName?: string; lastName?: string; email?: string };
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
  ai_incident_type?: string;
  ai_incident_types?: string[];
  ai_summary?: string;
  ai_indicators?: string[];
  ai_legal_references?: Array<{ title?: string; reference?: string; url?: string }>;
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
  emergencyReports: number;
  totalUsers: number;
  verifiedUsers: number;
};

export async function fetchAdminIncidents(signal?: AbortSignal): Promise<AdminIncident[]> {
  const data = await requestJson<any>({
    path: "/api/web/v1/incidents",
    signal,
    auth: true,
  });
  return Array.isArray(data?.incidents) ? data.incidents : Array.isArray(data) ? data : [];
}

export async function fetchAdminIncidentById(
  id: string,
  signal?: AbortSignal,
): Promise<AdminIncident> {
  const data = await requestJson<any>({
    path: `/api/web/v1/incidents/${encodeURIComponent(id)}`,
    signal,
    auth: true,
  });
  return (data?.incident || data) as AdminIncident;
}

export async function updateIncidentStatus(
  incidentId: string,
  status: string,
  signal?: AbortSignal,
): Promise<void> {
  await requestJson({
    method: "PUT",
    path: `/api/web/v1/incidents/${encodeURIComponent(incidentId)}/status`,
    body: { status },
    signal,
    auth: true,
  });
}

export async function fetchAdminUsers(signal?: AbortSignal): Promise<AdminUser[]> {
  const data = await requestJson<any>({
    path: "/api/web/v1/users",
    signal,
    auth: true,
  });
  return Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
}

export async function fetchAdminStats(signal?: AbortSignal): Promise<AdminStats> {
  const data = await requestJson<any>({
    path: "/api/web/v1/statistics",
    signal,
    auth: true,
  });
  return {
    totalIncidents: data?.totalCases ?? 0,
    pending: data?.pending ?? 0,
    reviewing: data?.ongoing ?? 0,
    resolved: data?.resolved ?? 0,
    cancelled: data?.cancelled ?? 0,
    emergencyReports: data?.emergencyReports ?? data?.emergency ?? 0,
    totalUsers: data?.totalUsers ?? 0,
    verifiedUsers: data?.verifiedUsers ?? 0,
  };
}
