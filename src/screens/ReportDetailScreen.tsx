// src/screens/ReportDetailScreen.tsx
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import { Colors } from "../theme/colors";

// ✅ Make sure ReportItem is exported from ReportScreen.tsx
import type { ReportItem } from "./ReportScreen";

type ViewKey = "details" | "threads";

type ThreadMsg = {
  id: string;
  side: "left" | "right";
  sender?: string;
  text: string;
  time: string;
};

type Props = {
  report: ReportItem;

  initialTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  onQuickExit?: () => void;

  onBack?: () => void;
};

// ✅ DEFAULT EXPORT (fixes your TS1192)
export default function ReportDetailScreen({
  report,
  initialTab = "Reports",
  onTabChange,
  onQuickExit,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [view, setView] = useState<ViewKey>("details");

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

  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ThreadMsg[]>(() => [
    {
      id: "m1",
      side: "left",
      sender: "Brgy. Captain Rawr",
      text: "Otw to the rescue",
      time: "01/12/2026, 10:00PM",
    },
    {
      id: "m2",
      side: "right",
      text: "Please hurry, i am suffering from minor injury uwu",
      time: "01/12/2026, 10:00PM",
    },
    {
      id: "m3",
      side: "left",
      sender: "Secretary Meow",
      text: "Okay, wait there",
      time: "01/12/2026, 10:00PM",
    },
    {
      id: "m4",
      side: "right",
      text: "Thank you so much",
      time: "01/12/2026, 10:00PM",
    },
  ]);

  // ✅ keep this typed safely
  const threadScrollRef = useRef<ScrollView | null>(null);

  const onSend = () => {
    const t = draft.trim();
    if (!t) return;

    const now = new Date();
    const stamp = now.toLocaleString(undefined, {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    setMessages((prev) => [
      ...prev,
      { id: `m_${Date.now()}`, side: "right", text: t, time: stamp },
    ]);
    setDraft("");

    setTimeout(() => {
      threadScrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
  };

  const threadHeader = useMemo(() => {
    return `Brgy. Taloy\n${report.dateLeft}, ${report.timeLeft}`;
  }, [report.dateLeft, report.timeLeft]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </Pressable>

          <Text style={styles.topTitle}>Reports</Text>

          <View style={{ width: 36, height: 36 }} />
        </View>

        {/* Tabs */}
        <View style={styles.segmentWrap}>
          <View style={styles.segmentPill}>
            <Pressable
              onPress={() => setView("details")}
              style={({ pressed }) => [
                styles.segmentBtn,
                view === "details" && styles.segmentBtnActive,
                pressed && { transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  view === "details" && styles.segmentTextActive,
                ]}
                numberOfLines={1}
              >
                Incident Details
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setView("threads")}
              style={({ pressed }) => [
                styles.segmentBtn,
                view === "threads" && styles.segmentBtnActive,
                pressed && { transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  view === "threads" && styles.segmentTextActive,
                ]}
                numberOfLines={1}
              >
                Threads
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Body */}
        {view === "details" ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: CONTENT_BOTTOM_PAD },
            ]}
          >
            <View style={styles.detailsCard}>
              {/* ✅ PENDING uses primary color */}
              <Text style={styles.detailsH1}>
                Incident Detail:{" "}
                <Text style={styles.pendingText}>PENDING</Text>
              </Text>

              <Text style={styles.detailsBody}>
                {report.title}
                {"\n\n"}
                {report.detail}
              </Text>

              <View style={styles.detailsMetaRow}>
                <Text style={styles.detailsMetaLabel}>Date:</Text>
                <Text style={styles.detailsMetaValue}>{report.dateLeft}</Text>

                <View style={{ width: 18 }} />

                <Text style={styles.detailsMetaLabel}>Time:</Text>
                <Text style={styles.detailsMetaValue}>{report.timeLeft}</Text>
              </View>

              <View style={[styles.detailsMetaRow, { marginTop: 8 }]}>
                <Text style={styles.detailsMetaLabel}>Location:</Text>
                <Text style={styles.detailsMetaValue}>Brgy. 12</Text>
              </View>

              <Text style={styles.detailsMetaFooter}>Alert no. 676767</Text>
            </View>
          </ScrollView>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={[styles.threadOuter, { paddingBottom: CONTENT_BOTTOM_PAD }]}>
              <View style={styles.threadCard}>
                <Text style={styles.threadHeaderText}>{threadHeader}</Text>

                <ScrollView
                  // ✅ FIXED: must return void (not ScrollView)
                  ref={(r) => {
                    threadScrollRef.current = r;
                  }}
                  style={styles.threadScroll}
                  contentContainerStyle={styles.threadScrollContent}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {messages.map((m) => {
                    const isLeft = m.side === "left";
                    return (
                      <View key={m.id} style={styles.msgBlock}>
                        {isLeft && m.sender ? (
                          <Text style={styles.msgTopLine}>
                            {m.sender}
                            {"\n"}
                            <Text style={styles.msgTime}>{m.time}</Text>
                          </Text>
                        ) : null}

                        <View
                          style={[
                            styles.msgRow,
                            isLeft ? styles.msgRowLeft : styles.msgRowRight,
                          ]}
                        >
                          <View
                            style={[
                              styles.bubble,
                              isLeft ? styles.bubbleLeft : styles.bubbleRight,
                            ]}
                          >
                            <Text style={styles.bubbleText}>{m.text}</Text>
                          </View>
                        </View>

                        {!isLeft ? (
                          <Text
                            style={[
                              styles.msgTime,
                              { textAlign: "right", marginTop: 4 },
                            ]}
                          >
                            {m.time}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={styles.replyRow}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Reply here babalabla"
                    placeholderTextColor="#9AA4B2"
                    style={styles.replyInput}
                    returnKeyType="send"
                    onSubmitEditing={onSend}
                  />

                  <Pressable
                    onPress={onSend}
                    style={({ pressed }) => [
                      styles.sendBtn,
                      pressed && {
                        transform: [{ scale: 0.98 }],
                        opacity: 0.95,
                      },
                    ]}
                  >
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

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
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT_DARK,
  },

  segmentWrap: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
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

  detailsCard: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
    minHeight: 240,
  },
  detailsH1: {
    fontSize: 12,
    fontWeight: "900",
    color: TEXT_DARK,
    marginBottom: 10,
  },

  // ✅ NEW: makes only "PENDING" primary
  pendingText: {
    color: Colors.primary,
  },

  detailsBody: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    lineHeight: 14,
  },
  detailsMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  detailsMetaLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginRight: 6,
  },
  detailsMetaValue: {
    fontSize: 10,
    fontWeight: "900",
    color: TEXT_DARK,
  },
  detailsMetaFooter: {
    marginTop: 12,
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    textAlign: "right",
  },

  threadOuter: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  threadCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  threadHeaderText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 10,
    lineHeight: 14,
  },

  threadScroll: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#F8FAFF",
    borderWidth: 1,
    borderColor: "#EDF2F7",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  threadScrollContent: {
    paddingBottom: 12,
  },

  msgBlock: {
    marginBottom: 12,
  },
  msgTopLine: {
    fontSize: 9,
    fontWeight: "900",
    color: "#6B7280",
    marginBottom: 6,
    lineHeight: 12,
  },
  msgTime: {
    fontSize: 8,
    fontWeight: "800",
    color: "#94A3B8",
  },

  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  msgRowLeft: { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },

  bubble: {
    maxWidth: "78%",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleLeft: { backgroundColor: "#E5E7EB" },
  bubbleRight: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  bubbleText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#374151",
    lineHeight: 14,
  },

  replyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  replyInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FBFF",
    paddingHorizontal: 14,
    fontSize: 10,
    fontWeight: "700",
    color: "#111827",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
});
