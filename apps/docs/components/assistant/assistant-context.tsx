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
  /** Ask the docs. Opens the answer panel; does nothing while disabled. */
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
      if (!open) {
        const active = document.activeElement;
        opener.current = active instanceof HTMLElement ? active : null;
      }
      setOpen(true);
      start(question, pageUrl);
    },
    [enabled, open, start]
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
