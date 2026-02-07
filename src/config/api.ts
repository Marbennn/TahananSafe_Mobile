// src/config/api.ts
const RAW = process.env.EXPO_PUBLIC_API_URL;

// fallback (dev) - only works on same PC / emulator; phone needs LAN IP
export const API_BASE_URL = (RAW && RAW.trim().length > 0)
  ? RAW.trim().replace(/\/+$/, "")
  : "http://localhost:8000";

export function apiUrl(path: string) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
