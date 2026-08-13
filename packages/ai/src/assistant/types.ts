import type { InferUITools, UIMessage } from "ai";
import type { clientTools } from "./tools/client-tools";

/**
 * Capabilities the assistant is permitted to use for this user.
 * Computed from UserAuthContext on the server; injected into the prompt
 * and used to filter which server tools are exposed.
 */
export interface AssistantCapabilities {
  /** Analytics (Umami) read access (globaladmin only) */
  analytics: boolean;
  /** Approval: user can approve/reject requests routed to their team */
  canApprove: boolean;
  /** Per-content-domain access level */
  domains: {
    benefits: ContentAccess;
    documents: ContentAccess;
    events: ContentAccess;
    jobs: ContentAccess;
    news: ContentAccess;
    pages: ContentAccess;
    shop: ContentAccess;
  };
  /** M365 management tools available (globaladmin only) */
  m365: boolean;
  /** Settings management tools available (globaladmin only) */
  settings: boolean;
}

/** "publish" implies write; "write" implies read */
export type ContentAccess = "none" | "read" | "write" | "publish";

/**
 * Input for buildAssistantSystemPrompt.
 */
export interface AssistantPromptInput {
  activeCampus: string | null;
  /** schemaId of the form currently open in the studio, if any (e.g. "job-studio") */
  activeFormSchemaId?: string | null;
  capabilities: AssistantCapabilities;
  currentPath: string;
  locale: string;
  /** Comma-separated roles, e.g. "Global admin" */
  roleSummary: string;
  /** Campus / department scope description */
  scopeSummary: string;
  user: { email: string | null; name: string | null };
}

/**
 * The deps object injected from the API route.
 * Each value is an async function matching the existing server action shape.
 * Typed loosely here so @repo/ai doesn't need to depend on app internals.
 */
export type AssistantActionDeps = Record<
  string,
  (...args: unknown[]) => Promise<unknown>
>;

// --- UI message types ---

/** Typed UI message for the assistant chat. */
export type AssistantChatTools = InferUITools<typeof clientTools>;

export type AssistantUIMessage = UIMessage<
  Record<string, never>,
  Record<string, never>,
  AssistantChatTools
>;
