"use client";

import { createContext, useContext } from "react";
import type { Data } from "@puckeditor/core";

/**
 * Text-based assist actions that return streaming text (shown in the panel).
 * These do NOT modify the Puck canvas directly.
 */
export type AssistAction =
  | "headline"
  | "description"
  | "cta"
  | "grammar"
  | "suggest"
  | "translate-en"
  | "translate-no";

export type AiAssistCallbacks = {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError?: (error: Error) => void;
};

export type AiAssistantContextValue = {
  /**
   * Generate or modify Puck canvas content via JSONL streaming patches.
   * Used for: page generation, improve-block actions.
   *
   * @param prompt - Natural language instruction
   * @param selectedBlockIndex - Optional index override for targeted block edits
   */
  generate: (prompt: string, selectedBlockIndex?: number) => Promise<void>;

  /** True while canvas generation is streaming */
  isStreaming: boolean;

  /** Abort any active canvas generation */
  abort: () => void;

  /**
   * Run a text-based AI operation, streaming the result token by token.
   * Used for: copy generation, grammar check, suggestions, translate.
   */
  assist: (
    action: AssistAction,
    content: string,
    callbacks: AiAssistCallbacks
  ) => Promise<void>;

  /** True while a text assist operation is running */
  isAssisting: boolean;

  /**
   * Called by the AI assistant plugin panel on mount/unmount to register
   * a handler that applies data changes directly to the Puck canvas via
   * dispatch({ type: "setData" }).
   *
   * This is necessary because Puck's `data` prop is initialization-only —
   * the only way to update the canvas programmatically is dispatch(), which
   * requires being inside Puck's context tree (i.e., inside a plugin).
   *
   * Pass null to unregister (called on plugin unmount).
   */
  onDataReady: (handler: ((data: Data) => void) | null) => void;
};

export const AiAssistantContext =
  createContext<AiAssistantContextValue | null>(null);

/**
 * Consume the AI assistant context inside the Puck plugin panel.
 * Returns null if no provider is present (plugin used outside admin app).
 */
export function useAiAssistant(): AiAssistantContextValue | null {
  return useContext(AiAssistantContext);
}
