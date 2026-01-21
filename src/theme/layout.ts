// src/theme/layout.ts
import { Dimensions } from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export const Layout = {
  screenHeight: SCREEN_HEIGHT,
  cardMinHeight: Math.round(SCREEN_HEIGHT * 0.72),
} as const;
