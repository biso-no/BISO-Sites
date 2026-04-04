import { create } from "zustand";
import type { FormFieldInfo } from "../types";

/**
 * Handler function type for form field updates from the AI
 */
export type FormFieldHandler = (data: {
  fieldId: string;
  value: string;
  streaming?: boolean;
  isComplete?: boolean;
}) => void;

/**
 * Handler function type for Puck content updates from the AI
 */
export type PuckContentHandler = (data: {
  blockIndex: number;
  block: {
    type: string;
    props: Record<string, unknown>;
  };
  isComplete: boolean;
}) => void;

/**
 * Page capability definition - what the AI can do on a specific page
 */
export type PageCapability =
  | "create-event"
  | "edit-event"
  | "create-job"
  | "edit-job"
  | "create-product"
  | "edit-product"
  | "create-post"
  | "edit-post"
  | "create-page"
  | "edit-page"
  | "dashboard"
  | "list-events"
  | "list-jobs"
  | "list-products"
  | "list-posts"
  | "list-pages"
  | "view-only";

/**
 * Entity type for context
 */
export type EntityType =
  | "event"
  | "job"
  | "product"
  | "post"
  | "page"
  | "user"
  | "order";

/**
 * Entity context - the current entity being viewed/edited
 * This gives the AI full understanding of what the user is working with
 */
export interface EntityContext {
  /** The full entity data - AI can read this to understand current state */
  data: Record<string, unknown>;
  id: string;
  /** Locale if applicable */
  locale?: string;
  /** Additional metadata */
  metadata?: {
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    author?: string;
  };
  /** Human-readable title/name for the entity */
  title: string;
  type: EntityType;
}

/**
 * Page context - broader context about the current page
 */
export interface PageContext {
  /** Breadcrumb path for context */
  breadcrumb?: string[];
  /** Any filters/search applied (for list views) */
  filters?: Record<string, unknown>;
  /** List of items if on a list page (summary only) */
  listSummary?: {
    totalCount: number;
    displayedCount: number;
    items?: Array<{ id: string; title: string; status?: string }>;
  };
  /** What section of admin we're in */
  section:
    | "dashboard"
    | "pages"
    | "events"
    | "jobs"
    | "products"
    | "posts"
    | "users"
    | "settings"
    | "shop"
    | "other";
  /** Is this a list view, detail view, or editor? */
  viewType: "list" | "detail" | "editor" | "create" | "dashboard";
}

/**
 * Active handler registration - connects a page's form/editor to the copilot
 */
export interface ActiveHandler {
  capability: PageCapability;
  formFields?: FormFieldInfo[];
  onFormField?: FormFieldHandler;
  onPuckContent?: PuckContentHandler;
  puckData?: unknown;
}

/**
 * Agent state for UI feedback
 */
export type AgentState =
  | "idle"
  | "thinking"
  | "analyzing"
  | "navigating"
  | "filling-form"
  | "generating-content"
  | "searching"
  | "reading-data"
  | "waiting-confirmation"
  | "error";

/**
 * Pending Puck content - queued when AI generates content before editor is ready
 */
export interface PendingPuckContent {
  blocks: Array<{
    type: string;
    props: Record<string, unknown>;
  }>;
  /** Timestamp for expiry */
  createdAt: number;
  /** Whether to replace all content or append */
  mode: "replace" | "append";
}

/**
 * Copilot store state
 */
interface CopilotState {
  // Active page capability and handler
  activeHandler: ActiveHandler | null;
  agentMessage: string | null;

  // Agent state for UI feedback
  agentState: AgentState;
  close: () => void;

  /**
   * Get and clear pending Puck content
   */
  consumePendingPuckContent: () => PendingPuckContent | null;

  // Current location
  currentPath: string;

  // Current entity context (the thing being viewed/edited)
  entityContext: EntityContext | null;

  /**
   * Execute pending navigation and clear it
   */
  executePendingNavigation: () => string | null;

  /**
   * Get full context for AI - combines all context into a single object
   */
  getFullContext: () => {
    path: string;
    entity: EntityContext | null;
    page: PageContext | null;
    capability: PageCapability | null;
    formFields: FormFieldInfo[] | undefined;
    puckData: unknown;
  };
  // Sidebar state
  isOpen: boolean;

  // Actions
  open: () => void;

  // Current page context (broader page info)
  pageContext: PageContext | null;

  // Pending navigation (when AI wants to navigate)
  pendingNavigation: string | null;

  // Pending Puck content (queued when AI generates content before editor is ready)
  pendingPuckContent: PendingPuckContent | null;

  /**
   * Register a page's capability and handlers with the copilot
   * Call this in useEffect when a form/editor mounts
   */
  registerHandler: (handler: ActiveHandler) => void;

  /**
   * Update agent state with optional message
   */
  setAgentState: (state: AgentState, message?: string) => void;

  setCurrentPath: (path: string) => void;

  /**
   * Set the current entity context (event, job, page, etc.)
   * Call this when viewing/editing an entity
   */
  setEntityContext: (context: EntityContext | null) => void;

  /**
   * Set the current page context
   * Call this to provide broader page information
   */
  setPageContext: (context: PageContext | null) => void;

  /**
   * Set pending navigation (AI requested navigation)
   */
  setPendingNavigation: (path: string | null) => void;

  /**
   * Queue Puck content to be applied when editor is ready
   */
  setPendingPuckContent: (content: PendingPuckContent | null) => void;
  toggle: () => void;

  /**
   * Unregister the current handler
   * Call this in useEffect cleanup when a form/editor unmounts
   */
  unregisterHandler: () => void;
}

export const useCopilotStore = create<CopilotState>((set, get) => ({
  // Initial state
  isOpen: false,
  currentPath: "/",
  entityContext: null,
  pageContext: null,
  activeHandler: null,
  agentState: "idle",
  agentMessage: null,
  pendingNavigation: null,
  pendingPuckContent: null,

  // Sidebar actions
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),

  // Path tracking
  setCurrentPath: (path) => set({ currentPath: path }),

  // Context setters
  setEntityContext: (context) => set({ entityContext: context }),
  setPageContext: (context) => set({ pageContext: context }),

  // Handler registration
  registerHandler: (handler) => set({ activeHandler: handler }),
  unregisterHandler: () => set({ activeHandler: null }),

  // Agent state
  setAgentState: (state, message) =>
    set({ agentState: state, agentMessage: message ?? null }),

  // Navigation
  setPendingNavigation: (path) => set({ pendingNavigation: path }),
  executePendingNavigation: () => {
    const { pendingNavigation } = get();
    set({ pendingNavigation: null });
    return pendingNavigation;
  },

  // Pending Puck content
  setPendingPuckContent: (content) => {
    console.log(
      "[Store] setPendingPuckContent:",
      content ? `${content.blocks.length} blocks` : "null"
    );
    set({ pendingPuckContent: content });
  },
  consumePendingPuckContent: () => {
    const { pendingPuckContent } = get();
    console.log(
      "[Store] consumePendingPuckContent called, current:",
      pendingPuckContent ? `${pendingPuckContent.blocks.length} blocks` : "null"
    );
    if (pendingPuckContent) {
      // Check if content is still fresh (within 30 seconds)
      const isExpired = Date.now() - pendingPuckContent.createdAt > 30_000;
      console.log(
        "[Store] Content age:",
        Date.now() - pendingPuckContent.createdAt,
        "ms, expired:",
        isExpired
      );
      set({ pendingPuckContent: null });
      return isExpired ? null : pendingPuckContent;
    }
    return null;
  },

  // Get full context for AI
  getFullContext: () => {
    const state = get();
    return {
      path: state.currentPath,
      entity: state.entityContext,
      page: state.pageContext,
      capability: state.activeHandler?.capability ?? null,
      formFields: state.activeHandler?.formFields,
      puckData: state.activeHandler?.puckData,
    };
  },
}));

/**
 * Get display text for agent state
 */
export function getAgentStateDisplay(state: AgentState): {
  text: string;
  icon: "loader" | "brain" | "compass" | "pencil" | "wand" | "alert" | "check";
} {
  switch (state) {
    case "idle":
      return { text: "Ready to help", icon: "check" };
    case "thinking":
      return { text: "Thinking...", icon: "brain" };
    case "analyzing":
      return { text: "Analyzing your request...", icon: "brain" };
    case "navigating":
      return { text: "Navigating...", icon: "compass" };
    case "filling-form":
      return { text: "Filling form fields...", icon: "pencil" };
    case "generating-content":
      return { text: "Generating content...", icon: "wand" };
    case "waiting-confirmation":
      return { text: "Waiting for confirmation...", icon: "loader" };
    case "error":
      return { text: "Something went wrong", icon: "alert" };
    default:
      return { text: "Processing...", icon: "loader" };
  }
}
