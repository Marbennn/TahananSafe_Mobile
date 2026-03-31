// src/api/community.ts
import { apiUrl } from "../config/api";
import { getAccessToken } from "../auth/session";
import { requestJson } from "./http";

export interface CommunityUser {
  _id: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  role?: string;
}

export interface Comment {
  _id: string;
  user: CommunityUser;
  text: string;
  reactions: Record<string, number>;
  reactionsCount: number;
  myReaction?: string;
  replies: CommentReply[];
  createdAt: string;
}

export interface CommentReply {
  _id: string;
  user: CommunityUser;
  text: string;
  createdAt: string;
}

export interface CommunityPost {
  _id: string;
  user: CommunityUser;
  content: string;
  imageUrl?: string;
  imageUrls: string[];
  likes: string[];
  likesCount?: number;
  likedByMe?: boolean;
  savesCount?: number;
  savedByMe?: boolean;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data as T;
}

function unwrapPayload<T = any>(data: any, keys: string[] = []): T {
  if (data == null) return data as T;

  for (const key of keys) {
    if (data?.[key] != null) return data[key] as T;
  }

  if (data?.data != null) {
    for (const key of keys) {
      if (data.data?.[key] != null) return data.data[key] as T;
    }
  }

  return data as T;
}

function normalizeImageUrl(input: any): string | undefined {
  if (!input) return undefined;

  const raw =
    typeof input === "string"
      ? input.trim()
      : typeof input?.url === "string"
        ? input.url.trim()
        : typeof input?.uri === "string"
          ? input.uri.trim()
          : "";

  if (!raw) return undefined;

  if (
    raw.startsWith("data:") ||
    raw.startsWith("file:") ||
    raw.startsWith("content://")
  ) {
    return raw;
  }

  if (raw.startsWith("/")) return apiUrl(raw);

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    if (raw.includes("localhost") || raw.includes("127.0.0.1")) {
      try {
        const parsed = new URL(raw);
        return apiUrl(`${parsed.pathname}${parsed.search}`);
      } catch {
        return apiUrl(raw);
      }
    }
    return raw;
  }

  return apiUrl(`/${raw.replace(/^\/+/, "")}`);
}

function normalizeImageUrls(...inputs: any[]): string[] {
  const urls: string[] = [];

  const append = (value: any) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }

    const normalized = normalizeImageUrl(value);
    if (normalized && !urls.includes(normalized)) {
      urls.push(normalized);
    }
  };

  inputs.forEach(append);
  return urls;
}

function normalizeUser(raw: any): CommunityUser {
  const fullName = String(raw?.name || "").trim();
  const firstName =
    raw?.firstName ||
    raw?.givenName ||
    (fullName ? fullName.split(/\s+/)[0] : "User");
  const lastName =
    raw?.lastName ||
    raw?.familyName ||
    (fullName ? fullName.split(/\s+/).slice(1).join(" ") : "");

  return {
    _id: String(raw?._id || raw?.id || raw?.userId || ""),
    firstName: String(firstName || "User"),
    lastName: String(lastName || ""),
    profileImage: normalizeImageUrl(
      raw?.profileImage || raw?.avatar || raw?.avatarUrl || raw?.photo
    ),
    role: raw?.role ? String(raw.role) : undefined,
  };
}

function normalizeLikeIds(rawLikes: any): string[] {
  if (!Array.isArray(rawLikes)) return [];

  return rawLikes
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (typeof entry === "number") return String(entry);
      if (entry && typeof entry === "object") {
        return String(entry._id || entry.id || entry.userId || "");
      }
      return "";
    })
    .filter(Boolean);
}

function normalizeComment(raw: any): Comment {
  const reactionCountsRaw = raw?.reactions && typeof raw.reactions === "object"
    ? raw.reactions
    : raw?.reactionCounts && typeof raw.reactionCounts === "object"
      ? raw.reactionCounts
      : {};
  const reactions: Record<string, number> = Object.fromEntries(
    Object.entries(reactionCountsRaw)
      .map(([type, count]) => [String(type), Number(count) || 0])
      .filter(([, count]) => Number(count) > 0)
  ) as Record<string, number>;

  return {
    _id: String(raw?._id || raw?.id || raw?.commentId || `${Date.now()}`),
    user: normalizeUser(raw?.user || raw?.author || raw?.createdBy || {}),
    text: String(raw?.text || raw?.content || raw?.body || ""),
    reactions,
    reactionsCount:
      typeof raw?.reactionsCount === "number"
        ? raw.reactionsCount
        : Object.values(reactions).reduce((sum, count) => sum + Number(count || 0), 0),
    myReaction: raw?.myReaction ? String(raw.myReaction) : undefined,
    replies: Array.isArray(raw?.replies)
      ? raw.replies.map((reply: any) => ({
          _id: String(reply?._id || reply?.id || `${Date.now()}-${Math.random()}`),
          user: normalizeUser(reply?.user || reply?.author || reply?.createdBy || {}),
          text: String(reply?.text || reply?.content || reply?.body || ""),
          createdAt: String(reply?.createdAt || reply?.updatedAt || new Date().toISOString()),
        }))
      : [],
    createdAt: String(raw?.createdAt || raw?.updatedAt || new Date().toISOString()),
  };
}

function normalizePost(raw: any): CommunityPost {
  const likes = normalizeLikeIds(raw?.likes || raw?.likedBy || raw?.reactions);
  const likesCountRaw = raw?.likesCount ?? raw?.likeCount ?? raw?.stats?.likes;
  const likedByMeRaw = raw?.likedByMe ?? raw?.liked ?? raw?.isLiked;
  const savesCountRaw = raw?.savesCount ?? raw?.saveCount ?? raw?.stats?.saves;
  const savedByMeRaw = raw?.savedByMe ?? raw?.saved ?? raw?.isSaved;
  const imageUrls = normalizeImageUrls(
    raw?.imageUrls,
    raw?.photoUrls,
    raw?.images,
    raw?.photos,
    raw?.attachments,
    raw?.media?.images,
    raw?.media?.photos,
    raw?.media,
    raw?.imageUrl,
    raw?.photoUrl,
    raw?.image,
    raw?.photo
  );

  return {
    _id: String(raw?._id || raw?.id || raw?.postId || ""),
    user: normalizeUser(raw?.user || raw?.author || raw?.createdBy || {}),
    content: String(raw?.content || raw?.text || raw?.body || ""),
    imageUrl: imageUrls[0],
    imageUrls,
    likes,
    likesCount:
      typeof likesCountRaw === "number" ? likesCountRaw : likes.length,
    likedByMe:
      typeof likedByMeRaw === "boolean" ? likedByMeRaw : undefined,
    savesCount:
      typeof savesCountRaw === "number" ? savesCountRaw : 0,
    savedByMe:
      typeof savedByMeRaw === "boolean" ? savedByMeRaw : undefined,
    comments: Array.isArray(raw?.comments)
      ? raw.comments.map(normalizeComment)
      : [],
    createdAt: String(raw?.createdAt || raw?.updatedAt || new Date().toISOString()),
    updatedAt: String(raw?.updatedAt || raw?.createdAt || new Date().toISOString()),
  };
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

function fileNameFromUri(uri: string) {
  const clean = uri.split("?")[0];
  const parts = clean.split("/");
  return parts[parts.length - 1] || "photo.jpg";
}

export async function fetchPosts(): Promise<CommunityPost[]> {
  const data = await requestJson<any>({
    method: "GET",
    path: "/api/mobile/v1/community/posts",
    auth: true,
  });

  const list = unwrapPayload<any[]>(data, ["posts", "items"]);
  return Array.isArray(list) ? list.map(normalizePost) : [];
}

export async function createPost(
  content: string,
  photoUris?: string[],
): Promise<CommunityPost> {
  const normalizedPhotoUris = Array.from(
    new Set((photoUris ?? []).map((uri) => String(uri || "").trim()).filter(Boolean))
  );

  if (normalizedPhotoUris.length > 5) {
    throw new Error("You can only upload up to 5 images.");
  }

  const uniquePhotoUris = normalizedPhotoUris.slice(0, 5);

  if (!uniquePhotoUris.length) {
    const data = await requestJson<any>({
      method: "POST",
      path: "/api/mobile/v1/community/posts",
      body: { content },
      auth: true,
    });
    return normalizePost(unwrapPayload(data, ["post", "item"]));
  }

  const headers = await authHeaders();
  const form = new FormData();
  form.append("content", content);

  for (const photoUri of uniquePhotoUris) {
    const mime = guessMimeType(photoUri);
    if (!ALLOWED_IMAGE_TYPES.has(mime)) {
      throw new Error("Unsupported image type. Use JPEG, PNG, WebP, or HEIC.");
    }

    form.append(uniquePhotoUris.length === 1 ? "photo" : "photos", {
      uri: photoUri,
      name: fileNameFromUri(photoUri),
      type: mime,
    } as any);
  }

  const res = await fetch(apiUrl("/api/mobile/v1/community/posts"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...headers,
    },
    body: form,
  });

  const data = await handleResponse<any>(res);
  return normalizePost(unwrapPayload(data, ["post", "item"]));
}

export async function toggleLike(
  postId: string
): Promise<{ liked: boolean; likesCount: number }> {
  const data = await requestJson<any>({
    method: "POST",
    path: `/api/mobile/v1/community/posts/${postId}/like`,
    auth: true,
  });

  const payload = unwrapPayload<any>(data, ["result", "like"]);
  return {
    liked: Boolean(
      payload?.liked ?? payload?.isLiked ?? payload?.post?.likedByMe
    ),
    likesCount: Number(
      payload?.likesCount ??
        payload?.likeCount ??
        payload?.post?.likesCount ??
        payload?.post?.likeCount ??
        0
    ),
  };
}

export async function addComment(
  postId: string,
  text: string,
  parentCommentId?: string,
): Promise<CommunityPost> {
  const data = await requestJson<any>({
    method: "POST",
    path: `/api/mobile/v1/community/posts/${postId}/comments`,
    body: parentCommentId ? { text, parentCommentId } : { text },
    auth: true,
  });

  return normalizePost(unwrapPayload(data, ["post", "item"]));
}

export async function reactToComment(
  postId: string,
  commentId: string,
  reaction: string,
): Promise<CommunityPost> {
  const data = await requestJson<any>({
    method: "POST",
    path: `/api/mobile/v1/community/posts/${postId}/comments/${commentId}/reactions`,
    body: { reaction },
    auth: true,
  });

  return normalizePost(unwrapPayload(data, ["post", "item"]));
}

export async function toggleSavePost(postId: string): Promise<CommunityPost> {
  const data = await requestJson<any>({
    method: "POST",
    path: `/api/mobile/v1/community/posts/${postId}/save`,
    auth: true,
  });

  return normalizePost(unwrapPayload(data, ["post", "item"]));
}

export async function updatePost(
  postId: string,
  content: string,
): Promise<CommunityPost> {
  const data = await requestJson<any>({
    method: "PUT",
    path: `/api/mobile/v1/community/posts/${postId}`,
    body: { content },
    auth: true,
  });

  return normalizePost(unwrapPayload(data, ["post", "item"]));
}

export async function deletePost(postId: string): Promise<void> {
  await requestJson<any>({
    method: "DELETE",
    path: `/api/mobile/v1/community/posts/${postId}`,
    auth: true,
  });
}
