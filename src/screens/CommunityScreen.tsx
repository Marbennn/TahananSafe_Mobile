// src/screens/CommunityScreen.tsx
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  FlatList,
  ScrollView,
  TextInput,
  StatusBar,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import BottomNavBar, { TabKey } from "../components/BottomNavBar";
import LogoutModal from "../components/LogoutModal";
import SavedModal from "../components/SavedModal";
import {
  fetchPosts,
  createPost,
  toggleLike,
  toggleSavePost,
  updatePost,
  addComment,
  reactToComment,
  deletePost,
  type Comment as CommunityComment,
  type CommentReply,
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

type FilterKey = "all" | "popular" | "recent" | "saved";

type Props = {
  initialTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  renderNav?: (props: {
    activeTab: TabKey;
    onTabPress: (tab: TabKey) => void;
    navHeight: number;
    paddingBottom: number;
    chevronBottom: number;
  }) => React.ReactNode;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All Posts" },
  { key: "popular", label: "Popular" },
  { key: "recent", label: "Recent" },
  { key: "saved", label: "Saved" },
];

const MAX_POST_IMAGES = 5;
const COMMENT_REACTIONS = [
  { key: "like", emoji: "👍" },
  { key: "love", emoji: "❤️" },
  { key: "care", emoji: "🥰" },
  { key: "haha", emoji: "😄" },
  { key: "wow", emoji: "😮" },
  { key: "sad", emoji: "😢" },
  { key: "angry", emoji: "😡" },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

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

function countThreadComments(comments: CommunityComment[]): number {
  return comments.reduce(
    (total, comment) => total + 1 + (Array.isArray(comment.replies) ? comment.replies.length : 0),
    0
  );
}

function buildCommentPreviewItems(comments: CommunityComment[]) {
  return comments.flatMap((comment) => [
    {
      _id: comment._id,
      user: comment.user,
      text: comment.text,
      parentUser: null as null | string,
    },
    ...(Array.isArray(comment.replies)
      ? comment.replies.map((reply) => ({
          _id: reply._id,
          user: reply.user,
          text: reply.text,
          parentUser: userDisplayName(comment.user),
        }))
      : []),
  ]);
}

function buildReactionSummary(comment: CommunityComment) {
  const entries = Object.entries(comment.reactions || {})
    .filter(([, count]) => Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  const emojis = entries
    .slice(0, 3)
    .map(([type]) => COMMENT_REACTIONS.find((reaction) => reaction.key === type)?.emoji)
    .filter(Boolean) as string[];

  return {
    emojis,
    count: typeof comment.reactionsCount === "number" ? comment.reactionsCount : 0,
  };
}

function patchCurrentUserProfileInPosts(
  posts: CommunityPost[],
  currentUserId: string,
  profile: { firstName?: string; lastName?: string; profileImage?: string }
) {
  if (!currentUserId) return posts;

  let changed = false;
  const nextFirstName = String(profile.firstName || "");
  const nextLastName = String(profile.lastName || "");
  const nextProfileImage = String(profile.profileImage || "");

  const patchUser = (communityUser: CommunityPost["user"]) => {
    if (String(communityUser?._id || "") !== String(currentUserId)) {
      return communityUser;
    }

    if (
      String(communityUser.firstName || "") === nextFirstName &&
      String(communityUser.lastName || "") === nextLastName &&
      String(communityUser.profileImage || "") === nextProfileImage
    ) {
      return communityUser;
    }

    changed = true;
    return {
      ...communityUser,
      firstName: nextFirstName || communityUser.firstName,
      lastName: nextLastName || communityUser.lastName,
      profileImage: nextProfileImage || communityUser.profileImage,
    };
  };

  const nextPosts = posts.map((post) => ({
    ...post,
    user: patchUser(post.user),
    comments: post.comments.map((comment) => ({
      ...comment,
      user: patchUser(comment.user),
      replies: comment.replies.map((reply) => ({
        ...reply,
        user: patchUser(reply.user),
      })),
    })),
  }));

  return changed ? nextPosts : posts;
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
  onToggleSave,
  onOpenOptions,
  onImagePress,
  colors,
}: {
  post: CommunityPost;
  currentUserId: string;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onToggleSave: (id: string) => void;
  onOpenOptions: (id: string) => void;
  onImagePress: (imageUris: string[], index: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { width } = useWindowDimensions();
  const postWidth = Math.min(Math.max(width - 32, 0), 688);
  const postImageHeight = Math.round(clamp(postWidth / 1.55, 180, 390));
  const galleryItemSize = Math.round(clamp(postWidth * 0.64, 180, 300));
  const isOwner = String(post.user._id || "") === String(currentUserId);
  const liked =
    typeof post.likedByMe === "boolean"
      ? post.likedByMe
      : post.likes.includes(currentUserId);
  const likeCount =
    typeof post.likesCount === "number" ? post.likesCount : post.likes.length;
  const saved = Boolean(post.savedByMe);
  const saveCount = typeof post.savesCount === "number" ? post.savesCount : 0;
  const commentCount = countThreadComments(post.comments);
  const previewItems = buildCommentPreviewItems(post.comments).slice(-2);
  const imageUrls =
    post.imageUrls?.length
      ? post.imageUrls
      : post.imageUrl
        ? [post.imageUrl]
        : [];

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
        {isOwner ? (
          <Pressable hitSlop={8} style={styles.postMenu} onPress={() => onOpenOptions(post._id)}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Content */}
      <Text style={[styles.postContent, { color: colors.text }]}>
        {post.content}
      </Text>

      {/* Image */}
      {imageUrls.length === 1 ? (
        <Pressable
          onPress={() => onImagePress(imageUrls, 0)}
          style={styles.postImageButton}
        >
          <Image
            source={{ uri: imageUrls[0] }}
            style={[styles.postImage, { height: postImageHeight }]}
            resizeMode="cover"
          />
          <View style={styles.expandImageBadge}>
            <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
            <Text style={styles.expandImageText}>Expand</Text>
          </View>
        </Pressable>
      ) : imageUrls.length > 1 ? (
        <View style={styles.postGalleryWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.postGalleryRow}
          >
            {imageUrls.map((imageUri, index) => (
              <Pressable
                key={`${post._id}-${index}`}
                onPress={() => onImagePress(imageUrls, index)}
                style={[
                  styles.postGalleryItem,
                  { width: galleryItemSize, height: galleryItemSize },
                ]}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={styles.postGalleryImage}
                  resizeMode="cover"
                />
                <View style={styles.expandImageBadge}>
                  <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.expandImageText}>Expand</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
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
            {commentCount}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onToggleSave(post._id)}
          style={[
            styles.actionBtn,
            { backgroundColor: saved ? `${colors.primary}18` : colors.inputBg },
          ]}
          hitSlop={6}
        >
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={18}
            color={saved ? colors.primary : colors.muted}
          />
          <Text style={[styles.actionText, { color: saved ? colors.primary : colors.muted }]}>
            {saveCount}
          </Text>
        </Pressable>
      </View>

      {/* Show last 2 comments preview */}
      {previewItems.length > 0 && (
        <View style={[styles.commentsPreview, { borderTopColor: colors.divider }]}>
          {previewItems.map((item) => (
            <View key={item._id} style={styles.commentRow}>
              <Text style={[styles.commentUser, { color: colors.text }]}>
                {userDisplayName(item.user)}
              </Text>
              <Text style={[styles.commentText, { color: colors.body }]}>
                {item.parentUser ? `Reply to ${item.parentUser}: ${item.text}` : item.text}
              </Text>
            </View>
          ))}
          {commentCount > 2 && (
            <Pressable onPress={() => onComment(post._id)}>
              <Text style={[styles.viewAllComments, { color: colors.muted }]}>
                View all {commentCount} comments
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
  onSubmit: (content: string, photoUris?: string[]) => Promise<void>;
  colors: ReturnType<typeof useColors>;
  userAvatar?: string;
  userName?: string;
}) {
  const [content, setContent] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    if (photoUris.length >= MAX_POST_IMAGES) {
      Alert.alert("Max reached", `You can only add up to ${MAX_POST_IMAGES} images.`);
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access so you can upload images.");
      return;
    }

    const remaining = MAX_POST_IMAGES - photoUris.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!result.canceled) {
      const newUris = Array.from(
        new Set((result.assets ?? []).map((asset) => asset.uri).filter(Boolean))
      );

      if (newUris.length > remaining) {
        Alert.alert(
          "Limit reached",
          `You can only select ${remaining} more image${remaining === 1 ? "" : "s"}.`
        );
      }

      setPhotoUris((prev) =>
        Array.from(new Set([...prev, ...newUris])).slice(0, MAX_POST_IMAGES)
      );
    }
  };

  const takePhoto = async () => {
    if (photoUris.length >= MAX_POST_IMAGES) {
      Alert.alert("Max reached", `You can only add up to ${MAX_POST_IMAGES} images.`);
      return;
    }

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUris((prev) =>
        Array.from(new Set([...prev, result.assets[0].uri])).slice(0, MAX_POST_IMAGES)
      );
    }
  };

  const removePhotoAt = (index: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed, photoUris.length ? photoUris : undefined);
      setContent("");
      setPhotoUris([]);
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create post.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setContent("");
    setPhotoUris([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
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
                  backgroundColor: content.trim()
                    ? colors.actionPrimary
                    : colors.border,
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

          <ScrollView
            style={styles.modalBodyScroll}
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
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
              placeholder="What's happening in your area?"
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
            {photoUris.length > 0 && (
              <View style={styles.photoPreviewWrap}>
              <Text style={[styles.photoPreviewTitle, { color: colors.muted }]}>
                Selected images ({photoUris.length}/{MAX_POST_IMAGES})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoPreviewRow}
              >
                {photoUris.map((photoUri, index) => (
                  <View key={`${photoUri}-${index}`} style={styles.photoPreviewItem}>
                    <Image
                      source={{ uri: photoUri }}
                      style={[styles.photoPreview, { borderColor: colors.divider }]}
                    />
                    <Pressable
                      style={styles.removePhoto}
                      onPress={() => removePhotoAt(index)}
                    >
                      <Ionicons name="close-circle" size={26} color="#FFF" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              </View>
            )}

          {/* Actions */}
            <View style={styles.composeActions}>
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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---- Edit Post Modal ---- */

function EditPostModal({
  visible,
  initialContent,
  onClose,
  onSubmit,
  colors,
}: {
  visible: boolean;
  initialContent: string;
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
  colors: ReturnType<typeof useColors>;
}) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setContent(initialContent);
    }
  }, [initialContent, visible]);

  const trimmedCurrent = content.trim();
  const trimmedInitial = initialContent.trim();
  const canSave = !!trimmedCurrent && trimmedCurrent !== trimmedInitial && !saving;

  const handleClose = () => {
    if (saving) return;
    setContent(initialContent);
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      await onSubmit(trimmedCurrent);
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update post.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
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
          <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
            <Pressable onPress={handleClose} disabled={saving}>
              <Text style={{ color: colors.muted, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Edit Post
            </Text>
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={[
                styles.postBtn,
                {
                  backgroundColor: canSave
                    ? colors.actionPrimary
                    : colors.border,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.postBtnText}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalBodyScroll}
            contentContainerStyle={styles.editPostBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              placeholder="What's happening in your area?"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.editPostInput,
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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---- Post Options Modal ---- */

function PostOptionsModal({
  visible,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onDelete,
  colors,
}: {
  visible: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.centerModalRoot}>
        <Pressable
          style={[styles.centerModalBackdrop, { backgroundColor: colors.overlay }]}
          onPress={onClose}
        />

        <View
          style={[
            styles.postOptionsCard,
            { backgroundColor: colors.surface, borderColor: colors.divider },
          ]}
        >
          <Text style={[styles.postOptionsTitle, { color: colors.textDark }]}>
            Post Options
          </Text>

          <View style={styles.postOptionsActions}>
            {canEdit ? (
              <Pressable
                onPress={onEdit}
                style={[styles.postOptionBtn, { backgroundColor: colors.inputBg }]}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text style={[styles.postOptionLabel, { color: colors.textDark }]}>
                  Edit Post
                </Text>
              </Pressable>
            ) : null}

            {canDelete ? (
              <Pressable
                onPress={onDelete}
                style={[styles.postOptionBtn, styles.postOptionBtnDanger]}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text style={styles.postOptionDangerLabel}>
                  Delete Post
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={onClose}
              style={[styles.postOptionBtn, { backgroundColor: colors.inputBg }]}
            >
              <Text style={[styles.postOptionLabel, { color: colors.textDark }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---- Comments Modal ---- */

function CommentThread({
  comment,
  colors,
  onReplyPress,
  onReactPress,
  isReactionPickerOpen,
}: {
  comment: CommunityComment;
  colors: ReturnType<typeof useColors>;
  onReplyPress: (comment: CommunityComment) => void;
  onReactPress: (commentId: string, reaction: string) => void;
  isReactionPickerOpen: boolean;
}) {
  const commentUserName = userDisplayName(comment.user);
  const reactionSummary = buildReactionSummary(comment);
  const longPressTriggeredRef = useRef(false);

  return (
    <View style={styles.commentThread}>
      <View style={styles.commentItem}>
        <AvatarImage
          uri={comment.user.profileImage}
          size={32}
          style={{ marginRight: 8 }}
          name={commentUserName}
          seed={comment.user._id}
        />
        <View style={[styles.commentBubble, { backgroundColor: colors.inputBg }]}>
          <Text style={[styles.commentBubbleName, { color: colors.text }]}>
            {commentUserName}
          </Text>
          <Text style={[styles.commentBubbleText, { color: colors.body }]}>
            {comment.text}
          </Text>
          <Text style={[styles.commentTime, { color: colors.muted }]}>
            {timeAgo(comment.createdAt)}
          </Text>
        </View>
      </View>

      <View style={styles.commentActionsRow}>
        <Pressable
          onPress={() => {
            if (longPressTriggeredRef.current) {
              longPressTriggeredRef.current = false;
              return;
            }
            onReplyPress(comment);
          }}
          onLongPress={() => {
            longPressTriggeredRef.current = true;
            onReactPress(comment._id, "__open__");
          }}
          delayLongPress={220}
          hitSlop={8}
        >
          <Text style={[styles.replyBtnText, { color: colors.primary }]}>Reply</Text>
        </Pressable>

        {reactionSummary.count > 0 ? (
          <View style={[styles.commentReactionSummary, { backgroundColor: colors.chipBg }]}>
            <Text style={styles.commentReactionEmojis}>{reactionSummary.emojis.join(" ")}</Text>
            <Text style={[styles.commentReactionCount, { color: colors.primary }]}>
              {reactionSummary.count}
            </Text>
          </View>
        ) : null}
      </View>

      {isReactionPickerOpen ? (
        <View style={[styles.reactionPickerWrap, { backgroundColor: "#2F3136" }]}>
          {COMMENT_REACTIONS.map((reaction) => (
            <Pressable
              key={reaction.key}
              onPress={() => onReactPress(comment._id, reaction.key)}
              style={[
                styles.reactionPickerItem,
                comment.myReaction === reaction.key && styles.reactionPickerItemActive,
              ]}
            >
              <Text style={styles.reactionPickerEmoji}>{reaction.emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {comment.replies.length > 0 ? (
        <View style={styles.replyList}>
          {comment.replies.map((reply: CommentReply) => (
            <View key={reply._id} style={styles.replyItem}>
              <AvatarImage
                uri={reply.user.profileImage}
                size={28}
                style={{ marginRight: 8 }}
                name={userDisplayName(reply.user)}
                seed={reply.user._id}
              />
              <View style={[styles.replyBubble, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.commentBubbleName, { color: colors.text }]}>
                  {userDisplayName(reply.user)}
                </Text>
                <Text style={[styles.commentBubbleText, { color: colors.body }]}>
                  {reply.text}
                </Text>
                <Text style={[styles.commentTime, { color: colors.muted }]}>
                  {timeAgo(reply.createdAt)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CommentsModal({
  visible,
  onClose,
  post,
  onAddComment,
  onReactToComment,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  post: CommunityPost | null;
  onAddComment: (postId: string, text: string, parentCommentId?: string) => Promise<void>;
  onReactToComment: (postId: string, commentId: string, reaction: string) => Promise<void>;
  colors: ReturnType<typeof useColors>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    commentId: string;
    userName: string;
  } | null>(null);
  const [reactionPickerCommentId, setReactionPickerCommentId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) {
      setText("");
      setReplyTarget(null);
      setReactionPickerCommentId(null);
    }
  }, [visible]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !post) return;
    setSending(true);
    try {
      await onAddComment(post._id, trimmed, replyTarget?.commentId);
      setText("");
      setReplyTarget(null);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add comment.");
    } finally {
      setSending(false);
    }
  };

  const handleReplyPress = useCallback((comment: CommunityComment) => {
    setReactionPickerCommentId(null);
    setReplyTarget({
      commentId: comment._id,
      userName: userDisplayName(comment.user),
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleReactPress = useCallback(
    async (commentId: string, reaction: string) => {
      if (!post) return;

      if (reaction === "__open__") {
        setReactionPickerCommentId((prev) => (prev === commentId ? null : commentId));
        return;
      }

      setReactionPickerCommentId(null);
      try {
        await onReactToComment(post._id, commentId, reaction);
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to react to comment.");
      }
    },
    [onReactToComment, post]
  );

  const handleClose = useCallback(() => {
    setText("");
    setReplyTarget(null);
    setReactionPickerCommentId(null);
    onClose();
  }, [onClose]);

  if (!post) return null;

  const totalComments = countThreadComments(post.comments);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setReactionPickerCommentId(null)} />
        <View
          style={[
            styles.commentsModalContent,
            { backgroundColor: colors.surface, borderColor: colors.divider },
          ]}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.modalTitle, { color: colors.text, flex: 1 }]}>
              Comments ({totalComments})
            </Text>
            <Pressable onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          {/* Comments list */}
          <FlatList
            data={post.comments}
            keyExtractor={(c) => c._id}
            contentContainerStyle={{ padding: 14 }}
            renderItem={({ item: c }) => (
              <CommentThread
                comment={c}
                colors={colors}
                onReplyPress={handleReplyPress}
                onReactPress={handleReactPress}
                isReactionPickerOpen={reactionPickerCommentId === c._id}
              />
            )}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No comments yet. Be the first!
              </Text>
            }
          />

          {/* Input */}
          <View style={[styles.commentInputRow, { borderTopColor: colors.divider, backgroundColor: colors.surface }]}>
            {replyTarget ? (
              <View style={[styles.replyTargetBar, { backgroundColor: colors.chipBg }]}>
                <Text style={[styles.replyTargetText, { color: colors.primary }]}>
                  Replying to {replyTarget.userName}
                </Text>
                <Pressable onPress={() => setReplyTarget(null)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.primary} />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.commentComposerRow}>
              <TextInput
                ref={inputRef}
                placeholder={replyTarget ? `Reply to ${replyTarget.userName}...` : "Write a comment..."}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ExpandedImageModal({
  visible,
  imageUris,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  imageUris: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    if (!visible || !imageUris.length) return;
    const safeIndex = Math.max(0, Math.min(initialIndex, imageUris.length - 1));
    setViewerIndex(safeIndex);
  }, [visible, imageUris, initialIndex]);

  const currentImageUri = imageUris[viewerIndex];
  const canPrev = viewerIndex > 0;
  const canNext = viewerIndex < imageUris.length - 1;

  useEffect(() => {
    setLoading(visible && !!currentImageUri);
  }, [visible, currentImageUri]);

  if (!currentImageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.imageViewerOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[styles.imageViewerCloseBtn, { top: insets.top + 12 }]}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={[styles.imageViewerTopBar, { top: insets.top + 12 }]}>
          <Text style={styles.imageViewerCounter}>
            {imageUris.length ? `${viewerIndex + 1} / ${imageUris.length}` : ""}
          </Text>
        </View>

        <View
          style={[
            styles.imageViewerBody,
            {
              paddingTop: insets.top + 56,
              paddingBottom: Math.max(insets.bottom + 20, 28),
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#FFFFFF"
              style={styles.imageViewerLoader}
            />
          ) : null}

          <ScrollView
            style={styles.imageViewerScroll}
            contentContainerStyle={styles.imageViewerScrollContent}
            minimumZoomScale={Platform.OS === "ios" ? 1 : undefined}
            maximumZoomScale={Platform.OS === "ios" ? 3 : undefined}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bounces={false}
            centerContent
          >
            <Image
              source={{ uri: currentImageUri }}
              style={styles.expandedImage}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          </ScrollView>

          {imageUris.length > 1 ? (
            <>
              <Pressable
                onPress={() => canPrev && setViewerIndex((prev) => prev - 1)}
                disabled={!canPrev}
                style={[
                  styles.imageViewerNavBtn,
                  styles.imageViewerNavLeft,
                  !canPrev && styles.imageViewerNavBtnDisabled,
                ]}
              >
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={() => canNext && setViewerIndex((prev) => prev + 1)}
                disabled={!canNext}
                style={[
                  styles.imageViewerNavBtn,
                  styles.imageViewerNavRight,
                  !canNext && styles.imageViewerNavBtnDisabled,
                ]}
              >
                <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
              </Pressable>
            </>
          ) : null}
        </View>

        <Text style={[styles.imageViewerHint, { bottom: Math.max(insets.bottom + 12, 20) }]}>
          {Platform.OS === "ios"
            ? "Tap outside to close | Pinch to zoom"
            : "Tap outside to close"}
        </Text>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                        */
/* ------------------------------------------------------------------ */

export default function CommunityScreen({
  initialTab = "Community",
  onTabChange,
  renderNav,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user } = useAuth() as any;

  const wScale = Math.min(Math.max(width / 375, 0.9), 1.25);
  const hScale = Math.min(Math.max(height / 812, 0.9), 1.2);
  const scale = (n: number) => Math.round(n * wScale);
  const vscale = (n: number) => Math.round(n * hScale);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [postOptionsPostId, setPostOptionsPostId] = useState<string | null>(null);
  const [deletePostConfirmId, setDeletePostConfirmId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postDeletedModalVisible, setPostDeletedModalVisible] = useState(false);
  const [expandedImageViewer, setExpandedImageViewer] = useState<{
    imageUris: string[];
    initialIndex: number;
  } | null>(null);

  const currentUserId: string = user?._id || user?.id || "";
  const userAvatar: string | undefined = user?.profileImage;
  const currentUserName = userDisplayName({
    firstName: user?.firstName,
    lastName: user?.lastName,
  });

  useEffect(() => {
    if (!currentUserId) return;

    setPosts((prev) =>
      patchCurrentUserProfileInPosts(prev, currentUserId, {
        firstName: user?.firstName,
        lastName: user?.lastName,
        profileImage: user?.profileImage,
      })
    );
  }, [currentUserId, user?.firstName, user?.lastName, user?.profileImage]);

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
    async (content: string, photoUris?: string[]) => {
      const newPost = await createPost(content, photoUris);
      setPosts((prev) => [newPost, ...prev]);
    },
    []
  );

  const handleAddComment = useCallback(
    async (postId: string, text: string, parentCommentId?: string) => {
      const updatedPost = await addComment(postId, text, parentCommentId);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? updatedPost
            : p
        )
      );
    },
    []
  );

  const handleReactToComment = useCallback(
    async (postId: string, commentId: string, reaction: string) => {
      const updatedPost = await reactToComment(postId, commentId, reaction);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? updatedPost
            : p
        )
      );
    },
    []
  );

  const handleToggleSave = useCallback(
    async (postId: string) => {
      try {
        const updatedPost = await toggleSavePost(postId);
        setPosts((prev) =>
          prev.map((p) =>
            p._id === postId
              ? updatedPost
              : p
          )
        );
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to update saved post.");
      }
    },
    []
  );

  const handleUpdatePost = useCallback(
    async (postId: string, content: string) => {
      const updatedPost = await updatePost(postId, content);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? updatedPost
            : p
        )
      );
    },
    []
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      try {
        await deletePost(postId);
        setPosts((prev) => prev.filter((p) => p._id !== postId));
        setPostDeletedModalVisible(true);
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to delete post.");
      }
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
      case "saved":
        return posts.filter((post) => Boolean(post.savedByMe));
      default:
        return posts;
    }
  }, [activeFilter, posts]);

  const commentPost = commentPostId
    ? posts.find((p) => p._id === commentPostId) ?? null
    : null;
  const optionsPost = postOptionsPostId
    ? posts.find((p) => p._id === postOptionsPostId) ?? null
    : null;
  const deleteConfirmPost = deletePostConfirmId
    ? posts.find((p) => p._id === deletePostConfirmId) ?? null
    : null;
  const editingPost = editingPostId
    ? posts.find((p) => p._id === editingPostId) ?? null
    : null;
  const emptyState = activeFilter === "saved"
    ? {
        title: "No saved posts yet",
        text: "Save a post from the options menu to see it here.",
      }
    : {
        title: "No posts yet",
        text: "Be the first to share a photo, update, or helpful message.",
      };

  const renderPost = useCallback(
    ({ item }: { item: CommunityPost }) => (
      <PostCard
        post={item}
        currentUserId={currentUserId}
        onLike={handleLike}
        onComment={(id) => setCommentPostId(id)}
        onToggleSave={handleToggleSave}
        onOpenOptions={(id) => setPostOptionsPostId(id)}
        onImagePress={(imageUris, initialIndex) =>
          setExpandedImageViewer({ imageUris, initialIndex })
        }
        colors={colors}
      />
    ),
    [handleLike, handleToggleSave, currentUserId, colors]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBg }]} edges={["top"]}>
      <StatusBar barStyle={colors.statusBar} />

      <View style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: scale(16),
              paddingTop: vscale(8),
              paddingBottom: vscale(6),
            },
          ]}
        >
          <View style={styles.headerCopy}>
            <Text
              style={[
                styles.headerTitle,
                { color: colors.textDark, fontSize: scale(28), letterSpacing: 0.2 },
              ]}
            >
              Community
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                { color: colors.muted, marginTop: vscale(4), fontSize: scale(13) },
              ]}
            >
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
                    <Text style={[styles.createPromptTitle, { color: colors.textDark }]}>
                      Start a post
                    </Text>
                    <View style={styles.createPromptRow}>
                      <AvatarImage uri={userAvatar} size={34} name={currentUserName} seed={currentUserId} />
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
                  {emptyState.title}
                </Text>
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  {emptyState.text}
                </Text>
              </View>
            }
          />
        )}

        {/* Bottom nav */}
        {renderNav ? (
          renderNav({
            activeTab,
            onTabPress: handleTab,
            navHeight,
            paddingBottom: bottomPad,
            chevronBottom,
          })
        ) : (
          <BottomNavBar
            activeTab={activeTab}
            onTabPress={handleTab}
            navHeight={navHeight}
            paddingBottom={bottomPad}
            chevronBottom={chevronBottom}
          />
        )}
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
        onReactToComment={handleReactToComment}
        colors={colors}
      />

      <EditPostModal
        visible={!!editingPost}
        initialContent={editingPost?.content ?? ""}
        onClose={() => setEditingPostId(null)}
        onSubmit={async (content) => {
          if (!editingPost) return;
          await handleUpdatePost(editingPost._id, content);
        }}
        colors={colors}
      />

      <PostOptionsModal
        visible={!!optionsPost}
        canEdit={optionsPost?.user._id === currentUserId}
        canDelete={optionsPost?.user._id === currentUserId}
        onClose={() => setPostOptionsPostId(null)}
        onEdit={() => {
          if (!optionsPost) return;
          setPostOptionsPostId(null);
          setEditingPostId(optionsPost._id);
        }}
        onDelete={() => {
          if (!optionsPost) return;
          setPostOptionsPostId(null);
          setDeletePostConfirmId(optionsPost._id);
        }}
        colors={colors}
      />

      <LogoutModal
        visible={!!deleteConfirmPost}
        onCancel={() => setDeletePostConfirmId(null)}
        onConfirm={() => {
          const postId = deleteConfirmPost?._id;
          setDeletePostConfirmId(null);
          if (postId) {
            void handleDeletePost(postId);
          }
        }}
        title="Delete Post"
        message="Are you sure you want to delete this post?"
        confirmLabel="Delete Post"
        confirmColor="#DC2626"
      />

      <SavedModal
        visible={postDeletedModalVisible}
        title="Post deleted"
        message=""
        hideButton
        autoCloseMs={1400}
        onClose={() => setPostDeletedModalVisible(false)}
      />

      <ExpandedImageModal
        visible={!!expandedImageViewer}
        imageUris={expandedImageViewer?.imageUris ?? []}
        initialIndex={expandedImageViewer?.initialIndex ?? 0}
        onClose={() => setExpandedImageViewer(null)}
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
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontWeight: "900" },
  headerSubtitle: { fontWeight: "400" },

  /* Loading */
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* List */
  listContent: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
  },

  /* Create bar */
  createBar: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  createBarLeft: { flex: 1 },
  createPromptRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  createPromptTitle: { fontSize: 14, fontWeight: "700", marginBottom: 8, marginLeft: 44 },
  createPromptText: { fontSize: 13, fontWeight: "500" },
  createInputPlaceholder: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  /* Filters */
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
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
  postImageButton: { position: "relative" },
  postImage: { width: "100%", height: 220 },
  postGalleryWrap: {
    paddingBottom: 4,
  },
  postGalleryRow: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 10,
  },
  postGalleryItem: {
    position: "relative",
    width: 220,
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
  },
  postGalleryImage: {
    width: "100%",
    height: "100%",
  },
  expandImageBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  expandImageText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
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
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "88%",
    borderWidth: 1,
    overflow: "hidden",
  },
  modalBodyScroll: {
    flexShrink: 1,
  },
  modalBodyContent: {
    paddingBottom: 4,
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
    paddingTop: 14,
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 8,
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
  photoPreviewTitle: { fontSize: 12, fontWeight: "700", marginBottom: 10 },
  photoPreviewRow: { gap: 10, paddingRight: 14 },
  photoPreviewItem: { position: "relative" },
  photoPreview: { width: 148, height: 148, borderRadius: 14, borderWidth: 1 },
  removePhoto: { position: "absolute", top: 6, right: 6 },
  composeActions: {
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: 12,
    paddingLeft: 60,
    paddingRight: 14,
    gap: 20,
  },
  composeActionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  composeActionLabel: { fontSize: 13, fontWeight: "600" },
  editPostBody: {
    padding: 14,
  },
  editPostInput: {
    minHeight: 180,
    fontSize: 15,
    textAlignVertical: "top",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  centerModalRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  centerModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  postOptionsCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
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
  postOptionsTitle: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 18,
  },
  postOptionsActions: {
    gap: 10,
  },
  postOptionBtn: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  postOptionBtnDanger: {
    backgroundColor: "#FEF2F2",
  },
  postOptionLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  postOptionDangerLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#DC2626",
  },

  /* Comments modal */
  commentsModalContent: {
    width: "100%",
    maxWidth: 720,
    maxHeight: 720,
    alignSelf: "center",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    height: "70%",
    borderWidth: 1,
    overflow: "hidden",
  },
  commentThread: {
    marginBottom: 12,
  },
  commentItem: {
    flexDirection: "row",
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
  commentActionsRow: {
    marginTop: 4,
    marginLeft: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  replyBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  commentReactionSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  commentReactionEmojis: {
    fontSize: 12,
  },
  commentReactionCount: {
    fontSize: 11,
    fontWeight: "700",
  },
  reactionPickerWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: 8,
    marginLeft: 40,
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 4,
  },
  reactionPickerItem: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionPickerItemActive: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  reactionPickerEmoji: {
    fontSize: 24,
  },
  replyList: {
    marginTop: 8,
    marginLeft: 40,
    gap: 8,
  },
  replyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  replyBubble: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
  },
  commentInputRow: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyTargetBar: {
    flexDirection: "row",
    padding: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  replyTargetText: {
    fontSize: 12,
    fontWeight: "700",
  },
  commentComposerRow: {
    flexDirection: "row",
    alignItems: "center",
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

  /* Expanded image modal */
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.96)",
  },
  imageViewerCloseBtn: {
    position: "absolute",
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    zIndex: 2,
  },
  imageViewerTopBar: {
    position: "absolute",
    left: 16,
    right: 72,
    alignItems: "flex-start",
    zIndex: 2,
  },
  imageViewerCounter: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  imageViewerBody: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerScroll: {
    width: "100%",
    flex: 1,
  },
  imageViewerScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerLoader: {
    position: "absolute",
    zIndex: 1,
  },
  imageViewerNavBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  imageViewerNavLeft: {
    left: 8,
  },
  imageViewerNavRight: {
    right: 8,
  },
  imageViewerNavBtnDisabled: {
    opacity: 0.35,
  },
  imageViewerHint: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "600",
  },
  expandedImage: {
    width: "100%",
    height: "100%",
  },
});
