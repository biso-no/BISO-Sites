"use client";

import { useCallback, useEffect, useRef } from "react";
import { type PageCapability, useCopilotStore } from "../stores/copilot-store";

// Re-export the new streaming hook for easy access
export { useStreamingPuck, useStreamingPuckRaw } from "./use-streaming-puck";

type PuckBlock = {
  type: string;
  props: Record<string, unknown>;
};

type PuckData = {
  content: PuckBlock[];
  root?: {
    props?: Record<string, unknown>;
  };
};

type UseCopilotPuckOptions = {
  /**
   * Current Puck data state
   */
  data: PuckData;

  /**
   * Callback to update Puck data
   */
  onDataChange: (data: PuckData) => void;

  /**
   * The capability this editor provides (e.g., "create-page", "edit-page")
   */
  capability: PageCapability;

  /**
   * Whether the copilot integration is enabled (default: true)
   */
  enabled?: boolean;
};

/**
 * Hook to connect a Puck editor to the AI copilot
 *
 * This hook:
 * 1. Registers the Puck editor with the copilot store when mounted
 * 2. Provides a handler for the AI to stream blocks into the editor
 * 3. Unregisters when unmounted
 *
 * For real-time streaming with json-render patches, use `useStreamingPuck` instead,
 * which provides:
 * - JSONL patch-based streaming for inline updates
 * - Block selection context for targeted editing
 * - Integration with json-render's useUIStream
 *
 * @example
 * ```tsx
 * const [data, setData] = useState<Data>(initialData);
 *
 * useCopilotPuck({
 *   data,
 *   onDataChange: setData,
 *   capability: "edit-page",
 * });
 * ```
 */
export function useCopilotPuck({
  data,
  onDataChange,
  capability,
  enabled = true,
}: UseCopilotPuckOptions) {
  const registerHandler = useCopilotStore((state) => state.registerHandler);
  const unregisterHandler = useCopilotStore((state) => state.unregisterHandler);
  const setAgentState = useCopilotStore((state) => state.setAgentState);

  // Keep refs updated to avoid stale closures
  const dataRef = useRef(data);
  const onDataChangeRef = useRef(onDataChange);

  useEffect(() => {
    dataRef.current = data;
    onDataChangeRef.current = onDataChange;
  }, [data, onDataChange]);

  // Track blocks being streamed
  const streamingBlocksRef = useRef<Map<number, PuckBlock>>(new Map());

  /**
   * Handle Puck content updates from the AI
   * Supports streaming blocks one at a time
   */
  const handlePuckContent = useCallback(
    (update: { blockIndex: number; block: PuckBlock; isComplete: boolean }) => {
      const { blockIndex, block, isComplete } = update;

      console.log(
        "[Puck] handlePuckContent called:",
        blockIndex,
        block.type,
        "isComplete:",
        isComplete
      );

      setAgentState("generating-content", `Adding ${block.type} block...`);

      // Store the streaming block - this accumulates all blocks
      streamingBlocksRef.current.set(blockIndex, block);

      // Build content from ALL accumulated blocks (handles synchronous batch calls)
      const accumulatedBlocks: PuckBlock[] = [];
      const sortedIndices = [...streamingBlocksRef.current.keys()].sort(
        (a, b) => a - b
      );

      for (const idx of sortedIndices) {
        const b = streamingBlocksRef.current.get(idx);
        if (b) {
          // Fill gaps if needed
          while (accumulatedBlocks.length < idx) {
            accumulatedBlocks.push({
              type: "Spacer",
              props: { id: `placeholder-${accumulatedBlocks.length}` },
            });
          }
          accumulatedBlocks.push(b);
        }
      }

      console.log("[Puck] Accumulated blocks:", accumulatedBlocks.length);

      // Update the Puck data with all accumulated blocks
      onDataChangeRef.current({
        ...dataRef.current,
        content: accumulatedBlocks,
      });

      if (isComplete) {
        // Clear all streaming blocks when complete
        streamingBlocksRef.current.clear();
        setAgentState("idle");
      }
    },
    [setAgentState]
  );

  /**
   * Replace all content with new blocks from AI
   */
  const handleFullContentReplace = useCallback(
    (content: PuckBlock[]) => {
      setAgentState("generating-content", "Generating page content...");

      onDataChangeRef.current({
        ...dataRef.current,
        content,
      });

      setAgentState("idle");
    },
    [setAgentState]
  );

  // Consume pending content from store
  const consumePendingPuckContent = useCopilotStore(
    (state) => state.consumePendingPuckContent
  );

  // Register with copilot store on mount
  useEffect(() => {
    if (!enabled) {
      return;
    }

    registerHandler({
      capability,
      puckData: dataRef.current,
      onPuckContent: handlePuckContent,
    });

    // Check for pending content that was queued before this editor mounted
    // This handles the case where AI navigated here and generated content
    const pendingContent = consumePendingPuckContent();
    console.log(
      "[Puck] Editor mounted, checking pending content:",
      pendingContent
    );

    if (pendingContent) {
      const { blocks, mode } = pendingContent;
      console.log(
        "[Puck] Applying",
        blocks.length,
        "pending blocks, mode:",
        mode
      );

      if (mode === "replace") {
        // Replace all content
        onDataChangeRef.current({
          ...dataRef.current,
          content: blocks,
        });
      } else {
        // Append to existing content
        onDataChangeRef.current({
          ...dataRef.current,
          content: [...dataRef.current.content, ...blocks],
        });
      }

      setAgentState("idle", "Content applied from AI");
    }

    return () => {
      streamingBlocksRef.current.clear();
      unregisterHandler();
    };
  }, [
    capability,
    enabled,
    handlePuckContent,
    registerHandler,
    unregisterHandler,
    consumePendingPuckContent,
    setAgentState,
  ]);

  // Update puck data in the store when it changes
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const activeHandler = useCopilotStore.getState().activeHandler;
    if (activeHandler?.capability === capability) {
      registerHandler({
        ...activeHandler,
        puckData: data,
      });
    }
  }, [capability, data, enabled, registerHandler]);

  return {
    /**
     * Manually trigger the AI to add a specific block type
     */
    requestBlock: (blockType: string) => {
      console.log(`Request AI to add block: ${blockType}`);
    },

    /**
     * Replace all content (useful for AI-generated full pages)
     */
    replaceContent: handleFullContentReplace,

    /**
     * Check if the AI is currently generating content
     */
    isGenerating: streamingBlocksRef.current.size > 0,
  };
}
