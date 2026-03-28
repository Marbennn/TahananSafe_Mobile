// src/api/http.ts
// ✅ FIXED: Added automatic token refresh on 401 responses
import { apiUrl } from "../config/api";
import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "../auth/session";

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

async function readErrorMessage(
  res: Response
): Promise<{ message: string; payload: any | null }> {
  const payload = await safeReadJson(res);
  if (payload && typeof payload === "object") {
    const msg = String(
      payload.message || payload.error || JSON.stringify(payload)
    );
    return { message: msg, payload };
  }

  const t = await res.text().catch(() => "");
  return { message: t || "Request failed.", payload: null };
}

// =====================================================
// ✅ Token refresh logic (singleton to prevent races)
// =====================================================
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function doRefreshToken(): Promise<string | null> {
  const rToken = await getRefreshToken();
  if (!rToken) return null;

  try {
    const url = apiUrl("/api/mobile/v1/refresh-token");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rToken }),
    });

    if (!res.ok) return null;

    const data = await safeReadJson(res);
    if (data?.accessToken) {
      await saveTokens({ accessToken: data.accessToken });
      return data.accessToken;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * ✅ If multiple 401s fire at once, they all wait for a single
 * refresh call instead of each triggering their own.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = doRefreshToken().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
}

// =====================================================
// ✅ Main request function
// =====================================================
type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: any;
  headers?: Record<string, string>;
  /**
   * ✅ NEW: Set to true to auto-attach the stored access token
   * as an Authorization: Bearer header, and auto-refresh on 401.
   * Defaults to false (backward compatible with your existing calls).
   */
  auth?: boolean;
};

export async function requestJson<T>(opts: RequestOptions): Promise<T> {
  const { method = "GET", path, body, headers = {}, auth = false } = opts;

  const url = apiUrl(path);

  // ✅ Build headers, optionally attaching the access token
  const buildHeaders = async (
    tokenOverride?: string | null
  ): Promise<Record<string, string>> => {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (auth && tokenOverride) {
      // On retry after token refresh, always use the fresh token
      h["Authorization"] = `Bearer ${tokenOverride}`;
    } else if (auth && !h["Authorization"]) {
      const token = await getAccessToken();
      if (token) {
        h["Authorization"] = `Bearer ${token}`;
      }
    }

    return h;
  };

  const doFetch = async (tokenOverride?: string | null): Promise<Response> => {
    const h = await buildHeaders(tokenOverride);
    return fetch(url, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  // ── First attempt ──
  let res = await doFetch();

  // ✅ If 401 + auth enabled → try refreshing the token once, then retry
  if (res.status === 401 && auth) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      // Retry the original request with the fresh token
      res = await doFetch(newToken);
    } else {
      // Refresh failed — don't clear session so PinScreen can still show
      const { message, payload } = await readErrorMessage(res);
      throw new ApiError(
        message || "Session expired. Please log in again.",
        401,
        payload
      );
    }
  }

  // ── Handle errors ──
  if (!res.ok) {
    const { message, payload } = await readErrorMessage(res);
    throw new ApiError(message, res.status, payload);
  }

  const data = (await safeReadJson(res)) as T;
  return data;
}