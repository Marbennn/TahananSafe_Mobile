import { Platform, type TextStyle } from "react-native";

export type TypographyScaler = (value: number) => number;

export const FontFamily =
  Platform.select({
    android: "sans-serif",
    ios: "System",
    default: "System",
  }) ?? "System";

export const FontSize = {
  // Ten-point text is reserved for constrained badges. The semantic `micro`
  // roles use the 11-point overline size so helper text remains readable.
  micro: 10,
  overline: 11,
  caption: 12,
  label: 13,
  body: 14,
  bodyLarge: 15,
  sectionTitle: 16,
  modalTitle: 18,
  numeric: 20,
  flowTitle: 24,
  authTitle: 26,
  screenTitle: 28,
  display: 32,
} as const;

export const FontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const satisfies Record<string, NonNullable<TextStyle["fontWeight"]>>;

export type TypographyRole =
  | "display"
  | "screenTitle"
  | "authTitle"
  | "flowTitle"
  | "modalTitle"
  | "sectionTitle"
  | "cardTitle"
  | "metric"
  | "numeric"
  | "bodyLarge"
  | "body"
  | "bodyStrong"
  | "bodySmall"
  | "label"
  | "input"
  | "button"
  | "caption"
  | "captionStrong"
  | "overline"
  | "badge"
  | "micro"
  | "microStrong"
  | "navLabel";

const identity: TypographyScaler = (value) => value;

/**
 * Shared semantic text styles for the mobile app.
 *
 * Pass a screen's existing scale/vscale helpers when typography needs to stay
 * responsive. Keeping the role names semantic prevents individual screens
 * from inventing slightly different sizes and weights for the same purpose.
 */
export function createTypography(
  scale: TypographyScaler = identity,
  _lineScale: TypographyScaler = scale,
): Record<TypographyRole, TextStyle> {
  // Text size and line height must use the same scaler. Some screens pass a
  // height-based vscale as the second argument; that value can shrink when the
  // keyboard opens and make lineHeight smaller than fontSize on Android. Keep
  // the parameter for existing call-site compatibility, but deliberately use
  // the font scaler for both dimensions.
  const textLineScale = scale;
  const base: TextStyle = {
    fontFamily: FontFamily,
    includeFontPadding: false,
  };

  return {
    display: {
      ...base,
      fontSize: scale(FontSize.display),
      lineHeight: textLineScale(38),
      fontWeight: FontWeight.bold,
      letterSpacing: -0.3,
    },
    screenTitle: {
      ...base,
      fontSize: scale(FontSize.screenTitle),
      lineHeight: textLineScale(34),
      fontWeight: FontWeight.bold,
      letterSpacing: -0.2,
    },
    authTitle: {
      ...base,
      fontSize: scale(FontSize.authTitle),
      lineHeight: textLineScale(32),
      fontWeight: FontWeight.bold,
      letterSpacing: -0.2,
    },
    flowTitle: {
      ...base,
      fontSize: scale(FontSize.flowTitle),
      lineHeight: textLineScale(30),
      fontWeight: FontWeight.bold,
      letterSpacing: -0.1,
    },
    modalTitle: {
      ...base,
      fontSize: scale(FontSize.modalTitle),
      lineHeight: textLineScale(24),
      fontWeight: FontWeight.bold,
    },
    sectionTitle: {
      ...base,
      fontSize: scale(FontSize.sectionTitle),
      lineHeight: textLineScale(22),
      fontWeight: FontWeight.bold,
    },
    cardTitle: {
      ...base,
      fontSize: scale(FontSize.body),
      lineHeight: textLineScale(21),
      fontWeight: FontWeight.semibold,
    },
    metric: {
      ...base,
      fontSize: scale(FontSize.screenTitle),
      lineHeight: textLineScale(34),
      fontWeight: FontWeight.bold,
      fontVariant: ["tabular-nums"],
    },
    numeric: {
      ...base,
      fontSize: scale(FontSize.numeric),
      lineHeight: textLineScale(24),
      fontWeight: FontWeight.bold,
      fontVariant: ["tabular-nums"],
    },
    bodyLarge: {
      ...base,
      fontSize: scale(FontSize.bodyLarge),
      lineHeight: textLineScale(22),
      fontWeight: FontWeight.regular,
    },
    body: {
      ...base,
      fontSize: scale(FontSize.body),
      lineHeight: textLineScale(20),
      fontWeight: FontWeight.regular,
    },
    bodyStrong: {
      ...base,
      fontSize: scale(FontSize.body),
      lineHeight: textLineScale(20),
      fontWeight: FontWeight.semibold,
    },
    bodySmall: {
      ...base,
      fontSize: scale(FontSize.label),
      lineHeight: textLineScale(18),
      fontWeight: FontWeight.regular,
    },
    label: {
      ...base,
      fontSize: scale(FontSize.label),
      lineHeight: textLineScale(18),
      fontWeight: FontWeight.semibold,
    },
    input: {
      ...base,
      fontSize: scale(FontSize.body),
      lineHeight: textLineScale(20),
      fontWeight: FontWeight.regular,
    },
    button: {
      ...base,
      fontSize: scale(FontSize.body),
      lineHeight: textLineScale(20),
      fontWeight: FontWeight.bold,
      letterSpacing: 0.1,
    },
    caption: {
      ...base,
      fontSize: scale(FontSize.caption),
      lineHeight: textLineScale(16),
      fontWeight: FontWeight.regular,
    },
    captionStrong: {
      ...base,
      fontSize: scale(FontSize.caption),
      lineHeight: textLineScale(16),
      fontWeight: FontWeight.semibold,
    },
    overline: {
      ...base,
      fontSize: scale(FontSize.overline),
      lineHeight: textLineScale(15),
      fontWeight: FontWeight.bold,
      letterSpacing: 0.7,
    },
    badge: {
      ...base,
      fontSize: scale(FontSize.micro),
      lineHeight: textLineScale(14),
      fontWeight: FontWeight.bold,
    },
    micro: {
      ...base,
      fontSize: scale(FontSize.overline),
      lineHeight: textLineScale(14),
      fontWeight: FontWeight.regular,
    },
    microStrong: {
      ...base,
      fontSize: scale(FontSize.overline),
      lineHeight: textLineScale(14),
      fontWeight: FontWeight.semibold,
    },
    navLabel: {
      ...base,
      fontSize: scale(FontSize.overline),
      lineHeight: textLineScale(14),
      fontWeight: FontWeight.semibold,
    },
  };
}

export const Typography = createTypography();
