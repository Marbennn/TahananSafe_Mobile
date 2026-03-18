// src/utils/safeLog.ts
// ✅ SECURITY FIX: Production-safe logger that strips sensitive data

const __DEV__ = process.env.NODE_ENV !== "production";

/**
 * Logs only in __DEV__ mode. In production builds, all output is suppressed.
 * Use this instead of console.log for any log that might contain sensitive data.
 */
export function devLog(tag: string, ...args: any[]) {
  if (__DEV__) {
    console.log(tag, ...args);
  }
}

/**
 * Masks an email for safe logging: "john@example.com" → "j***@e***.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  const domParts = domain.split(".");
  const ext = domParts.pop() || "";
  const domName = domParts.join(".");
  return `${local[0]}***@${domName[0]}***.${ext}`;
}

/**
 * Masks a token for safe logging: shows first 6 chars + "..."
 */
export function maskToken(token: string | null | undefined): string {
  if (!token) return "(none)";
  return token.substring(0, 6) + "...";
}
