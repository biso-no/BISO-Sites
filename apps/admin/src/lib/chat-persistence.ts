"use client";

import type { UIMessage } from "ai";

const CHAT_STORAGE_KEY = "admin-assistant-chat-history";
const CHAT_SESSION_KEY = "admin-assistant-session-id";

/**
 * Generate a unique session ID for the current chat session
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get or create a session ID
 */
export function getSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  let sessionId = sessionStorage.getItem(CHAT_SESSION_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(CHAT_SESSION_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Save chat messages to localStorage
 */
export function saveChatMessages(messages: UIMessage[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const sessionId = getSessionId();
    const data = {
      sessionId,
      messages,
      timestamp: Date.now(),
    };
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save chat messages:", error);
  }
}

/**
 * Load chat messages from localStorage
 */
export function loadChatMessages(): UIMessage[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const data = JSON.parse(stored);
    const sessionId = getSessionId();

    // Only load messages from the current session
    if (data.sessionId === sessionId) {
      return data.messages || [];
    }

    return [];
  } catch (error) {
    console.error("Failed to load chat messages:", error);
    return [];
  }
}

/**
 * Clear chat history
 */
export function clearChatHistory(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    sessionStorage.removeItem(CHAT_SESSION_KEY);
  } catch (error) {
    console.error("Failed to clear chat history:", error);
  }
}

/**
 * Check if there's an active chat session
 */
export function hasActiveChatSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const stored = localStorage.getItem(CHAT_STORAGE_KEY);
  if (!stored) {
    return false;
  }

  try {
    const data = JSON.parse(stored);
    const sessionId = getSessionId();
    return data.sessionId === sessionId && data.messages?.length > 0;
  } catch {
    return false;
  }
}
