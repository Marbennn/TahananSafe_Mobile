// src/api/http.ts
import { apiUrl } from "../config/api";

export type ApiErrorPayload = {
  message?: string;
  error?: string;
  [key: string]: any;
};

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload | null;

  constructor(message: string, status: number, payload: ApiErrorPayload | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function safeReadJson(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return res.json().catch(() => null);
}

async function readErrorMessage(res: Response): Promise<{ message: string; payload: any | null }> {
  const payload = await safeReadJson(res);
  if (payload && typeof payload === "object") {
    const msg = String(payload.message || payload.error || JSON.stringify(payload));
    return { message: msg, payload };
  }

  const t = await res.text().catch(() => "");
  return { message: t || "Request failed.", payload: null };
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string; // ex: "/api/mobile/v1/register"
  body?: any;
  headers?: Record<string, string>;
};

export async function requestJson<T>(opts: RequestOptions): Promise<T> {
  const { method = "GET", path, body, headers = {} } = opts;

  const url = apiUrl(path);

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const { message, payload } = await readErrorMessage(res);
    throw new ApiError(message, res.status, payload);
  }

  const data = (await safeReadJson(res)) as T;
  return data;
}
