"use client";

import { useCallback, useEffect, useState } from "react";
import { useAI } from "../provider";
import type { AssistantAction, AssistantMessage } from "../types";

type UseAssistantOptions = {
  /** API endpoint for the assistant */
  api: string;
  /** Called when navigation action is triggered */
  onNavigate?: (path: string) => void;
  /** Called when form field should be updated */
  onFormField?: (fieldId: string, value: string, streaming?: boolean) => void;
  /** Called when toast should be shown */
  onToast?: (
    title: string,
    description?: string,
    variant?: "default" | "destructive"
  ) => void;
};

export function useAssistant({
  api,
  onNavigate,
  onFormField,
  onToast,
}: UseAssistantOptions) {
  const ai = useAI();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [localMessages, setLocalMessages] = useState<AssistantMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Execute pending actions
  const executeAction = useCallback(
    (action: AssistantAction) => {
      switch (action.type) {
        case "navigation":
          onNavigate?.(action.path);
          break;
        case "form-field":
          onFormField?.(action.fieldId, action.value, action.streaming);
          break;
        case "toast":
          onToast?.(action.title, action.description, action.variant);
          break;
        case "confirm":
          // Confirm actions are handled by UI
          break;
        default:
          break;
      }
      ai.executePendingAction(action);
    },
    [onNavigate, onFormField, onToast, ai]
  );

  // Auto-execute navigation actions
  useEffect(() => {
    for (const action of ai.pendingActions) {
      if (action.type === "navigation") {
        executeAction(action);
      }
    }
  }, [ai.pendingActions, executeAction]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) {
        return;
      }

      const userMessage: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: content }],
      };

      setLocalMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...localMessages, userMessage],
            context: ai.context,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const assistantMessage: AssistantMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          parts: [{ type: "text", text: "" }],
        };

        setLocalMessages((prev) => [...prev, assistantMessage]);

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;

          // Update the assistant message with accumulated text
          setLocalMessages((prev) => {
            const updated = [...prev];
            const lastMessage = updated.at(-1);
            if (lastMessage && lastMessage.role === "assistant") {
              lastMessage.parts = [{ type: "text", text: fullText }];
            }
            return updated;
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [api, localMessages, ai.context]
  );

  const clearChat = useCallback(() => {
    setLocalMessages([]);
    ai.clearMessages();
    ai.clearPendingActions();
  }, [ai]);

  return {
    // Chat state
    messages: localMessages,
    input,
    setInput,
    isLoading,
    error,

    // Actions
    sendMessage,
    clearChat,

    // Pending actions
    pendingActions: ai.pendingActions,
    executeAction,

    // Panel state
    isOpen: ai.isOpen,
    setOpen: ai.setOpen,
    toggle: ai.toggle,
  };
}
