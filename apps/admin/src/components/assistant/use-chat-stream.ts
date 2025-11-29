"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { AssistantMessage } from "@repo/ai/types";

type FormFieldUpdate = {
  fieldId: string;
  fieldName: string;
  value: string;
  streaming?: boolean;
};

type FormContextType = {
  formId: string;
  formName: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    label: string;
    required?: boolean;
    currentValue?: unknown;
  }>;
};

type UseChatStreamOptions = {
  api: string;
  onNavigate?: (path: string) => void;
  onFormField?: (update: FormFieldUpdate) => void;
  formContext?: FormContextType;
};

/**
 * Wrapper around the Vercel AI SDK's useChat hook
 * Adds support for navigation and form field actions
 */
export function useChatStream({
  api,
  onNavigate,
  onFormField,
  formContext,
}: UseChatStreamOptions) {
  // Store callbacks in refs to avoid stale closures
  const onNavigateRef = useRef(onNavigate);
  const onFormFieldRef = useRef(onFormField);
  const formContextRef = useRef(formContext);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onFormFieldRef.current = onFormField;
    formContextRef.current = formContext;
  }, [onNavigate, onFormField, formContext]);

  // Create transport with dynamic body data
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api,
        body: () =>
          formContextRef.current
            ? { formContext: formContextRef.current }
            : {},
      }),
    [api]
  );

  const {
    messages: chatMessages,
    status,
    error,
    sendMessage: sdkSendMessage,
    setMessages: setChatMessages,
    addToolResult,
  } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Track which tool calls we've already handled
  const handledToolCallsRef = useRef<Set<string>>(new Set());

  // Watch for tool calls in message parts and handle them
  useEffect(() => {
    for (const msg of chatMessages) {
      if (msg.role !== "assistant") {
        continue;
      }

      for (const part of msg.parts) {
        // Handle navigation tool calls - the type is "tool-{toolName}"
        if (part.type === "tool-navigate" && "input" in part && "toolCallId" in part) {
          const toolPart = part as { toolCallId: string; input: { path?: string }; state: string };
          
          // Only handle when input is available and we haven't handled this call yet
          if (toolPart.state === "input-available" && toolPart.input?.path && !handledToolCallsRef.current.has(toolPart.toolCallId)) {
              handledToolCallsRef.current.add(toolPart.toolCallId);
              
              // Navigate to the path
              onNavigateRef.current?.(toolPart.input.path);
              
              // Provide tool result so the AI can continue
              addToolResult({
                toolCallId: toolPart.toolCallId,
                tool: "navigate",
                output: { success: true, navigatedTo: toolPart.input.path },
              });
          }
        }

        // Handle form filler tool calls
        if (part.type === "tool-fillFormFields" && "input" in part && "toolCallId" in part) {
          const toolPart = part as { 
            toolCallId: string; 
            input: { updates?: Array<{ fieldId: string; value: string }> }; 
            state: string 
          };
          
          if (toolPart.state === "input-available" && toolPart.input?.updates && !handledToolCallsRef.current.has(toolPart.toolCallId)) {
              handledToolCallsRef.current.add(toolPart.toolCallId);
              
              console.log("Filling form fields:", toolPart.input.updates);
              
              for (const update of toolPart.input.updates) {
                onFormFieldRef.current?.({
                  fieldId: update.fieldId,
                  fieldName: update.fieldId,
                  value: update.value,
                });
              }
              
              // Provide tool result
              addToolResult({
                toolCallId: toolPart.toolCallId,
                tool: "fillFormFields",
                output: { success: true, fieldsUpdated: toolPart.input.updates.length },
              });
          }
        }

        // Handle translate tool calls - just acknowledge, the AI handles the actual translation
        if (part.type === "tool-translateContent" && "input" in part && "toolCallId" in part) {
          const toolPart = part as { toolCallId: string; state: string };
          
          if (toolPart.state === "input-available" && !handledToolCallsRef.current.has(toolPart.toolCallId)) {
            handledToolCallsRef.current.add(toolPart.toolCallId);
            
            // Just acknowledge - the AI will use the result to generate translated content
            addToolResult({
              toolCallId: toolPart.toolCallId,
              tool: "translateContent",
              output: { success: true, message: "Translation ready" },
            });
          }
        }
      }
    }
  }, [chatMessages, addToolResult]);

  // Convert AI SDK messages to our AssistantMessage format
  const messages: AssistantMessage[] = chatMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    parts: msg.parts.map((part) => {
      if (part.type === "text") {
        return { type: "text" as const, text: part.text };
      }
      // Handle tool calls - show tool name
      if (part.type === "tool-call") {
        return { type: "text" as const, text: "" };
      }
      // Handle tool results
      if (part.type === "tool-result") {
        return { type: "text" as const, text: "" };
      }
      return { type: "text" as const, text: "" };
    }),
  }));

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) {
        return;
      }
      await sdkSendMessage({ text: content });
    },
    [sdkSendMessage, isLoading]
  );

  const clearMessages = useCallback(() => {
    setChatMessages([]);
  }, [setChatMessages]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
