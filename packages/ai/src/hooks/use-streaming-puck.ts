/**
 * useStreamingPuck Hook
 *
 * Connects json-render's useUIStream to the Puck editor, handling:
 * - Streaming JSONL patches from the API
 * - Applying patches to Puck data in real-time
 * - Block selection context for targeted editing
 * - Integration with copilot store for state management
 */

"use client";

import type { UITree } from "@json-render/core";
import { useUIStream } from "@json-render/react";
import type { Data } from "@puckeditor/core";
import { createStreamHandler } from "@repo/editor/stream-handler";
import { treeToPuckData } from "@repo/editor/tree-to-puck";
import { useCallback, useEffect, useRef, useState } from "react";
import { type AgentState, useCopilotStore } from "../stores/copilot-store";

type UseStreamingPuckOptions = {
  /**
   * Current Puck data state
   */
  data: Data;

  /**
   * Callback when data changes from streaming
   */
  onDataChange: (data: Data) => void;

  /**
   * Currently selected block index in Puck (if any)
   */
  selectedBlockIndex?: number;

  /**
   * API endpoint for streaming generation
   * @default "/api/ai/generate-page"
   */
  apiEndpoint?: string;
};

type UseStreamingPuckReturn = {
  /**
   * Current json-render tree (for preview if needed)
   */
  tree: UITree | null;

  /**
   * Whether content is currently streaming
   */
  isStreaming: boolean;

  /**
   * Any error that occurred
   */
  error: Error | null;

  /**
   * Send a prompt to generate/modify content.
   * @param selectedBlockIndex - Optional override for the selected block index.
   *   Pass this when the caller (e.g. AI assistant plugin) knows the target block
   *   index independently of the hook's own selectedBlockIndex option.
   */
  generate: (prompt: string, selectedBlockIndex?: number) => Promise<void>;

  /**
   * Abort current streaming
   */
  abort: () => void;

  /**
   * Clear current tree
   */
  clear: () => void;
};

/**
 * Hook for streaming AI-generated Puck content
 *
 * @example
 * ```tsx
 * const { generate, isStreaming } = useStreamingPuck({
 *   data: puckData,
 *   onDataChange: setPuckData,
 *   selectedBlockIndex: selectedIndex,
 * });
 *
 * // Generate new content
 * await generate("Create an about page with hero and team grid");
 *
 * // Replace selected block
 * await generate("Replace this with a FeatureGrid");
 * ```
 */
export function useStreamingPuck({
  data,
  onDataChange,
  selectedBlockIndex,
  apiEndpoint = "/api/ai/generate-page",
}: UseStreamingPuckOptions): UseStreamingPuckReturn {
  const setAgentState = useCopilotStore((state) => state.setAgentState);

  // Track current data in ref to avoid stale closures
  const dataRef = useRef(data);
  const onDataChangeRef = useRef(onDataChange);

  useEffect(() => {
    dataRef.current = data;
    onDataChangeRef.current = onDataChange;
  }, [data, onDataChange]);

  // Local state for error tracking
  const [streamError, setStreamError] = useState<Error | null>(null);

  // Stream handler for processing JSONL patches
  const streamHandlerRef = useRef(
    createStreamHandler((newData) => {
      onDataChangeRef.current(newData);
    }, data)
  );

  // Update stream handler when data changes
  useEffect(() => {
    streamHandlerRef.current.reset(data);
  }, [data]);

  // Use json-render's streaming hook
  const {
    tree,
    isStreaming,
    error: uiStreamError,
    send,
    clear,
  } = useUIStream({
    api: apiEndpoint,
    onComplete: (completedTree) => {
      // Convert completed tree to Puck data
      const puckData = treeToPuckData(completedTree);
      onDataChangeRef.current(puckData);
      setAgentState("idle", "Content generated successfully");
    },
    onError: (err) => {
      setStreamError(err);
      setAgentState("idle", `Error: ${err.message}`);
    },
  });

  // Generate function that includes context
  const generate = useCallback(
    async (prompt: string, selectedBlockIndexOverride?: number) => {
      setStreamError(null);
      setAgentState("generating-content", "Generating page content...");

      try {
        const effectiveIndex = selectedBlockIndexOverride ?? selectedBlockIndex;
        // Send with current context
        await send(prompt, {
          currentData: dataRef.current,
          selectedBlockIndex: effectiveIndex,
        });
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setStreamError(errorObj);
        setAgentState("idle", `Error: ${errorObj.message}`);
      }
    },
    [send, selectedBlockIndex, setAgentState]
  );

  // Abort function
  const abort = useCallback(() => {
    clear();
    setAgentState("idle", "Generation cancelled");
  }, [clear, setAgentState]);

  // Update agent state when streaming
  useEffect(() => {
    if (isStreaming) {
      setAgentState("generating-content", "Streaming content...");
    }
  }, [isStreaming, setAgentState]);

  return {
    tree,
    isStreaming,
    error: streamError || uiStreamError,
    generate,
    abort,
    clear,
  };
}

/**
 * Helper to process a streaming response body
 */
async function processStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (chunk: string) => void
): Promise<void> {
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk);
  }
}

/**
 * Helper to handle generate errors
 */
function handleGenerateError(
  err: unknown,
  setRawError: (error: Error | null) => void,
  setAgentState: (state: AgentState, message?: string) => void
): void {
  if ((err as Error).name === "AbortError") {
    setAgentState("idle", "Generation cancelled");
    return;
  }

  const errorObj = err instanceof Error ? err : new Error(String(err));
  setRawError(errorObj);
  setAgentState("idle", `Error: ${errorObj.message}`);
}

/**
 * Alternative hook that processes raw JSONL streaming (for custom endpoints)
 *
 * Use this if you need more control over the streaming process
 * or are using a custom API that doesn't use json-render's format.
 */
export function useStreamingPuckRaw({
  data,
  onDataChange,
  selectedBlockIndex,
  apiEndpoint = "/api/ai/generate-page",
}: UseStreamingPuckOptions): UseStreamingPuckReturn {
  const setAgentState = useCopilotStore((state) => state.setAgentState);

  const [isStreaming, setIsStreaming] = useState(false);
  const [rawError, setRawError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track current data in ref
  const dataRef = useRef(data);
  const onDataChangeRef = useRef(onDataChange);

  useEffect(() => {
    dataRef.current = data;
    onDataChangeRef.current = onDataChange;
  }, [data, onDataChange]);

  // Create stream handler
  const streamHandlerRef = useRef(
    createStreamHandler((newData) => {
      onDataChangeRef.current(newData);
    }, data)
  );

  useEffect(() => {
    streamHandlerRef.current.reset(data);
  }, [data]);

  const generate = useCallback(
    async (prompt: string, selectedBlockIndexOverride?: number) => {
      // Abort any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setRawError(null);
      setIsStreaming(true);
      setAgentState("generating-content", "Generating page content...");

      const effectiveIndex = selectedBlockIndexOverride ?? selectedBlockIndex;

      try {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            currentData: dataRef.current,
            selectedBlockIndex: effectiveIndex,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        await processStream(reader, (chunk) => {
          streamHandlerRef.current.processChunk(chunk);
        });

        streamHandlerRef.current.finalize();
        setAgentState("idle", "Content generated successfully");
      } catch (err) {
        handleGenerateError(err, setRawError, setAgentState);
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [apiEndpoint, selectedBlockIndex, setAgentState]
  );

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clear = useCallback(() => {
    streamHandlerRef.current.reset(dataRef.current);
  }, []);

  return {
    tree: null, // Raw mode doesn't build a tree
    isStreaming,
    error: rawError,
    generate,
    abort,
    clear,
  };
}
