// src/components/OnBoarding/OnboardingSlide.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { Colors } from "../../theme/colors";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Props = {
  Svg: React.ComponentType<{ width?: number; height?: number }>;
  title: string;
  description: string;
};

export default function OnboardingSlide({ Svg, title, description }: Props) {
  const { width, height } = useWindowDimensions();

  // ✅ responsive scale (bigger phones => bigger UI)
  const s = clamp(width / 375, 0.95, 1.6);
  const vs = clamp(height / 812, 0.95, 1.35);

  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  /**
   * ✅ Responsive SVG sizing:
   * - based on screen width
   * - capped so it doesn't become too huge
   */
  const illusW = clamp(Math.round(width * 0.74), scale(250), scale(360));
  const illusH = Math.round(illusW * 0.82);

  return (
    <View style={styles.slide}>
      <View style={styles.illustrationWrap}>
        <Svg width={illusW} height={illusH} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
    </View>
  );
}

function createStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number
) {
  return StyleSheet.create({
    slide: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(22),
      paddingTop: vscale(6),
      paddingBottom: vscale(6),
      backgroundColor: "#FFFFFF",
    },

    illustrationWrap: {
      marginBottom: vscale(16),
      alignItems: "center",
      justifyContent: "center",
    },

    title: {
      textAlign: "center",
      fontSize: scale(16),
      fontWeight: Platform.select({ ios: "800", android: "800" }) as any,
      color: Colors.text,
      marginBottom: vscale(6),
    },

    desc: {
      textAlign: "center",
      fontSize: scale(11.5),
      lineHeight: scale(16),
      color: Colors.muted,
      maxWidth: scale(300),
    },
  });
}
