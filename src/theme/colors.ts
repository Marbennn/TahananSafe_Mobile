// src/theme/colors.ts
export const Colors = {
  // ✅ Primary (from your Primary Blue Linear)
  primary: "#07519C",
  primaryDark: "#021C36",

  // ✅ Links / clickable text
  link: "#07519C",

  // ✅ Text colors (from your Figma "Text Colors")
  heading: "#374151",
  body: "#41546E",
  muted: "#6B7280", // keep if you still use this
  timestamp: "#888888",
  placeholder: "#AAAAAA",
  inboxRead: "#666666",
  inboxUnread: "#07519C",

  // ✅ UI neutrals
  text: "#111827",
  border: "#E3E8EF",
  inputBg: "#F8FAFC",

  // ✅ Gradient (0% -> 100%)
  gradient: ["#07519C", "#021C36"],
} as const;
