import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import GreetingCardSvg from "../../../assets/HomeScreen/GreetingCard.svg";

type Props = {
  greeting: string;
  dateLine: string;
  userName?: string;
  dots?: { count: number; active: number };
  onGridPress?: () => void;
};

export default function GreetingCard({
  greeting,
  dateLine,
  userName = "User",
  dots = { count: 2, active: 0 },
  onGridPress,
}: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height }
    );
  }, []);

  return (
    <View style={styles.card} onLayout={onLayout}>
      {size.w > 0 && size.h > 0 ? (
        <GreetingCardSvg
          width={size.w}
          height={size.h}
          preserveAspectRatio="xMidYMid slice"
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <View style={styles.fallbackBg} />
      )}

      <View pointerEvents="none" style={styles.rightAccent} />
      <View pointerEvents="none" style={styles.rightAccent2} />

      <View style={styles.overlay}>
        <View style={styles.left}>
          <Text style={styles.title} numberOfLines={1}>
            {greeting}, {userName}!
          </Text>

          <Text style={styles.sub} numberOfLines={1}>
            {dateLine}
          </Text>
        </View>

        <View style={styles.gridWrap}>
          <Pressable
            onPress={onGridPress}
            hitSlop={10}
            style={({ pressed }) => [
              styles.gridBtn,
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
            ]}
          >
            <Ionicons name="grid-outline" size={18} color="#0B2B45" />
          </Pressable>
        </View>

        <View style={styles.dotsRow} pointerEvents="none">
          {Array.from({ length: dots.count }).map((_, i) => {
            const active = i === dots.active;
            return (
              <View key={i} style={[styles.dot, active && styles.dotActive]} />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginTop: 6,
    height: 142,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#0B3A5A",
  },

  fallbackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0B3A5A",
  },

  rightAccent: {
    position: "absolute",
    right: -32,
    top: -16,
    width: 155,
    height: 155,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.18)",
    transform: [{ rotate: "12deg" }],
  },
  rightAccent2: {
    position: "absolute",
    right: -20,
    bottom: -30,
    width: 140,
    height: 140,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.10)",
    transform: [{ rotate: "12deg" }],
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },

  left: {
    paddingRight: 110,
    marginTop: 18,
  },

  // ✅ bigger like your screenshot
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
    lineHeight: 20,
  },

  // ✅ slightly bigger too
  sub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },

  gridWrap: {
    position: "absolute",
    right: 12,
    bottom: 20,
  },

  gridBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  dotsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    alignItems: "center",
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  dotActive: {
    backgroundColor: "#FFFFFF",
  },
});
