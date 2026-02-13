// src/api/reports.ts
import { getAccessToken } from "../auth/session";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

export type ThreadDto = {
  _id: string;
  reportId: string;
  senderRole: "resident" | "staff";
  senderName: string;
  text: string;
  createdAt: string;
};

export async function fetchReportThreads(reportId: string): Promise<ThreadDto[]> {
  const token = await getAccessToken();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/mobile/reports/${reportId}/threads`, {
    method: "GET",
    headers,
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

  return (data?.threads || []) as ThreadDto[];
}

export async function sendReportThreadMessage(reportId: string, message: string) {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/mobile/reports/${reportId}/threads`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: message }),
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

  return data; // { message, thread }
}
