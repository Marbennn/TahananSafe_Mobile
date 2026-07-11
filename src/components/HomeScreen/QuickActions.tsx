// src/components/HomeScreen/QuickActions.tsx
import React, { useMemo } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "../../theme/colors";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
  isOpen: boolean;
  animation: Animated.Value;
  navHeight: number;
  fabBottom?: number;
  fabSize: number;
  s: number;
  fs: number;
  onToggle: () => void;
  onIncidentLog: () => void;
  onSos: () => void;
  onServices: () => void;
  onChatbot: () => void;
  onHideApp: () => void;
  onSignOut: () => void;
};

type ActionItem = {
  label: string;
  menuLabel: string;
  icon: IconName;
  onPress: () => void;
};

export default function QuickActions({
  isOpen,
  animation,
  navHeight,
  fabBottom,
  fabSize,
  s,
  fs,
  onToggle,
  onIncidentLog,
  onSos,
  onServices,
  onChatbot,
  onHideApp,
  onSignOut,
}: Props) {
  const TC = useColors();
  const { width } = useWindowDimensions();
  const centerFabBottom = fabBottom ?? navHeight - fabSize / 2 - 10;
  const fabArchSize = clamp(Math.round(fabSize + 34 * s), fabSize + 28, fabSize + 44);
  const actionPillMaxWidth = Math.max(190, Math.min(202, width - 32));
  const actionPillWidth = clamp(Math.round(196 * s), 190, actionPillMaxWidth);
  const actionPillHeight = clamp(Math.round(56 * s), 56, 60);
  const actionPillGap = clamp(Math.round(10 * s), 10, 12);
  const actionIconChipSize = clamp(Math.round(32 * s), 30, 34);
  const actionIconSize = clamp(Math.round(18 * s), 17, 20);
  const actionMenuRight = clamp(Math.round(10 * s), 8, 14);
  const actionMenuBottom = fabSize + clamp(Math.round(8 * s), 8, 12);
  const actionPillRadius = actionPillHeight / 2;
  const actionMenuBg = TC.isDark ? TC.surface : "#FFFFFF";
  const actionIconBg = TC.isDark ? "rgba(74, 158, 245, 0.16)" : "#EEF8FF";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        archRoot: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: centerFabBottom,
          alignItems: "center",
          zIndex: 2,
          elevation: 2,
        },
        root: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: centerFabBottom,
          alignItems: "center",
          zIndex: 20,
          elevation: 20,
        },
        actionMenu: {
          position: "absolute",
          right: actionMenuRight,
          bottom: actionMenuBottom,
          width: actionPillWidth,
          zIndex: 3,
          gap: actionPillGap,
        },
        actionPill: {
          width: actionPillWidth,
          height: actionPillHeight,
          borderRadius: actionPillRadius,
          backgroundColor: actionMenuBg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: TC.isDark ? "rgba(148, 163, 184, 0.22)" : "#E7EEF7",
          paddingLeft: clamp(Math.round(14 * s), 12, 16),
          paddingRight: clamp(Math.round(18 * s), 16, 20),
          flexDirection: "row",
          alignItems: "center",
          gap: clamp(Math.round(12 * s), 10, 14),
          ...Platform.select({
            ios: {
              shadowColor: "#0F172A",
              shadowOpacity: TC.isDark ? 0.28 : 0.16,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            },
            android: { elevation: 6 },
          }),
        },
        actionIconChip: {
          width: actionIconChipSize,
          height: actionIconChipSize,
          borderRadius: actionIconChipSize / 2,
          backgroundColor: actionIconBg,
          alignItems: "center",
          justifyContent: "center",
        },
        actionLabel: {
          flex: 1,
          fontSize: clamp(Math.round(14 * fs), 14, 16),
          fontWeight: "800",
          color: TC.textDark,
          textAlign: "left",
          includeFontPadding: false,
        },
        fabButton: {
          width: fabSize,
          height: fabSize,
          borderRadius: fabSize / 2,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
            },
            android: { elevation: 10 },
          }),
        },
        fabArchClip: {
          position: "absolute",
          bottom: fabSize / 2,
          width: fabArchSize,
          height: fabArchSize / 2,
          overflow: "hidden",
          alignItems: "center",
          zIndex: 1,
        },
        fabArch: {
          width: fabArchSize,
          height: fabArchSize,
          borderRadius: fabArchSize / 2,
          backgroundColor: TC.surface,
        },
      }),
    [
      TC.surface,
      TC.textDark,
      TC.isDark,
      actionIconBg,
      actionIconChipSize,
      actionMenuBg,
      actionMenuBottom,
      actionMenuRight,
      actionPillGap,
      actionPillHeight,
      actionPillRadius,
      actionPillWidth,
      centerFabBottom,
      fabArchSize,
      fabSize,
      fs,
      s,
    ]
  );

  const actionsOpacity = animation;
  const actionsScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });
  const actionsTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const fabRotate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "135deg"],
  });

  const actions: ActionItem[] = [
    { label: "Incident Log", menuLabel: "Incident Log", icon: "document-text-outline", onPress: onIncidentLog },
    { label: "Alert", menuLabel: "Alert", icon: "warning-outline", onPress: onSos },
    { label: "Services", menuLabel: "Services", icon: "grid-outline", onPress: onServices },
    { label: "Chatbot", menuLabel: "Chatbot", icon: "chatbubble-ellipses-outline", onPress: onChatbot },
    { label: "Hide App", menuLabel: "Hide App", icon: "eye-off-outline", onPress: onHideApp },
    { label: "Sign Out", menuLabel: "Sign Out", icon: "log-out-outline", onPress: onSignOut },
  ];

  return (
    <>
      <View pointerEvents="none" style={styles.archRoot}>
        <View style={styles.fabArchClip}>
          <View style={styles.fabArch} />
        </View>
      </View>

      <View pointerEvents="box-none" style={styles.root}>
        {isOpen ? (
          <Animated.View
            style={[
              styles.actionMenu,
              {
                opacity: actionsOpacity,
                transform: [{ translateY: actionsTranslateY }, { scale: actionsScale }],
              },
            ]}
          >
            {actions.map((item, index) => {
              // Reveal from the bottom item upward so the stack feels connected
              // to the FAB instead of appearing all at once.
              const reverseIndex = actions.length - 1 - index;
              const revealStart = reverseIndex * 0.08;
              const revealEnd = Math.min(1, revealStart + 0.38);
              const hasDelay = revealStart > 0;
              const startOffset =
                reverseIndex * (actionPillHeight + actionPillGap) + clamp(Math.round(10 * s), 8, 12);
              const itemOpacity = animation.interpolate({
                inputRange: hasDelay ? [0, revealStart, revealEnd] : [0, revealEnd],
                outputRange: hasDelay ? [0, 0, 1] : [0, 1],
                extrapolate: "clamp",
              });
              const itemTranslateY = animation.interpolate({
                inputRange: hasDelay ? [0, revealStart, revealEnd] : [0, revealEnd],
                outputRange: hasDelay ? [startOffset, startOffset, 0] : [startOffset, 0],
                extrapolate: "clamp",
              });
              const itemScale = animation.interpolate({
                inputRange: hasDelay ? [0, revealStart, revealEnd] : [0, revealEnd],
                outputRange: hasDelay ? [0.96, 0.96, 1] : [0.96, 1],
                extrapolate: "clamp",
              });

              return (
                <Animated.View
                  key={item.label}
                  style={{
                    opacity: itemOpacity,
                    transform: [{ translateY: itemTranslateY }, { scale: itemScale }],
                  }}
                >
                  <Pressable
                    onPress={item.onPress}
                    style={({ pressed }) => [
                      styles.actionPill,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                    hitSlop={6}
                  >
                    <View style={styles.actionIconChip}>
                      <Ionicons name={item.icon} size={actionIconSize} color={TC.primary} />
                    </View>
                    <Text
                      style={styles.actionLabel}
                      numberOfLines={1}
                      allowFontScaling={false}
                    >
                      {item.menuLabel}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.View>
        ) : null}

        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [
            styles.fabButton,
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
        >
          <LinearGradient
            colors={TC.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}
