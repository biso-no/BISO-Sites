"use client";

import type { Data } from "@repo/editor";
import { useCallback, useRef } from "react";

interface PuckContentUpdate {
  block: {
    type: string;
    props: Record<string, unknown>;
  };
  blockIndex: number;
  isComplete: boolean;
  type: "puck-content";
}

interface PuckContentHandlerProps {
  onContentComplete?: (data: Data) => void;
  onContentUpdate?: (update: PuckContentUpdate) => void;
}

/**
 * Hook to handle AI-generated Puck content updates
 * This integrates with the streaming JSON parser to apply content in real-time
 */
function usePuckContentHandler({
  onContentUpdate,
  onContentComplete,
}: PuckContentHandlerProps) {
  const contentBufferRef = useRef<
    Array<{ type: string; props: Record<string, unknown> }>
  >([]);
  const isGeneratingRef = useRef(false);

  const handlePuckContent = useCallback(
    (update: PuckContentUpdate) => {
      isGeneratingRef.current = true;

      // Update or add block to buffer
      if (update.blockIndex >= contentBufferRef.current.length) {
        contentBufferRef.current.push(update.block);
      } else {
        contentBufferRef.current[update.blockIndex] = update.block;
      }

      // Notify parent of update
      onContentUpdate?.(update);

      // If this is the final block, emit complete event
      if (update.isComplete) {
        const completeData: Data = {
          content: contentBufferRef.current.map((block, idx) => ({
            type: block.type,
            props: {
              ...block.props,
              id: block.props.id || `${block.type}-${idx + 1}`,
            },
          })),
          root: { props: {} },
        };

        onContentComplete?.(completeData);
        isGeneratingRef.current = false;
      }
    },
    [onContentUpdate, onContentComplete]
  );

  const reset = useCallback(() => {
    contentBufferRef.current = [];
    isGeneratingRef.current = false;
  }, []);

  return {
    handlePuckContent,
    reset,
    isGenerating: isGeneratingRef.current,
  };
}

/**
 * Component to display live generation indicator
 */
export function PuckGenerationIndicator({
  isGenerating,
}: {
  isGenerating: boolean;
}) {
  if (!isGenerating) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="fade-in slide-in-from-top-4 animate-in rounded-full border border-primary/20 bg-primary/10 px-4 py-2 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2 font-medium text-primary text-sm">
          <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span>AI is generating content...</span>
        </div>
      </div>
    </div>
  );
}
