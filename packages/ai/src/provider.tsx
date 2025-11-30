"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type {
  AdminAssistantContext,
  AssistantAction,
  AssistantMessage,
  FormContext,
  FormStreamEvent,
} from "./types";

type AIContextValue = {
  // State
  isOpen: boolean;
  isLoading: boolean;
  messages: AssistantMessage[];
  pendingActions: AssistantAction[];
  context: AdminAssistantContext | null;

  // Actions
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setLoading: (loading: boolean) => void;
  addMessage: (message: AssistantMessage) => void;
  setMessages: (messages: AssistantMessage[]) => void;
  clearMessages: () => void;
  setContext: (context: AdminAssistantContext) => void;
  updateFormContext: (formContext: FormContext | undefined) => void;

  // Action handling
  addPendingAction: (action: AssistantAction) => void;
  clearPendingActions: () => void;
  executePendingAction: (action: AssistantAction) => void;

  // Form streaming
  onFormStream?: (event: FormStreamEvent) => void;
  setFormStreamHandler: (handler: (event: FormStreamEvent) => void) => void;
};

const AIContext = createContext<AIContextValue | null>(null);

type AIProviderProps = {
  children: ReactNode;
  initialContext?: Partial<AdminAssistantContext>;
};

export function AIProvider({ children, initialContext }: AIProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pendingActions, setPendingActions] = useState<AssistantAction[]>([]);
  const [formStreamHandler, setFormStreamHandlerState] = useState<
    ((event: FormStreamEvent) => void) | undefined
  >();

  const [context, setContextState] = useState<AdminAssistantContext | null>(
    initialContext
      ? {
          currentPath: initialContext.currentPath ?? "/",
          availableRoutes: initialContext.availableRoutes ?? [],
          userRoles: initialContext.userRoles ?? [],
          ...initialContext,
        }
      : null
  );

  const setOpen = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const addMessage = useCallback((message: AssistantMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const setContext = useCallback((newContext: AdminAssistantContext) => {
    setContextState(newContext);
  }, []);

  const updateFormContext = useCallback(
    (formContext: FormContext | undefined) => {
      setContextState((prev) => {
        if (!prev) {
          return prev;
        }
        return { ...prev, formContext };
      });
    },
    []
  );

  const addPendingAction = useCallback((action: AssistantAction) => {
    setPendingActions((prev) => [...prev, action]);
  }, []);

  const clearPendingActions = useCallback(() => {
    setPendingActions([]);
  }, []);

  const executePendingAction = useCallback((action: AssistantAction) => {
    // Remove from pending
    setPendingActions((prev) => prev.filter((a) => a !== action));
  }, []);

  const setFormStreamHandler = useCallback(
    (handler: (event: FormStreamEvent) => void) => {
      setFormStreamHandlerState(() => handler);
    },
    []
  );

  const value = useMemo<AIContextValue>(
    () => ({
      isOpen,
      isLoading,
      messages,
      pendingActions,
      context,
      setOpen,
      toggle,
      setLoading,
      addMessage,
      setMessages,
      clearMessages,
      setContext,
      updateFormContext,
      addPendingAction,
      clearPendingActions,
      executePendingAction,
      onFormStream: formStreamHandler,
      setFormStreamHandler,
    }),
    [
      isOpen,
      isLoading,
      messages,
      pendingActions,
      context,
      setOpen,
      toggle,
      setLoading,
      addMessage,
      clearMessages,
      setContext,
      updateFormContext,
      addPendingAction,
      clearPendingActions,
      executePendingAction,
      formStreamHandler,
      setFormStreamHandler,
    ]
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI(): AIContextValue {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
}
