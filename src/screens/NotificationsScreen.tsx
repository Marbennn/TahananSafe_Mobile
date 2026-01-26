// src/screens/NotificationsScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

type NotifType = "alert" | "report" | "system";

type NotificationItem = {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  time: string;
  unread: boolean;
};

type Props = {
  onBack: () => void;
};

function iconForType(t: NotifType): keyof typeof Ionicons.glyphMap {
  if (t === "alert") return "warning-outline";
  if (t === "report") return "document-text-outline";
  return "information-circle-outline";
}

export default function NotificationsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");

  const initialData: NotificationItem[] = useMemo(
    () => [
      {
        id: "n1",
        type: "alert",
        title: "Emergency Alert",
        message: "A new emergency incident was reported near your area.",
        time: "Today • 9:12 AM",
        unread: true,
      },
      {
        id: "n2",
        type: "report",
        title: "Report Updated",
        message: "Your report status changed to “On going”.",
        time: "Today • 7:40 AM",
        unread: true,
      },
      {
        id: "n3",
        type: "system",
        title: "Security Reminder",
        message: "Enable your PIN and keep your account safe.",
        time: "Yesterday • 6:10 PM",
        unread: false,
      },
      {
        id: "n4",
        type: "system",
        title: "New Feature",
        message: "You can now view more details in Recent Logs.",
        time: "Jan 20 • 11:22 AM",
        unread: false,
      },
    ],
    []
  );

  const [items, setItems] = useState<NotificationItem[]>(initialData);

  const unreadCount = useMemo(() => items.filter((i) => i.unread).length, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      `${i.title} ${i.message} ${i.time}`.toLowerCase().includes(q)
    );
  }, [items, query]);

  const markAllRead = () => {
    setItems((prev) => prev.map((x) => ({ ...x, unread: false })));
  };

  const clearAll = () => {
    setItems([]);
  };

  const toggleRead = (id: string) => {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, unread: !x.unread } : x))
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.page}>
        {/* Header (same feel as Hotlines/Reports) */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.topTitle}>Notifications</Text>
            {unreadCount > 0 ? (
              <Text style={styles.subTitle}>{unreadCount} unread</Text>
            ) : (
              <Text style={styles.subTitle}>All caught up</Text>
            )}
          </View>

          <Pressable
            onPress={markAllRead}
            hitSlop={10}
            style={({ pressed }) => [styles.markBtn, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.markText}>Mark all</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#9AA4B2" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor="#9AA4B2"
              style={styles.searchInput}
              returnKeyType="search"
            />
          </View>

          <Pressable
            onPress={clearAll}
            hitSlop={10}
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="trash-outline" size={18} color="#9AA4B2" />
          </Pressable>
        </View>

        {/* List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="notifications-off-outline" size={30} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptyText}>You don’t have any notifications yet.</Text>
            </View>
          ) : (
            filtered.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => toggleRead(n.id)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.96, transform: [{ scale: 0.995 }] },
                ]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={iconForType(n.type)}
                    size={20}
                    color={Colors.primary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.cardTitle, n.unread && styles.cardTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {n.unread ? <View style={styles.dot} /> : null}
                  </View>

                  <Text style={styles.cardMsg} numberOfLines={2}>
                    {n.message}
                  </Text>
                  <Text style={styles.cardTime}>{n.time}</Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>
            ))
          )}

          {filtered.length > 0 ? (
            <View style={{ height: 18 }} />
          ) : null}
        </ScrollView>
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
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: TEXT_DARK,
  },
  subTitle: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
  },
  markBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
  },
  markText: {
    fontSize: 11,
    fontWeight: "900",
    color: Colors.primary,
  },

  searchRow: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBox: {
    flex: 1,
    height: 36,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
    paddingVertical: 0,
    fontWeight: "600",
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 18,
    gap: 10,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F2F6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    color: "#1F2A37",
  },
  cardTitleUnread: {
    color: Colors.primary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#EF4444",
  },
  cardMsg: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    lineHeight: 14,
  },
  cardTime: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyTitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "900",
    color: "#1F2A37",
  },
  emptyText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 16,
  },
});
