// src/theme/colors.ts
import { useTheme } from "./ThemeContext";

export const PRIMARY_ACTION_COLOR = "#00223E";
export const PRIMARY_ACTION_GRADIENT = [
  PRIMARY_ACTION_COLOR,
  PRIMARY_ACTION_COLOR,
] as const;

export const Colors = {
  // ✅ Primary (from your Primary Blue Linear)
  primary: "#07519C",
  primaryDark: "#021C36",

  // ✅ Links / clickable text
  link: "#07519C",

  // ✅ Text colors (from your Figma "Text Colors")
  heading: "#374151",
  body: "#41546E",
  muted: "#6B7280",
  timestamp: "#888888",
  placeholder: "#AAAAAA",
  inboxRead: "#666666",
  inboxUnread: "#07519C",

  // ✅ UI neutrals
  text: "#111827",
  border: "#E3E8EF",
  inputBg: "#F8FAFC",

  // ✅ Gradient MUST be a tuple (at least 2 colors) for expo-linear-gradient typing
  gradient: ["#07519C", "#021C36"] as const,
  actionPrimary: PRIMARY_ACTION_COLOR,
  actionGradient: PRIMARY_ACTION_GRADIENT,

  // ✅ Semantic surface colors (light defaults)
  screenBg: "#F5FAFE",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  divider: "#E7EEF7",
  chipBg: "#EEF6FF",
  textDark: "#0F172A",
  switchTrackOff: "#D1D5DB",
  switchThumbOff: "#F3F4F6",
  ripple: "rgba(0,0,0,0.06)",
  overlay: "rgba(15, 23, 42, 0.35)",
  statusBar: "dark-content" as "dark-content" | "light-content",
} as const;

// ✅ Dark mode palette
export const DarkColors = {
  primary: "#4A9EF5",
  primaryDark: "#1A3A5C",

  link: "#4A9EF5",

  heading: "#E2E8F0",
  body: "#CBD5E1",
  muted: "#94A3B8",
  timestamp: "#94A3B8",
  placeholder: "#64748B",
  inboxRead: "#94A3B8",
  inboxUnread: "#4A9EF5",

  text: "#F1F5F9",
  border: "#1E293B",
  inputBg: "#1E293B",

  gradient: ["#1A3A5C", "#0F172A"] as const,
  actionPrimary: PRIMARY_ACTION_COLOR,
  actionGradient: PRIMARY_ACTION_GRADIENT,

  screenBg: "#0F172A",
  surface: "#1E293B",
  card: "#1E293B",
  divider: "#334155",
  chipBg: "#1E3A5F",
  textDark: "#F1F5F9",
  switchTrackOff: "#475569",
  switchThumbOff: "#94A3B8",
  ripple: "rgba(255,255,255,0.08)",
  overlay: "rgba(0, 0, 0, 0.55)",
  statusBar: "light-content" as "dark-content" | "light-content",
} as const;

/** Hook: returns the full themed color set for the current mode. */
export function useColors() {
  const { isDark } = useTheme();
  return isDark ? { ...Colors, ...DarkColors, isDark: true as const } : { ...Colors, isDark: false as const };
}
