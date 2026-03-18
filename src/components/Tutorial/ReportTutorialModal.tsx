// src/components/Tutorial/ReportTutorialModal.tsx
import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  FlatList,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    icon: "add-circle",
    iconColor: "#1A3C6E",
    title: "Tap the + Button",
    description:
      "On the Home screen, tap the blue + button at the bottom center to start creating a new incident log.",
  },
  {
    icon: "document-text-outline",
    iconColor: "#D4770B",
    title: "Select Incident Type",
    description:
      "Choose the type of incident you want to report (e.g., Physical Abuse, Psychological Abuse, Sexual Abuse, etc.).",
  },
  {
    icon: "calendar-outline",
    iconColor: "#2E7D32",
    title: "Fill in the Details",
    description:
      "Provide the date, time, and a detailed description of what happened. The more details you provide, the better we can help.",
  },
  {
    icon: "camera-outline",
    iconColor: "#6A1B9A",
    title: "Attach Evidence (Optional)",
    description:
      "You can attach photos as supporting evidence. Tap the camera icon to take a photo or choose from your gallery.",
  },
  {
    icon: "shield-checkmark-outline",
    iconColor: "#1565C0",
    title: "Review & Submit",
    description:
      "Review all the information you entered, then tap Submit. Your report will be securely sent and tracked by the Barangay.",
  },
  {
    icon: "notifications-outline",
    iconColor: "#C62828",
    title: "Track Your Report",
    description:
      "After submitting, you can track your report status under the Reports tab. You'll receive notifications for any updates.",
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ReportTutorialModal({ visible, onClose }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleClose = useCallback(() => {
    setActiveIndex(0);
    onClose();
  }, [onClose]);

  const goToNext = useCallback(() => {
    if (activeIndex < STEPS.length - 1) {
      const next = activeIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    } else {
      handleClose();
    }
  }, [activeIndex, handleClose]);

  const goToPrev = useCallback(() => {
    if (activeIndex > 0) {
      const prev = activeIndex - 1;
      flatListRef.current?.scrollToIndex({ index: prev, animated: true });
      setActiveIndex(prev);
    }
  }, [activeIndex]);

  const onMomentumScrollEnd = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 48));
    setActiveIndex(idx);
  }, []);

  const CARD_WIDTH = SCREEN_WIDTH - 48;

  const renderItem = useCallback(
    ({ item, index }: { item: Step; index: number }) => (
      <View style={[styles.card, { width: CARD_WIDTH }]}>
        <View style={[styles.iconCircle, { backgroundColor: item.iconColor + "15" }]}>
          <Ionicons name={item.icon} size={48} color={item.iconColor} />
        </View>
        <Text style={styles.stepLabel}>Step {index + 1} of {STEPS.length}</Text>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDesc}>{item.description}</Text>
      </View>
    ),
    [CARD_WIDTH]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="book-outline" size={22} color="#1A3C6E" />
            <Text style={styles.headerTitle}>How to Submit a Report</Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="#555" />
            </Pressable>
          </View>

          {/* Step cards */}
          <FlatList
            ref={flatListRef}
            data={STEPS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            snapToInterval={CARD_WIDTH}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 0 }}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({
              length: CARD_WIDTH,
              offset: CARD_WIDTH * index,
              index,
            })}
          />

          {/* Dots */}
          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === activeIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {activeIndex > 0 ? (
              <Pressable style={styles.navBtnSecondary} onPress={goToPrev}>
                <Ionicons name="chevron-back" size={18} color="#1A3C6E" />
                <Text style={styles.navBtnSecondaryText}>Back</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.navBtnSecondary} onPress={handleClose}>
                <Text style={styles.navBtnSecondaryText}>Skip</Text>
              </Pressable>
            )}

            <Pressable style={styles.navBtnPrimary} onPress={goToNext}>
              <Text style={styles.navBtnPrimaryText}>
                {activeIndex === STEPS.length - 1 ? "Got it!" : "Next"}
              </Text>
              {activeIndex < STEPS.length - 1 && (
                <Ionicons name="chevron-forward" size={18} color="#FFF" />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: SCREEN_WIDTH - 32,
    backgroundColor: "#FFF",
    borderRadius: 20,
    overflow: "hidden",
    maxHeight: 520,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#1A3C6E",
  },
  card: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A3C6E",
    textAlign: "center",
    marginBottom: 10,
  },
  cardDesc: {
    fontSize: 14,
    fontWeight: "500",
    color: "#555",
    textAlign: "center",
    lineHeight: 21,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: "#1A3C6E",
    width: 20,
    borderRadius: 4,
  },
  dotInactive: {
    backgroundColor: "#D0D5DD",
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 12,
  },
  navBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D0D5DD",
    gap: 4,
  },
  navBtnSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A3C6E",
  },
  navBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#1A3C6E",
    gap: 4,
  },
  navBtnPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
});
