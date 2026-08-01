import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  Animated,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../theme/colors";

export type TutorialStep = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  headerIcon?: keyof typeof Ionicons.glyphMap;
  steps: TutorialStep[];
};

export default function StepTutorialModal({
  visible,
  onClose,
  title,
  headerIcon = "book-outline",
  steps,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleClose = useCallback(() => {
    setActiveIndex(0);
    onClose();
  }, [onClose]);

  const containerWidth = Math.min(Math.max(width - 32, 1), 560);
  const cardWidth = containerWidth;
  const containerMaxHeight = Math.min(
    Math.max(height - insets.top - insets.bottom - 32, 1),
    560
  );
  const isShort = height < 600;
  const cardViewportHeight = Math.max(
    96,
    containerMaxHeight - (isShort ? 144 : 150)
  );

  useEffect(() => {
    if (!visible || !steps.length) return;
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({
        index: Math.min(activeIndex, steps.length - 1),
        animated: false,
      });
    });
  }, [cardWidth, steps.length, visible]);

  const goToNext = useCallback(() => {
    if (activeIndex < steps.length - 1) {
      const next = activeIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
      return;
    }
    handleClose();
  }, [activeIndex, handleClose, steps.length]);

  const goToPrev = useCallback(() => {
    if (activeIndex > 0) {
      const prev = activeIndex - 1;
      flatListRef.current?.scrollToIndex({ index: prev, animated: true });
      setActiveIndex(prev);
    }
  }, [activeIndex]);

  const onMomentumScrollEnd = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    setActiveIndex(idx);
  }, [cardWidth]);

  const renderItem = useCallback(
    ({ item, index }: { item: TutorialStep; index: number }) => (
      <ScrollView
        style={{ width: cardWidth, height: cardViewportHeight }}
        contentContainerStyle={[styles.card, isShort && styles.cardShort]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View
          style={[
            styles.iconCircle,
            isShort && styles.iconCircleShort,
            { backgroundColor: item.iconColor + "15" },
          ]}
        >
          <Ionicons name={item.icon} size={isShort ? 36 : 48} color={item.iconColor} />
        </View>
        <Text style={styles.stepLabel}>Step {index + 1} of {steps.length}</Text>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDesc}>{item.description}</Text>
      </ScrollView>
    ),
    [cardViewportHeight, cardWidth, isShort, steps.length]
  );

  const dots = useMemo(
    () =>
      steps.map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
        />
      )),
    [activeIndex, steps]
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

        <View
          style={[
            styles.container,
            { width: containerWidth, maxHeight: containerMaxHeight },
          ]}
        >
          <View style={styles.header}>
            <Ionicons name={headerIcon} size={22} color="#1A3C6E" />
            <Text style={styles.headerTitle}>{title}</Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="#555" />
            </Pressable>
          </View>

          <FlatList
            key={`tutorial-${Math.round(cardWidth)}`}
            ref={flatListRef}
            style={[styles.stepsList, { height: cardViewportHeight }]}
            data={steps}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            snapToInterval={cardWidth}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 0 }}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({
              length: cardWidth,
              offset: cardWidth * index,
              index,
            })}
            onScrollToIndexFailed={({ index }) => {
              flatListRef.current?.scrollToOffset({
                offset: index * cardWidth,
                animated: false,
              });
            }}
          />

          <View style={styles.dotsRow}>{dots}</View>

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
                {activeIndex === steps.length - 1 ? "Got it!" : "Next"}
              </Text>
              {activeIndex < steps.length - 1 ? (
                <Ionicons name="chevron-forward" size={18} color="#FFF" />
              ) : null}
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  container: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    overflow: "hidden",
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
  stepsList: {
    flexShrink: 1,
  },
  card: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  cardShort: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconCircleShort: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 10,
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
    backgroundColor: Colors.actionPrimary,
    gap: 4,
  },
  navBtnPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
});
