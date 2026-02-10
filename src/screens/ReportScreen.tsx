// src/screens/ReportScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors } from "../theme/colors";

type FilterKey = "Pending" | "On going" | "Cancelled" | "Resolved";

export type ReportItem = {
  id: string;

  // list fields
  title: string;
  detail: string;
  dateLeft: string;
  timeLeft: string;
  dateRight: string;
  timeRight: string;
  groupLabel?: string;

  // detail fields
  status?: "PENDING" | "ONGOING" | "CANCELLED" | "RESOLVED";
  witnessName?: string;
  witnessType?: string;
  location?: string;
  incidentTypeLabel?: string;
  alertNo?: string;
};

type Props = {
  onQuickExit?: () => void;
  onTabChange?: (tab: TabKey) => void;
  initialTab?: TabKey;

  onOpenReport?: (item: ReportItem) => void;
};

const BG = "#F5FAFE";
const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";

function ReportCard({
  item,
  onPress,
  styles,
  chevronSize,
}: {
  item: ReportItem;
  onPress?: () => void;
  styles: ReturnType<typeof makeStyles>;
  chevronSize: number;
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
            {item.dateLeft}
            {"\n"}
            {item.timeLeft}
          </Text>

          <Text style={styles.cardMeta}>
            {item.dateRight}
            {"\n"}
            {item.timeRight}
          </Text>
        </View>
      </View>

      <View style={styles.cardChevron}>
        <Ionicons name="chevron-forward" size={chevronSize} color="#94A3B8" />
      </View>
    </Pressable>
  );
}

export default function ReportScreen({
  onQuickExit,
  onTabChange,
  initialTab,
  onOpenReport,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // ===== Responsive scaling helpers (same approach as Hotlines) =====
  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);

  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const chevronSize = scale(20);

  const styles = useMemo(() => makeStyles(scale, vscale), [width, height]);

  // ✅ Reports tab key in your BottomNavBar is "Ledger"
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? "Ledger");
  const [filter, setFilter] = useState<FilterKey>("Pending");

  const NAV_BASE_HEIGHT = 78;
  const FAB_SIZE = 62;

  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;

  const chevronBottom = navHeight + 90;
  const fabBottom = navHeight - FAB_SIZE / 2 - 10;

  const CONTENT_BOTTOM_PAD =
    Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + 6;

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
        status: "PENDING",
        witnessName: "John Dela Cruz",
        witnessType: "Neighbor",
        location: "Brgy. 12",
        incidentTypeLabel: "Sinipa ng tatay",
        alertNo: "676767",
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
        status: "PENDING",
        witnessName: "John Dela Cruz",
        witnessType: "Neighbor",
        location: "Brgy. 12",
        incidentTypeLabel: "Sinipa ng tatay",
        alertNo: "676767",
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
        status: "PENDING",
        witnessName: "John Dela Cruz",
        witnessType: "Neighbor",
        location: "Brgy. 12",
        incidentTypeLabel: "Sinipa ng tatay",
        alertNo: "676767",
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
        status: "PENDING",
        witnessName: "John Dela Cruz",
        witnessType: "Neighbor",
        location: "Brgy. 12",
        incidentTypeLabel: "Sinipa ng tatay",
        alertNo: "676767",
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
        status: "PENDING",
        witnessName: "John Dela Cruz",
        witnessType: "Neighbor",
        location: "Brgy. 12",
        incidentTypeLabel: "Sinipa ng tatay",
        alertNo: "676767",
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    // placeholder filtering (wire real status later)
    return data;
  }, [data, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* ✅ FIX GAP: SafeAreaView already adds top inset, so no extra paddingTop */}
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>Reports</Text>
        </View>

        {/* Segmented filter */}
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
                      style={[styles.segmentText, active && styles.segmentTextActive]}
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

        {/* List */}
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

                  <ReportCard
                    item={item}
                    onPress={() => onOpenReport?.(item)}
                    styles={styles}
                    chevronSize={chevronSize}
                  />
                </View>
              );
            });
          })()}
        </ScrollView>

        {/* Bottom nav */}
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

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const SEG_H = vscale(40);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    page: { flex: 1, backgroundColor: BG },

    topBar: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(6), // small, clean
      paddingBottom: vscale(10),
      flexDirection: "row",
      alignItems: "center",
    },
    topTitle: {
      fontSize: scale(28),
      fontWeight: "900",
      color: TEXT_DARK,
    },

    segmentWrap: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
      paddingBottom: vscale(10),
    },
    segmentPill: {
      height: SEG_H,
      borderRadius: Math.round(SEG_H / 2),
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
      paddingHorizontal: scale(6),
    },
    segmentBtnActive: {
      backgroundColor: Colors.primary,
    },
    segmentText: {
      fontSize: scale(12),
      fontWeight: "800",
      color: "#6B7280",
    },
    segmentTextActive: {
      color: "#FFFFFF",
    },

    scrollContent: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(6),
    },

    block: {
      marginBottom: vscale(12),
      gap: vscale(8),
    },

    groupLabel: {
      fontSize: scale(12),
      fontWeight: "800",
      color: "#94A3B8",
      paddingLeft: scale(2),
    },

    card: {
      flexDirection: "row",
      alignItems: "stretch",
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: "#FFFFFF",
      borderRadius: scale(16),
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    cardLeftBar: {
      width: scale(4),
      backgroundColor: Colors.primary,
    },
    cardBody: {
      flex: 1,
      paddingVertical: vscale(12),
      paddingLeft: scale(12),
      paddingRight: scale(10),
      gap: vscale(6),
    },
    cardTitle: {
      fontSize: scale(15),
      fontWeight: "900",
      color: Colors.primary,
    },
    cardDetail: {
      fontSize: scale(13),
      fontWeight: "700",
      color: "#6B7280",
      fontStyle: "italic",
      lineHeight: vscale(18),
    },
    cardMetaRow: {
      marginTop: vscale(6),
      flexDirection: "row",
      justifyContent: "space-between",
      gap: scale(10),
    },
    cardMeta: {
      fontSize: scale(11),
      fontWeight: "800",
      color: "#94A3B8",
      lineHeight: vscale(14),
    },
    cardChevron: {
      width: scale(38),
      alignItems: "center",
      justifyContent: "center",
      paddingRight: scale(10),
    },
  });
}
