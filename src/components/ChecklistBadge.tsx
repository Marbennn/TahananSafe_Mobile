import React from "react";
import { View, StyleSheet } from "react-native";

// ✅ Use your checklist SVG (adjust path if your folder name differs)
import SignupChecklist from "../../assets/Signup/SignupChecklist.svg";

type Props = {
  size: number; // halo size (circle)
};

export default function ChecklistBadge({ size }: Props) {
  // Keep the svg nicely sized inside the halo
  const svgSize = Math.round(size * 0.63);

  return (
    <View style={[styles.halo, { width: size, height: size, borderRadius: size / 2 }]}>
      <SignupChecklist width={svgSize} height={svgSize} style={styles.svg} />
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    backgroundColor: "#EAF2FA", // ✅ transparent blue halo background
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    alignSelf: "center",
  },
});
