// src/components/HomeScreen/QuickActions.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
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
  onHideApp,
  onSignOut,
}: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();
  const centerFabBottom = fabBottom ?? navHeight - fabSize / 2 - 10;
  const fabArchSize = clamp(Math.round(fabSize + 34 * s), fabSize + 28, fabSize + 44);
  const actionButtonSize = clamp(Math.round(54 * s), 48, 58);
  const actionIconSize = clamp(Math.round(24 * s), 21, 26);
  const expandedActionWidth = clamp(Math.round(150 * s), 132, 160);
  const longPressHintWidth = clamp(Math.round(170 * s), 152, 184);
  const fabCenterY = height - centerFabBottom - fabSize / 2;
  const rightColumnOffset = width / 2 - actionButtonSize / 2 - clamp(Math.round(16 * s), 14, 20);
  const columnBottomRise = clamp(Math.round(84 * s), 74, 94);
  const desiredColumnStep = clamp(Math.round(68 * s), 62, 74);
  const maxColumnTopRise = Math.max(
    columnBottomRise,
    fabCenterY - actionButtonSize / 2 - 32
  );
  const columnTopRise = Math.min(
    columnBottomRise + desiredColumnStep * 4,
    maxColumnTopRise
  );
  const columnStep = (columnTopRise - columnBottomRise) / 4;
  const actionMenuBg = TC.isDark ? TC.surface : "#FFFFFF";

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
          height: fabSize,
          alignItems: "center",
          zIndex: 20,
          elevation: 20,
        },
        actionLayer: {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 3,
        },
        actionNode: {
          position: "absolute",
          width: actionButtonSize,
          height: actionButtonSize,
          overflow: "visible",
        },
        actionSurface: {
          position: "absolute",
          right: 0,
          top: 0,
          height: actionButtonSize,
          borderRadius: actionButtonSize / 2,
          backgroundColor: actionMenuBg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: TC.isDark ? "rgba(148, 163, 184, 0.22)" : "#E7EEF7",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
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
        iconPressable: {
          position: "absolute",
          right: 0,
          top: 0,
          width: actionButtonSize,
          height: actionButtonSize,
          borderRadius: actionButtonSize / 2,
          alignItems: "center",
          justifyContent: "center",
        },
        expandedLabel: {
          position: "absolute",
          left: clamp(Math.round(10 * s), 8, 12),
          right: actionButtonSize + clamp(Math.round(8 * s), 7, 10),
          top: 0,
          bottom: 0,
          justifyContent: "center",
        },
        expandedLabelText: {
          fontSize: clamp(Math.round(11 * fs), 10, 12),
          fontWeight: "800",
          color: TC.textDark,
          textAlign: "center",
          includeFontPadding: false,
        },
        longPressHint: {
          position: "absolute",
          width: longPressHintWidth,
          minHeight: clamp(Math.round(38 * s), 34, 42),
          paddingHorizontal: clamp(Math.round(10 * s), 9, 12),
          paddingVertical: clamp(Math.round(7 * s), 6, 8),
          borderRadius: clamp(Math.round(12 * s), 10, 14),
          backgroundColor: actionMenuBg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: TC.isDark ? "rgba(148, 163, 184, 0.22)" : "#E7EEF7",
          justifyContent: "center",
          zIndex: 12,
          ...Platform.select({
            ios: {
              shadowColor: "#0F172A",
              shadowOpacity: TC.isDark ? 0.28 : 0.16,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            },
            android: { elevation: 8 },
          }),
        },
        longPressHintText: {
          fontSize: clamp(Math.round(10 * fs), 9, 11),
          fontWeight: "800",
          color: TC.textDark,
          textAlign: "center",
          lineHeight: clamp(Math.round(13 * fs), 12, 15),
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
      TC.isDark,
      actionMenuBg,
      actionButtonSize,
      centerFabBottom,
      fabArchSize,
      fabSize,
      fs,
      s,
      expandedActionWidth,
      longPressHintWidth,
    ]
  );

  const [reduceMotion, setReduceMotion] = useState(false);
  const [expandedActionIndex, setExpandedActionIndex] = useState<number | "all" | null>(null);
  const [showLongPressHint, setShowLongPressHint] = useState(false);
  const expansion = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const expandedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressSuppressRef = useRef<string | null>(null);
  const longPressSuppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMenuAnimationValueRef = useRef(0);

  const clearExpandedTimer = useCallback(() => {
    if (!expandedTimerRef.current) return;
    clearTimeout(expandedTimerRef.current);
    expandedTimerRef.current = null;
  }, []);

  const clearHintTimer = useCallback(() => {
    if (!hintTimerRef.current) return;
    clearTimeout(hintTimerRef.current);
    hintTimerRef.current = null;
  }, []);

  const hideLongPressHint = useCallback(
    (immediate = false) => {
      clearHintTimer();
      hintOpacity.stopAnimation();

      if (immediate || reduceMotion) {
        hintOpacity.setValue(0);
        setShowLongPressHint(false);
        return;
      }

      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShowLongPressHint(false);
      });
    },
    [clearHintTimer, hintOpacity, reduceMotion]
  );

  const revealLongPressHint = useCallback(() => {
    clearHintTimer();
    hintOpacity.stopAnimation();
    setShowLongPressHint(true);
    hintOpacity.setValue(0);

    Animated.timing(hintOpacity, {
      toValue: 1,
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      hintTimerRef.current = setTimeout(() => hideLongPressHint(), 3200);
    });
  }, [clearHintTimer, hideLongPressHint, hintOpacity, reduceMotion]);

  const collapseActionLabel = useCallback(
    (immediate = false, showHintAfter = false) => {
      clearExpandedTimer();
      expansion.stopAnimation();
      labelOpacity.stopAnimation();

      if (immediate || reduceMotion) {
        expansion.setValue(0);
        labelOpacity.setValue(0);
        setExpandedActionIndex(null);
        if (immediate) hideLongPressHint(true);
        else if (showHintAfter) revealLongPressHint();
        return;
      }

      Animated.parallel([
        Animated.timing(labelOpacity, {
          toValue: 0,
          duration: 170,
          useNativeDriver: true,
        }),
        Animated.timing(expansion, {
          toValue: 0,
          duration: 240,
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setExpandedActionIndex(null);
        if (showHintAfter) revealLongPressHint();
      });
    },
    [
      clearExpandedTimer,
      expansion,
      hideLongPressHint,
      labelOpacity,
      reduceMotion,
      revealLongPressHint,
    ]
  );

  const expandActionLabels = useCallback(
    (target: number | "all", visibleForMs: number) => {
      clearExpandedTimer();
      hideLongPressHint(true);
      expansion.stopAnimation();
      labelOpacity.stopAnimation();
      setExpandedActionIndex(target);
      expansion.setValue(0);
      labelOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(expansion, {
          toValue: 1,
          duration: reduceMotion ? 0 : 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(labelOpacity, {
          toValue: 1,
          delay: reduceMotion ? 0 : 90,
          duration: reduceMotion ? 0 : 170,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        expandedTimerRef.current = setTimeout(
          () => collapseActionLabel(false, target === "all"),
          visibleForMs
        );
      });
    },
    [
      clearExpandedTimer,
      collapseActionLabel,
      expansion,
      hideLongPressHint,
      labelOpacity,
      reduceMotion,
    ]
  );

  const expandActionLabel = useCallback(
    (index: number) => expandActionLabels(index, 3000),
    [expandActionLabels]
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => setReduceMotion(enabled))
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    return () => {
      clearExpandedTimer();
      clearHintTimer();
      if (longPressSuppressTimerRef.current) clearTimeout(longPressSuppressTimerRef.current);
      expansion.stopAnimation();
      labelOpacity.stopAnimation();
      hintOpacity.stopAnimation();
    };
  }, [clearExpandedTimer, clearHintTimer, expansion, hintOpacity, labelOpacity]);

  useEffect(() => {
    if (!isOpen) collapseActionLabel(true);
  }, [collapseActionLabel, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    expandActionLabels("all", 5000);
  }, [expandActionLabels, isOpen]);

  useEffect(() => {
    const listenerId = animation.addListener(({ value }) => {
      if (value < lastMenuAnimationValueRef.current - 0.01) {
        collapseActionLabel(true);
      }
      lastMenuAnimationValueRef.current = value;
    });

    return () => animation.removeListener(listenerId);
  }, [animation, collapseActionLabel]);

  const fabRotate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  useEffect(() => {
    if (!isOpen) return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      collapseActionLabel(true);
      onToggle();
      return true;
    });

    return () => subscription.remove();
  }, [collapseActionLabel, isOpen, onToggle]);

  const actions: ActionItem[] = [
    { label: "Incident Log", menuLabel: "Incident Log", icon: "document-text-outline", onPress: onIncidentLog },
    { label: "Alert", menuLabel: "Alert", icon: "warning-outline", onPress: onSos },
    { label: "Services", menuLabel: "Services", icon: "grid-outline", onPress: onServices },
    { label: "Hide App", menuLabel: "Hide App", icon: "eye-off-outline", onPress: onHideApp },
    { label: "Sign Out", menuLabel: "Sign Out", icon: "log-out-outline", onPress: onSignOut },
  ];
  const columnTargets = [
    { x: rightColumnOffset, rise: columnTopRise },
    { x: rightColumnOffset, rise: columnTopRise - columnStep },
    { x: rightColumnOffset, rise: columnTopRise - columnStep * 2 },
    { x: rightColumnOffset, rise: columnTopRise - columnStep * 3 },
    { x: rightColumnOffset, rise: columnBottomRise },
  ];
  const hintIconLeft = width / 2 - actionButtonSize / 2 + rightColumnOffset;
  const longPressHintLeft = clamp(
    hintIconLeft - longPressHintWidth - 12,
    8,
    width - longPressHintWidth - 8
  );
  const longPressHintTop = fabSize / 2 - actionButtonSize / 2 - columnBottomRise;
  const longPressHintTranslateY = hintOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });

  return (
    <>
      <View pointerEvents="none" style={styles.archRoot}>
        <View style={styles.fabArchClip}>
          <View style={styles.fabArch} />
        </View>
      </View>

      <View pointerEvents="box-none" style={styles.root}>
        {isOpen ? (
          <View pointerEvents="box-none" style={styles.actionLayer}>
            {actions.map((item, index) => {
              // Sign Out is nearest the FAB, so the stack expands bottom to top.
              const revealRank = actions.length - 1 - index;
              const revealStart = revealRank * 0.055;
              const revealEnd = Math.min(1, revealStart + 0.72);
              const hasDelay = revealStart > 0;
              const target = columnTargets[index];
              const itemOpacity = animation.interpolate({
                inputRange: hasDelay ? [0, revealStart, revealEnd] : [0, revealEnd],
                outputRange: hasDelay ? [0, 0, 1] : [0, 1],
                extrapolate: "clamp",
              });
              const itemTranslateY = animation.interpolate({
                inputRange: hasDelay ? [0, revealStart, revealEnd] : [0, revealEnd],
                outputRange: hasDelay ? [0, 0, -target.rise] : [0, -target.rise],
                extrapolate: "clamp",
              });
              const itemTranslateX = animation.interpolate({
                inputRange: hasDelay ? [0, revealStart, revealEnd] : [0, revealEnd],
                outputRange: hasDelay ? [0, 0, target.x] : [0, target.x],
                extrapolate: "clamp",
              });
              const itemScale = animation.interpolate({
                inputRange: hasDelay ? [0, revealStart, revealEnd] : [0, revealEnd],
                outputRange: hasDelay ? [0.5, 0.5, 1] : [0.5, 1],
                extrapolate: "clamp",
              });
              const isExpanded = expandedActionIndex === "all" || expandedActionIndex === index;
              const surfaceWidth = isExpanded
                ? expansion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [actionButtonSize, expandedActionWidth],
                  })
                : actionButtonSize;

              return (
                <Animated.View
                  key={item.label}
                  style={[
                    styles.actionNode,
                    {
                      left: width / 2 - actionButtonSize / 2,
                      top: fabSize / 2 - actionButtonSize / 2,
                      opacity: reduceMotion ? 1 : itemOpacity,
                      transform: [
                        { translateX: reduceMotion ? target.x : itemTranslateX },
                        { translateY: reduceMotion ? -target.rise : itemTranslateY },
                        { scale: reduceMotion ? 1 : itemScale },
                      ],
                    },
                  ]}
                >
                  <Animated.View style={[styles.actionSurface, { width: surfaceWidth }]}>
                    {isExpanded ? (
                      <Animated.View style={[styles.expandedLabel, { opacity: labelOpacity }]}>
                        <Text
                          style={[
                            styles.expandedLabelText,
                            item.label === "Sign Out" && { color: "#DC2626" },
                          ]}
                          numberOfLines={1}
                          allowFontScaling={false}
                        >
                          {item.menuLabel}
                        </Text>
                      </Animated.View>
                    ) : null}
                  </Animated.View>

                  <Pressable
                    onPress={() => {
                      if (longPressSuppressRef.current === item.label) {
                        longPressSuppressRef.current = null;
                        return;
                      }

                      collapseActionLabel(true);
                      onToggle();
                      item.onPress();
                    }}
                    onLongPress={() => {
                      longPressSuppressRef.current = item.label;
                      if (longPressSuppressTimerRef.current) {
                        clearTimeout(longPressSuppressTimerRef.current);
                        longPressSuppressTimerRef.current = null;
                      }
                      expandActionLabel(index);
                    }}
                    onPressOut={() => {
                      if (longPressSuppressRef.current !== item.label) return;
                      if (longPressSuppressTimerRef.current) {
                        clearTimeout(longPressSuppressTimerRef.current);
                      }
                      longPressSuppressTimerRef.current = setTimeout(() => {
                        longPressSuppressRef.current = null;
                        longPressSuppressTimerRef.current = null;
                      }, 100);
                    }}
                    delayLongPress={450}
                    style={({ pressed }) => [
                      styles.iconPressable,
                      pressed && { transform: [{ scale: 0.94 }] },
                    ]}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityHint={`Activate ${item.label}`}
                  >
                    <Ionicons
                      name={item.icon}
                      size={actionIconSize}
                      color={item.label === "Sign Out" ? "#DC2626" : TC.primary}
                    />
                  </Pressable>
                </Animated.View>
              );
            })}

            {showLongPressHint ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.longPressHint,
                  {
                    left: longPressHintLeft,
                    top: longPressHintTop,
                    opacity: hintOpacity,
                    transform: [{ translateY: longPressHintTranslateY }],
                  },
                ]}
              >
                <Text style={styles.longPressHintText} allowFontScaling={false}>
                  Long press to see the icon label
                </Text>
              </Animated.View>
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            collapseActionLabel(true);
            onToggle();
          }}
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
