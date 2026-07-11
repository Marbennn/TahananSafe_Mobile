import { requestJson } from "./http";

export type ChatbotMessage = {
  _id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  confidence?: number | null;
  category?: string;
  source?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ChatbotConversationSummary = {
  _id: string;
  title: string;
  preview: string;
  messageCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ChatbotConversation = ChatbotConversationSummary & {
  messages: ChatbotMessage[];
};

type ChatbotConversationListResponse = {
  conversations?: ChatbotConversationSummary[];
};

type ChatbotConversationDetailResponse = {
  conversation?: ChatbotConversation;
};

export async function listChatbotConversations() {
  const data = await requestJson<ChatbotConversationListResponse>({
    path: "/api/mobile/v1/chatbot/conversations",
    auth: true,
  });

  return Array.isArray(data?.conversations) ? data.conversations : [];
}

export async function getChatbotConversation(conversationId: string) {
  const data = await requestJson<ChatbotConversationDetailResponse>({
    path: `/api/mobile/v1/chatbot/conversations/${encodeURIComponent(
      conversationId
    )}`,
    auth: true,
  });

  if (!data?.conversation) {
    throw new Error("Conversation not found.");
  }

  return data.conversation;
}

export async function sendChatbotMessage(
  message: string,
  conversationId?: string | null
) {
  const data = await requestJson<ChatbotConversationDetailResponse>({
    method: "POST",
    path: "/api/mobile/v1/chatbot/chat",
    auth: true,
    body: {
      message,
      conversationId: conversationId || undefined,
    },
  });

  if (!data?.conversation) {
    throw new Error("Chatbot did not return a conversation.");
  }

  return data.conversation;
}
