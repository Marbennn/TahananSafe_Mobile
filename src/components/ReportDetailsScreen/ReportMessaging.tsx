import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  deleteReportThreadMessage,
  fetchReportThreads,
  fetchReportTyping,
  sendReportThreadMessage,
  setReportTyping,
  ThreadDto,
  updateReportThreadMessage,
} from "../../api/reports";
import { fetchMyNotifications, toggleNotificationRead } from "../../api/notifications";
import { useColors } from "../../theme/colors";
import LogoutModal from "../LogoutModal";
import ReportContextPanel, {
  type ReportContextData,
} from "./ReportContextPanel";

const RESPONDER_LABEL = "Barangay Admin";
const POLL_MS = 4000;
const BUBBLE_MEASUREMENT_VERSION = 3;
const BALANCED_MESSAGE_MIN_LENGTH = 33;

type ThreadMessage = {
  id: string;
  side: "left" | "right";
  sender?: string;
  text: string;
  time: string;
  createdAtMs?: number;
  editedAt?: string | null;
  deletedAt?: string | null;
  deletedByRole?: "resident" | "staff" | null;
  replyTo?: {
    threadId?: string | null;
    sender?: string;
    side: "left" | "right";
    text: string;
  } | null;
  pending?: boolean;
};

type BubbleMeasurement = {
  version: number;
  text: string;
  maxWidth: number;
  fontScale: number;
  width: number;
};

type Props = {
  reportId: string;
  canChat: boolean;
  reportStatus: string;
  reportContext?: ReportContextData;
  onContextPress?: () => void;
  autoOpen?: boolean;
  hideFab?: boolean;
  modalTitle?: string;
  onModalClose?: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isAbortError(error: any) {
  const name = error?.name || "";
  const message = String(error?.message || "");
  return name === "AbortError" || message.toLowerCase().includes("aborted");
}

function formatStamp(date: Date) {
  return date.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatThreadMeta(message: ThreadMessage) {
  if (message.pending) return "Sending...";
  return message.editedAt ? `${message.time} • Edited` : message.time;
}

function formatChatTime(message: ThreadMessage) {
  if (message.pending) return "Sending";
  if (message.createdAtMs && Number.isFinite(message.createdAtMs)) {
    return new Date(message.createdAtMs).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const parts = String(message.time || "").split(",");
  return (parts[parts.length - 1] || message.time || "").trim();
}

function formatChatDayPill(message?: ThreadMessage) {
  if (!message?.createdAtMs || !Number.isFinite(message.createdAtMs)) return "Today";

  const date = new Date(message.createdAtMs);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const day = isToday
    ? "Today"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return `${day}, ${formatChatTime(message)}`;
}

function getThreadSenderLabel(message?: ThreadMessage | null) {
  if (!message) return RESPONDER_LABEL;
  return message.side === "right" ? "You" : message.sender || RESPONDER_LABEL;
}

function getReplyIndicatorText(message: ThreadMessage) {
  const targetLabel =
    message.replyTo?.sender ||
    (message.replyTo?.side === "right" ? "You" : RESPONDER_LABEL);
  const actorLabel =
    message.side === "right" ? "You" : message.sender || RESPONDER_LABEL;
  return `${actorLabel} replied to ${targetLabel}`;
}

function getDeletedMessageLabel(message: ThreadMessage) {
  return message.side === "right"
    ? "You deleted a message"
    : `${message.sender || RESPONDER_LABEL} deleted a message`;
}

function dtoToMessage(dto: ThreadDto): ThreadMessage {
  const isResident = dto.senderRole === "resident";
  const createdAtMs = dto.createdAt ? new Date(dto.createdAt).getTime() : undefined;

  return {
    id: dto._id,
    side: isResident ? "right" : "left",
    sender: isResident ? undefined : RESPONDER_LABEL,
    text: dto.text,
    time: dto.createdAt ? formatStamp(new Date(dto.createdAt)) : "",
    createdAtMs,
    editedAt: dto.editedAt || null,
    deletedAt: dto.deletedAt || null,
    deletedByRole: dto.deletedByRole || null,
    replyTo: dto.replyTo
      ? {
          threadId: dto.replyTo.threadId || null,
          sender: dto.replyTo.senderRole === "resident" ? "You" : RESPONDER_LABEL,
          side: dto.replyTo.senderRole === "resident" ? "right" : "left",
          text: dto.replyTo.text || "",
        }
      : null,
    pending: false,
  };
}

export default function ReportMessaging({
  reportId,
  canChat,
  reportStatus,
  reportContext,
  onContextPress,
  autoOpen = false,
  hideFab = false,
  modalTitle = "Messages",
  onModalClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const themeColors = useColors();
  const isTablet = Math.min(width, height) >= 600;
  const isWideLayout = width >= 600;
  const widthScale = clamp(width / 375, 0.92, isTablet ? 1.08 : 1.18);
  const heightScale = clamp(height / 812, 0.92, isTablet ? 1.08 : 1.18);
  const scale = useCallback((value: number) => Math.round(value * widthScale), [widthScale]);
  const vscale = useCallback((value: number) => Math.round(value * heightScale), [heightScale]);
  const primary = String(themeColors.primary || "#07519C");
  const modalPanelWidth = Math.round(Math.min(width * 0.92, scale(520)));
  const contentMaxWidth = isWideLayout ? Math.min(720, Math.round(width * 0.92)) : width;

  const styles = useMemo(
    () =>
      makeStyles({
        scale,
        vscale,
        primary,
        isDark: themeColors.isDark,
        isTablet,
        contentMaxWidth,
      }),
    [contentMaxWidth, isTablet, primary, scale, themeColors.isDark, vscale]
  );

  const [visible, setVisible] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState<ThreadMessage | null>(null);
  const [visibleMessageMetaId, setVisibleMessageMetaId] = useState("");
  const [messageMenuVisible, setMessageMenuVisible] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [deleteMessageModalVisible, setDeleteMessageModalVisible] = useState(false);
  const [deleteTargetMessageId, setDeleteTargetMessageId] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [sending, setSending] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [bubbleMeasurements, setBubbleMeasurements] = useState<
    Record<string, BubbleMeasurement>
  >({});
  const [threadsError, setThreadsError] = useState("");
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [activePanel, setActivePanel] = useState<"messages" | "context">(
    "messages"
  );

  const contextSlide = useRef(new Animated.Value(0)).current;
  const messageDotAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const threadScrollRef = useRef<ScrollView | null>(null);
  const composerInputRef = useRef<TextInput | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preEditDraftRef = useRef("");
  const threadsAbortRef = useRef<AbortController | null>(null);
  const threadsInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const isAtBottomRef = useRef(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pendingOptimisticRef = useRef<
    Map<string, { text: string; createdAtMs: number; side: "left" | "right" }>
  >(new Map());

  const selectedMessage = useMemo(
    () => messages.find((message) => message.id === selectedMessageId) ?? null,
    [messages, selectedMessageId]
  );
  const editingMessage = useMemo(
    () => messages.find((message) => message.id === editingMessageId) ?? null,
    [editingMessageId, messages]
  );
  const lastIncomingMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].side === "left") return messages[index];
    }
    return null;
  }, [messages]);

  const composerBaseBottomPadding = Math.max(insets.bottom, vscale(6));
  const composerBottomPadding =
    Platform.OS === "android" && isKeyboardVisible ? vscale(4) : composerBaseBottomPadding;
  const chatContentWidth = Math.max(modalPanelWidth - scale(44), scale(120));
  const threadBubbleMaxWidth = Math.round(
    chatContentWidth * (isTablet ? 0.66 : 0.78)
  );
  const messagesTranslateX = contextSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -modalPanelWidth],
    extrapolate: "clamp",
  });
  const contextTranslateX = contextSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [modalPanelWidth, 0],
    extrapolate: "clamp",
  });

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      threadsAbortRef.current?.abort();
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const refreshMessageNotifications = useCallback(async () => {
    if (!reportId) return;

    try {
      const notifications = await fetchMyNotifications(80);
      const unreadCount = notifications.filter(
        (item) =>
          item.type === "thread" &&
          item.unread &&
          String(item.incidentId || "") === String(reportId)
      ).length;
      if (mountedRef.current) setNewMessageCount(unreadCount);
    } catch {
      // Notification polling should not interrupt the report screen.
    }
  }, [reportId]);

  useEffect(() => {
    if (!reportId || visible) return;

    void refreshMessageNotifications();
    const timer = setInterval(() => {
      void refreshMessageNotifications();
    }, 5000);

    return () => clearInterval(timer);
  }, [refreshMessageNotifications, reportId, visible]);

  useEffect(() => {
    if (!reportId) {
      setAdminTyping(false);
      return;
    }

    let active = true;
    const pollTyping = async () => {
      try {
        const status = await fetchReportTyping(reportId);
        if (active) setAdminTyping(status.isTyping && status.role === "staff");
      } catch {
        if (active) setAdminTyping(false);
      }
    };

    void pollTyping();
    const timer = setInterval(() => {
      void pollTyping();
    }, 1000);

    return () => {
      active = false;
      clearInterval(timer);
      setAdminTyping(false);
    };
  }, [reportId]);

  const hasMessageIndicator = newMessageCount > 0 || adminTyping;
  useEffect(() => {
    if (!hasMessageIndicator) {
      messageDotAnimations.forEach((dot) => dot.setValue(0));
      return;
    }

    const loops = messageDotAnimations.map((dot, index) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(dot, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.delay(700),
        ])
      );
      loop.start();
      return loop;
    });

    return () => loops.forEach((loop) => loop.stop());
  }, [hasMessageIndicator, messageDotAnimations]);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      threadScrollRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const findMatchingServerMessage = useCallback(
    (
      optimistic: { text: string; createdAtMs: number; side: "left" | "right" },
      serverMessages: ThreadMessage[]
    ) => {
      const windowMs = 8000;
      const wantedText = optimistic.text.trim();
      if (!wantedText) return null;

      let best: ThreadMessage | null = null;
      let bestDelta = Number.POSITIVE_INFINITY;

      for (const message of serverMessages) {
        if (message.side !== optimistic.side || message.pending) continue;
        if (message.text.trim() !== wantedText) continue;
        const timestamp = message.createdAtMs ?? 0;
        if (!timestamp) continue;
        const delta = Math.abs(timestamp - optimistic.createdAtMs);
        if (delta <= windowMs && delta < bestDelta) {
          best = message;
          bestDelta = delta;
        }
      }

      return best;
    },
    []
  );

  const mergeThreadDtos = useCallback(
    (list: ThreadDto[]) => {
      const incoming = (list || []).map(dtoToMessage);

      setMessages((previous) => {
        const pendingMap = pendingOptimisticRef.current;
        const previousFiltered: ThreadMessage[] = [];

        for (const message of previous) {
          if (message.pending && pendingMap.has(message.id)) {
            const metadata = pendingMap.get(message.id)!;
            const match = findMatchingServerMessage(metadata, incoming);
            if (match) {
              pendingMap.delete(message.id);
              continue;
            }
          }
          previousFiltered.push(message);
        }

        const messageMap = new Map<string, ThreadMessage>();
        previousFiltered.forEach((message) => messageMap.set(message.id, message));
        incoming.forEach((message) => messageMap.set(message.id, message));

        const merged = Array.from(messageMap.values()).sort((a, b) => {
          const first = a.createdAtMs ?? 0;
          const second = b.createdAtMs ?? 0;
          return first !== second ? first - second : a.id.localeCompare(b.id);
        });

        const added = merged.length - previous.length;
        if (added > 0 && !isAtBottomRef.current) {
          setNewMessageCount((count) => count + added);
        }
        if (added > 0 && isAtBottomRef.current) {
          setTimeout(() => scrollToBottom(true), 60);
        }

        return merged;
      });
    },
    [findMatchingServerMessage, scrollToBottom]
  );

  const refreshThreads = useCallback(
    async (options?: { showLoader?: boolean }) => {
      if (!reportId || threadsInFlightRef.current) return;

      threadsAbortRef.current?.abort();
      const controller = new AbortController();
      threadsAbortRef.current = controller;
      threadsInFlightRef.current = true;
      if (options?.showLoader) setLoadingThreads(true);
      setThreadsError("");

      try {
        const list = await fetchReportThreads(reportId, controller.signal);
        if (!mountedRef.current || controller.signal.aborted) return;
        mergeThreadDtos(list || []);
      } catch (error: any) {
        if (!mountedRef.current || isAbortError(error)) return;
        setThreadsError(error?.message || "Failed to load threads");
      } finally {
        if (mountedRef.current && !controller.signal.aborted) setLoadingThreads(false);
        threadsInFlightRef.current = false;
      }
    },
    [mergeThreadDtos, reportId]
  );

  const stopPolling = useCallback(() => {
    if (!pollTimerRef.current) return;
    clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    if (!reportId || !visible || appStateRef.current !== "active") return;

    void refreshThreads({ showLoader: messages.length === 0 });
    pollTimerRef.current = setInterval(() => {
      void refreshThreads({ showLoader: false });
    }, POLL_MS);
  }, [messages.length, refreshThreads, reportId, stopPolling, visible]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      if (nextState === "active") startPolling();
      else stopPolling();
    });

    return () => subscription.remove();
  }, [startPolling, stopPolling]);

  useEffect(() => {
    if (visible) {
      startPolling();
    } else {
      stopPolling();
      threadsAbortRef.current?.abort();
    }

    return stopPolling;
  }, [reportId, startPolling, stopPolling, visible]);

  useEffect(() => {
    threadsAbortRef.current?.abort();
    threadsInFlightRef.current = false;
    pendingOptimisticRef.current.clear();
    preEditDraftRef.current = "";
    isAtBottomRef.current = true;

    setVisible(false);
    setMessages([]);
    setBubbleMeasurements({});
    setThreadsError("");
    setLoadingThreads(false);
    setNewMessageCount(0);
    setDraft("");
    setEditingMessageId("");
    setReplyingToMessage(null);
    setVisibleMessageMetaId("");
    setSelectedMessageId("");
    setMessageMenuVisible(false);
    setDeleteMessageModalVisible(false);
    setDeleteTargetMessageId("");
    setIsKeyboardVisible(false);
    setActivePanel("messages");
    contextSlide.stopAnimation();
    contextSlide.setValue(0);
  }, [contextSlide, reportId]);

  const publishTypingStatus = useCallback(
    (isTyping: boolean) => {
      if (!reportId) return;
      void setReportTyping(reportId, isTyping).catch(() => {});
    },
    [reportId]
  );

  useEffect(
    () => () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      publishTypingStatus(false);
    },
    [publishTypingStatus]
  );

  useEffect(() => {
    if (!visible || !isKeyboardVisible) return;
    const timer = setTimeout(() => scrollToBottom(true), 60);
    return () => clearTimeout(timer);
  }, [isKeyboardVisible, scrollToBottom, visible]);

  const handleComposerTextChange = useCallback(
    (value: string) => {
      setDraft(value);

      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }

      const isTyping = value.trim().length > 0;
      publishTypingStatus(isTyping);
      if (isTyping) {
        typingStopTimerRef.current = setTimeout(() => {
          publishTypingStatus(false);
          typingStopTimerRef.current = null;
        }, 1200);
      }
    },
    [publishTypingStatus]
  );

  const sendThreadText = useCallback(
    async (
      rawText: string,
      options?: { manageDraft?: boolean; replyTo?: ThreadMessage | null }
    ) => {
      const text = rawText.trim();
      if (!text) return false;

      if (!reportId) {
        Alert.alert("Missing report id", "Cannot send message because reportId is empty.");
        return false;
      }
      if (sending) return false;

      publishTypingStatus(false);
      setSending(true);

      const createdAtMs = Date.now();
      const temporaryId = `tmp_${createdAtMs}`;
      const optimistic: ThreadMessage = {
        id: temporaryId,
        side: "right",
        text,
        time: formatStamp(new Date()),
        createdAtMs,
        replyTo: options?.replyTo
          ? {
              threadId: options.replyTo.id,
              sender: getThreadSenderLabel(options.replyTo),
              side: options.replyTo.side,
              text: options.replyTo.text,
            }
          : null,
        pending: true,
      };

      pendingOptimisticRef.current.set(temporaryId, {
        text,
        createdAtMs,
        side: "right",
      });
      isAtBottomRef.current = true;
      setNewMessageCount(0);
      setMessages((previous) => [...previous, optimistic]);
      if (options?.manageDraft) setDraft("");
      setTimeout(() => scrollToBottom(true), 60);

      try {
        await sendReportThreadMessage(
          reportId,
          { text, replyToThreadId: options?.replyTo?.id || undefined }
        );
        await refreshThreads({ showLoader: false });
        setTimeout(() => {
          setMessages((previous) => {
            if (pendingOptimisticRef.current.has(temporaryId)) {
              void refreshThreads({ showLoader: false });
            }
            return previous;
          });
        }, 800);
        return true;
      } catch (error: any) {
        if (!isAbortError(error)) {
          Alert.alert("Send failed", error?.message || "Could not send message.");
        }
        pendingOptimisticRef.current.delete(temporaryId);
        setMessages((previous) =>
          previous.filter((message) => message.id !== temporaryId)
        );
        if (options?.manageDraft) setDraft(text);
        return false;
      } finally {
        setSending(false);
      }
    },
    [publishTypingStatus, refreshThreads, reportId, scrollToBottom, sending]
  );

  const updateThreadText = useCallback(
    async (messageId: string, rawText: string) => {
      const text = rawText.trim();
      if (!text) return false;

      if (!reportId) {
        Alert.alert("Missing report id", "Cannot edit message because reportId is empty.");
        return false;
      }
      if (sending) return false;

      setSending(true);
      try {
        const data = await updateReportThreadMessage(reportId, messageId, text);
        const updatedThread = data?.thread as ThreadDto | undefined;
        if (updatedThread?._id) {
          const updatedMessage = dtoToMessage(updatedThread);
          setMessages((previous) =>
            previous.map((message) =>
              message.id === updatedMessage.id ? updatedMessage : message
            )
          );
        } else {
          await refreshThreads({ showLoader: false });
        }
        return true;
      } catch (error: any) {
        if (!isAbortError(error)) {
          Alert.alert("Edit failed", error?.message || "Could not edit message.");
        }
        return false;
      } finally {
        setSending(false);
      }
    },
    [refreshThreads, reportId, sending]
  );

  const deleteThreadText = useCallback(
    async (messageId: string) => {
      if (!reportId) {
        Alert.alert("Missing report id", "Cannot delete message because reportId is empty.");
        return false;
      }
      if (sending) return false;

      setSending(true);
      try {
        const data = await deleteReportThreadMessage(reportId, messageId);
        const deletedThread = data?.thread as ThreadDto | undefined;
        if (deletedThread?._id) {
          const deletedMessage = dtoToMessage(deletedThread);
          setMessages((previous) =>
            previous.map((message) =>
              message.id === deletedMessage.id ? deletedMessage : message
            )
          );
        } else {
          setMessages((previous) =>
            previous.filter((message) => message.id !== messageId)
          );
        }

        if (editingMessageId === messageId) {
          preEditDraftRef.current = "";
          setEditingMessageId("");
          setDraft("");
        }
        if (visibleMessageMetaId === messageId) setVisibleMessageMetaId("");
        if (replyingToMessage?.id === messageId) setReplyingToMessage(null);
        return true;
      } catch (error: any) {
        if (!isAbortError(error)) {
          Alert.alert("Delete failed", error?.message || "Could not delete message.");
        }
        return false;
      } finally {
        setSending(false);
      }
    },
    [editingMessageId, replyingToMessage, reportId, sending, visibleMessageMetaId]
  );

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;

    if (editingMessageId) {
      const updated = await updateThreadText(editingMessageId, text);
      if (updated) {
        const restoredDraft = preEditDraftRef.current;
        preEditDraftRef.current = "";
        setEditingMessageId("");
        setDraft(restoredDraft);
      }
      return;
    }

    const sent = await sendThreadText(text, {
      manageDraft: true,
      replyTo: replyingToMessage,
    });
    if (sent) setReplyingToMessage(null);
  }, [draft, editingMessageId, replyingToMessage, sendThreadText, updateThreadText]);

  const closeMessageMenu = useCallback(() => {
    setMessageMenuVisible(false);
    setSelectedMessageId("");
  }, []);

  const openMessageMenu = useCallback(
    (message: ThreadMessage) => {
      if (!canChat || message.pending || message.deletedAt) return;
      Keyboard.dismiss();
      setSelectedMessageId(message.id);
      setMessageMenuVisible(true);
    },
    [canChat]
  );

  const toggleMessageMeta = useCallback((messageId: string) => {
    setVisibleMessageMetaId((previous) => (previous === messageId ? "" : messageId));
  }, []);

  const handleQuickReply = useCallback(
    (target?: ThreadMessage | null) => {
      if (!canChat) return;

      if (editingMessageId) {
        const restoredDraft = preEditDraftRef.current;
        preEditDraftRef.current = "";
        setEditingMessageId("");
        setDraft(restoredDraft);
      }

      setReplyingToMessage(target || lastIncomingMessage || null);
      closeMessageMenu();
      setTimeout(() => {
        composerInputRef.current?.focus();
        scrollToBottom(true);
      }, 60);
    },
    [canChat, closeMessageMenu, editingMessageId, lastIncomingMessage, scrollToBottom]
  );

  const handleEditSelectedMessage = useCallback(
    (message: ThreadMessage | null) => {
      if (!message || message.side !== "right" || message.pending || !canChat) return;

      if (!editingMessageId) preEditDraftRef.current = draft;
      setReplyingToMessage(null);
      setEditingMessageId(message.id);
      setDraft(message.text);
      closeMessageMenu();
      setTimeout(() => {
        composerInputRef.current?.focus();
        scrollToBottom(true);
      }, 60);
    },
    [canChat, closeMessageMenu, draft, editingMessageId, scrollToBottom]
  );

  const requestDeleteSelectedMessage = useCallback(() => {
    if (!selectedMessage || selectedMessage.side !== "right" || selectedMessage.pending) return;
    setDeleteTargetMessageId(selectedMessage.id);
    setDeleteMessageModalVisible(true);
    closeMessageMenu();
  }, [closeMessageMenu, selectedMessage]);

  const closeDeleteMessageModal = useCallback(() => {
    setDeleteMessageModalVisible(false);
    setDeleteTargetMessageId("");
  }, []);

  const confirmDeleteMessage = useCallback(() => {
    const messageId = deleteTargetMessageId;
    setDeleteMessageModalVisible(false);
    setDeleteTargetMessageId("");
    if (messageId) void deleteThreadText(messageId);
  }, [deleteTargetMessageId, deleteThreadText]);

  const cancelEditingMessage = useCallback(() => {
    const restoredDraft = preEditDraftRef.current;
    preEditDraftRef.current = "";
    setEditingMessageId("");
    setDraft(restoredDraft);
  }, []);

  const cancelReplyMessage = useCallback(() => {
    setReplyingToMessage(null);
  }, []);

  const openReportContext = useCallback(() => {
    Keyboard.dismiss();
    setIsKeyboardVisible(false);
    publishTypingStatus(false);
    closeMessageMenu();

    if (!reportContext) {
      onContextPress?.();
      return;
    }

    contextSlide.stopAnimation();
    setActivePanel("context");
    Animated.timing(contextSlide, {
      toValue: 1,
      duration: 330,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [
    closeMessageMenu,
    contextSlide,
    onContextPress,
    publishTypingStatus,
    reportContext,
  ]);

  const returnToMessages = useCallback(() => {
    contextSlide.stopAnimation();
    setActivePanel("messages");
    Animated.timing(contextSlide, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contextSlide]);

  const openMessages = useCallback(async () => {
    setNewMessageCount(0);
    setActivePanel("messages");
    contextSlide.stopAnimation();
    contextSlide.setValue(0);
    setVisible(true);

    try {
      const notifications = await fetchMyNotifications(80);
      const unreadThreadNotifications = notifications.filter(
        (item) =>
          item.type === "thread" &&
          item.unread &&
          String(item.incidentId || "") === String(reportId)
      );
      await Promise.all(
        unreadThreadNotifications.map((item) => toggleNotificationRead(item.id))
      );
    } catch {
      // The messages modal remains usable if acknowledgement fails.
    }
  }, [contextSlide, reportId]);

  const closeMessages = useCallback(() => {
    Keyboard.dismiss();
    setIsKeyboardVisible(false);
    publishTypingStatus(false);
    closeMessageMenu();
    setActivePanel("messages");
    contextSlide.stopAnimation();
    contextSlide.setValue(0);
    setVisible(false);
    onModalClose?.();
  }, [
    closeMessageMenu,
    contextSlide,
    onModalClose,
    publishTypingStatus,
  ]);

  const handleMessageModalBack = useCallback(() => {
    if (activePanel === "context") {
      returnToMessages();
      return;
    }
    closeMessages();
  }, [activePanel, closeMessages, returnToMessages]);

  useEffect(() => {
    if (!autoOpen || !reportId) return;
    void openMessages();
  }, [autoOpen, openMessages, reportId]);

  const updateBubbleMeasurement = useCallback(
    (messageId: string, text: string, lineWidths: number[]) => {
      const validWidths = lineWidths.filter(
        (lineWidth) => Number.isFinite(lineWidth) && lineWidth > 0
      );
      if (!messageId || !validWidths.length) return;

      const horizontalChrome = scale(14) * 2 + 2;
      const layoutSlack = scale(4);
      const singleLineWidth =
        Math.ceil(validWidths.reduce((total, lineWidth) => total + lineWidth, 0)) +
        horizontalChrome +
        layoutSlack * validWidths.length;
      const widestLineWidth =
        Math.ceil(Math.max(...validWidths)) + horizontalChrome + layoutSlack;
      const canFitOnOneLine =
        !/[\r\n]/.test(text) && singleLineWidth <= threadBubbleMaxWidth;
      const nextWidth = clamp(
        canFitOnOneLine ? singleLineWidth : widestLineWidth,
        scale(42),
        threadBubbleMaxWidth
      );

      setBubbleMeasurements((previous) => {
        const current = previous[messageId];
        if (
          current?.version === BUBBLE_MEASUREMENT_VERSION &&
          current?.text === text &&
          current.maxWidth === threadBubbleMaxWidth &&
          current.fontScale === fontScale &&
          current.width === nextWidth
        ) {
          return previous;
        }

        return {
          ...previous,
          [messageId]: {
            version: BUBBLE_MEASUREMENT_VERSION,
            text,
            maxWidth: threadBubbleMaxWidth,
            fontScale,
            width: nextWidth,
          },
        };
      });
    },
    [fontScale, scale, threadBubbleMaxWidth]
  );

  const onChatScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      const atBottom = distanceFromBottom < 40;
      isAtBottomRef.current = atBottom;
      if (atBottom) setNewMessageCount(0);
    },
    []
  );

  useEffect(() => {
    if (messageMenuVisible && !selectedMessage) closeMessageMenu();
  }, [closeMessageMenu, messageMenuVisible, selectedMessage]);

  if (!reportId) return null;

  const selectedMessageCanReply = !!selectedMessage && !selectedMessage.deletedAt;
  const selectedMessageCanEdit =
    !!selectedMessage &&
    selectedMessage.side === "right" &&
    !selectedMessage.pending &&
    !selectedMessage.deletedAt;
  const selectedMessageCanDelete = selectedMessageCanEdit;

  return (
    <>
      <Modal
        visible={messageMenuVisible}
        animationType="fade"
        transparent
        onRequestClose={closeMessageMenu}
      >
        <View style={styles.threadMenuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMessageMenu} />
          {selectedMessage ? (
            <View style={styles.threadMenuShell} pointerEvents="box-none">
              <View
                style={[
                  styles.threadMenuPreviewRow,
                  selectedMessage.side === "right"
                    ? styles.threadMenuPreviewRowRight
                    : styles.threadMenuPreviewRowLeft,
                ]}
              >
                <View
                  style={[
                    styles.threadMenuPreviewBubble,
                    selectedMessage.side === "right"
                      ? styles.threadMenuPreviewBubbleRight
                      : styles.threadMenuPreviewBubbleLeft,
                  ]}
                >
                  <Text
                    numberOfLines={3}
                    style={[
                      styles.threadMenuPreviewText,
                      selectedMessage.side === "right"
                        ? styles.threadMenuPreviewTextRight
                        : styles.threadMenuPreviewTextLeft,
                    ]}
                  >
                    {selectedMessage.text}
                  </Text>
                </View>
              </View>

              <View style={styles.threadMenuCard}>
                {selectedMessageCanReply ? (
                  <Pressable
                    onPress={() => handleQuickReply(selectedMessage)}
                    style={({ pressed }) => [
                      styles.threadMenuAction,
                      !selectedMessageCanEdit &&
                        !selectedMessageCanDelete &&
                        styles.threadMenuActionLast,
                      pressed && styles.threadMenuActionPressed,
                    ]}
                  >
                    <Text style={styles.threadMenuActionText}>Reply</Text>
                    <Ionicons
                      name="arrow-undo"
                      size={styles._menuIcon}
                      color="#FFFFFF"
                    />
                  </Pressable>
                ) : null}

                {selectedMessageCanEdit ? (
                  <Pressable
                    onPress={() => handleEditSelectedMessage(selectedMessage)}
                    style={({ pressed }) => [
                      styles.threadMenuAction,
                      !selectedMessageCanDelete && styles.threadMenuActionLast,
                      pressed && styles.threadMenuActionPressed,
                    ]}
                  >
                    <Text style={styles.threadMenuActionText}>Edit</Text>
                    <Ionicons
                      name="create-outline"
                      size={styles._menuIcon}
                      color="#FFFFFF"
                    />
                  </Pressable>
                ) : null}

                {selectedMessageCanDelete ? (
                  <Pressable
                    onPress={requestDeleteSelectedMessage}
                    style={({ pressed }) => [
                      styles.threadMenuAction,
                      styles.threadMenuActionLast,
                      styles.threadMenuDeleteAction,
                      pressed && styles.threadMenuActionPressed,
                    ]}
                  >
                    <Text style={[styles.threadMenuActionText, styles.threadMenuDeleteText]}>
                      Delete
                    </Text>
                    <Ionicons
                      name="trash-outline"
                      size={styles._menuIcon}
                      color="#F87171"
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <LogoutModal
        visible={deleteMessageModalVisible}
        title="Delete message?"
        message="This will permanently remove this message from the thread."
        confirmLabel="Delete"
        confirmColor="#DC2626"
        onCancel={closeDeleteMessageModal}
        onConfirm={confirmDeleteMessage}
      />

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleMessageModalBack}
      >
        <View style={styles.messageModalLayer}>
          <Pressable style={styles.messageModalBackdrop} onPress={closeMessages} />
          <KeyboardAvoidingView
            pointerEvents="box-none"
            style={styles.messageModalRoot}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
          >
            <View style={styles.messageModalCard}>
            <View style={styles.messageModalHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close messages"
                onPress={closeMessages}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.messageModalClose,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="close" size={styles._miniIcon} color="#64748B" />
              </Pressable>

              <View
                style={styles.messageModalHeaderContent}
                accessibilityLabel={modalTitle}
              >
                {reportContext || onContextPress ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      activePanel === "context"
                        ? "Return to report messages"
                        : "Show report context"
                    }
                    onPress={() => {
                      if (activePanel === "context") {
                        returnToMessages();
                      } else {
                        openReportContext();
                      }
                    }}
                    style={({ pressed }) => [
                      styles.contextButton,
                      activePanel === "context" &&
                        styles.contextButtonMessages,
                      pressed && { opacity: 0.78 },
                    ]}
                  >
                    <Ionicons
                      name={
                        activePanel === "context"
                          ? "chatbubble-ellipses-outline"
                          : "information-circle-outline"
                      }
                      size={styles._contextIcon}
                      color={
                        activePanel === "context" ? "#FFFFFF" : primary
                      }
                    />
                    <Text
                      style={[
                        styles.contextButtonText,
                        activePanel === "context" &&
                          styles.contextButtonMessagesText,
                      ]}
                      allowFontScaling={false}
                    >
                      {activePanel === "context" ? "Messages" : "Context"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

            </View>

            <View style={styles.messageModalBody}>
              <Animated.View
                pointerEvents={
                  activePanel === "messages" ? "auto" : "none"
                }
                style={[
                  styles.messageSlidingPanel,
                  {
                    opacity: contextSlide.interpolate({
                      inputRange: [0, 0.85, 1],
                      outputRange: [1, 0.94, 0.78],
                      extrapolate: "clamp",
                    }),
                    transform: [{ translateX: messagesTranslateX }],
                  },
                ]}
              >
                <View style={styles.threadsKav}>
                  <View style={styles.threadsWrap}>
                {loadingThreads ? (
                  <View style={styles.bannerNeutral}>
                    <ActivityIndicator />
                    <Text style={styles.bannerNeutralText}>Loading threads…</Text>
                  </View>
                ) : threadsError ? (
                  <View style={styles.bannerDanger}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={styles._miniIcon}
                      color="#B91C1C"
                    />
                    <Text style={styles.bannerDangerText}>{threadsError}</Text>
                    <Pressable
                      onPress={() => refreshThreads({ showLoader: true })}
                      style={({ pressed }) => [
                        styles.bannerButton,
                        pressed && { opacity: 0.92 },
                      ]}
                    >
                      <Text style={styles.bannerButtonText}>Retry</Text>
                    </Pressable>
                  </View>
                ) : null}

                <View style={styles.chatSurface}>
                  <ScrollView
                    ref={(ref) => {
                      threadScrollRef.current = ref;
                    }}
                    style={styles.chatScroll}
                    contentContainerStyle={[
                      styles.chatContent,
                      { paddingBottom: vscale(18) },
                    ]}
                    showsVerticalScrollIndicator
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                    onScroll={onChatScroll}
                    scrollEventThrottle={16}
                  >
                    {messages.length === 0 && !loadingThreads && !threadsError ? (
                      <View style={styles.emptyChat}>
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={styles._emptyIcon}
                          color="#94A3B8"
                        />
                        <Text style={styles.emptyChatTitle}>No messages yet</Text>
                        <Text style={styles.emptyChatSubtitle}>
                          Send a message to follow up this report.
                        </Text>
                      </View>
                    ) : null}

                    {messages.length > 0 ? (
                      <View style={styles.chatDatePill}>
                        <Text style={styles.chatDatePillText}>
                          {formatChatDayPill(messages[0])}
                        </Text>
                      </View>
                    ) : null}

                    {messages.map((message) => {
                      const isLeft = message.side === "left";
                      const showMeta = visibleMessageMetaId === message.id;
                      const shouldBalanceMessage =
                        Array.from(message.text.trim()).length >=
                        BALANCED_MESSAGE_MIN_LENGTH;
                      const storedMeasurement = bubbleMeasurements[message.id];
                      const bubbleMeasurement =
                        shouldBalanceMessage &&
                        storedMeasurement?.version === BUBBLE_MEASUREMENT_VERSION &&
                        storedMeasurement.text === message.text &&
                        storedMeasurement.maxWidth === threadBubbleMaxWidth &&
                        storedMeasurement.fontScale === fontScale
                          ? storedMeasurement
                          : null;
                      const bubbleSizingStyle = bubbleMeasurement
                        ? {
                            width: bubbleMeasurement.width,
                            maxWidth: threadBubbleMaxWidth,
                          }
                        : { maxWidth: threadBubbleMaxWidth };

                      return (
                        <View key={message.id} style={styles.messageBlock}>
                          {showMeta ? (
                            <View
                              style={[
                                styles.messageMetaWrap,
                                isLeft
                                  ? styles.messageMetaWrapLeft
                                  : styles.messageMetaWrapRight,
                              ]}
                            >
                              <Text style={styles.messageMetaText}>
                                {formatThreadMeta(message)}
                              </Text>
                            </View>
                          ) : null}

                          {message.deletedAt ? (
                            <View
                              style={[
                                styles.deletedMessageWrap,
                                isLeft
                                  ? styles.deletedMessageWrapLeft
                                  : styles.deletedMessageWrapRight,
                              ]}
                            >
                              <Pressable
                                onPress={() => toggleMessageMeta(message.id)}
                                style={({ pressed }) => [pressed && { opacity: 0.88 }]}
                              >
                                <View style={styles.deletedMessagePill}>
                                  <Text style={styles.deletedMessageText}>
                                    {getDeletedMessageLabel(message)}
                                  </Text>
                                </View>
                              </Pressable>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.messageStack,
                                isLeft
                                  ? styles.messageStackLeft
                                  : styles.messageStackRight,
                              ]}
                            >
                              {message.replyTo ? (
                                <View
                                  style={[
                                    styles.replyPreviewWrap,
                                    isLeft
                                      ? styles.replyPreviewWrapLeft
                                      : styles.replyPreviewWrapRight,
                                  ]}
                                >
                                  <View
                                    style={[
                                      styles.replyMetaRow,
                                      isLeft
                                        ? styles.replyMetaRowLeft
                                        : styles.replyMetaRowRight,
                                    ]}
                                  >
                                    <Ionicons
                                      name="arrow-undo"
                                      size={styles._miniIcon}
                                      color="#94A3B8"
                                    />
                                    <Text style={styles.replyMetaText} numberOfLines={1}>
                                      {getReplyIndicatorText(message)}
                                    </Text>
                                  </View>
                                  <View
                                    style={[
                                      styles.replyPreviewBubble,
                                      isLeft
                                        ? styles.replyPreviewBubbleLeft
                                        : styles.replyPreviewBubbleRight,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.replyPreviewText,
                                        isLeft
                                          ? styles.replyPreviewTextLeft
                                          : styles.replyPreviewTextRight,
                                      ]}
                                      numberOfLines={2}
                                    >
                                      {message.replyTo.text}
                                    </Text>
                                  </View>
                                </View>
                              ) : null}

                              <View
                                style={[
                                  styles.messageRow,
                                  isLeft ? styles.messageRowLeft : styles.messageRowRight,
                                ]}
                              >
                                {isLeft ? (
                                  <View style={styles.adminAvatar}>
                                    <Ionicons
                                      name="shield-checkmark-outline"
                                      size={styles._miniIcon}
                                      color="#718093"
                                    />
                                  </View>
                                ) : null}

                                <View
                                  style={[
                                    styles.messageBubbleGroup,
                                    isLeft
                                      ? styles.messageBubbleGroupLeft
                                      : styles.messageBubbleGroupRight,
                                  ]}
                                >
                                  {isLeft && message.sender ? (
                                    <Text style={styles.messageSender}>{message.sender}</Text>
                                  ) : null}
                                  <Pressable
                                    disabled={!canChat || !!message.pending}
                                    delayLongPress={220}
                                    onPress={() => toggleMessageMeta(message.id)}
                                    onLongPress={() => openMessageMenu(message)}
                                    style={({ pressed }) => [
                                      styles.bubblePressable,
                                      bubbleSizingStyle,
                                      pressed &&
                                        !message.pending &&
                                        canChat && {
                                          transform: [{ scale: 0.985 }],
                                        },
                                    ]}
                                  >
                                    <View
                                      style={[
                                        styles.bubble,
                                        bubbleSizingStyle,
                                        isLeft ? styles.bubbleLeft : styles.bubbleRight,
                                        message.pending && { opacity: 0.72 },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.bubbleText,
                                          isLeft
                                            ? styles.bubbleTextLeft
                                            : styles.bubbleTextRight,
                                        ]}
                                        textBreakStrategy={
                                          shouldBalanceMessage ? "balanced" : "simple"
                                        }
                                        onTextLayout={
                                          !shouldBalanceMessage || bubbleMeasurement
                                            ? undefined
                                            : (event) => {
                                                updateBubbleMeasurement(
                                                  message.id,
                                                  message.text,
                                                  (event.nativeEvent.lines || []).map(
                                                    (line: any) => Number(line?.width || 0)
                                                  )
                                                );
                                              }
                                        }
                                      >
                                        {message.text}
                                      </Text>
                                    </View>
                                  </Pressable>
                                  <Text
                                    style={[
                                      styles.messageTime,
                                      isLeft
                                        ? styles.messageTimeLeft
                                        : styles.messageTimeRight,
                                    ]}
                                  >
                                    {formatChatTime(message)}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>

                  {newMessageCount > 0 ? (
                    <View style={styles.newMessagePillWrap} pointerEvents="box-none">
                      <Pressable
                        onPress={() => {
                          isAtBottomRef.current = true;
                          setNewMessageCount(0);
                          scrollToBottom(true);
                        }}
                        style={({ pressed }) => [
                          styles.newMessagePill,
                          pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                        ]}
                      >
                        <Ionicons
                          name="arrow-down"
                          size={styles._miniIcon}
                          color="#FFFFFF"
                        />
                        <Text style={styles.newMessagePillText}>
                          {newMessageCount} new message(s)
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {!canChat ? (
                    <View style={styles.disabledMessagingWrap}>
                      <Text style={styles.disabledMessagingText}>
                        This report is {reportStatus.toLowerCase()} — messaging is disabled
                      </Text>
                    </View>
                  ) : null}

                  {replyingToMessage ? (
                    <View style={styles.replyBanner}>
                      <View style={styles.replyBannerAccent} />
                      <View style={styles.replyBannerBody}>
                        <Text style={styles.replyBannerTitle}>
                          Replying to {getThreadSenderLabel(replyingToMessage)}
                        </Text>
                        <Text style={styles.replyBannerText} numberOfLines={1}>
                          {replyingToMessage.text}
                        </Text>
                      </View>
                      <Pressable
                        onPress={cancelReplyMessage}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.replyBannerClose,
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <Ionicons
                          name="close"
                          size={styles._miniIcon}
                          color="#64748B"
                        />
                      </Pressable>
                    </View>
                  ) : null}

                  {editingMessage ? (
                    <View style={styles.editingBanner}>
                      <View style={styles.editingBannerAccent} />
                      <View style={styles.editingBannerBody}>
                        <Text style={styles.editingBannerTitle}>Editing message</Text>
                        <Text style={styles.editingBannerText} numberOfLines={1}>
                          {editingMessage.text}
                        </Text>
                      </View>
                      <Pressable
                        onPress={cancelEditingMessage}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.editingBannerClose,
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <Ionicons
                          name="close"
                          size={styles._miniIcon}
                          color="#64748B"
                        />
                      </Pressable>
                    </View>
                  ) : null}

                  {adminTyping ? (
                    <View style={styles.typingIndicatorWrap} pointerEvents="none">
                      <View style={styles.typingIndicatorIcon}>
                        <Ionicons
                          name="chatbubble-outline"
                          size={styles._typingIndicatorIcon}
                          color="#334E68"
                        />
                      </View>
                      <View style={styles.typingIndicatorBubble}>
                        <View style={styles.typingIndicatorDots}>
                          {messageDotAnimations.map((dot, index) => (
                            <Animated.View
                              key={index}
                              style={[
                                styles.typingIndicatorDot,
                                {
                                  transform: [
                                    {
                                      translateY: dot.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, -4],
                                      }),
                                    },
                                  ],
                                },
                              ]}
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.composerDock,
                      {
                        paddingBottom: composerBottomPadding,
                      },
                    ]}
                  >
                    <View style={styles.composerRow}>
                      <View style={styles.composerInputWrap}>
                        <Ionicons
                          name="attach-outline"
                          size={styles._inputIcon}
                          color="#6E7B8A"
                        />
                        <TextInput
                          ref={composerInputRef}
                          value={draft}
                          onChangeText={handleComposerTextChange}
                          placeholder={
                            editingMessage ? "Edit your message..." : "Write a message..."
                          }
                          placeholderTextColor="#9AA4B2"
                          style={styles.composerInput}
                          returnKeyType="send"
                          onSubmitEditing={handleSend}
                          editable={!sending && canChat}
                          blurOnSubmit={false}
                          multiline={false}
                          textAlignVertical="center"
                          onFocus={() => {
                            setTimeout(() => scrollToBottom(true), 60);
                          }}
                          {...(Platform.OS === "android"
                            ? { includeFontPadding: false as any }
                            : null)}
                        />
                      </View>

                      <Pressable
                        onPress={handleSend}
                        disabled={sending || !canChat}
                        style={({ pressed }) => [
                          styles.sendButton,
                          pressed && {
                            transform: [{ scale: 0.98 }],
                            opacity: 0.95,
                          },
                          (sending || !canChat) && { opacity: 0.7 },
                        ]}
                      >
                        {sending ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Ionicons
                            name={editingMessage ? "checkmark" : "paper-plane"}
                            size={styles._sendIcon}
                            color="#FFFFFF"
                          />
                        )}
                      </Pressable>
                    </View>
                  </View>
                </View>
                  </View>
                </View>
              </Animated.View>

              {reportContext ? (
                <Animated.View
                  pointerEvents={
                    activePanel === "context" ? "auto" : "none"
                  }
                  accessibilityElementsHidden={activePanel !== "context"}
                  importantForAccessibility={
                    activePanel === "context"
                      ? "yes"
                      : "no-hide-descendants"
                  }
                  style={[
                    styles.messageSlidingPanel,
                    {
                      opacity: contextSlide.interpolate({
                        inputRange: [0, 0.15, 1],
                        outputRange: [0.78, 0.94, 1],
                        extrapolate: "clamp",
                      }),
                      transform: [{ translateX: contextTranslateX }],
                    },
                  ]}
                >
                  <ReportContextPanel context={reportContext} />
                </Animated.View>
              ) : null}
            </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {!visible && !hideFab ? (
        <Pressable
          onPress={openMessages}
          accessibilityRole="button"
          accessibilityLabel="Open messages"
          style={({ pressed }) => [
            styles.messageFab,
            {
              bottom: Math.max(insets.bottom, 16) + vscale(18),
              right: scale(18),
            },
            pressed && styles.messageFabPressed,
          ]}
        >
          <View style={styles.messageFabIconWrap}>
            <Ionicons
              name="chatbubble-outline"
              size={styles._messageFabIcon}
              color="#FFFFFF"
            />
            <View style={styles.messageFabDots}>
              {messageDotAnimations.map((dot, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.messageFabDot,
                    {
                      transform: [
                        {
                          translateY: dot.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -4],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          </View>
          {newMessageCount > 0 ? (
            <View style={styles.messageFabBadge}>
              <Text style={styles.messageFabBadgeText} allowFontScaling={false}>
                {newMessageCount > 99 ? "99+" : newMessageCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </>
  );
}

function makeStyles({
  scale,
  vscale,
  primary,
  isDark,
  isTablet,
  contentMaxWidth,
}: {
  scale: (value: number) => number;
  vscale: (value: number) => number;
  primary: string;
  isDark: boolean;
  isTablet: boolean;
  contentMaxWidth: number;
}) {
  const border = isDark ? "#334155" : "#E7EEF7";
  const background = isDark ? "#1E293B" : "#FFFFFF";
  const textDark = isDark ? "#F1F5F9" : "#0B2B45";
  const chatBackground = isDark ? "#0F172A" : "#F7F9FC";
  const inputBackground = isDark ? "#172033" : "#FFFFFF";
  const mutedText = isDark ? "#94A3B8" : "#64748B";
  const contentAlignment: any = {
    width: "100%",
    maxWidth: contentMaxWidth,
    alignSelf: "center",
  };
  const _miniIcon = scale(14);
  const _menuIcon = scale(18);
  const _emptyIcon = scale(isTablet ? 52 : 44);
  const _inputIcon = scale(18);
  const _sendIcon = scale(18);
  const _messageFabIcon = scale(24);
  const _typingIndicatorIcon = scale(24);
  const _contextIcon = scale(14);

  return Object.assign(
    StyleSheet.create({
      messageFab: {
        position: "absolute",
        width: scale(56),
        height: scale(56),
        borderRadius: scale(28),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary,
        zIndex: 20,
        ...Platform.select({
          ios: {
            shadowColor: "#0F172A",
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          },
          android: { elevation: 8 },
        }),
      },
      messageFabPressed: {
        transform: [{ scale: 0.94 }],
        opacity: 0.92,
      },
      messageFabIconWrap: {
        width: scale(30),
        height: scale(28),
        alignItems: "center",
        justifyContent: "center",
      },
      messageFabDots: {
        position: "absolute",
        left: 0,
        right: 0,
        top: scale(12),
        flexDirection: "row",
        justifyContent: "center",
        gap: scale(2),
      },
      messageFabDot: {
        width: scale(3),
        height: scale(3),
        borderRadius: scale(2),
        backgroundColor: "#FFFFFF",
      },
      messageFabBadge: {
        position: "absolute",
        top: -scale(3),
        right: -scale(3),
        minWidth: scale(18),
        height: scale(18),
        borderRadius: scale(9),
        paddingHorizontal: scale(4),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E11D48",
        borderWidth: 2,
        borderColor: background,
      },
      messageFabBadgeText: {
        fontSize: scale(9),
        fontWeight: "900",
        color: "#FFFFFF",
      },
      messageModalLayer: {
        flex: 1,
      },
      messageModalRoot: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      },
      messageModalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: isDark
          ? "rgba(0, 0, 0, 0.58)"
          : "rgba(15, 23, 42, 0.38)",
      },
      messageModalCard: {
        width: "92%",
        maxWidth: scale(520),
        height: "78%",
        borderRadius: scale(24),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: border,
        overflow: "hidden",
        backgroundColor: background,
      },
      messageModalBody: {
        flex: 1,
        position: "relative",
        overflow: "hidden",
        backgroundColor: background,
      },
      messageSlidingPanel: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: background,
      },
      messageModalHeader: {
        height: vscale(58),
        paddingHorizontal: scale(18),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: background,
      },
      messageModalHeaderContent: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: scale(7),
      },
      contextButton: {
        flexShrink: 0,
        minHeight: vscale(28),
        paddingHorizontal: scale(8),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: isDark ? "#2A5680" : "#D8EAFE",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: scale(3),
        backgroundColor: isDark ? "#1E3A5F" : "#EEF6FF",
      },
      contextButtonText: {
        fontSize: scale(10),
        fontWeight: "800",
        color: primary,
      },
      contextButtonMessages: {
        borderColor: primary,
        backgroundColor: primary,
      },
      contextButtonMessagesText: {
        color: "#FFFFFF",
      },
      messageModalClose: {
        width: scale(32),
        height: scale(32),
        alignItems: "center",
        justifyContent: "center",
      },
      threadsKav: { flex: 1, backgroundColor: background },
      threadsWrap: {
        flex: 1,
        paddingHorizontal: 0,
        paddingTop: vscale(4),
        backgroundColor: background,
      },
      chatSurface: {
        flex: 1,
        width: "100%",
        borderTopLeftRadius: scale(18),
        borderTopRightRadius: scale(18),
        borderWidth: 1,
        borderColor: border,
        backgroundColor: chatBackground,
        overflow: "hidden",
      },
      chatScroll: { flex: 1, backgroundColor: chatBackground },
      chatContent: {
        paddingHorizontal: scale(22),
        paddingTop: vscale(14),
        paddingBottom: vscale(12),
      },
      emptyChat: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: vscale(24),
        gap: vscale(6),
      },
      emptyChatTitle: {
        fontSize: scale(isTablet ? 13 : 12),
        fontWeight: "900",
        color: textDark,
      },
      emptyChatSubtitle: {
        fontSize: scale(10.5),
        fontWeight: "400",
        color: mutedText,
        textAlign: "center",
      },
      chatDatePill: {
        alignSelf: "center",
        borderRadius: scale(999),
        backgroundColor: "#EEF0F3",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(5),
        marginBottom: vscale(18),
      },
      chatDatePillText: {
        fontSize: scale(10),
        fontWeight: "900",
        color: "#9AA0A8",
      },
      messageBlock: {
        width: "100%",
        marginBottom: vscale(12),
      },
      messageSender: {
        fontSize: scale(10),
        fontWeight: "900",
        color: "#718093",
        marginBottom: vscale(5),
        marginLeft: scale(2),
      },
      messageTime: {
        marginTop: vscale(4),
        fontSize: scale(9.5),
        fontWeight: "800",
        color: "#8F99A5",
      },
      messageTimeLeft: { alignSelf: "flex-start" },
      messageTimeRight: { alignSelf: "flex-end" },
      messageMetaWrap: {
        width: "100%",
        marginBottom: vscale(6),
      },
      messageMetaWrapLeft: { alignItems: "flex-start" },
      messageMetaWrapRight: { alignItems: "flex-end" },
      messageMetaText: {
        fontSize: scale(9.5),
        fontWeight: "500",
        color: "#94A3B8",
      },
      messageStack: {
        maxWidth: "100%",
        flexShrink: 1,
        width: "100%",
      },
      messageStackLeft: {
        alignSelf: "flex-start",
        alignItems: "flex-start",
      },
      messageStackRight: {
        alignSelf: "flex-end",
        alignItems: "flex-end",
      },
      replyPreviewWrap: {
        maxWidth: "100%",
        flexShrink: 1,
        flexDirection: "column",
        gap: vscale(4),
        marginBottom: vscale(8),
      },
      replyPreviewWrapLeft: {
        alignSelf: "flex-start",
        alignItems: "flex-start",
      },
      replyPreviewWrapRight: {
        alignSelf: "flex-end",
        alignItems: "flex-end",
      },
      replyMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "nowrap",
        gap: scale(4),
      },
      replyMetaRowLeft: { alignSelf: "flex-start" },
      replyMetaRowRight: {
        alignSelf: "flex-end",
        justifyContent: "flex-end",
      },
      replyMetaText: {
        fontSize: scale(9.5),
        fontWeight: "600",
        color: "#94A3B8",
        maxWidth: scale(isTablet ? 240 : 190),
      },
      replyPreviewBubble: {
        maxWidth: "100%",
        borderRadius: scale(14),
        paddingHorizontal: scale(12),
        paddingVertical: vscale(8),
        borderWidth: 1,
      },
      replyPreviewBubbleLeft: {
        backgroundColor: "#EEF2F7",
        borderColor: "#E6ECF5",
      },
      replyPreviewBubbleRight: {
        backgroundColor: "#1F2937",
        borderColor: "#1F2937",
      },
      replyPreviewText: {
        fontSize: scale(10.5),
        fontWeight: "500",
        lineHeight: vscale(14),
      },
      replyPreviewTextLeft: { color: "#334155" },
      replyPreviewTextRight: { color: "#F8FAFC" },
      deletedMessageWrap: {
        width: "100%",
        marginTop: vscale(2),
      },
      deletedMessageWrapLeft: { alignItems: "flex-start" },
      deletedMessageWrapRight: { alignItems: "flex-end" },
      deletedMessagePill: {
        borderRadius: scale(999),
        backgroundColor: "#111827",
        paddingHorizontal: scale(14),
        paddingVertical: vscale(7),
      },
      deletedMessageText: {
        fontSize: scale(10.5),
        fontWeight: "500",
        color: "#E5E7EB",
      },
      messageRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        width: "100%",
      },
      messageRowLeft: { justifyContent: "flex-start" },
      messageRowRight: { justifyContent: "flex-end" },
      adminAvatar: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        backgroundColor: "#E5E9EF",
        alignItems: "center",
        justifyContent: "center",
        marginRight: scale(9),
        marginTop: vscale(18),
      },
      messageBubbleGroup: {
        maxWidth: isTablet ? "66%" : "78%",
        minWidth: 0,
        flexShrink: 1,
      },
      messageBubbleGroupLeft: { alignItems: "flex-start" },
      messageBubbleGroupRight: { alignItems: "flex-end" },
      bubblePressable: {
        maxWidth: "100%",
        minWidth: 0,
        flexShrink: 1,
      },
      bubble: {
        maxWidth: "100%",
        minWidth: 0,
        flexShrink: 1,
        borderRadius: scale(12),
        paddingHorizontal: scale(14),
        paddingVertical: vscale(11),
        borderWidth: 1,
      },
      bubbleLeft: {
        backgroundColor: "#E9ECEF",
        borderColor: "#D0D4DA",
      },
      bubbleRight: {
        backgroundColor: "#000000",
        borderColor: "#000000",
      },
      bubbleText: {
        flexShrink: 1,
        fontSize: scale(isTablet ? 13 : 12),
        fontWeight: "800",
        lineHeight: vscale(isTablet ? 18 : 17),
      },
      bubbleTextLeft: { color: "#4D5662" },
      bubbleTextRight: { color: "#FFFFFF" },
      replyBanner: {
        paddingHorizontal: scale(12),
        paddingVertical: vscale(10),
        borderTopWidth: 1,
        borderTopColor: border,
        backgroundColor: "#F8FBFF",
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
      },
      replyBannerAccent: {
        width: scale(3),
        alignSelf: "stretch",
        borderRadius: scale(999),
        backgroundColor: "#64748B",
      },
      replyBannerBody: {
        flex: 1,
        gap: vscale(2),
      },
      replyBannerTitle: {
        fontSize: scale(10.5),
        fontWeight: "900",
        color: "#334155",
      },
      replyBannerText: {
        fontSize: scale(10.5),
        fontWeight: "400",
        color: "#64748B",
      },
      replyBannerClose: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: border,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
      },
      editingBanner: {
        paddingHorizontal: scale(12),
        paddingVertical: vscale(10),
        borderTopWidth: 1,
        borderTopColor: border,
        backgroundColor: "#F8FBFF",
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
      },
      editingBannerAccent: {
        width: scale(3),
        alignSelf: "stretch",
        borderRadius: scale(999),
        backgroundColor: primary,
      },
      editingBannerBody: {
        flex: 1,
        gap: vscale(2),
      },
      editingBannerTitle: {
        fontSize: scale(10.5),
        fontWeight: "900",
        color: primary,
      },
      editingBannerText: {
        fontSize: scale(10.5),
        fontWeight: "400",
        color: "#475569",
      },
      editingBannerClose: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: border,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
      },
      typingIndicatorWrap: {
        paddingLeft: scale(24),
        paddingRight: scale(22),
        paddingBottom: vscale(6),
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
        backgroundColor: "#F7F9FC",
      },
      typingIndicatorIcon: {
        width: scale(32),
        height: vscale(32),
        alignItems: "center",
        justifyContent: "center",
      },
      typingIndicatorBubble: {
        alignItems: "center",
        justifyContent: "center",
        width: scale(64),
        height: vscale(38),
        borderRadius: scale(19),
        borderWidth: 1,
        borderColor: "#D7E0E8",
        backgroundColor: "#F5F8FB",
      },
      typingIndicatorDots: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(5),
      },
      typingIndicatorDot: {
        width: scale(6),
        height: scale(6),
        borderRadius: scale(3),
        backgroundColor: "#526D82",
      },
      composerDock: {
        backgroundColor: chatBackground,
        paddingTop: vscale(8),
      },
      composerRow: {
        marginHorizontal: scale(28),
        marginBottom: vscale(8),
        minHeight: vscale(50),
        borderRadius: scale(999),
        borderWidth: 1,
        borderColor: "#D7DCE3",
        backgroundColor: inputBackground,
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        paddingLeft: scale(11),
        paddingRight: scale(6),
        paddingVertical: vscale(5),
      },
      composerInputWrap: {
        flex: 1,
        minHeight: vscale(40),
        backgroundColor: inputBackground,
        paddingHorizontal: scale(2),
        flexDirection: "row",
        alignItems: "center",
        gap: scale(8),
      },
      composerInput: {
        flex: 1,
        height: vscale(40),
        paddingVertical: 0,
        fontSize: scale(isTablet ? 13 : 12),
        fontWeight: "800",
        color: isDark ? "#F1F5F9" : "#111827",
      },
      sendButton: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        backgroundColor: "#32AFE6",
        alignItems: "center",
        justifyContent: "center",
      },
      disabledMessagingWrap: {
        paddingHorizontal: scale(16),
        paddingBottom: vscale(6),
      },
      disabledMessagingText: {
        textAlign: "center",
        fontSize: scale(12),
        color: "#94A3B8",
        fontStyle: "italic",
      },
      bannerNeutral: {
        ...contentAlignment,
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: border,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(10),
      },
      bannerNeutralText: {
        fontSize: scale(10.5),
        fontWeight: "400",
        color: "#6E7D90",
      },
      bannerDanger: {
        ...contentAlignment,
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: scale(10),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: "#FECACA",
        backgroundColor: "#FEF2F2",
        paddingHorizontal: scale(12),
        paddingVertical: vscale(10),
      },
      bannerDangerText: {
        flex: 1,
        fontSize: scale(10.5),
        fontWeight: "400",
        color: "#B91C1C",
      },
      bannerButton: {
        paddingHorizontal: scale(12),
        paddingVertical: vscale(8),
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: border,
        backgroundColor: "#FFFFFF",
      },
      bannerButtonText: {
        fontSize: scale(10.5),
        fontWeight: "900",
        color: primary,
      },
      newMessagePillWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: vscale(74),
        alignItems: "center",
        zIndex: 10,
      },
      newMessagePill: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(8),
        paddingHorizontal: scale(12),
        paddingVertical: vscale(8),
        borderRadius: scale(999),
        backgroundColor: primary,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.25)",
      },
      newMessagePillText: {
        fontSize: scale(10.5),
        fontWeight: "900",
        color: "#FFFFFF",
      },
      threadMenuBackdrop: {
        flex: 1,
        backgroundColor: "rgba(15,23,42,0.26)",
        justifyContent: "center",
        paddingHorizontal: scale(20),
      },
      threadMenuShell: {
        alignSelf: "center",
        width: "100%",
        maxWidth: scale(288),
        gap: vscale(12),
      },
      threadMenuPreviewRow: {
        flexDirection: "row",
        width: "100%",
      },
      threadMenuPreviewRowLeft: { justifyContent: "flex-start" },
      threadMenuPreviewRowRight: { justifyContent: "flex-end" },
      threadMenuPreviewBubble: {
        maxWidth: "84%",
        borderRadius: scale(18),
        paddingHorizontal: scale(14),
        paddingVertical: vscale(10),
      },
      threadMenuPreviewBubbleLeft: {
        backgroundColor: "#EEF2F7",
        borderWidth: 1,
        borderColor: "#E6ECF5",
      },
      threadMenuPreviewBubbleRight: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#D7E3F4",
      },
      threadMenuPreviewText: {
        fontSize: scale(isTablet ? 12 : 11),
        fontWeight: "500",
        lineHeight: vscale(isTablet ? 16 : 15),
      },
      threadMenuPreviewTextLeft: { color: "#334155" },
      threadMenuPreviewTextRight: { color: "#0F172A" },
      threadMenuCard: {
        borderRadius: scale(18),
        backgroundColor: "#15181E",
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.08)",
        shadowColor: "#000000",
        shadowOpacity: 0.24,
        shadowRadius: scale(18),
        shadowOffset: { width: 0, height: vscale(8) },
        elevation: 10,
      },
      threadMenuAction: {
        minHeight: vscale(50),
        paddingHorizontal: scale(16),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(255,255,255,0.08)",
      },
      threadMenuActionPressed: {
        backgroundColor: "rgba(255,255,255,0.08)",
      },
      threadMenuActionLast: { borderBottomWidth: 0 },
      threadMenuActionText: {
        fontSize: scale(12),
        fontWeight: "700",
        color: "#FFFFFF",
      },
      threadMenuDeleteAction: {
        backgroundColor: "rgba(127,29,29,0.12)",
      },
      threadMenuDeleteText: { color: "#F87171" },
    }),
    {
      _miniIcon,
      _menuIcon,
      _emptyIcon,
      _inputIcon,
      _sendIcon,
      _messageFabIcon,
      _typingIndicatorIcon,
      _contextIcon,
    }
  ) as any;
}
