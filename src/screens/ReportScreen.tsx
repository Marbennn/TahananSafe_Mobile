// src/screens/ReportScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors } from "../theme/colors";

type FilterKey = "Pending" | "On going" | "Cancelled" | "Resolved";

type ReportItem = {
  id: string;
  title: string;
  detail: string;
  dateLeft: string;
  timeLeft: string;
  dateRight: string;
  timeRight: string;
  groupLabel?: string;
};

type Props = {
  onQuickExit?: () => void;
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;
};

function ReportCard({
  item,
  onPress,
}: {
  item: ReportItem;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
    >
      <View style={styles.cardLeftBar} />

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>

        <Text style={styles.cardDetail} numberOfLines={2}>
          {item.detail}
        </Text>

        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMeta}>
            {item.dateLeft}{"\n"}
            {item.timeLeft}
          </Text>

          <Text style={styles.cardMeta}>
            {item.dateRight}{"\n"}
            {item.timeRight}
          </Text>
        </View>
      </View>

      <View style={styles.cardChevron}>
        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
      </View>
    </Pressable>
  );
}

export default function ReportScreen({ onQuickExit, onTabChange, initialTab }: Props) {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? "Reports");
  const [filter, setFilter] = useState<FilterKey>("Pending");

  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + 6;

  const handleTab = (key: TabKey) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  const pressFab = () => handleTab("Incident");
  const longPressFab = () => onQuickExit?.();

  const data: ReportItem[] = useMemo(
    () => [
      {
        id: "r1",
        groupLabel: "Today",
        title: "Sinipa ng tatay",
        detail: "On January 12, 2026, at approximately 8:30 PM,",
        dateLeft: "January 12, 2026",
        timeLeft: "8:30 PM",
        dateRight: "January 20, 2026",
        timeRight: "12:00 PM",
      },
      {
        id: "r2",
        groupLabel: "Jan 13, 2026",
        title: "Sinipa ng tatay",
        detail: "On January 12, 2026, at approximately 8:30 PM,",
        dateLeft: "January 12, 2026",
        timeLeft: "8:30 PM",
        dateRight: "January 20, 2026",
        timeRight: "12:00 PM",
      },
      {
        id: "r3",
        groupLabel: "Jan 13, 2026",
        title: "Sinipa ng tatay",
        detail: "On January 12, 2026, at approximately 8:30 PM,",
        dateLeft: "January 12, 2026",
        timeLeft: "8:30 PM",
        dateRight: "January 20, 2026",
        timeRight: "12:00 PM",
      },
      {
        id: "r4",
        groupLabel: "Jan 13, 2026",
        title: "Sinipa ng tatay",
        detail: "On January 12, 2026, at approximately 8:30 PM,",
        dateLeft: "January 12, 2026",
        timeLeft: "8:30 PM",
        dateRight: "January 20, 2026",
        timeRight: "12:00 PM",
      },
      {
        id: "r5",
        groupLabel: "Jan 13, 2026",
        title: "Sinipa ng tatay",
        detail: "On January 12, 2026, at approximately 8:30 PM,",
        dateLeft: "January 12, 2026",
        timeLeft: "8:30 PM",
        dateRight: "January 20, 2026",
        timeRight: "12:00 PM",
      },
    ],
    []
  );

  const filtered = useMemo(() => data, [data, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <Text style={styles.headerTitle}>Reports</Text>
        </View>

        <View style={styles.segmentWrap}>
          <View style={styles.segmentPill}>
            {(["Pending", "On going", "Cancelled", "Resolved"] as FilterKey[]).map(
              (k) => {
                const active = k === filter;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setFilter(k)}
                    style={({ pressed }) => [
                      styles.segmentBtn,
                      active && styles.segmentBtnActive,
                      pressed && { transform: [{ scale: 0.99 }] },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {k}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_BOTTOM_PAD },
          ]}
        >
          {(() => {
            let lastGroup = "";
            return filtered.map((item) => {
              const showGroup = item.groupLabel && item.groupLabel !== lastGroup;
              if (item.groupLabel) lastGroup = item.groupLabel;

              return (
                <View key={item.id} style={styles.block}>
                  {showGroup ? (
                    <Text style={styles.groupLabel}>{item.groupLabel}</Text>
                  ) : null}
                  <ReportCard item={item} onPress={() => {}} />
                </View>
              );
            });
          })()}
        </ScrollView>

        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          fabBottom={fabBottom}
          fabSize={FAB_SIZE}
          onFabPress={pressFab}
          onFabLongPress={longPressFab}
          centerLabel="Incident Log"
        />
      </View>
    </SafeAreaView>
  );
}

const BG = "#F5FAFE";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  page: { flex: 1, backgroundColor: BG },

  topBar: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT_DARK,
  },

  segmentWrap: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  segmentPill: {
    height: 34,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B7280",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },

  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 6,
  },

  block: {
    marginBottom: 10,
    gap: 8,
  },

  groupLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    paddingLeft: 2,
  },

  card: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardLeftBar: {
    width: 4,
    backgroundColor: Colors.primary,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 8,
    gap: 4,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.primary,
  },
  cardDetail: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    fontStyle: "italic",
    lineHeight: 14,
  },
  cardMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  cardMeta: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    lineHeight: 12,
  },
  cardChevron: {
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 8,
  },
});
