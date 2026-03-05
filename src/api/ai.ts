// src/api/ai.ts
import { getAccessToken } from "../auth/session";

export type AiAnalyzeRequest = {
  incident_description: string;
};

export type AiAnalyzeResponse = {
  incident_type?: string;
  language?: string;
  risk_level?: string;
  risk_percentage?: number;
  priority_level?: string;
  children_involved?: boolean;
  weapon_mentioned?: boolean;
  confidence_score?: number;
  explanation?: string;
  summary?: string;
  [key: string]: any;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, id };
}

export async function analyzeIncident(incidentDescription: string) {
  const token = await getAccessToken();

  const payload: AiAnalyzeRequest = {
    incident_description: incidentDescription,
  };

  const { controller, id } = withTimeout(20000);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_URL}/api/mobile/ai/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!res.ok) {
      throw new Error(data?.message || data?.detail || `AI analyze failed (${res.status})`);
    }

    return data as AiAnalyzeResponse;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("AI request timed out. Please try again.");
    }
    throw e;
  } finally {
    clearTimeout(id);
  }
}