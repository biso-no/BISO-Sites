"use client";

import { useAssistant } from "components/assistant/assistant-context";
import { MAX_QUESTION_CHARS } from "components/assistant/use-ask";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

interface AskFieldViewProps {
  ask: (question: string) => void;
  enabled: boolean;
}

/**
 * The hero's field. With the assistant on, it asks the docs, with a link to
 * search instead; with it off, it is the search button it always was. The
 * hero is navy in both themes, so its colours are fixed brand values.
 */
export function AskField() {
  const { ask, enabled } = useAssistant();
  return <AskFieldView ask={ask} enabled={enabled} />;
}

/** The field for either state, so each can be rendered on its own. */
export function AskFieldView({ ask, enabled }: AskFieldViewProps) {
  const { open, setOpenSearch } = useSearchContext();
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const openedHere = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const inputId = useId();

  // The search dialog has no Radix trigger to hand focus back to, so it would
  // drop to <body> on close. When this field opened it, focus comes back here.
  useEffect(() => {
    if (!open && openedHere.current) {
      openedHere.current = false;
      searchTrigger.current?.focus();
    }
  }, [open]);

  const openSearch = () => {
    openedHere.current = true;
    setOpenSearch(true);
  };

  if (!enabled) {
    return (
      <button
        aria-haspopup="dialog"
        aria-label="Search the docs"
        className="flex w-full max-w-[470px] cursor-pointer items-stretch rounded-biso-sm bg-paper text-left focus-visible:outline-2 focus-visible:outline-sky focus-visible:outline-offset-2"
        onClick={openSearch}
        ref={searchTrigger}
        type="button"
      >
        <span className="flex-1 px-4 py-[13px] text-[#526475] text-[14.5px]">
          Search the docs
        </span>
        <span className="flex items-center rounded-r-biso-sm bg-blue px-4 font-bold text-[13.5px] text-paper">
          Search
        </span>
      </button>
    );
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim()) {
      return;
    }
    // The panel hands focus back to whatever asked. Asking from the input
    // means focus returns there, ready for the next question, even after a
    // click on Ask, which is disabled once the field clears.
    input.current?.focus();
    ask(question);
    setQuestion("");
  };

  return (
    <form className="w-full max-w-[470px]" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor={inputId}>
        Ask a question or search
      </label>
      <div className="flex items-stretch rounded-biso-sm bg-paper focus-within:outline-2 focus-within:outline-sky focus-within:outline-offset-2">
        <input
          autoComplete="off"
          className="min-w-0 flex-1 rounded-l-biso-sm bg-transparent px-4 py-[13px] text-[14.5px] text-deep placeholder:text-[#526475] focus:outline-none"
          id={inputId}
          maxLength={MAX_QUESTION_CHARS}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question or search"
          ref={input}
          type="text"
          value={question}
        />
        <button
          className="cursor-pointer rounded-r-biso-sm bg-blue px-4 font-bold text-[13.5px] text-paper focus-visible:outline-2 focus-visible:outline-paper focus-visible:-outline-offset-4 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={!question.trim()}
          type="submit"
        >
          Ask
        </button>
      </div>
      <button
        aria-haspopup="dialog"
        className="mt-2.5 cursor-pointer rounded-sm text-[13px] text-ink-muted underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-sky focus-visible:outline-offset-2"
        onClick={openSearch}
        ref={searchTrigger}
        type="button"
      >
        Search instead
      </button>
    </form>
  );
}
