"use client";

import { useSearchContext } from "fumadocs-ui/contexts/search";
import { useEffect, useRef } from "react";

/**
 * The hero's search field: a button drawn as a white field with a blue end
 * cap. It opens Fumadocs search; Stage 5 turns it into ask-and-search. The
 * hero is navy in both themes, so its colours are fixed brand values.
 */
export function AskField() {
  const { open, setOpenSearch } = useSearchContext();
  const button = useRef<HTMLButtonElement>(null);
  const openedHere = useRef(false);

  // The search dialog has no Radix trigger to hand focus back to, so it would
  // drop to <body> on close. When this field opened it, focus comes back here.
  useEffect(() => {
    if (!open && openedHere.current) {
      openedHere.current = false;
      button.current?.focus();
    }
  }, [open]);

  return (
    <button
      aria-haspopup="dialog"
      aria-label="Search the docs"
      className="flex w-full max-w-[470px] cursor-pointer items-stretch rounded-biso-sm bg-paper text-left focus-visible:outline-2 focus-visible:outline-sky focus-visible:outline-offset-2"
      onClick={() => {
        openedHere.current = true;
        setOpenSearch(true);
      }}
      ref={button}
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
