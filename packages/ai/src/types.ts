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
export interface AssistantTool {
  description: string;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
  name: string;
  parameters: Record<string, unknown>;
}

/**
 * Navigation action - redirects user to a specific page
 */
export interface NavigationAction {
  description?: string;
  path: string;
  type: "navigation";
}

/**
 * Form field action - streams data into a form field
 */
export interface FormFieldAction {
  fieldId: string;
  fieldName: string;
  streaming?: boolean;
  type: "form-field";
  value: string;
}

/**
 * Toast/notification action
 */
export interface ToastAction {
  description?: string;
  title: string;
  type: "toast";
  variant?: "default" | "destructive";
}

/**
 * Confirmation action - asks user to confirm before proceeding
 */
export interface ConfirmAction {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  title: string;
  type: "confirm";
}

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
export interface AdminAssistantContext {
  availableRoutes: RouteInfo[];
  currentPage?: string;
  currentPath: string;
  formContext?: FormContext;
  userRoles: string[];
}

/**
 * Route information for navigation
 */
export interface RouteInfo {
  description?: string;
  label: string;
  path: string;
  requiredRoles?: string[];
}

/**
 * Form context for form-filling capabilities
 */
export interface FormContext {
  fields: FormFieldInfo[];
  formId: string;
  formName: string;
}

/**
 * Individual form field information
 */
export interface FormFieldInfo {
  currentValue?: unknown;
  id: string;
  label: string;
  name: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
}

/**
 * Streaming form update event
 */
export interface FormStreamEvent {
  chunk: string;
  done: boolean;
  fieldId: string;
}

/**
 * Assistant state for UI
 */
export interface AssistantState {
  context: AdminAssistantContext | null;
  isLoading: boolean;
  isOpen: boolean;
  messages: AssistantMessage[];
  pendingActions: AssistantAction[];
}
