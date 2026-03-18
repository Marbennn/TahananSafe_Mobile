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
  incident_tip?: string;
  submission_decision?: string; // "ALLOW" | "BLOCKED"
  allow_submission?: boolean;
  validation_reason?: string;
  [key: string]: any;
};

const API_URL = (
  process.env.EXPO_PUBLIC_AI_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:8000"
)
  .trim()
  .replace(/\/+$/, "");

const ANALYZE_PATH = (
  process.env.EXPO_PUBLIC_AI_ANALYZE_PATH || "/analyze"
)
  .trim()
  .replace(/^([^/])/, "/$1");

function normalizePath(path: string) {
  return String(path || "")
    .trim()
    .replace(/^([^/])/, "/$1");
}

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

  const { controller, id } = withTimeout(60000);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const path = normalizePath(ANALYZE_PATH);
    const endpoint = `${API_URL}${path}`;
    console.log("[AI] analyze endpoint:", endpoint);

    const res = await fetch(endpoint, {
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
      throw new Error(
        data?.message ||
          data?.detail ||
          `AI analyze failed (${res.status}) @ ${endpoint}`
      );
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
