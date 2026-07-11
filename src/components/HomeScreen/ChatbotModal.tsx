import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../theme/colors";
import { useAuth } from "../../auth/AuthContext";
import {
  ChatbotConversation,
  ChatbotConversationSummary,
  listChatbotConversations,
  getChatbotConversation,
  sendChatbotMessage,
} from "../../api/chatbot";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const STARTER_PROMPTS = [
  "How do I submit a report?",
  "How does the SOS alert work?",
  "How do I verify my account?",
] as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatHistoryTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isSameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function getDisplayName(user: any) {
  const fullName = [user?.firstName, user?.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");

  if (fullName) return fullName;
  if (typeof user?.name === "string" && user.name.trim()) return user.name.trim();
  return "there";
}

function upsertSummary(
  previous: ChatbotConversationSummary[],
  conversation: ChatbotConversation
) {
  const nextSummary: ChatbotConversationSummary = {
    _id: conversation._id,
    title: conversation.title,
    preview: conversation.preview,
    messageCount: conversation.messageCount,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };

  const rest = previous.filter((item) => item._id !== nextSummary._id);
  return [nextSummary, ...rest].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export default function ChatbotModal({ visible, onClose }: Props) {
  const TC = useColors();
  const { user } = useAuth() as any;
  const { width, height } = useWindowDimensions();
  const compactHeader = width <= 360;

  const s = clamp(width / 375, 0.95, 1.22);
  const vs = clamp(height / 812, 0.88, 1.15);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);
  const openSlideOffset = Math.round(42 * vs);
  const closeSlideOffset = Math.round(30 * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;
  const slideY = useRef(new Animated.Value(openSlideOffset)).current;
  const messagesRef = useRef<ScrollView | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  const [historyMode, setHistoryMode] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingConversationId, setLoadingConversationId] = useState<
    string | null
  >(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [conversations, setConversations] = useState<
    ChatbotConversationSummary[]
  >([]);
  const [currentConversation, setCurrentConversation] =
    useState<ChatbotConversation | null>(null);

  const displayName = useMemo(() => getDisplayName(user), [user]);
  const currentMessages = currentConversation?.messages ?? [];

  const closeWithAnim = useCallback(
    (cb: () => void) => {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(pop, {
          toValue: 0.98,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideY, {
          toValue: closeSlideOffset,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) cb();
      });
    },
    [closeSlideOffset, fade, pop, slideY]
  );

  const loadConversationHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const items = await listChatbotConversations();
      setConversations(items);
      setErrorMessage("");
    } catch (error: any) {
      setErrorMessage(
        error?.message || "Unable to load chatbot conversation history."
      );
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    fade.setValue(0);
    pop.setValue(0.96);
    slideY.setValue(openSlideOffset);
    setHistoryMode(false);

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(pop, {
        toValue: 1,
        speed: 16,
        bounciness: 5,
        useNativeDriver: true,
      }),
      Animated.spring(slideY, {
        toValue: 0,
        speed: 16,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();

    void loadConversationHistory();
  }, [fade, loadConversationHistory, openSlideOffset, pop, slideY, visible]);

  useEffect(() => {
    if (!visible || historyMode) return;

    const id = setTimeout(() => {
      messagesRef.current?.scrollToEnd({ animated: true });
    }, 90);

    return () => clearTimeout(id);
  }, [currentMessages.length, historyMode, sending, visible]);

  const handleNewChat = useCallback(() => {
    setCurrentConversation(null);
    setHistoryMode(false);
    setErrorMessage("");
    setDraft("");

    setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
  }, []);

  const handleSelectConversation = useCallback(async (conversationId: string) => {
    setLoadingConversationId(conversationId);
    try {
      const conversation = await getChatbotConversation(conversationId);
      setCurrentConversation(conversation);
      setHistoryMode(false);
      setErrorMessage("");
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to open this conversation.");
    } finally {
      setLoadingConversationId(null);
    }
  }, []);

  const handleSend = useCallback(
    async (nextText?: string) => {
      const message = String(nextText ?? draft).trim();
      if (!message || sending) return;

      const restoreDraft = message;
      setDraft("");
      setSending(true);
      setErrorMessage("");

      try {
        const conversation = await sendChatbotMessage(
          message,
          currentConversation?._id
        );
        setCurrentConversation(conversation);
        setConversations((previous) => upsertSummary(previous, conversation));
      } catch (error: any) {
        setDraft(restoreDraft);
        setErrorMessage(
          error?.message || "Unable to send your message right now."
        );
      } finally {
        setSending(false);
      }
    },
    [currentConversation?._id, draft, sending]
  );

  const renderHistory = () => {
    if (loadingHistory) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator color={TC.primary} />
          <Text style={[styles.stateText, { color: TC.muted }]}>
            Loading past conversations...
          </Text>
        </View>
      );
    }

    if (!conversations.length) {
      return (
        <View style={styles.centerState}>
          <Ionicons
            name="time-outline"
            size={scale(28)}
            color={TC.primary}
          />
          <Text style={[styles.emptyTitle, { color: TC.textDark }]}>
            No history yet
          </Text>
          <Text style={[styles.stateText, { color: TC.muted }]}>
            Your chatbot conversations will appear here after you start asking
            questions.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.historyScroll}
        contentContainerStyle={styles.historyContent}
        showsVerticalScrollIndicator={false}
      >
        {conversations.map((conversation) => {
          const active = conversation._id === currentConversation?._id;
          const opening = loadingConversationId === conversation._id;

          return (
            <Pressable
              key={conversation._id}
              onPress={() => void handleSelectConversation(conversation._id)}
              style={({ pressed }) => [
                styles.historyCard,
                {
                  backgroundColor: active ? TC.chipBg : TC.surface,
                  borderColor: active ? TC.primary : TC.divider,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={styles.historyRow}>
                <Text
                  style={[styles.historyTitle, { color: TC.textDark }]}
                  numberOfLines={1}
                >
                  {conversation.title || "New chat"}
                </Text>
                <Text style={[styles.historyTime, { color: TC.muted }]}>
                  {formatHistoryTime(conversation.updatedAt)}
                </Text>
              </View>

              <Text
                style={[styles.historyPreview, { color: TC.muted }]}
                numberOfLines={2}
              >
                {conversation.preview || "No preview available yet."}
              </Text>

              <View style={styles.historyFooter}>
                <Text style={[styles.historyMeta, { color: TC.muted }]}>
                  {conversation.messageCount} message
                  {conversation.messageCount === 1 ? "" : "s"}
                </Text>
                {opening ? (
                  <ActivityIndicator size="small" color={TC.primary} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  };

  const renderChat = () => (
    <>
      <ScrollView
        ref={messagesRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!currentMessages.length ? (
          <View style={styles.welcomeWrap}>
            <View
              style={[styles.assistantBubble, { backgroundColor: TC.surface, borderColor: TC.divider }]}
            >
              <Text style={[styles.assistantLabel, { color: TC.primary }]}>
                TahananSafe Assistant
              </Text>
              <Text style={[styles.messageText, { color: TC.textDark }]}>
                Hi {displayName}. Ask me about incident reporting, SOS alerts,
                verification, settings, or other TahananSafe features.
              </Text>
            </View>

            <View style={styles.promptRow}>
              {STARTER_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  onPress={() => void handleSend(prompt)}
                  style={({ pressed }) => [
                    styles.promptChip,
                    {
                      backgroundColor: TC.chipBg,
                      borderColor: TC.divider,
                    },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Text style={[styles.promptText, { color: TC.primary }]}>
                    {prompt}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {currentMessages.map((message) => {
          const isUser = message.role === "user";

          return (
            <View
              key={message._id}
              style={[
                styles.messageRow,
                isUser ? styles.messageRowUser : styles.messageRowAssistant,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  isUser
                    ? {
                        backgroundColor: TC.primary,
                        borderColor: TC.primary,
                      }
                    : {
                        backgroundColor: TC.surface,
                        borderColor: TC.divider,
                      },
                ]}
              >
                {!isUser ? (
                  <Text style={[styles.assistantLabel, { color: TC.primary }]}>
                    TahananSafe Assistant
                  </Text>
                ) : null}

                <Text
                  style={[
                    styles.messageText,
                    { color: isUser ? "#FFFFFF" : TC.textDark },
                  ]}
                >
                  {message.content}
                </Text>
              </View>
            </View>
          );
        })}

        {sending ? (
          <View style={[styles.messageRow, styles.messageRowAssistant]}>
            <View
              style={[
                styles.messageBubble,
                styles.typingBubble,
                { backgroundColor: TC.surface, borderColor: TC.divider },
              ]}
            >
              <ActivityIndicator size="small" color={TC.primary} />
              <Text style={[styles.typingText, { color: TC.muted }]}>
                Assistant is typing...
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.inputWrap, { borderTopColor: TC.divider }]}>
        <View
          style={[
            styles.inputShell,
            {
              backgroundColor: TC.inputBg,
              borderColor: TC.divider,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask the chatbot anything..."
            placeholderTextColor={TC.placeholder}
            style={[styles.input, { color: TC.textDark }]}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          <Pressable
            onPress={() => void handleSend()}
            disabled={sending || !draft.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor:
                  sending || !draft.trim() ? "#D8E5F4" : TC.primary,
              },
              pressed && !sending && draft.trim() ? { opacity: 0.88 } : null,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={scale(16)} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => closeWithAnim(onClose)}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: fade, backgroundColor: TC.overlay },
          ]}
        />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: fade,
              transform: [{ translateY: slideY }, { scale: pop }],
              backgroundColor: TC.surface,
            },
          ]}
        >
          <View style={styles.header}>
            <View
              style={[
                styles.headerTopRow,
                compactHeader && styles.headerTopRowCompact,
              ]}
            >
              <View style={styles.headerIdentity}>
                <View
                  style={[styles.avatarWrap, { backgroundColor: TC.chipBg }]}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={scale(18)}
                    color={TC.primary}
                  />
                </View>

                <View style={styles.headerTextWrap}>
                  <Text
                    style={[styles.title, { color: TC.textDark }]}
                    numberOfLines={2}
                  >
                    TahananSafe Assistant
                  </Text>
                  <Text style={[styles.subtitle, { color: TC.muted }]}>
                    Chat support for reports, alerts, settings, and app help.
                  </Text>
                </View>
              </View>

              <View style={styles.headerIconRow}>
                <Pressable
                  onPress={handleNewChat}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: TC.chipBg },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Ionicons
                    name="add-outline"
                    size={scale(18)}
                    color={TC.primary}
                  />
                </Pressable>

                <Pressable
                  onPress={() => closeWithAnim(onClose)}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: TC.chipBg },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Ionicons
                    name="close-outline"
                    size={scale(18)}
                    color={TC.textDark}
                  />
                </Pressable>
              </View>
            </View>

            <View
              style={[
                styles.headerUtilityRow,
                compactHeader && styles.headerUtilityRowCompact,
              ]}
            >
              <Pressable
                onPress={() => setHistoryMode((value) => !value)}
                style={({ pressed }) => [
                  styles.headerPill,
                  {
                    backgroundColor: historyMode ? TC.primary : TC.chipBg,
                  },
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={scale(14)}
                  color={historyMode ? "#FFFFFF" : TC.primary}
                />
                  <Text
                    style={[
                      styles.headerPillText,
                    { color: historyMode ? "#FFFFFF" : TC.primary },
                  ]}
                >
                  History
                </Text>
              </Pressable>
            </View>
          </View>

          {errorMessage ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: TC.chipBg,
                  borderColor: TC.divider,
                },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={scale(16)}
                color={TC.primary}
              />
              <Text style={[styles.errorText, { color: TC.textDark }]}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View style={styles.body}>
            {historyMode ? renderHistory() : renderChat()}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: scale(16),
      paddingVertical: vscale(18),
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(15,23,42,0.35)",
    },
    card: {
      width: "100%",
      maxWidth: scale(360),
      height: "100%",
      maxHeight: vscale(680),
      borderRadius: scale(24),
      paddingTop: scale(20),
      paddingBottom: scale(16),
      paddingHorizontal: scale(16),
      overflow: "hidden",
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
    header: {
      marginBottom: scale(14),
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: scale(12),
    },
    headerTopRowCompact: {
      gap: scale(10),
    },
    headerIdentity: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: scale(12),
    },
    avatarWrap: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(20),
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    headerTextWrap: {
      flex: 1,
      minWidth: 0,
      paddingTop: scale(1),
    },
    title: {
      fontSize: scale(17),
      fontWeight: "900",
      lineHeight: scale(21),
      marginBottom: scale(4),
    },
    subtitle: {
      fontSize: scale(12),
      lineHeight: scale(18),
    },
    headerIconRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: scale(8),
      flexShrink: 0,
    },
    headerUtilityRow: {
      marginTop: scale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
    },
    headerUtilityRowCompact: {
      marginTop: scale(10),
    },
    headerPill: {
      height: vscale(34),
      borderRadius: scale(17),
      paddingHorizontal: scale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: scale(6),
    },
    headerPillText: {
      fontSize: scale(12),
      fontWeight: "800",
    },
    iconBtn: {
      width: scale(34),
      height: scale(34),
      borderRadius: scale(17),
      alignItems: "center",
      justifyContent: "center",
    },
    errorBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
      borderWidth: 1,
      borderRadius: scale(14),
      paddingHorizontal: scale(12),
      paddingVertical: scale(10),
      marginBottom: scale(12),
    },
    errorText: {
      flex: 1,
      fontSize: scale(12),
      lineHeight: scale(17),
      fontWeight: "600",
    },
    body: {
      flex: 1,
      minHeight: 0,
    },
    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(24),
    },
    emptyTitle: {
      fontSize: scale(16),
      fontWeight: "900",
      marginTop: scale(10),
      marginBottom: scale(6),
    },
    stateText: {
      fontSize: scale(12),
      lineHeight: scale(18),
      textAlign: "center",
      marginTop: scale(8),
    },
    historyScroll: {
      flex: 1,
    },
    historyContent: {
      paddingBottom: scale(8),
      gap: scale(10),
    },
    historyCard: {
      borderWidth: 1,
      borderRadius: scale(18),
      paddingHorizontal: scale(14),
      paddingVertical: scale(12),
    },
    historyRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(8),
      marginBottom: scale(6),
    },
    historyTitle: {
      flex: 1,
      fontSize: scale(13),
      fontWeight: "800",
    },
    historyTime: {
      fontSize: scale(11),
      fontWeight: "700",
    },
    historyPreview: {
      fontSize: scale(12),
      lineHeight: scale(18),
      marginBottom: scale(10),
    },
    historyFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(8),
    },
    historyMeta: {
      fontSize: scale(11),
      fontWeight: "700",
    },
    messagesScroll: {
      flex: 1,
    },
    messagesContent: {
      paddingBottom: scale(10),
      gap: scale(12),
    },
    welcomeWrap: {
      gap: scale(12),
    },
    promptRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: scale(8),
    },
    promptChip: {
      borderWidth: 1,
      borderRadius: scale(999),
      paddingHorizontal: scale(12),
      paddingVertical: scale(9),
    },
    promptText: {
      fontSize: scale(12),
      fontWeight: "700",
    },
    messageRow: {
      width: "100%",
      flexDirection: "row",
    },
    messageRowAssistant: {
      justifyContent: "flex-start",
    },
    messageRowUser: {
      justifyContent: "flex-end",
    },
    messageBubble: {
      maxWidth: "86%",
      borderWidth: 1,
      borderRadius: scale(18),
      paddingHorizontal: scale(14),
      paddingVertical: scale(11),
    },
    assistantBubble: {
      borderWidth: 1,
      borderRadius: scale(18),
      paddingHorizontal: scale(14),
      paddingVertical: scale(12),
    },
    assistantLabel: {
      fontSize: scale(11),
      fontWeight: "900",
      marginBottom: scale(6),
    },
    messageText: {
      fontSize: scale(13),
      lineHeight: scale(19),
    },
    typingBubble: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
    },
    typingText: {
      fontSize: scale(12),
      fontWeight: "700",
    },
    inputWrap: {
      borderTopWidth: 1,
      paddingTop: scale(12),
      marginTop: scale(10),
    },
    inputShell: {
      borderWidth: 1,
      borderRadius: scale(18),
      minHeight: vscale(58),
      paddingLeft: scale(14),
      paddingRight: scale(8),
      paddingVertical: scale(8),
      flexDirection: "row",
      alignItems: "flex-end",
      gap: scale(8),
    },
    input: {
      flex: 1,
      maxHeight: vscale(110),
      fontSize: scale(13),
      lineHeight: scale(18),
      paddingTop: scale(4),
      paddingBottom: scale(4),
    },
    sendBtn: {
      width: scale(42),
      height: scale(42),
      borderRadius: scale(21),
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
