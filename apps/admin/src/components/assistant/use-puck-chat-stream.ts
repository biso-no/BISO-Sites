"use client";

import { useChat } from "@ai-sdk/react";
import {
  type StreamEvent,
  StreamingJSONParser,
} from "@repo/ai/lib/streaming-json-parser";
import type { AssistantMessage } from "@repo/ai/types";
import type { AgentState } from "@repo/ai/types/agent-state";
import { inferAgentState } from "@repo/ai/types/agent-state";
import type { Data } from "@repo/editor";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PuckContentUpdate = {
  type: "puck-content";
  blockIndex: number;
  block: {
    type: string;
    props: Record<string, unknown>;
  };
  isComplete: boolean;
};

type UsePuckChatStreamOptions = {
  api: string;
  onNavigate?: (path: string) => void;
  onPuckContent?: (update: PuckContentUpdate) => void;
  currentPath?: string;
  puckData?: Data;
};

type ChatMessagePart = {
  type: string;
  input?: unknown;
  toolCallId?: string;
  state?: string;
  text?: string;
};

type NavigateToolPart = ChatMessagePart & {
  type: "tool-navigate";
  input: { path?: string };
  toolCallId: string;
  state: string;
};

type PuckGeneratorToolPart = ChatMessagePart & {
  type: "tool-generatePuckContent";
  input?: { content?: unknown };
  toolCallId: string;
  state: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNavigateToolPart = (part: ChatMessagePart): part is NavigateToolPart =>
  part.type === "tool-navigate" &&
  typeof part.toolCallId === "string" &&
  typeof part.state === "string" &&
  isObject(part.input);

const isPuckGeneratorPart = (
  part: ChatMessagePart
): part is PuckGeneratorToolPart =>
  part.type === "tool-generatePuckContent" &&
  typeof part.toolCallId === "string" &&
  typeof part.state === "string";

/**
 * Enhanced chat stream hook with Puck content generation support
 */
export function usePuckChatStream({
  api,
  onNavigate,
  onPuckContent,
  currentPath,
  puckData,
}: UsePuckChatStreamOptions) {
  const onNavigateRef = useRef(onNavigate);
  const onPuckContentRef = useRef(onPuckContent);
  const currentPathRef = useRef(currentPath);
  const puckDataRef = useRef(puckData);

  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [currentToolCall, setCurrentToolCall] = useState<string | undefined>();

  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onPuckContentRef.current = onPuckContent;
    currentPathRef.current = currentPath;
    puckDataRef.current = puckData;
  }, [onNavigate, onPuckContent, currentPath, puckData]);

  // Create transport with dynamic body data
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api,
        body: () => ({
          currentPath: currentPathRef.current,
          puckData: puckDataRef.current,
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

  // Track handled tool calls
  const handledToolCallsRef = useRef<Set<string>>(new Set());

  // Streaming JSON parser for Puck content
  const parserRef = useRef<StreamingJSONParser | null>(null);

  // Initialize parser when needed
  const getParser = useCallback(() => {
    if (!parserRef.current) {
      parserRef.current = new StreamingJSONParser((event: StreamEvent) => {
        if (event.type === "block-start" || event.type === "block-complete") {
          onPuckContentRef.current?.({
            type: "puck-content",
            blockIndex: event.blockIndex,
            block:
              event.type === "block-start" ? event.partialBlock : event.block,
            isComplete: event.type === "block-complete",
          });
        }
      });
    }
    return parserRef.current;
  }, []);

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
      setAgentState("navigating");
      onNavigateRef.current?.(toolPart.input.path);

      addToolResult({
        toolCallId: toolPart.toolCallId,
        tool: "navigate",
        output: { success: true, navigatedTo: toolPart.input.path },
      });

      setTimeout(() => setAgentState("idle"), 500);
    },
    [addToolResult]
  );

  // Handle Puck content generation
  const handlePuckGeneratorTool = useCallback(
    (toolPart: PuckGeneratorToolPart) => {
      const isStreaming = toolPart.state === "partial";
      const isComplete = toolPart.state === "input-available";

      if (isStreaming) {
        setAgentState("generating-content");
        setCurrentToolCall("generatePuckContent");

        // Parse streaming JSON
        if (toolPart.input) {
          const parser = getParser();
          const jsonStr = JSON.stringify(toolPart.input);
          parser.append(jsonStr);
        }
      }

      if (isComplete && !handledToolCallsRef.current.has(toolPart.toolCallId)) {
        handledToolCallsRef.current.add(toolPart.toolCallId);

        // Finalize parser
        if (parserRef.current) {
          parserRef.current.finalize();
          parserRef.current = null;
        }

        addToolResult({
          toolCallId: toolPart.toolCallId,
          tool: "generatePuckContent",
          output: { success: true, message: "Content generated" },
        });

        setAgentState("idle");
        setCurrentToolCall(undefined);
      }
    },
    [addToolResult, getParser]
  );

  const handleToolPart = useCallback(
    (part: ChatMessagePart) => {
      if (isNavigateToolPart(part)) {
        handleNavigateTool(part);
        return;
      }

      if (isPuckGeneratorPart(part)) {
        handlePuckGeneratorTool(part);
        return;
      }
    },
    [handleNavigateTool, handlePuckGeneratorTool]
  );

  // Watch for tool calls in message parts
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

  // Update agent state based on loading and tool calls
  useEffect(() => {
    if (isLoading && agentState === "idle") {
      const hasContent = chatMessages.some(
        (msg) =>
          msg.role === "assistant" && msg.parts.some((p) => p.type === "text")
      );
      const newState = inferAgentState(isLoading, currentToolCall, hasContent);
      setAgentState(newState);
    } else if (!isLoading && agentState !== "idle") {
      setAgentState("idle");
      setCurrentToolCall(undefined);
    }
  }, [isLoading, agentState, currentToolCall, chatMessages]);

  // Convert AI SDK messages to AssistantMessage format
  const messages: AssistantMessage[] = chatMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    parts: msg.parts
      .filter((part) => part.type === "text")
      .map((part) => ({
        type: "text" as const,
        text: (part as { text: string }).text,
      })),
  }));

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) {
        return;
      }
      setAgentState("thinking");
      await sdkSendMessage({ text: content });
    },
    [sdkSendMessage, isLoading]
  );

  const clearMessages = useCallback(() => {
    setChatMessages([]);
    setAgentState("idle");
    setCurrentToolCall(undefined);
    handledToolCallsRef.current.clear();
    if (parserRef.current) {
      parserRef.current.reset();
    }
  }, [setChatMessages]);

  return {
    messages,
    isLoading,
    agentState,
    error,
    sendMessage,
    clearMessages,
  };
}
