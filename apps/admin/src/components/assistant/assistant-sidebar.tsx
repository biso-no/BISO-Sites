"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import { motion } from "framer-motion";
import { Bot, Loader2, Send, Sparkles, Trash2, X, Zap, Navigation, Wand2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAgentStateDisplay } from "@repo/ai/types/agent-state";
import type { AgentState } from "@repo/ai/types/agent-state";
import { formEvents } from "@/lib/form-events";
import { loadChatMessages, saveChatMessages, clearChatHistory } from "@/lib/chat-persistence";
import { createManagedPage } from "@/app/actions/pages/actions";
import { PageStatus, PageVisibility, Locale } from "@repo/api/types/appwrite";
import { AssistantMessage as MessageComponent } from "./assistant-message";
import { useChatStream } from "./use-chat-stream";

type PuckContentUpdate = {
  type: "puck-content";
  blockIndex: number;
  block: {
    type: string;
    props: Record<string, unknown>;
  };
  isComplete: boolean;
};

type AssistantSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  puckData?: unknown;
  currentPath?: string;
  onPuckContent?: (update: PuckContentUpdate) => void;
};

export function AssistantSidebar({ isOpen, onClose, puckData, currentPath, onPuckContent }: AssistantSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNavigate = useCallback(
    (path: string) => {
      // Skip navigation if already on the target page
      if (pathname === path) {
        console.log("Already on page:", path);
        return;
      }
      router.push(path);
    },
    [router, pathname]
  );

  const handleFormField = useCallback(
    (update: {
      fieldId: string;
      fieldName: string;
      value: string;
      streaming?: boolean;
      isComplete?: boolean;
    }) => {
      // Emit the form field update to any listening forms
      formEvents.emit(update);
    },
    []
  );

  const handleCreatePage = useCallback(
    async (params: { title: string; slug: string; locale: "en" | "no"; description?: string }) => {
      try {
        const page = await createManagedPage({
          title: params.title,
          slug: params.slug,
          status: PageStatus.DRAFT,
          visibility: PageVisibility.PUBLIC,
          template: null,
          campusId: null,
          translations: [
            {
              locale: params.locale as Locale,
              title: params.title,
              description: params.description || null,
              draftDocument: { content: [], root: {} },
              publish: false,
            },
          ],
        });

        // Navigate to the new page editor
        const translation = page.translations.find((t) => t.locale === params.locale);
        if (translation) {
          router.push(`/admin/pages/${page.id}/${params.locale}/editor`);
        }
      } catch (error) {
        console.error("Failed to create page:", error);
        throw error;
      }
    },
    [router]
  );

  const { messages, isLoading, sendMessage, clearMessages, setMessages } = useChatStream({
    api: "/api/admin-assistant",
    onNavigate: handleNavigate,
    onFormField: handleFormField,
    onCreatePage: handleCreatePage,
    onPuckContent,
    puckData,
    currentPath,
  });

  // Load persisted messages on mount
  useEffect(() => {
    const savedMessages = loadChatMessages();
    if (savedMessages.length > 0 && messages.length === 0) {
      setMessages(savedMessages);
    }
  }, []);

  // Save messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveChatMessages(messages);
    }
  }, [messages]);

  // Clear both local and persisted messages
  const handleClearMessages = useCallback(() => {
    clearChatHistory();
    clearMessages();
  }, [clearMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && messages.length >= 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendMessage = useCallback(
    (content: string) => {
      sendMessage(content);
      setInput("");
    },
    [sendMessage]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  return (
    <motion.div
      animate={{
        width: isOpen ? 400 : 0,
        opacity: isOpen ? 1 : 0,
        marginRight: isOpen ? 16 : 0, // m-4 equivalent
      }}
      className={cn(
        "relative z-10 my-4 flex shrink-0 flex-col overflow-hidden rounded-[32px] border border-primary/10 bg-white/80 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#001731]/95 dark:text-white dark:shadow-[0_45px_80px_-45px_rgba(0,23,49,0.9)]",
        // Ensure it's hidden when closed to avoid pointer events
        !isOpen && "pointer-events-none border-none"
      )}
      initial={false}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
      }}
    >
      <div className="flex h-full w-[400px] flex-col">
        {/* Header */}
        <div className="shrink-0 border-b px-4 py-3 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 dark:bg-white/10">
                <Sparkles className="h-4 w-4 text-primary dark:text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-base">BISO Assistant</h3>
                <p className="text-muted-foreground text-xs dark:text-white/60">
                  Your AI-powered admin helper
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                className="h-8 w-8"
                onClick={handleClearMessages}
                size="icon"
                title="Clear chat"
                variant="ghost"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                className="h-8 w-8"
                onClick={onClose}
                size="icon"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 dark:bg-white/10">
                  <Bot className="h-6 w-6 text-primary dark:text-white" />
                </div>
                <h3 className="mb-2 font-medium">How can I help you today?</h3>
                <p className="max-w-[280px] text-muted-foreground text-sm dark:text-white/60">
                  I can help you create events, navigate the admin dashboard,
                  and answer questions about BISO.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button
                    className="text-xs"
                    onClick={() => sendMessage("Create a new event")}
                    size="sm"
                    variant="outline"
                  >
                    Create event
                  </Button>
                  <Button
                    className="text-xs"
                    onClick={() => sendMessage("Show me all events")}
                    size="sm"
                    variant="outline"
                  >
                    View events
                  </Button>
                  <Button
                    className="text-xs"
                    onClick={() => sendMessage("Help me with the dashboard")}
                    size="sm"
                    variant="outline"
                  >
                    Dashboard help
                  </Button>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <MessageComponent key={message.id} message={message} />
              ))
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm dark:text-white/60">
                {(() => {
                  // Infer agent state from messages
                  const lastMessage = messages[messages.length - 1];
                  const hasToolCalls = lastMessage?.parts.some(
                    (p) => p.type === "text" && p.text.includes("analyzeTask")
                  );
                  const hasNavigation = lastMessage?.parts.some(
                    (p) => p.type === "text" && p.text.includes("navigate")
                  );
                  const hasGeneration = lastMessage?.parts.some(
                    (p) => p.type === "text" && p.text.includes("generatePuckContent")
                  );

                  if (hasGeneration) {
                    return (
                      <>
                        <Wand2 className="h-4 w-4 animate-pulse" />
                        <span>Generating Content...</span>
                      </>
                    );
                  }
                  if (hasNavigation) {
                    return (
                      <>
                        <Navigation className="h-4 w-4 animate-bounce" />
                        <span>Navigating...</span>
                      </>
                    );
                  }
                  if (hasToolCalls) {
                    return (
                      <>
                        <Zap className="h-4 w-4 animate-pulse" />
                        <span>Analyzing Tools...</span>
                      </>
                    );
                  }
                  return (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Thinking...</span>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="shrink-0 border-t p-4 dark:border-white/10">
          <form className="flex gap-2" onSubmit={handleSubmit}>
            <Input
              className="flex-1 dark:bg-white/5 dark:text-white"
              disabled={isLoading}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              ref={inputRef}
              value={input}
            />
            <Button
              disabled={!input.trim() || isLoading}
              size="icon"
              type="submit"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
