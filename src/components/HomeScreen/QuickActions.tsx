// src/components/HomeScreen/QuickActions.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";

import { useColors } from "../../theme/colors";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
  isOpen: boolean;
  animation: Animated.Value;
  navHeight: number;
  navPaddingBottom: number;
  fabBottom?: number;
  fabSize: number;
  onToggle: () => void;
  onFabLongPress?: () => void;
  onIncidentLog: () => void;
  onSos: () => void;
  onServices: () => void;
  onHideApp: () => void;
  onSignOut: () => void;
};

type ActionItem = {
  label: string;
  icon: IconName;
  onPress: () => void;
};

type ActionTarget = {
  x: number;
  rise: number;
};

export default function QuickActions({
  isOpen,
  animation,
  navHeight,
  navPaddingBottom,
  fabBottom,
  fabSize,
  onToggle,
  onFabLongPress,
  onIncidentLog,
  onSos,
  onServices,
  onHideApp,
  onSignOut,
}: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();
  const menuScale = clamp(width / 375, 0.86, 1.2);
  const menuFontScale = clamp(menuScale * 1.06, 0.95, 1.3);
  const centerFabBottom = fabBottom ?? navHeight - fabSize / 2 - 10;
  const fabCenterY = height - centerFabBottom - fabSize / 2;

  const actionButtonSize = clamp(Math.round(56 * menuScale), 48, 60);
  const actionIconSize = clamp(Math.round(24 * menuScale), 21, 28);
  const actionLabelWidth = clamp(Math.round(92 * menuScale), 82, 108);
  const actionLabelGap = clamp(Math.round(6 * menuScale), 4, 8);
  const actionLabelLineHeight = clamp(
    Math.round(15 * menuFontScale),
    13,
    18
  );
  const actionLabelAreaHeight = actionLabelGap + actionLabelLineHeight;
  const actionItemHeight = actionButtonSize + actionLabelAreaHeight;
  const fabCenterFromBottom = centerFabBottom + fabSize / 2;
  const actionNodeBottom =
    fabCenterFromBottom - actionButtonSize / 2 - actionLabelAreaHeight;
  const actionVerticalInset = clamp(
    Math.round(10 * menuScale),
    8,
    12
  );
  const menuLayoutWidth = Math.min(width, 720);
  const quarterEllipseKappa = 0.5522847498;
  const navScale = menuScale;
  const menuSideClearance = clamp(
    Math.round(12 * menuScale),
    10,
    18
  );
  const outerAngleRadians = (28 * Math.PI) / 180;
  const idealRadialRadius = clamp(menuLayoutWidth * 0.415, 132, 240);
  const horizontalRadiusCap =
    (menuLayoutWidth / 2 - actionButtonSize / 2 - menuSideClearance) /
    Math.cos(outerAngleRadians);
  const verticalRadiusCap =
    fabCenterY -
    clamp(Math.round(24 * menuScale), 20, 32) -
    actionButtonSize / 2;
  const radialRadius = Math.max(
    96,
    Math.min(idealRadialRadius, horizontalRadiusCap, verticalRadiusCap)
  );
  const actionAngles = [152, 121, 90, 59, 28];
  const actionTargets: ActionTarget[] = actionAngles.map((angle) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: radialRadius * Math.cos(radians),
      rise: radialRadius * Math.sin(radians),
    };
  });

  // Keep these measurements synchronized with BottomNavBar's cradle so this
  // fill occupies only the transparent notch and never covers the white bar.
  const navExtraBarHeight = clamp(Math.round(12 * navScale), 10, 18);
  const navTopLowering = clamp(Math.round(12 * navScale), 10, 14);
  const effectiveNavHeight =
    navHeight + navExtraBarHeight - navTopLowering;
  const navItemPaddingBottom = clamp(Math.round(12 * navScale), 10, 16);
  const navLabelFont = clamp(Math.round(10 * navScale), 9, 12);
  const navLabelMarginTop = clamp(Math.round(3 * navScale), 2, 4);
  const fabCenterYWithinBar =
    effectiveNavHeight - (centerFabBottom + fabSize / 2);
  const fabBottomWithinBar = fabCenterYWithinBar + fabSize / 2;
  const cradleHalfWidth =
    fabSize / 2 + clamp(Math.round(28 * navScale), 24, 32);
  const cradleShoulderWidth = clamp(
    Math.round(24 * navScale),
    20,
    28
  );
  const minimumCradleDepth = Math.max(
    0,
    Math.round(
      fabBottomWithinBar + clamp(Math.round(9 * navScale), 8, 11)
    )
  );
  const maximumCradleDepth = Math.max(
    minimumCradleDepth,
    effectiveNavHeight -
      (navPaddingBottom +
        navItemPaddingBottom +
        navLabelFont +
        navLabelMarginTop +
        6)
  );
  const cradleDepth = clamp(
    Math.round(
      fabBottomWithinBar + clamp(Math.round(12 * navScale), 10, 14)
    ),
    minimumCradleDepth,
    maximumCradleDepth
  );
  const cradleCenterX = width / 2;
  const cradleStartX = cradleCenterX - cradleHalfWidth;
  const cradleEndX = cradleCenterX + cradleHalfWidth;
  const cradleShoulderDepth = cradleDepth * 0.34;
  const cradleLeftSideX = cradleStartX + cradleShoulderWidth;
  const cradleRightSideX = cradleEndX - cradleShoulderWidth;
  const cradleBottomControlX =
    (cradleCenterX - cradleLeftSideX) * quarterEllipseKappa;
  const cradleBottomControlY =
    (cradleDepth - cradleShoulderDepth) * quarterEllipseKappa;
  const notchCurvePath = [
    `M ${cradleStartX} 0`,
    `C ${cradleStartX + cradleShoulderWidth * 0.55} 0 ${
      cradleLeftSideX
    } ${cradleDepth * 0.08} ${cradleLeftSideX} ${cradleShoulderDepth}`,
    `C ${cradleLeftSideX} ${
      cradleShoulderDepth + cradleBottomControlY
    } ${cradleCenterX - cradleBottomControlX} ${cradleDepth} ${
      cradleCenterX
    } ${cradleDepth}`,
    `C ${cradleCenterX + cradleBottomControlX} ${cradleDepth} ${
      cradleRightSideX
    } ${cradleShoulderDepth + cradleBottomControlY} ${cradleRightSideX} ${
      cradleShoulderDepth
    }`,
    `C ${cradleRightSideX} ${cradleDepth * 0.08} ${
      cradleEndX - cradleShoulderWidth * 0.55
    } 0 ${cradleEndX} 0`,
  ].join(" ");
  const notchFillPath = [
    notchCurvePath,
    `L ${cradleStartX} 0`,
    `Z`,
  ].join(" ");
  const notchEdgeStrokeWidth = clamp(1.75 * navScale, 1.5, 2.25);

  const panelWidth = menuLayoutWidth;
  const panelHeight =
    radialRadius +
    actionButtonSize / 2 +
    clamp(Math.round(16 * menuScale), 12, 20);
  const panelLeft = (width - panelWidth) / 2;
  const panelPath = [
    `M 0 ${panelHeight}`,
    `C 0 ${panelHeight - panelHeight * quarterEllipseKappa} ${
      panelWidth / 2 - (panelWidth / 2) * quarterEllipseKappa
    } 0 ${panelWidth / 2} 0`,
    `C ${panelWidth / 2 + (panelWidth / 2) * quarterEllipseKappa} 0 ${
      panelWidth
    } ${panelHeight - panelHeight * quarterEllipseKappa} ${panelWidth} ${
      panelHeight
    }`,
    `L 0 ${panelHeight}`,
    `Z`,
  ].join(" ");
  const panelBackground = TC.isDark ? "#243247" : "#E7EEF8";
  const panelRestingOpacity = 0.72;

  const actions: ActionItem[] = [
    {
      label: "Create Log",
      icon: "document-text-outline",
      onPress: onIncidentLog,
    },
    { label: "Alert", icon: "warning-outline", onPress: onSos },
    { label: "Menu", icon: "grid-outline", onPress: onServices },
    { label: "Privacy", icon: "eye-off-outline", onPress: onHideApp },
    { label: "Logout", icon: "log-out-outline", onPress: onSignOut },
  ];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
        },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0, 0, 0, 0.22)",
          zIndex: 0,
        },
        menuPanelClip: {
          position: "absolute",
          left: panelLeft,
          bottom: effectiveNavHeight,
          width: panelWidth,
          height: panelHeight,
          zIndex: 1,
        },
        notchPanelFill: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: effectiveNavHeight,
          zIndex: 2,
        },
        actionLayer: {
          ...StyleSheet.absoluteFillObject,
          zIndex: 3,
        },
        actionNode: {
          position: "absolute",
          width: actionLabelWidth,
          height: actionItemHeight,
          alignItems: "center",
        },
        actionPressable: {
          width: actionLabelWidth,
          height: actionItemHeight,
          alignItems: "center",
        },
        actionCircleShadow: {
          width: actionButtonSize,
          height: actionButtonSize,
          borderRadius: actionButtonSize / 2,
          backgroundColor: TC.primary,
          ...Platform.select({
            ios: {
              shadowColor: "#0F172A",
              shadowOpacity: TC.isDark ? 0.3 : 0.22,
              shadowRadius: 9,
              shadowOffset: { width: 0, height: 5 },
            },
            android: { elevation: 8 },
          }),
        },
        actionCircle: {
          width: actionButtonSize,
          height: actionButtonSize,
          borderRadius: actionButtonSize / 2,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        actionLabel: {
          width: actionLabelWidth,
          marginTop: actionLabelGap,
          color: TC.textDark,
          fontSize: clamp(Math.round(12 * menuFontScale), 10, 14),
          lineHeight: actionLabelLineHeight,
          fontWeight: "700",
          textAlign: "center",
          includeFontPadding: false,
        },
        fabAnchor: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: centerFabBottom,
          height: fabSize,
          alignItems: "center",
          zIndex: 4,
          elevation: 20,
        },
        fabButton: {
          width: fabSize,
          height: fabSize,
          borderRadius: fabSize / 2,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
            },
            android: { elevation: 10 },
          }),
        },
      }),
    [
      TC.isDark,
      TC.primary,
      TC.textDark,
      actionButtonSize,
      actionItemHeight,
      actionLabelGap,
      actionLabelLineHeight,
      actionLabelWidth,
      centerFabBottom,
      effectiveNavHeight,
      fabSize,
      menuFontScale,
      panelHeight,
      panelLeft,
      panelWidth,
    ]
  );

  const [reduceMotion, setReduceMotion] = useState(false);
  const [actionsInteractive, setActionsInteractive] = useState(false);
  const longPressSuppressRef = useRef(false);
  const longPressSuppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => setReduceMotion(enabled))
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setActionsInteractive(false);
      return;
    }

    if (reduceMotion) setActionsInteractive(true);
  }, [isOpen, reduceMotion]);

  useEffect(() => {
    const listenerId = animation.addListener(({ value }) => {
      if (!isOpen || value < 0.7) {
        setActionsInteractive(false);
      } else {
        setActionsInteractive(true);
      }
    });

    return () => animation.removeListener(listenerId);
  }, [animation, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onToggle();
      return true;
    });

    return () => subscription.remove();
  }, [isOpen, onToggle]);

  useEffect(() => {
    return () => {
      if (longPressSuppressTimerRef.current) {
        clearTimeout(longPressSuppressTimerRef.current);
      }
    };
  }, []);

  const fabRotate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });
  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const panelOpacity = animation.interpolate({
    inputRange: [0, 0.08, 0.7, 1],
    outputRange: [0, 0, 0.68, panelRestingOpacity],
    extrapolate: "clamp",
  });

  return (
    <View
      pointerEvents="box-none"
      style={styles.root}
      accessibilityViewIsModal={isOpen}
      importantForAccessibility={isOpen ? "yes" : "auto"}
    >
      {isOpen ? (
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: reduceMotion ? 1 : backdropOpacity },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel="Close services menu"
          />
        </Animated.View>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.menuPanelClip,
          {
            opacity: reduceMotion
              ? isOpen
                ? panelRestingOpacity
                : 0
              : panelOpacity,
          },
        ]}
      >
        <Svg
          pointerEvents="none"
          width="100%"
          height="100%"
          viewBox={`0 0 ${panelWidth} ${panelHeight}`}
          preserveAspectRatio="none"
        >
          <Path d={panelPath} fill={panelBackground} />
        </Svg>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.notchPanelFill,
          {
            opacity: reduceMotion
              ? isOpen
                ? panelRestingOpacity
                : 0
              : panelOpacity,
          },
        ]}
      >
        <Svg
          pointerEvents="none"
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${effectiveNavHeight}`}
          preserveAspectRatio="none"
        >
          <Path d={notchFillPath} fill={panelBackground} />
          <Path
            d={notchCurvePath}
            fill="none"
            stroke={panelBackground}
            strokeWidth={notchEdgeStrokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      <View
        pointerEvents={isOpen ? "box-none" : "none"}
        style={styles.actionLayer}
      >
        {actions.map((item, index) => {
          const target = actionTargets[index];
          const revealRank = Math.abs(index - 2);
          const revealStart = revealRank * 0.045;
          const revealEnd = Math.min(1, 0.72 + revealRank * 0.05);
          const hasDelay = revealStart > 0;
          const inputRange = hasDelay
            ? [0, revealStart, revealEnd]
            : [0, revealEnd];
          const itemOpacity = animation.interpolate({
            inputRange,
            outputRange: hasDelay ? [0, 0, 1] : [0, 1],
            extrapolate: "clamp",
          });
          const translateX = animation.interpolate({
            inputRange,
            outputRange: hasDelay ? [0, 0, target.x] : [0, target.x],
            extrapolate: "clamp",
          });
          const translateY = animation.interpolate({
            inputRange,
            outputRange: hasDelay
              ? [0, 0, -target.rise + actionVerticalInset]
              : [0, -target.rise + actionVerticalInset],
            extrapolate: "clamp",
          });
          const itemScale = animation.interpolate({
            inputRange,
            outputRange: hasDelay ? [0.58, 0.58, 1] : [0.58, 1],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={item.label}
              pointerEvents={actionsInteractive ? "auto" : "none"}
              style={[
                styles.actionNode,
                {
                  left: "50%",
                  marginLeft: -actionLabelWidth / 2,
                  bottom: actionNodeBottom,
                  opacity: reduceMotion ? 1 : itemOpacity,
                  transform: [
                    { translateX: reduceMotion ? target.x : translateX },
                    {
                      translateY: reduceMotion
                        ? -target.rise + actionVerticalInset
                        : translateY,
                    },
                    { scale: reduceMotion ? 1 : itemScale },
                  ],
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  onToggle();
                  item.onPress();
                }}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={`Activate ${item.label}`}
                style={({ pressed }) => [
                  styles.actionPressable,
                  pressed && { opacity: 0.78 },
                ]}
              >
                <View style={styles.actionCircleShadow}>
                  <View style={styles.actionCircle}>
                    <LinearGradient
                      colors={TC.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Ionicons
                      name={item.icon}
                      size={actionIconSize}
                      color="#FFFFFF"
                    />
                  </View>
                </View>

                <Text
                  style={styles.actionLabel}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {item.label}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <View pointerEvents="box-none" style={styles.fabAnchor}>
        <Pressable
          onPress={() => {
            if (longPressSuppressRef.current) {
              longPressSuppressRef.current = false;
              return;
            }

            onToggle();
          }}
          onLongPress={
            onFabLongPress
              ? () => {
                  longPressSuppressRef.current = true;
                  onFabLongPress();
                }
              : undefined
          }
          onPressOut={() => {
            if (!longPressSuppressRef.current) return;
            if (longPressSuppressTimerRef.current) {
              clearTimeout(longPressSuppressTimerRef.current);
            }
            longPressSuppressTimerRef.current = setTimeout(() => {
              longPressSuppressRef.current = false;
              longPressSuppressTimerRef.current = null;
            }, 100);
          }}
          delayLongPress={450}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isOpen ? "Close services menu" : "Open services menu"}
          accessibilityState={{ expanded: isOpen }}
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
            <Ionicons
              name="add"
              size={clamp(Math.round(30 * menuScale), 27, 34)}
              color="#FFFFFF"
            />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}
