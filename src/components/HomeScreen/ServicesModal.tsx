import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../theme/colors";
import { createTypography } from "../../theme/typography";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectService: (serviceId: string) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const SERVICES = [
  {
    id: "senior-citizen",
    icon: "people-outline" as const,
    title: "Senior Citizen Services",
    description:
      "Claim government funds and benefits available for senior citizens.",
  },
] as const;

export default function ServicesModal({
  visible,
  onClose,
  onSelectService,
}: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();

  const layoutWidth = Math.min(width, 600);
  const s = clamp(layoutWidth / 375, 0.88, 1.2);
  const vs = clamp(height / 812, 0.82, 1.15);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);
  const openSlideOffset = Math.round(42 * vs);
  const closeSlideOffset = Math.round(30 * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;
  const slideY = useRef(new Animated.Value(openSlideOffset)).current;

  const closeWithAnim = useCallback(
    (cb: () => void) => {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(pop, {
          toValue: 0.98,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideY, {
          toValue: closeSlideOffset,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) cb();
      });
    },
    [closeSlideOffset, fade, pop, slideY]
  );

  useEffect(() => {
    if (!visible) return;

    fade.setValue(0);
    pop.setValue(0.96);
    slideY.setValue(openSlideOffset);

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(pop, {
        toValue: 1,
        speed: 16,
        bounciness: 5,
        useNativeDriver: true,
      }),
      Animated.spring(slideY, {
        toValue: 0,
        speed: 16,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, openSlideOffset, pop, slideY, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => closeWithAnim(onClose)}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: fade, backgroundColor: TC.overlay },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => closeWithAnim(onClose)}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: fade,
              transform: [{ translateY: slideY }, { scale: pop }],
              backgroundColor: TC.surface,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerIdentity}>
                <View
                  style={[styles.avatarWrap, { backgroundColor: TC.chipBg }]}
                >
                  <Ionicons
                    name="grid-outline"
                    size={scale(18)}
                    color={TC.primary}
                  />
                </View>
                <View style={styles.headerTextWrap}>
                  <Text style={[styles.title, { color: TC.textDark }]}>
                    Services
                  </Text>
                  <Text style={[styles.subtitle, { color: TC.muted }]}>
                    Government programs and assistance available for you.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => closeWithAnim(onClose)}
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: TC.chipBg },
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Ionicons
                  name="close-outline"
                  size={scale(18)}
                  color={TC.textDark}
                />
              </Pressable>
            </View>
          </View>

          {/* Service list */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {SERVICES.map((service) => (
              <Pressable
                key={service.id}
                onPress={() => {
                  closeWithAnim(() => onSelectService(service.id));
                }}
                style={({ pressed }) => [
                  styles.serviceCard,
                  {
                    backgroundColor: TC.surface,
                    borderColor: TC.divider,
                  },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View
                  style={[
                    styles.serviceIconWrap,
                    { backgroundColor: TC.chipBg },
                  ]}
                >
                  <Ionicons
                    name={service.icon}
                    size={scale(24)}
                    color={TC.primary}
                  />
                </View>

                <View style={styles.serviceTextWrap}>
                  <Text style={[styles.serviceTitle, { color: TC.textDark }]}>
                    {service.title}
                  </Text>
                  <Text style={[styles.serviceDesc, { color: TC.muted }]}>
                    {service.description}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={scale(18)}
                  color={TC.muted}
                />
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(
  scale: (n: number) => number,
  vscale: (n: number) => number
) {
  const type = createTypography(scale, vscale);
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: scale(16),
      paddingVertical: vscale(18),
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(15,23,42,0.35)",
    },
    card: {
      width: "100%",
      maxWidth: scale(360),
      borderRadius: scale(24),
      paddingTop: scale(20),
      paddingBottom: scale(20),
      paddingHorizontal: scale(16),
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
        },
        android: { elevation: 10 },
      }),
    },
    header: {
      marginBottom: scale(16),
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: scale(12),
    },
    headerIdentity: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: scale(12),
    },
    avatarWrap: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(20),
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    headerTextWrap: {
      flex: 1,
      minWidth: 0,
      paddingTop: scale(1),
    },
    title: {
      ...type.sectionTitle,
      marginBottom: scale(4),
    },
    subtitle: {
      ...type.caption,
    },
    closeBtn: {
      width: scale(34),
      height: scale(34),
      borderRadius: scale(17),
      alignItems: "center",
      justifyContent: "center",
    },
    body: {
      maxHeight: vscale(420),
    },
    bodyContent: {
      gap: scale(10),
      paddingBottom: scale(4),
    },
    serviceCard: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: scale(18),
      paddingHorizontal: scale(14),
      paddingVertical: scale(14),
      gap: scale(12),
    },
    serviceIconWrap: {
      width: scale(48),
      height: scale(48),
      borderRadius: scale(14),
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    serviceTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    serviceTitle: {
      ...type.cardTitle,
      marginBottom: scale(3),
    },
    serviceDesc: {
      ...type.caption,
    },
  });
}
