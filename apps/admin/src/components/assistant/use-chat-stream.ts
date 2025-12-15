"use client";

import { useChat } from "@ai-sdk/react";
import type { AssistantMessage } from "@repo/ai/types";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownBuffer } from "@/lib/markdown-buffer";

// Chat persistence key
const CHAT_STORAGE_KEY = "admin-assistant-chat-history";

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

type PuckContentUpdate = {
  type: "puck-content";
  blockIndex: number;
  block: {
    type: string;
    props: Record<string, unknown>;
  };
  isComplete: boolean;
};

type UseChatStreamOptions = {
  api: string;
  onNavigate?: (path: string) => void;
  onFormField?: (update: FormFieldUpdate) => void;
  onCreatePage?: (params: { title: string; slug: string; locale: "en" | "no"; description?: string }) => Promise<void>;
  onPuckContent?: (update: PuckContentUpdate) => void;
  formContext?: FormContextType;
  puckData?: unknown;
  currentPath?: string;
};

type ChatMessagePart = {
  type: string;
  input?: unknown;
  toolCallId?: string;
  state?: string;
};

type NavigateToolPart = ChatMessagePart & {
  type: "tool-navigate";
  input: { path?: string };
  toolCallId: string;
  state: string;
};

type FillFormFieldsToolPart = ChatMessagePart & {
  type: "tool-fillFormFields";
  input: { updates?: Array<{ fieldId: string; value: string }> };
  toolCallId: string;
  state: string;
};

type TranslateContentToolPart = ChatMessagePart & {
  type: "tool-translateContent";
  toolCallId: string;
  state: string;
};

type CreatePageToolPart = ChatMessagePart & {
  type: "tool-createPage";
  input: { title: string; slug: string; locale: "en" | "no"; description?: string };
  toolCallId: string;
  state: string;
};

type GeneratePuckContentToolPart = ChatMessagePart & {
  type: "tool-generatePuckContent";
  input?: { content?: unknown };
  toolCallId: string;
  state: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFormFieldUpdate = (
  update: unknown
): update is {
  fieldId: string;
  value: string;
} => {
  if (!isObject(update)) {
    return false;
  }
  const fieldId = (update as { fieldId?: unknown }).fieldId;
  const value = (update as { value?: unknown }).value;
  return typeof fieldId === "string" && typeof value === "string";
};

const isNavigateToolPart = (part: ChatMessagePart): part is NavigateToolPart =>
  part.type === "tool-navigate" &&
  typeof part.toolCallId === "string" &&
  typeof part.state === "string" &&
  isObject(part.input);

const isFillFormFieldsPart = (
  part: ChatMessagePart
): part is FillFormFieldsToolPart => {
  if (
    part.type !== "tool-fillFormFields" ||
    typeof part.toolCallId !== "string" ||
    typeof part.state !== "string" ||
    !isObject(part.input)
  ) {
    return false;
  }
  const updates = (part.input as { updates?: unknown }).updates;
  if (updates === undefined) {
    return true;
  }
  return Array.isArray(updates) && updates.every(isFormFieldUpdate);
};

const isTranslateContentPart = (
  part: ChatMessagePart
): part is TranslateContentToolPart =>
  part.type === "tool-translateContent" &&
  typeof part.toolCallId === "string" &&
  typeof part.state === "string";

const isCreatePagePart = (
  part: ChatMessagePart
): part is CreatePageToolPart =>
  part.type === "tool-createPage" &&
  typeof part.toolCallId === "string" &&
  typeof part.state === "string" &&
  isObject(part.input);

const isGeneratePuckContentPart = (
  part: ChatMessagePart
): part is GeneratePuckContentToolPart =>
  part.type === "tool-generatePuckContent" &&
  typeof part.toolCallId === "string" &&
  typeof part.state === "string";

/**
 * Wrapper around the Vercel AI SDK's useChat hook
 * Adds support for navigation and form field actions
 */
export function useChatStream({
  api,
  onNavigate,
  onFormField,
  onCreatePage,
  onPuckContent,
  formContext,
  puckData,
  currentPath,
}: UseChatStreamOptions) {
  // Store callbacks in refs to avoid stale closures
  const onNavigateRef = useRef(onNavigate);
  const onFormFieldRef = useRef(onFormField);
  const onCreatePageRef = useRef(onCreatePage);
  const onPuckContentRef = useRef(onPuckContent);
  const puckDataRef = useRef(puckData);
  const currentPathRef = useRef(currentPath);
  const formContextRef = useRef(formContext);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onFormFieldRef.current = onFormField;
    onCreatePageRef.current = onCreatePage;
    onPuckContentRef.current = onPuckContent;
    puckDataRef.current = puckData;
    currentPathRef.current = currentPath;
    formContextRef.current = formContext;
  }, [onNavigate, onFormField, onCreatePage, onPuckContent, puckData, currentPath, formContext]);

  // Create transport with dynamic body data
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api,
        body: () => ({
          ...(formContextRef.current ? { formContext: formContextRef.current } : {}),
          ...(puckDataRef.current ? { puckData: puckDataRef.current } : {}),
          ...(currentPathRef.current ? { currentPath: currentPathRef.current } : {}),
        }),
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

  const getStreamedFields = useCallback((toolCallId: string) => {
    if (!streamedFieldsRef.current.has(toolCallId)) {
      streamedFieldsRef.current.set(toolCallId, new Set());
    }
    return streamedFieldsRef.current.get(toolCallId)!;
  }, []);

  const getFieldStreamingState = useCallback(
    (fieldId: string, isDescriptionField: boolean) => {
      const existing = streamingFieldsRef.current.get(fieldId);
      if (existing) {
        return existing;
      }
      const buffer = isDescriptionField
        ? new MarkdownBuffer((content) => {
            onFormFieldRef.current?.({
              fieldId,
              fieldName: fieldId,
              value: content,
              streaming: true,
              isComplete: false,
            });
          })
        : null;
      const nextState = { lastValue: "", buffer };
      streamingFieldsRef.current.set(fieldId, nextState);
      return nextState;
    },
    []
  );

  const flushStreamingBuffers = useCallback(() => {
    for (const [fieldId, state] of streamingFieldsRef.current.entries()) {
      if (!state.buffer) {
        continue;
      }
      state.buffer.flush();
      onFormFieldRef.current?.({
        fieldId,
        fieldName: fieldId,
        value: state.lastValue,
        streaming: false,
        isComplete: true,
      });
    }
    streamingFieldsRef.current.clear();
  }, []);

  const processFieldUpdate = useCallback(
    (
      update: { fieldId: string; value: string },
      isComplete: boolean,
      streamedFields: Set<string>
    ) => {
      const { fieldId, value } = update;
      const isDescriptionField = fieldId.includes("description");
      const fieldState = getFieldStreamingState(fieldId, isDescriptionField);

      if (value === fieldState.lastValue) {
        return;
      }

      fieldState.lastValue = value;

      if (isDescriptionField && fieldState.buffer) {
        fieldState.buffer.reset();
        fieldState.buffer.append(value);

        if (isComplete) {
          fieldState.buffer.flush();
        }
      } else {
        onFormFieldRef.current?.({
          fieldId,
          fieldName: fieldId,
          value,
          streaming: !isComplete,
          isComplete,
        });
      }

      streamedFields.add(fieldId);
    },
    [getFieldStreamingState]
  );

  // Handle navigation tool calls
  const handleNavigateTool = useCallback(
    (toolPart: NavigateToolPart) => {
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

  // Handle create-page tool calls
  const handleCreatePageTool = useCallback(
    async (toolPart: CreatePageToolPart) => {
      if (toolPart.state !== "input-available") {
        return;
      }
      if (handledToolCallsRef.current.has(toolPart.toolCallId)) {
        return;
      }

      handledToolCallsRef.current.add(toolPart.toolCallId);
      
      try {
        await onCreatePageRef.current?.(toolPart.input);
        addToolResult({
          toolCallId: toolPart.toolCallId,
          tool: "createPage",
          output: { success: true, created: toolPart.input },
        });
      } catch (error) {
        addToolResult({
          toolCallId: toolPart.toolCallId,
          tool: "createPage",
          output: { success: false, error: String(error) },
        });
      }
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

      const streamedFields = getStreamedFields(toolCallId);

      for (const update of updates) {
        processFieldUpdate(update, isComplete, streamedFields);
      }

      // If complete, flush all buffers and clean up
      if (isComplete) {
        flushStreamingBuffers();
        streamedFieldsRef.current.delete(toolCallId);
      }
    },
    [flushStreamingBuffers, getStreamedFields, processFieldUpdate]
  );

  // Handle translate tool calls
  const handleTranslateTool = useCallback(
    (toolPart: TranslateContentToolPart) => {
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

  const handleFillFormFieldsPart = useCallback(
    (toolPart: FillFormFieldsToolPart) => {
      const isComplete = toolPart.state === "input-available";
      const isStreaming = toolPart.state === "partial";

      if ((isStreaming || isComplete) && toolPart.input?.updates) {
        handleFormFieldStreaming(
          toolPart.toolCallId,
          toolPart.input.updates,
          isComplete
        );
      }

      if (isComplete && !handledToolCallsRef.current.has(toolPart.toolCallId)) {
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
    },
    [addToolResult, handleFormFieldStreaming]
  );

  const handleGeneratePuckContentPart = useCallback(
    (toolPart: GeneratePuckContentToolPart) => {
      if (toolPart.state !== "input-available") {
        return;
      }
      if (handledToolCallsRef.current.has(toolPart.toolCallId)) {
        return;
      }

      handledToolCallsRef.current.add(toolPart.toolCallId);
      
      if (toolPart.input?.content && onPuckContentRef.current) {
        const content = toolPart.input.content as { content?: Array<{ type: string; props: Record<string, unknown> }> };
        if (content.content && Array.isArray(content.content)) {
          for (const [index, block] of content.content.entries()) {
            onPuckContentRef.current({
              type: "puck-content",
              blockIndex: index,
              block,
              isComplete: index === content.content.length - 1,
            });
          }
        }
      }

      addToolResult({
        toolCallId: toolPart.toolCallId,
        tool: "generatePuckContent",
        output: { success: true, message: "Content generated" },
      });
    },
    [addToolResult]
  );

  const handleToolPart = useCallback(
    (part: ChatMessagePart) => {
      if (isNavigateToolPart(part)) {
        handleNavigateTool(part);
        return;
      }

      if (isCreatePagePart(part)) {
        handleCreatePageTool(part);
        return;
      }

      if (isGeneratePuckContentPart(part)) {
        handleGeneratePuckContentPart(part);
        return;
      }

      if (isFillFormFieldsPart(part)) {
        handleFillFormFieldsPart(part);
        return;
      }

      if (isTranslateContentPart(part)) {
        handleTranslateTool(part);
      }
    },
    [handleCreatePageTool, handleGeneratePuckContentPart, handleFillFormFieldsPart, handleNavigateTool, handleTranslateTool]
  );

  // Watch for tool calls in message parts and handle them
  useEffect(() => {
    for (const msg of chatMessages) {
      if (msg.role !== "assistant") {
        continue;
      }

      for (const part of msg.parts) {
        handleToolPart(part as ChatMessagePart);
      }
    }
  }, [chatMessages, handleToolPart]);

  // Convert AI SDK messages to our AssistantMessage format
  const messages: AssistantMessage[] = chatMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    parts: msg.parts
      .map((part) => {
        if (part.type === "text") {
          return { type: "text" as const, text: part.text };
        }
        // Handle tool calls - don't show them (they're handled separately)
        if (part.type === "tool-call") {
          return null;
        }
        // Handle tool results - don't show them
        if (part.type === "tool-result") {
          return null;
        }
        return { type: "text" as const, text: "" };
      })
      .filter((part): part is { type: "text"; text: string } => part !== null),
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
    setMessages: setChatMessages,
  };
}
