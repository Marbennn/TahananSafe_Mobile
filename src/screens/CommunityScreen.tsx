// src/screens/CommunityScreen.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  FlatList,
  TextInput,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../theme/colors";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FilterKey = "all" | "popular" | "recent";

interface Post {
  id: string;
  userName: string;
  userRole: string;
  avatarUrl: string;
  timeAgo: string;
  content: string;
  imageUrl?: string;
  likes: number;
  comments: number;
  liked: boolean;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_POSTS: Post[] = [
  {
    id: "1",
    userName: "Ram Charan",
    userRole: "IT Developer",
    avatarUrl: "https://i.pravatar.cc/150?img=11",
    timeAgo: "1.5m ago",
    content: "Amazing Snacks today",
    imageUrl:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80",
    likes: 24,
    comments: 8,
    liked: false,
  },
  {
    id: "2",
    userName: "Sejal Agarwal",
    userRole: "Software Engineer",
    avatarUrl: "https://i.pravatar.cc/150?img=5",
    timeAgo: "45m ago",
    content: "Today's lunch special: Butter Chicken! Must try",
    imageUrl:
      "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&q=80",
    likes: 18,
    comments: 5,
    liked: true,
  },
  {
    id: "3",
    userName: "Alex Kim",
    userRole: "Designer",
    avatarUrl: "https://i.pravatar.cc/150?img=12",
    timeAgo: "2h ago",
    content: "Check out the new cafe on 5th street! Great ambiance and food.",
    imageUrl:
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&q=80",
    likes: 42,
    comments: 12,
    liked: false,
  },
  {
    id: "4",
    userName: "Priya Sharma",
    userRole: "Product Manager",
    avatarUrl: "https://i.pravatar.cc/150?img=9",
    timeAgo: "3h ago",
    content: "Homemade pasta for today's potluck. Recipe in the comments!",
    likes: 31,
    comments: 15,
    liked: false,
  },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All Posts" },
  { key: "popular", label: "Popular" },
  { key: "recent", label: "Recent" },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FilterChip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: colors.text }
          : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? "#FFFFFF" : colors.body },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PostCard({
  post,
  onLike,
  colors,
}: {
  post: Post;
  onLike: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.postCard, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={styles.postHeader}>
        <Image source={{ uri: post.avatarUrl }} style={styles.postAvatar} />
        <View style={styles.postUserInfo}>
          <Text style={[styles.postUserName, { color: colors.text }]}>
            {post.userName}
          </Text>
          <Text style={[styles.postUserRole, { color: colors.muted }]}>
            {post.userRole}
          </Text>
        </View>
        <Text style={[styles.postTime, { color: colors.muted }]}>
          {post.timeAgo}
        </Text>
        <Pressable hitSlop={8} style={styles.postMenu}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
        </Pressable>
      </View>

      {/* Content */}
      <Text style={[styles.postContent, { color: colors.text }]}>
        {post.content}
      </Text>

      {/* Image */}
      {post.imageUrl && (
        <Image
          source={{ uri: post.imageUrl }}
          style={styles.postImage}
          resizeMode="cover"
        />
      )}

      {/* Actions */}
      <View style={[styles.postActions, { borderTopColor: colors.divider }]}>
        <Pressable
          onPress={() => onLike(post.id)}
          style={styles.actionBtn}
          hitSlop={6}
        >
          <Ionicons
            name={post.liked ? "heart" : "heart-outline"}
            size={20}
            color={post.liked ? "#EF4444" : colors.muted}
          />
          <Text style={[styles.actionText, { color: colors.muted }]}>
            {post.likes}
          </Text>
        </Pressable>

        <Pressable style={styles.actionBtn} hitSlop={6}>
          <Ionicons
            name="chatbubble-outline"
            size={19}
            color={colors.muted}
          />
          <Text style={[styles.actionText, { color: colors.muted }]}>
            {post.comments}
          </Text>
        </Pressable>

        <Pressable style={styles.actionBtn} hitSlop={6}>
          <Ionicons
            name="share-social-outline"
            size={20}
            color={colors.muted}
          />
        </Pressable>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                        */
/* ------------------------------------------------------------------ */

export default function CommunityScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();

  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);

  const handleLike = useCallback((id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  }, []);

  const filteredPosts = (() => {
    switch (activeFilter) {
      case "popular":
        return [...posts].sort((a, b) => b.likes - a.likes);
      case "recent":
        return [...posts]; // already newest-first in mock
      default:
        return posts;
    }
  })();

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} onLike={handleLike} colors={colors} />
    ),
    [handleLike, colors]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBg }]}>
      <StatusBar barStyle={colors.statusBar} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={{ uri: "https://i.pravatar.cc/150?img=3" }}
            style={styles.headerAvatar}
          />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Community Feed
          </Text>
        </View>
      </View>

      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* ── Create post bar ── */}
            <View
              style={[
                styles.createBar,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Image
                source={{ uri: "https://i.pravatar.cc/150?img=3" }}
                style={styles.createAvatar}
              />
              <TextInput
                placeholder="What's cooking today?"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.createInput,
                  { color: colors.text, backgroundColor: colors.inputBg },
                ]}
                editable={false}
              />
              <Pressable style={styles.cameraBtn}>
                <Ionicons name="camera-outline" size={22} color={colors.muted} />
              </Pressable>
            </View>

            {/* ── Filters ── */}
            <View style={styles.filterRow}>
              {FILTERS.map((f) => (
                <FilterChip
                  key={f.key}
                  label={f.label}
                  active={activeFilter === f.key}
                  onPress={() => setActiveFilter(f.key)}
                  colors={colors}
                />
              ))}
            </View>
          </>
        }
      />
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  /* Create bar */
  createBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
  },
  createAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  createInput: {
    flex: 1,
    fontSize: 14,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cameraBtn: {
    marginLeft: 8,
    padding: 4,
  },

  /* Filters */
  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },

  /* Post card */
  postCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  postUserInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 15,
    fontWeight: "600",
  },
  postUserRole: {
    fontSize: 12,
    marginTop: 1,
  },
  postTime: {
    fontSize: 12,
    marginRight: 6,
  },
  postMenu: {
    padding: 4,
  },
  postContent: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  postImage: {
    width: "100%",
    height: 220,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 20,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
