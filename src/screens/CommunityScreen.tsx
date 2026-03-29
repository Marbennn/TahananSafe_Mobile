// src/screens/CommunityScreen.tsx
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  FlatList,
  TextInput,
  StatusBar,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import {
  fetchPosts,
  createPost,
  toggleLike,
  addComment,
  deletePost,
  type CommunityPost,
} from "../api/community";

/* ------------------------------------------------------------------ */
/*  Default avatar                                                     */
/* ------------------------------------------------------------------ */

function AvatarImage({
  uri,
  size,
  style,
  name,
  seed,
}: {
  uri?: string | null;
  size: number;
  style?: any;
  name?: string;
  seed?: string;
}) {
  const colors = useColors();
  const [imageFailed, setImageFailed] = useState(false);

  const initials = useMemo(() => {
    const clean = String(name || "").trim();
    if (!clean) return "?";
    const parts = clean.split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0)?.toUpperCase() || "";
    const last = parts[1]?.charAt(0)?.toUpperCase() || "";
    return `${first}${last}` || first || "?";
  }, [name]);

  const avatarColor = useMemo(() => {
    const palette = [
      "#4F8EF7",
      "#7C3AED",
      "#059669",
      "#DC2626",
      "#D97706",
      "#0891B2",
      "#BE185D",
      "#065F46",
    ];

    const key = String(seed || name || "community-user");
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
  }, [name, seed]);

  const safeUri = useMemo(() => {
    const clean = String(uri || "").trim();
    if (!clean) return "";
    if (clean === "null" || clean === "undefined") return "";
    return clean;
  }, [uri]);

  useEffect(() => {
    setImageFailed(false);
  }, [safeUri]);

  if (safeUri && !imageFailed) {
    return (
      <Image
        source={{ uri: safeUri }}
        onError={() => setImageFailed(true)}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      />
    );
  }
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${avatarColor}20`,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          color: avatarColor,
          fontSize: Math.max(12, Math.round(size * 0.34)),
          fontWeight: "800",
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FilterKey = "all" | "popular" | "recent";

type Props = {
  initialTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All Posts" },
  { key: "popular", label: "Popular" },
  { key: "recent", label: "Recent" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function userDisplayName(u: { firstName?: string; lastName?: string }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || "User";
}

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
          ? { backgroundColor: colors.chipBg, borderColor: colors.divider, borderWidth: 1 }
          : { backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1 },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? colors.primary : colors.body },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ---- Post Card ---- */

function PostCard({
  post,
  currentUserId,
  onLike,
  onComment,
  onDelete,
  colors,
}: {
  post: CommunityPost;
  currentUserId: string;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onDelete: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const liked =
    typeof post.likedByMe === "boolean"
      ? post.likedByMe
      : post.likes.includes(currentUserId);
  const likeCount =
    typeof post.likesCount === "number" ? post.likesCount : post.likes.length;
  const isOwner = post.user._id === currentUserId;

  const handleMenu = () => {
    if (isOwner) {
      Alert.alert("Post Options", "", [
        {
          text: "Delete Post",
          style: "destructive",
          onPress: () => onDelete(post._id),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  return (
    <View
      style={[
        styles.postCard,
        { backgroundColor: colors.surface, borderColor: colors.divider },
      ]}
    >
      {/* Header */}
      <View style={styles.postHeader}>
        <AvatarImage
          uri={post.user.profileImage}
          size={40}
          style={{ marginRight: 10 }}
          name={userDisplayName(post.user)}
          seed={post.user._id}
        />

        <View style={styles.postUserInfo}>
          <Text style={[styles.postUserName, { color: colors.text }]}>
            {userDisplayName(post.user)}
          </Text>
          {post.user.role ? (
            <Text style={[styles.postUserRole, { color: colors.muted }]}>
              {post.user.role}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.postTime, { color: colors.muted }]}>
          {timeAgo(post.createdAt)}
        </Text>
        {isOwner && (
          <Pressable hitSlop={8} style={styles.postMenu} onPress={handleMenu}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* Content */}
      <Text style={[styles.postContent, { color: colors.text }]}>
        {post.content}
      </Text>

      {/* Image */}
      {post.imageUrl ? (
        <Image
          source={{ uri: post.imageUrl }}
          style={styles.postImage}
          resizeMode="cover"
        />
      ) : null}

      {/* Actions */}
      <View style={[styles.postActions, { borderTopColor: colors.divider }]}>
        <Pressable
          onPress={() => onLike(post._id)}
          style={[
            styles.actionBtn,
            { backgroundColor: liked ? `${colors.primary}18` : colors.inputBg },
          ]}
          hitSlop={6}
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={20}
            color={liked ? "#DC2626" : colors.muted}
          />
          <Text style={[styles.actionText, { color: colors.muted }]}>
            {likeCount}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onComment(post._id)}
          style={[styles.actionBtn, { backgroundColor: colors.inputBg }]}
          hitSlop={6}
        >
          <Ionicons name="chatbubble-outline" size={19} color={colors.muted} />
          <Text style={[styles.actionText, { color: colors.muted }]}>
            {post.comments.length}
          </Text>
        </Pressable>
      </View>

      {/* Show last 2 comments preview */}
      {post.comments.length > 0 && (
        <View style={[styles.commentsPreview, { borderTopColor: colors.divider }]}>
          {post.comments.slice(-2).map((c) => (
            <View key={c._id} style={styles.commentRow}>
              <Text style={[styles.commentUser, { color: colors.text }]}>
                {userDisplayName(c.user)}
              </Text>
              <Text style={[styles.commentText, { color: colors.body }]}>
                {c.text}
              </Text>
            </View>
          ))}
          {post.comments.length > 2 && (
            <Pressable onPress={() => onComment(post._id)}>
              <Text style={[styles.viewAllComments, { color: colors.muted }]}>
                View all {post.comments.length} comments
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

/* ---- Create Post Modal ---- */

function CreatePostModal({
  visible,
  onClose,
  onSubmit,
  colors,
  userAvatar,
  userName,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (content: string, photoUri?: string) => Promise<void>;
  colors: ReturnType<typeof useColors>;
  userAvatar?: string;
  userName?: string;
}) {
  const [content, setContent] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed, photoUri);
      setContent("");
      setPhotoUri(undefined);
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create post.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setContent("");
    setPhotoUri(undefined);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
      >
        <View
          style={[
            styles.modalContent,
            { backgroundColor: colors.surface, borderColor: colors.divider },
          ]}
        >
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
            <Pressable onPress={handleClose}>
              <Text style={{ color: colors.muted, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              New Post
            </Text>
            <Pressable
              onPress={handleSubmit}
              disabled={!content.trim() || submitting}
              style={[
                styles.postBtn,
                {
                  backgroundColor: content.trim() ? colors.primary : colors.border,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.postBtnText}>Post</Text>
              )}
            </Pressable>
          </View>

          {/* Compose area */}
          <View style={styles.composeArea}>
            <AvatarImage
              uri={userAvatar}
              size={36}
              style={{ marginRight: 10 }}
              name={userName}
              seed={userName}
            />
            <TextInput
              placeholder="What's on your mind?"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.composeInput,
                {
                  color: colors.textDark,
                  backgroundColor: colors.inputBg,
                  borderColor: colors.divider,
                },
              ]}
              multiline
              autoFocus
              value={content}
              onChangeText={setContent}
            />
          </View>

          {/* Photo preview */}
          {photoUri && (
            <View style={styles.photoPreviewWrap}>
              <Image
                source={{ uri: photoUri }}
                style={[styles.photoPreview, { borderColor: colors.divider }]}
              />
              <Pressable
                style={styles.removePhoto}
                onPress={() => setPhotoUri(undefined)}
              >
                <Ionicons name="close-circle" size={26} color="#FFF" />
              </Pressable>
            </View>
          )}

          {/* Actions */}
          <View style={[styles.composeActions, { borderTopColor: colors.divider }]}>
            <Pressable style={styles.composeActionBtn} onPress={pickImage}>
              <Ionicons name="image-outline" size={24} color={colors.primary} />
              <Text style={[styles.composeActionLabel, { color: colors.body }]}>
                Photo
              </Text>
            </Pressable>
            <Pressable style={styles.composeActionBtn} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color="#10B981" />
              <Text style={[styles.composeActionLabel, { color: colors.body }]}>
                Camera
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---- Comments Modal ---- */

function CommentsModal({
  visible,
  onClose,
  post,
  onAddComment,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  post: CommunityPost | null;
  onAddComment: (postId: string, text: string) => Promise<void>;
  colors: ReturnType<typeof useColors>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !post) return;
    setSending(true);
    try {
      await onAddComment(post._id, trimmed);
      setText("");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add comment.");
    } finally {
      setSending(false);
    }
  };

  if (!post) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
      >
        <View
          style={[
            styles.commentsModalContent,
            { backgroundColor: colors.surface, borderColor: colors.divider },
          ]}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.modalTitle, { color: colors.text, flex: 1 }]}>
              Comments ({post.comments.length})
            </Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          {/* Comments list */}
          <FlatList
            data={post.comments}
            keyExtractor={(c) => c._id}
            contentContainerStyle={{ padding: 14 }}
            renderItem={({ item: c }) => (
              <View style={styles.commentItem}>
                <AvatarImage
                  uri={c.user.profileImage}
                  size={32}
                  style={{ marginRight: 8 }}
                  name={userDisplayName(c.user)}
                  seed={c.user._id}
                />
                <View style={[styles.commentBubble, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.commentBubbleName, { color: colors.text }]}>
                    {userDisplayName(c.user)}
                  </Text>
                  <Text style={[styles.commentBubbleText, { color: colors.body }]}>
                    {c.text}
                  </Text>
                  <Text style={[styles.commentTime, { color: colors.muted }]}>
                    {timeAgo(c.createdAt)}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No comments yet. Be the first!
              </Text>
            }
          />

          {/* Input */}
          <View style={[styles.commentInputRow, { borderTopColor: colors.divider, backgroundColor: colors.surface }]}>
            <TextInput
              ref={inputRef}
              placeholder="Write a comment..."
              placeholderTextColor={colors.placeholder}
              style={[
                styles.commentInput,
                {
                  color: colors.textDark,
                  backgroundColor: colors.inputBg,
                  borderColor: colors.divider,
                },
              ]}
              value={text}
              onChangeText={setText}
              multiline
            />
            <Pressable
              onPress={handleSend}
              disabled={!text.trim() || sending}
              style={styles.sendBtn}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name="send"
                  size={22}
                  color={text.trim() ? colors.primary : colors.muted}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                        */
/* ------------------------------------------------------------------ */

export default function CommunityScreen({
  initialTab = "Community",
  onTabChange,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth() as any;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);

  const currentUserId: string = user?._id || user?.id || "";
  const userAvatar: string | undefined = user?.profileImage;
  const currentUserName = userDisplayName({
    firstName: user?.firstName,
    lastName: user?.lastName,
  });

  const NAV_BASE_HEIGHT = 78;
  const bottomPad = Math.max(insets.bottom, 10);
  const navHeight = NAV_BASE_HEIGHT + bottomPad;
  const chevronBottom = navHeight + 90;
  const CONTENT_BOTTOM_PAD = Math.round(NAV_BASE_HEIGHT * 0.85) + bottomPad + 24;

  /* ---- Data loading ---- */
  const loadPosts = useCallback(async () => {
    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch (err: any) {
      console.warn("Failed to load posts:", err.message);
      Alert.alert("Community unavailable", err?.message || "Failed to load posts.");
    }
  }, []);

  useEffect(() => {
    loadPosts().finally(() => setLoading(false));
  }, [loadPosts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  }, [loadPosts]);

  /* ---- Actions ---- */
  const handleTab = (tab: TabKey) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const handleLike = useCallback(
    async (postId: string) => {
      // Optimistic update
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== postId) return p;
          const alreadyLiked =
            typeof p.likedByMe === "boolean"
              ? p.likedByMe
              : p.likes.includes(currentUserId);
          const currentCount =
            typeof p.likesCount === "number" ? p.likesCount : p.likes.length;
          return {
            ...p,
            likedByMe: !alreadyLiked,
            likesCount: Math.max(0, currentCount + (alreadyLiked ? -1 : 1)),
            likes: alreadyLiked
              ? p.likes.filter((id) => id !== currentUserId)
              : [...p.likes, currentUserId],
          };
        })
      );
      try {
        const result = await toggleLike(postId);
        setPosts((prev) =>
          prev.map((p) =>
            p._id === postId
              ? {
                  ...p,
                  likedByMe: result.liked,
                  likesCount: result.likesCount,
                }
              : p
          )
        );
      } catch {
        // Revert on failure
        await loadPosts();
      }
    },
    [currentUserId, loadPosts]
  );

  const handleCreatePost = useCallback(
    async (content: string, photoUri?: string) => {
      const newPost = await createPost(content, photoUri);
      setPosts((prev) => [newPost, ...prev]);
    },
    []
  );

  const handleAddComment = useCallback(
    async (postId: string, text: string) => {
      const comment = await addComment(postId, text);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, comments: [...p.comments, comment] }
            : p
        )
      );
    },
    []
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePost(postId);
              setPosts((prev) => prev.filter((p) => p._id !== postId));
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete post.");
            }
          },
        },
      ]);
    },
    []
  );

  /* ---- Filtering ---- */
  const filteredPosts = useMemo(() => {
    switch (activeFilter) {
      case "popular":
        return [...posts].sort(
          (a, b) =>
            (b.likesCount ?? b.likes.length) - (a.likesCount ?? a.likes.length)
        );
      case "recent":
        return [...posts].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      default:
        return posts;
    }
  }, [activeFilter, posts]);

  const commentPost = commentPostId
    ? posts.find((p) => p._id === commentPostId) ?? null
    : null;

  const renderPost = useCallback(
    ({ item }: { item: CommunityPost }) => (
      <PostCard
        post={item}
        currentUserId={currentUserId}
        onLike={handleLike}
        onComment={(id) => setCommentPostId(id)}
        onDelete={handleDeletePost}
        colors={colors}
      />
    ),
    [handleLike, handleDeletePost, currentUserId, colors]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBg }]} edges={["top"]}>
      <StatusBar barStyle={colors.statusBar} />

      <View style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: colors.textDark }]}>
              Community
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
              Share updates, photos, and neighborhood conversations
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredPosts}
            keyExtractor={(item) => item._id}
            renderItem={renderPost}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: CONTENT_BOTTOM_PAD },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListHeaderComponent={
              <>
                {/* ── Create post bar ── */}
                <Pressable
                  onPress={() => setCreateModalVisible(true)}
                  style={[
                    styles.createBar,
                    { backgroundColor: colors.surface, borderColor: colors.divider },
                  ]}
                >
                  <View style={styles.createBarLeft}>
                    <AvatarImage uri={userAvatar} size={34} name={currentUserName} seed={currentUserId} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.createPromptTitle, { color: colors.textDark }]}>
                        Start a post
                      </Text>
                      <View
                        style={[
                          styles.createInputPlaceholder,
                          { backgroundColor: colors.inputBg },
                        ]}
                      >
                        <Text style={[styles.createPromptText, { color: colors.placeholder }]}>
                          What's happening in your area?
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.cameraBtn,
                      { backgroundColor: colors.chipBg, borderColor: colors.divider },
                    ]}
                  >
                    <Ionicons name="camera-outline" size={20} color={colors.primary} />
                  </View>
                </Pressable>

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
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIconWrap, { backgroundColor: colors.chipBg }]}>
                  <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textDark }]}>
                  No posts yet
                </Text>
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  Be the first to share a photo, update, or helpful message.
                </Text>
              </View>
            }
          />
        )}

        {/* Bottom nav */}
        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTab}
          navHeight={navHeight}
          paddingBottom={bottomPad}
          chevronBottom={chevronBottom}
          centerLabel="Community"
        />
      </View>

      {/* ── Create Post Modal ── */}
      <CreatePostModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreatePost}
        colors={colors}
        userAvatar={userAvatar}
        userName={currentUserName}
      />

      {/* ── Comments Modal ── */}
      <CommentsModal
        visible={!!commentPostId}
        onClose={() => setCommentPostId(null)}
        post={commentPost}
        onAddComment={handleAddComment}
        colors={colors}
      />
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  safe: { flex: 1 },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: "900" },
  headerSubtitle: { marginTop: 4, fontSize: 12, fontWeight: "500", lineHeight: 16 },

  /* Loading */
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* List */
  listContent: { paddingHorizontal: 16, paddingTop: 6 },

  /* Create bar */
  createBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  createBarLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  createPromptTitle: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  createPromptText: { fontSize: 13, fontWeight: "500" },
  createInputPlaceholder: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cameraBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  /* Filters */
  filterRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: "700" },

  /* Post card */
  postCard: { borderRadius: 18, marginBottom: 14, overflow: "hidden", borderWidth: 1 },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  postAvatar: { marginRight: 10 },
  postUserInfo: { flex: 1, minWidth: 0 },
  postUserName: { fontSize: 14, fontWeight: "700" },
  postUserRole: { fontSize: 11, marginTop: 2 },
  postTime: { fontSize: 11, marginRight: 6 },
  postMenu: { padding: 4 },
  postContent: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  postImage: { width: "100%", height: 220 },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionText: { fontSize: 12, fontWeight: "600" },

  /* Comments preview (under post) */
  commentsPreview: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  commentRow: { flexDirection: "row", marginBottom: 4, flexWrap: "wrap" },
  commentUser: { fontSize: 12, fontWeight: "700", marginRight: 6 },
  commentText: { fontSize: 12 },
  viewAllComments: { fontSize: 12, marginTop: 4, fontWeight: "600" },

  /* Empty */
  emptyWrap: { alignItems: "center", paddingTop: 48, paddingHorizontal: 20 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", marginBottom: 6 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18 },

  /* ── Modal shared ── */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    minHeight: 340,
    maxHeight: "85%",
    borderWidth: 1,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 16, fontWeight: "800" },

  /* Create post modal */
  postBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
  },
  postBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  composeArea: {
    flexDirection: "row",
    padding: 14,
    alignItems: "flex-start",
  },
  composeAvatar: { marginRight: 10 },
  composeInput: {
    flex: 1,
    fontSize: 15,
    minHeight: 104,
    textAlignVertical: "top",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  photoPreviewWrap: { paddingHorizontal: 14, marginBottom: 10 },
  photoPreview: { width: "100%", height: 200, borderRadius: 14, borderWidth: 1 },
  removePhoto: { position: "absolute", top: 8, right: 22 },
  composeActions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 20,
  },
  composeActionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  composeActionLabel: { fontSize: 13, fontWeight: "600" },

  /* Comments modal */
  commentsModalContent: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    height: "70%",
    borderWidth: 1,
    overflow: "hidden",
  },
  commentItem: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-start",
  },
  commentAvatar: { marginRight: 8 },
  commentBubble: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
  },
  commentBubbleName: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  commentBubbleText: { fontSize: 13, lineHeight: 18 },
  commentTime: { fontSize: 10, marginTop: 4 },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    maxHeight: 80,
    borderWidth: 1,
  },
  sendBtn: { marginLeft: 8, padding: 6 },
});
