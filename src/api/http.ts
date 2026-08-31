import { getAccessToken, getRefreshToken, saveTokens } from "../auth/session";
import { apiUrl } from "../config/api";

export type ApiErrorPayload = {
  message?: string;
  error?: string;
  [key: string]: unknown;
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

type SessionExpiredListener = () => void | Promise<void>;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener) {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired() {
  for (const listener of sessionExpiredListeners) {
    Promise.resolve(listener()).catch(() => {});
  }
}

export async function safeReadJson(res: Response): Promise<any> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  return res.json().catch(() => null);
}

async function readErrorMessage(
  res: Response,
): Promise<{ message: string; payload: ApiErrorPayload | null }> {
  const clone = res.clone();
  const payload = await safeReadJson(clone);
  if (payload && typeof payload === "object") {
    return {
      message: String(payload.message || payload.error || "Request failed."),
      payload,
    };
  }

  const text = await res.text().catch(() => "");
  return { message: text || "Request failed.", payload: null };
}

let refreshPromise: Promise<string | null> | null = null;

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(apiUrl("/api/mobile/v1/refresh-token"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;

    const data = await safeReadJson(response);
    if (!data?.accessToken) return null;

    await saveTokens({
      accessToken: String(data.accessToken),
      refreshToken: data.refreshToken ? String(data.refreshToken) : refreshToken,
    });
    return String(data.accessToken);
  } catch {
    return null;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export type RawRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path?: string;
  url?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  auth?: boolean;
};

export async function requestRaw(options: RawRequestOptions): Promise<Response> {
  const {
    method = "GET",
    path,
    url: absoluteUrl,
    body,
    headers = {},
    signal,
    auth = false,
  } = options;
  const url = absoluteUrl || apiUrl(path || "");

  const execute = async (tokenOverride?: string | null) => {
    const requestHeaders: Record<string, string> = { ...headers };
    if (auth) {
      const token = tokenOverride || (await getAccessToken());
      if (token) requestHeaders.Authorization = `Bearer ${token}`;
    }

    return fetch(url, { method, headers: requestHeaders, body, signal });
  };

  let response = await execute();
  if (response.status !== 401 || !auth) return response;

  const newToken = await refreshAccessToken();
  if (!newToken) {
    notifySessionExpired();
    return response;
  }

  response = await execute(newToken);
  if (response.status === 401) notifySessionExpired();
  return response;
}

type JsonRequestOptions = Omit<RawRequestOptions, "body"> & {
  path: string;
  body?: unknown;
};

export async function requestJson<T>(options: JsonRequestOptions): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  const response = await requestRaw({
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const { message, payload } = await readErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }

  return (await safeReadJson(response)) as T;
}
