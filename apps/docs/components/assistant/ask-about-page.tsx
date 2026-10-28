"use client";

import { MessageCircleQuestionMarkIcon } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useAssistant } from "./assistant-context";
import { MAX_QUESTION_CHARS } from "./use-ask";

interface AskAboutPageViewProps {
  ask: (question: string, pageUrl?: string) => void;
  enabled: boolean;
  /** The page's own url (`page.url`), so the answer starts from this page. */
  url: string;
}

/**
 * "Ask about this page", at the foot of the table of contents. Hidden while
 * the assistant is off.
 */
export function AskAboutPage({ url }: { url: string }) {
  const { ask, enabled } = useAssistant();
  return <AskAboutPageView ask={ask} enabled={enabled} url={url} />;
}

/** A button that opens a small question field below it. */
export function AskAboutPageView({ ask, enabled, url }: AskAboutPageViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const formId = useId();
  const inputId = useId();

  useEffect(() => {
    if (expanded) {
      input.current?.focus();
    }
  }, [expanded]);

  if (!enabled) {
    return null;
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim()) {
      return;
    }
    // Ask from the input, so the panel hands focus back there for the next
    // question, even after a click on Ask, which is disabled once it clears.
    input.current?.focus();
    ask(question, url);
    setQuestion("");
  };

  return (
    <div className="mt-3 border-fd-border border-t pt-3 pb-3 text-sm">
      <button
        aria-controls={expanded ? formId : undefined}
        aria-expanded={expanded}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground focus-visible:outline-2 focus-visible:outline-fd-ring focus-visible:outline-offset-2"
        onClick={() => setExpanded((open) => !open)}
        type="button"
      >
        <MessageCircleQuestionMarkIcon aria-hidden="true" className="size-4" />
        Ask about this page
      </button>
      {expanded ? (
        <form className="mt-2.5 flex gap-1.5" id={formId} onSubmit={onSubmit}>
          <label className="sr-only" htmlFor={inputId}>
            Your question about this page
          </label>
          <input
            autoComplete="off"
            className="min-w-0 flex-1 rounded-biso-sm border border-fd-border bg-fd-background px-2.5 py-1.5 text-fd-foreground placeholder:text-fd-muted-foreground focus-visible:outline-2 focus-visible:outline-fd-ring focus-visible:outline-offset-1"
            id={inputId}
            maxLength={MAX_QUESTION_CHARS}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Your question"
            ref={input}
            type="text"
            value={question}
          />
          <button
            className="cursor-pointer rounded-biso-sm bg-fd-primary px-3 font-bold text-[13px] text-fd-primary-foreground focus-visible:outline-2 focus-visible:outline-fd-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!question.trim()}
            type="submit"
          >
            Ask
          </button>
        </form>
      ) : null}
    </div>
  );
}
