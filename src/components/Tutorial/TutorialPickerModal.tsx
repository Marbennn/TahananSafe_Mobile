import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Typography } from "../../theme/typography";

type TutorialOption = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  options: TutorialOption[];
};

export default function TutorialPickerModal({ visible, onClose, options }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxCardHeight = Math.max(height - insets.top - insets.bottom - 32, 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.card, { maxHeight: maxCardHeight }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Tutorials</Text>
              <Text style={styles.subtitle}>Choose a guide to open</Text>
            </View>

            <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}>
              <Ionicons name="close" size={20} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.optionList}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {options.map((option) => (
              <Pressable
                key={option.key}
                onPress={option.onPress}
                style={({ pressed }) => [styles.optionCard, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
              >
                <View style={[styles.optionIconWrap, { backgroundColor: `${option.iconColor}14` }]}>
                  <Ionicons name={option.icon} size={22} color={option.iconColor} />
                </View>

                <View style={styles.optionBody}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDesc}>{option.description}</Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#1A3C6E" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  title: {
    ...Typography.sectionTitle,
    color: "#0F172A",
  },
  subtitle: {
    ...Typography.caption,
    marginTop: 4,
    color: "#64748B",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  optionList: {
    gap: 10,
  },
  optionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    ...Typography.cardTitle,
    color: "#0F172A",
  },
  optionDesc: {
    ...Typography.caption,
    marginTop: 3,
    color: "#64748B",
  },
});
