/**
 * Agent state types for granular UI feedback
 */

export type AgentState =
  | "idle"
  | "thinking"
  | "analyzing-tools"
  | "navigating"
  | "generating-content"
  | "executing"
  | "error";

export interface AgentStateInfo {
  message?: string;
  progress?: number;
  state: AgentState;
}

/**
 * Get display text for agent state
 */
export function getAgentStateDisplay(state: AgentState): string {
  switch (state) {
    case "idle":
      return "Ready";
    case "thinking":
      return "Thinking...";
    case "analyzing-tools":
      return "Analyzing Tools...";
    case "navigating":
      return "Navigating...";
    case "generating-content":
      return "Generating Content...";
    case "executing":
      return "Executing...";
    case "error":
      return "Error";
    default:
      return "Processing...";
  }
}

/**
 * Determine agent state from tool calls and message state
 */
export function inferAgentState(
  isLoading: boolean,
  currentToolCall?: string,
  hasContent?: boolean
): AgentState {
  if (!isLoading) {
    return "idle";
  }

  if (currentToolCall === "analyzeTask") {
    return "analyzing-tools";
  }

  if (currentToolCall === "navigate") {
    return "navigating";
  }

  if (currentToolCall === "fillFormFields") {
    return "executing";
  }

  if (hasContent) {
    return "executing";
  }

  return "thinking";
}
