// src/utils/responsive.ts
import { PixelRatio } from "react-native";

/**
 * Responsive helpers for consistent scaling across devices.
 * Works best for phones (small/normal/large) and stays stable on tablets.
 */

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Stable scale based on screen width + height.
 * Uses the smaller influence to avoid oversized UI on short phones.
 */
export function getScale(width: number, height: number) {
  const baseW = 375;
  const baseH = 812;

  const sw = width / baseW;
  const sh = height / baseH;

  // A stable scale value for spacing/components
  const s = clamp(Math.min(sw, sh) * 1.04, 0.88, 1.28);

  // Slight font bump but controlled
  const fs = clamp(s * 1.06, 0.92, 1.32);

  return { s, fs };
}

/**
 * For components that only know width (like cards in lists),
 * keep it stable and slightly smaller than getScale().
 */
export function getScaleFromWidth(width: number) {
  const baseW = 375;
  const s = clamp((width / baseW) * 1.03, 0.88, 1.25);
  const fs = clamp(s * 1.06, 0.92, 1.32);
  return { s, fs };
}

/**
 * Pixel-snapping for smooth Animated values.
 */
export function snapToPixel(value: number) {
  const dpr = PixelRatio.get();
  return Math.round(value * dpr) / dpr;
}

/**
 * Helpful shortcuts (optional usage):
 */
export function rpx(n: number, s: number) {
  return Math.round(n * s);
}

export function rfont(n: number, fs: number) {
  return Math.round(n * fs);
}