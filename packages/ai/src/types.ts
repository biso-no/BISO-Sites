import type { UIMessage } from "ai";

/**
 * Extended message type for assistant conversations
 */
export type AssistantMessage = UIMessage & {
  actions?: AssistantAction[];
};

/**
 * Tool definition for the assistant
 */
export type AssistantTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Navigation action - redirects user to a specific page
 */
export type NavigationAction = {
  type: "navigation";
  path: string;
  description?: string;
};

/**
 * Form field action - streams data into a form field
 */
export type FormFieldAction = {
  type: "form-field";
  fieldId: string;
  fieldName: string;
  value: string;
  streaming?: boolean;
};

/**
 * Toast/notification action
 */
export type ToastAction = {
  type: "toast";
  title: string;
  description?: string;
  variant?: "default" | "destructive";
};

/**
 * Confirmation action - asks user to confirm before proceeding
 */
export type ConfirmAction = {
  type: "confirm";
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

/**
 * Union of all possible assistant actions
 */
export type AssistantAction =
  | NavigationAction
  | FormFieldAction
  | ToastAction
  | ConfirmAction;

/**
 * Context for admin assistant - what the assistant knows about the current state
 */
export type AdminAssistantContext = {
  currentPath: string;
  currentPage?: string;
  availableRoutes: RouteInfo[];
  formContext?: FormContext;
  userRoles: string[];
};

/**
 * Route information for navigation
 */
export type RouteInfo = {
  path: string;
  label: string;
  description?: string;
  requiredRoles?: string[];
};

/**
 * Form context for form-filling capabilities
 */
export type FormContext = {
  formId: string;
  formName: string;
  fields: FormFieldInfo[];
};

/**
 * Individual form field information
 */
export type FormFieldInfo = {
  id: string;
  name: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
  label: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  currentValue?: unknown;
};

/**
 * Streaming form update event
 */
export type FormStreamEvent = {
  fieldId: string;
  chunk: string;
  done: boolean;
};

/**
 * Assistant state for UI
 */
export type AssistantState = {
  isOpen: boolean;
  isLoading: boolean;
  messages: AssistantMessage[];
  pendingActions: AssistantAction[];
  context: AdminAssistantContext | null;
};
