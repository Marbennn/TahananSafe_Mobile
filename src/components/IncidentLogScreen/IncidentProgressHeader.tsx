import React from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PRIMARY_ACTION_COLOR } from "../../theme/colors";

type Props = {
  screenTitle: string;
  step: 1 | 2 | 3;
  stepTitle: string;
  navigationIcon: "close" | "chevron-back";
  onNavigationPress?: () => void;
  navigationDisabled?: boolean;
  animateFromStep?: 1 | 2 | 3;
};

const STEP_COUNT = 3;

export default function IncidentProgressHeader({
  screenTitle,
  step,
  stepTitle,
  navigationIcon,
  onNavigationPress,
  navigationDisabled = false,
  animateFromStep,
}: Props) {
  const progress = React.useRef(
    new Animated.Value(animateFromStep ?? step)
  ).current;

  React.useEffect(() => {
    progress.stopAnimation();

    const animation = Animated.timing(progress, {
      toValue: step,
      duration: 460,
      delay: 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start();
    return () => animation.stop();
  }, [animateFromStep, progress, step]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={navigationIcon === "close" ? "Close report" : "Edit report"}
          disabled={navigationDisabled}
          onPress={onNavigationPress}
          hitSlop={12}
          style={({ pressed }) => [
            styles.navigationButton,
            (pressed || navigationDisabled) && styles.navigationButtonPressed,
          ]}
        >
          <Ionicons
            name={navigationIcon}
            size={navigationIcon === "close" ? 28 : 31}
            color={navigationIcon === "close" ? TEXT_DARK : "#00518D"}
          />
        </Pressable>

        <Text
          style={styles.screenTitle}
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          {screenTitle}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.stepOuter}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepEyebrow} allowFontScaling={false}>
            STEP {step} OF {STEP_COUNT}
          </Text>
          <Text style={styles.stepTitle} allowFontScaling={false}>
            {stepTitle}
          </Text>

          <View
            style={styles.progressRow}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 1, max: STEP_COUNT, now: step }}
          >
            {Array.from({ length: STEP_COUNT }, (_, index) => {
              const fillWidth = progress.interpolate({
                inputRange: [index, index + 1],
                outputRange: ["0%", "100%"],
                extrapolate: "clamp",
              });

              return (
                <View key={index} style={styles.progressSegment}>
                  <Animated.View
                    style={[styles.progressFill, { width: fillWidth }]}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const BG = "#F5F7FA";
const NAVY = PRIMARY_ACTION_COLOR;
const TEXT_DARK = "#344052";
const BORDER = "#D8DDE2";

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    backgroundColor: BG,
  },
  topBar: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navigationButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  navigationButtonPressed: {
    opacity: 0.65,
  },
  screenTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 26,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  stepOuter: {
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 10,
    alignItems: "center",
  },
  stepHeader: {
    width: "100%",
    maxWidth: 680,
    paddingHorizontal: 12,
  },
  stepEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    color: "#858B94",
    marginBottom: 3,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT_DARK,
    marginBottom: 10,
  },
  progressRow: {
    flexDirection: "row",
    gap: 12,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: BORDER,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: NAVY,
  },
});
