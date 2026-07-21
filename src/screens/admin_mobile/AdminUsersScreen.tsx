// src/screens/admin_mobile/AdminUsersScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, useColors } from "../../theme/colors";
import { fetchAdminUsers, AdminUser } from "../../api/admin";

type RoleFilter = "All" | "Resident" | "Barangay Official" | "Staff";

type Props = {
  onBack: () => void;
};

function getInitials(user: AdminUser): string {
  const first = (user.firstName || "").charAt(0).toUpperCase();
  const last = (user.lastName || "").charAt(0).toUpperCase();
  if (first || last) return `${first}${last}`;
  return (user.email || "?").charAt(0).toUpperCase();
}

function getAvatarColor(userId: string): string {
  const colors = [
    "#4F8EF7", "#7C3AED", "#059669", "#DC2626",
    "#D97706", "#0891B2", "#BE185D", "#065F46",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function normalizeRole(role?: string): string {
  return String(role || "resident").trim();
}

const ROLE_FILTERS: RoleFilter[] = ["All", "Resident", "Barangay Official", "Staff"];

export default function AdminUsersScreen({ onBack }: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const boundedWidth = Math.min(width, 900);
  const listInnerWidth = Math.max(0, boundedWidth - 40);
  const listColumns = width >= 720 ? 2 : 1;
  const userCardWidth =
    listColumns === 2 ? (listInnerWidth - 10) / 2 : listInnerWidth;
  const railPadding = Math.max(20, (width - 900) / 2 + 20);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [search, setSearch] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const data = await fetchAdminUsers(ctrl.signal);
      setUsers(data);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e?.message || "Failed to load users.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  const filtered = useMemo(() => {
    let list = users;

    if (roleFilter !== "All") {
      list = list.filter(
        (u) => normalizeRole(u.role).toLowerCase() === roleFilter.toLowerCase()
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          (u.firstName || "").toLowerCase().includes(q) ||
          (u.lastName || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.contactNumber || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [users, roleFilter, search]);

  const counts = useMemo(() => {
    const all = users.length;
    const residents = users.filter(
      (u) => normalizeRole(u.role).toLowerCase() === "resident"
    ).length;
    const officials = users.filter(
      (u) => normalizeRole(u.role).toLowerCase() === "barangay official"
    ).length;
    const staff = users.filter(
      (u) => normalizeRole(u.role).toLowerCase() === "staff"
    ).length;
    const verified = users.filter((u) => u.isVerified).length;
    return { all, residents, officials, staff, verified };
  }, [users]);

  function getFilterCount(f: RoleFilter): number {
    if (f === "All") return counts.all;
    if (f === "Resident") return counts.residents;
    if (f === "Barangay Official") return counts.officials;
    if (f === "Staff") return counts.staff;
    return 0;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: TC.screenBg }]} edges={["top"]}>
      <StatusBar barStyle={TC.statusBar} backgroundColor={TC.screenBg} />

      {/* Header */}
      <View style={[styles.header, styles.bounded, { paddingTop: Math.max(insets.top, 8) }]}>
        <Pressable onPress={onBack} style={[styles.backBtn, { backgroundColor: TC.surface, borderColor: TC.divider }]} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={TC.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: TC.textDark }]}>Users</Text>
          <Text style={styles.headerSub}>{counts.all} registered users</Text>
        </View>
        <View style={[styles.headerBadge, { backgroundColor: TC.chipBg }]}>
          <Ionicons name="people" size={16} color={TC.primary} />
        </View>
      </View>

      {/* Summary cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.summaryRow, { paddingHorizontal: railPadding }]}
        style={styles.summaryScroll}
      >
        <View style={[styles.summaryCard, { backgroundColor: TC.surface, borderColor: TC.divider }]}>
          <Text style={styles.summaryValue}>{counts.all}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: "#35B56A30" }]}>
          <Text style={[styles.summaryValue, { color: "#35B56A" }]}>
            {counts.verified}
          </Text>
          <Text style={styles.summaryLabel}>Verified</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: `${Colors.primary}30` }]}>
          <Text style={[styles.summaryValue, { color: Colors.primary }]}>
            {counts.residents}
          </Text>
          <Text style={styles.summaryLabel}>Residents</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: "#7C3AED30" }]}>
          <Text style={[styles.summaryValue, { color: "#7C3AED" }]}>
            {counts.officials}
          </Text>
          <Text style={styles.summaryLabel}>Officials</Text>
        </View>
      </ScrollView>

      {/* Search */}
      <View
        style={[
          styles.searchWrap,
          {
            width: Math.max(0, Math.min(width - 40, 860)),
            backgroundColor: TC.surface,
            borderColor: TC.divider,
          },
        ]}
      >
        <Ionicons name="search-outline" size={16} color={TC.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          placeholderTextColor="#9AA4B2"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#9AA4B2" />
          </Pressable>
        )}
      </View>

      {/* Role filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filtersRow, { paddingHorizontal: railPadding }]}
        style={styles.filtersScroll}
      >
        {ROLE_FILTERS.map((f) => {
          const active = roleFilter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setRoleFilter(f)}
              style={[styles.chip, { backgroundColor: TC.surface, borderColor: TC.divider }, active && [styles.chipActive, { backgroundColor: TC.primary, borderColor: TC.primary }]]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f} ({getFilterCount(f)})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TC.primary} />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#F04452" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={TC.primary}
              colors={[TC.primary]}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={52} color="#C5D2E0" />
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptyText}>
                {search ? "Try a different search." : "No users match this filter."}
              </Text>
            </View>
          ) : (
            filtered.map((user) => {
              const initials = getInitials(user);
              const avatarColor = getAvatarColor(user._id);
              const fullName = [user.firstName, user.lastName]
                .filter(Boolean)
                .join(" ") || "Unknown";
              const role = normalizeRole(user.role);

              return (
                <View
                  key={user._id}
                  style={[
                    styles.userCard,
                    {
                      width: userCardWidth,
                      backgroundColor: TC.surface,
                      borderColor: TC.divider,
                    },
                  ]}
                >
                  <View style={[styles.avatar, { backgroundColor: `${avatarColor}20` }]}>
                    <Text style={[styles.avatarText, { color: avatarColor }]}>
                      {initials}
                    </Text>
                  </View>

                  <View style={styles.userInfo}>
                    <View style={styles.userTopRow}>
                      <Text style={[styles.userName, { color: TC.textDark }]} numberOfLines={1}>
                        {fullName}
                      </Text>
                      {user.isVerified ? (
                        <Ionicons
                          name="shield-checkmark"
                          size={14}
                          color="#35B56A"
                        />
                      ) : null}
                    </View>

                    <Text style={styles.userEmail} numberOfLines={1}>
                      {user.email}
                    </Text>

                    <View style={styles.userBottomRow}>
                      <View style={[styles.rolePill, { backgroundColor: TC.chipBg }]}>
                        <Text style={[styles.rolePillText, { color: TC.primary }]}>{role}</Text>
                      </View>
                      {user.createdAt ? (
                        <Text style={styles.joinedText}>
                          Joined {formatDate(user.createdAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#EEF3F8",
  },
  bounded: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAF2",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0E2B4D",
  },
  headerSub: {
    fontSize: 12,
    color: "#6B7A8D",
    fontWeight: "500",
    marginTop: 1,
  },
  headerBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DDEEFF",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  summaryRow: {
    paddingHorizontal: 20,
    gap: 10,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6EDF5",
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    minWidth: 80,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#102A43",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#6B7A8D",
    fontWeight: "600",
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3EAF2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: "#1E2E3E",
    padding: 0,
  },
  filtersScroll: {
    flexGrow: 0,
    marginBottom: 14,
  },
  filtersRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAF2",
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5B6B7A",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7A8D",
    fontWeight: "600",
  },
  errorText: {
    fontSize: 14,
    color: "#F04452",
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  list: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: 20,
    gap: 10,
    paddingTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  emptyWrap: {
    width: "100%",
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#5B6B7A",
  },
  emptyText: {
    fontSize: 13,
    color: "#9AA4B2",
    textAlign: "center",
    fontWeight: "500",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EDF5",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "800",
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  userTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#1E2E3E",
  },
  userEmail: {
    fontSize: 12.5,
    color: "#6B7A8D",
    fontWeight: "500",
  },
  userBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    flexWrap: "wrap",
    gap: 6,
  },
  rolePill: {
    backgroundColor: "#EAF3FF",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
    textTransform: "capitalize",
  },
  joinedText: {
    fontSize: 11,
    color: "#9AA4B2",
    fontWeight: "500",
  },
});
