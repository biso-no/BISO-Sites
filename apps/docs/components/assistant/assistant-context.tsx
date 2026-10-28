"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnswerPanel } from "./answer-panel";
import { useAsk } from "./use-ask";

interface Assistant {
  /**
   * Ask the docs. Opens the answer panel; does nothing while disabled.
   * `pageUrl` must be a docs page's own url (`page.url`), never `/`: the route
   * answers 400 for any path that isn't a page, and the panel would then show
   * the question-length message. Leave it out on the landing.
   */
  ask: (question: string, pageUrl?: string) => void;
  /** False until `GET /api/ask` says otherwise, so entry points start hidden. */
  enabled: boolean;
}

const OFF: Assistant = { ask: () => undefined, enabled: false };

const AssistantContext = createContext<Assistant>(OFF);

/** The assistant, or an off one outside `AssistantProvider`. */
export function useAssistant(): Assistant {
  return useContext(AssistantContext);
}

function isEnabled(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { enabled?: unknown }).enabled === true
  );
}

/**
 * Holds the assistant for the whole site and renders its one answer panel.
 * Mounted once in the root layout, so every page and the landing share it.
 */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  // Read by `ask` without making it depend on `open`, so the context value
  // doesn't change, and every consumer re-render, on each open and close.
  const isOpen = useRef(false);
  const { answer, ask: start, cancel } = useAsk();
  const opener = useRef<HTMLElement | null>(null);
  const pathname = usePathname();

  // In the browser after mount only, so the build and the static HTML never
  // call the route. Any failure leaves the assistant off.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ask", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => setEnabled(isEnabled(body)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const close = useCallback(() => {
    isOpen.current = false;
    setOpen(false);
    cancel();
  }, [cancel]);

  const followLink = useCallback(() => {
    // The new page takes focus; don't pull it back to the old opener.
    opener.current = null;
    close();
  }, [close]);

  // Any route change, such as the back button, closes the panel too.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useEffect(() => {
    followLink();
  }, [pathname, followLink]);

  const ask = useCallback(
    (question: string, pageUrl?: string) => {
      if (!(enabled && question.trim())) {
        return;
      }
      if (!isOpen.current) {
        const active = document.activeElement;
        opener.current = active instanceof HTMLElement ? active : null;
      }
      isOpen.current = true;
      setOpen(true);
      start(question, pageUrl);
    },
    [enabled, start]
  );

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        close();
      }
    },
    [close]
  );

  const value = useMemo(() => ({ ask, enabled }), [ask, enabled]);

  return (
    <AssistantContext value={value}>
      {children}
      <AnswerPanel
        answer={answer}
        onFollowLink={followLink}
        onOpenChange={onOpenChange}
        open={open}
        returnFocusTo={opener}
      />
    </AssistantContext>
  );
}
