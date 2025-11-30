"use client";

import { useChat } from "@ai-sdk/react";
import type { AssistantMessage } from "@repo/ai/types";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MarkdownBuffer } from "@/lib/markdown-buffer";

type FormFieldUpdate = {
  fieldId: string;
  fieldName: string;
  value: string;
  streaming?: boolean;
  isComplete?: boolean;
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
          formContextRef.current ? { formContext: formContextRef.current } : {},
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

  // Track which tool calls we've already handled (completed)
  const handledToolCallsRef = useRef<Set<string>>(new Set());

  // Track streaming state for each field
  const streamingFieldsRef = useRef<
    Map<
      string,
      {
        lastValue: string;
        buffer: MarkdownBuffer | null;
      }
    >
  >(new Map());

  // Track which fields we've already started streaming for each tool call
  const streamedFieldsRef = useRef<Map<string, Set<string>>>(new Map());

  // Handle navigation tool calls
  const handleNavigateTool = useCallback(
    (toolPart: {
      toolCallId: string;
      input: { path?: string };
      state: string;
    }) => {
      if (toolPart.state !== "input-available") {
        return;
      }
      if (!toolPart.input?.path) {
        return;
      }
      if (handledToolCallsRef.current.has(toolPart.toolCallId)) {
        return;
      }

      handledToolCallsRef.current.add(toolPart.toolCallId);
      onNavigateRef.current?.(toolPart.input.path);
      addToolResult({
        toolCallId: toolPart.toolCallId,
        tool: "navigate",
        output: { success: true, navigatedTo: toolPart.input.path },
      });
    },
    [addToolResult]
  );

  // Handle streaming form field updates
  const handleFormFieldStreaming = useCallback(
    (
      toolCallId: string,
      updates: Array<{ fieldId: string; value: string }> | undefined,
      isComplete: boolean
    ) => {
      if (!updates) {
        return;
      }

      // Get or create the set of streamed fields for this tool call
      if (!streamedFieldsRef.current.has(toolCallId)) {
        streamedFieldsRef.current.set(toolCallId, new Set());
      }
      const streamedFields = streamedFieldsRef.current.get(toolCallId)!;

      for (const update of updates) {
        const { fieldId, value } = update;

        // Check if this is a description field (needs markdown buffering)
        const isDescriptionField = fieldId.includes("description");

        // Get or create streaming state for this field
        let fieldState = streamingFieldsRef.current.get(fieldId);
        if (!fieldState) {
          fieldState = {
            lastValue: "",
            buffer: isDescriptionField
              ? new MarkdownBuffer((content) => {
                  onFormFieldRef.current?.({
                    fieldId,
                    fieldName: fieldId,
                    value: content,
                    streaming: true,
                    isComplete: false,
                  });
                })
              : null,
          };
          streamingFieldsRef.current.set(fieldId, fieldState);
        }

        // Only emit if the value has changed
        if (value === fieldState.lastValue) {
          continue;
        }

        fieldState.lastValue = value;

        if (isDescriptionField && fieldState.buffer) {
          // For description fields, use the markdown buffer
          // Reset and re-add the full content (since we get the full value each time)
          fieldState.buffer.reset();
          fieldState.buffer.append(value);

          if (isComplete) {
            fieldState.buffer.flush();
          }
        } else {
          // For regular fields, emit directly
          onFormFieldRef.current?.({
            fieldId,
            fieldName: fieldId,
            value,
            streaming: !isComplete,
            isComplete,
          });
        }

        streamedFields.add(fieldId);
      }

      // If complete, flush all buffers and clean up
      if (isComplete) {
        for (const [fieldId, state] of streamingFieldsRef.current.entries()) {
          if (state.buffer) {
            state.buffer.flush();
            // Send final complete update
            onFormFieldRef.current?.({
              fieldId,
              fieldName: fieldId,
              value: state.lastValue,
              streaming: false,
              isComplete: true,
            });
          }
        }
        streamingFieldsRef.current.clear();
        streamedFieldsRef.current.delete(toolCallId);
      }
    },
    []
  );

  // Handle translate tool calls
  const handleTranslateTool = useCallback(
    (toolPart: { toolCallId: string; state: string }) => {
      if (toolPart.state !== "input-available") {
        return;
      }
      if (handledToolCallsRef.current.has(toolPart.toolCallId)) {
        return;
      }

      handledToolCallsRef.current.add(toolPart.toolCallId);
      addToolResult({
        toolCallId: toolPart.toolCallId,
        tool: "translateContent",
        output: { success: true, message: "Translation ready" },
      });
    },
    [addToolResult]
  );

  // Watch for tool calls in message parts and handle them
  useEffect(() => {
    for (const msg of chatMessages) {
      if (msg.role !== "assistant") {
        continue;
      }

      for (const part of msg.parts) {
        // Handle navigation tool calls
        if (
          part.type === "tool-navigate" &&
          "input" in part &&
          "toolCallId" in part
        ) {
          handleNavigateTool(
            part as {
              toolCallId: string;
              input: { path?: string };
              state: string;
            }
          );
        }

        // Handle form filler tool calls - both streaming (partial) and complete
        if (
          part.type === "tool-fillFormFields" &&
          "input" in part &&
          "toolCallId" in part
        ) {
          const toolPart = part as {
            toolCallId: string;
            input: { updates?: Array<{ fieldId: string; value: string }> };
            state: string;
          };

          const isComplete = toolPart.state === "input-available";
          const isStreaming = toolPart.state === "partial";

          if ((isStreaming || isComplete) && toolPart.input?.updates) {
            handleFormFieldStreaming(
              toolPart.toolCallId,
              toolPart.input.updates,
              isComplete
            );
          }

          // Only send tool result when complete
          if (
            isComplete &&
            !handledToolCallsRef.current.has(toolPart.toolCallId)
          ) {
            handledToolCallsRef.current.add(toolPart.toolCallId);
            addToolResult({
              toolCallId: toolPart.toolCallId,
              tool: "fillFormFields",
              output: {
                success: true,
                fieldsUpdated: toolPart.input.updates?.length ?? 0,
              },
            });
          }
        }

        // Handle translate tool calls
        if (
          part.type === "tool-translateContent" &&
          "input" in part &&
          "toolCallId" in part
        ) {
          handleTranslateTool(part as { toolCallId: string; state: string });
        }
      }
    }
  }, [
    chatMessages,
    addToolResult,
    handleNavigateTool,
    handleFormFieldStreaming,
    handleTranslateTool,
  ]);

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
