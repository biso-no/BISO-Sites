"use client";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { cn } from "@repo/ui/lib/utils";
import { XIcon } from "lucide-react";
import Link from "next/link";
import type { MouseEvent, RefObject } from "react";
import { AnswerText, citedSources } from "./answer-text";
import type { AnswerError, AnswerState } from "./use-ask";

export const ANSWER_ERRORS: Record<AnswerError, string> = {
  rate_limited: "You've asked a lot of questions. Try again in a few minutes.",
  failed: "The assistant couldn't answer right now. Try the search instead.",
  invalid: "Ask a question of up to 500 characters.",
};

const NOTE =
  "Answers come from these docs and can be wrong. Check the page before you act.";

/*
 * Every position and size class is set here, not left to the Sheet's own
 * defaults: Tailwind scans this app's files, so these are sure to be built.
 * Full screen below 768px; from there, a 480px sheet on the right.
 */
const PANEL_CLASS =
  "fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-none flex-col gap-0 border-0 bg-fd-background p-0 text-fd-foreground shadow-none focus:outline-none sm:max-w-none md:w-[30rem] md:border-fd-border md:border-l";

const OVERLAY_CLASS = "fixed inset-0 z-50 bg-deep/60";

const CLOSE_CLASS =
  "-mt-1.5 -mr-2.5 inline-flex size-10 shrink-0 items-center justify-center rounded-biso-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2";

const PAGE_LINK_CLASS =
  "rounded-sm font-bold text-fd-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-fd-ring focus-visible:outline-offset-2";

/** The pure view: the answer and the pages it used, for any state. */
export function AnswerPanelView({ answer }: { answer: AnswerState }) {
  const { error, sources, status, text } = answer;
  // Citations arrive as the answer streams, so the list waits for the end.
  const pages = status === "done" ? citedSources(text, sources) : [];

  return (
    <>
      <div aria-busy={status === "streaming"} aria-live="polite">
        {status === "thinking" ? (
          <p className="text-[15px] text-fd-muted-foreground motion-safe:animate-pulse">
            Thinking…
          </p>
        ) : null}
        {text ? <AnswerText sources={sources} text={text} /> : null}
        {error ? (
          <p className={cn("text-[15px]", text && "mt-4")}>
            {ANSWER_ERRORS[error]}
          </p>
        ) : null}
      </div>
      {pages.length > 0 ? (
        <section className="mt-8 border-t pt-4">
          <h3 className="mb-2 font-bold font-sans text-[12.5px] text-fd-muted-foreground">
            Pages used
          </h3>
          <ul className="space-y-1.5 text-sm">
            {pages.map((page) => (
              <li className="flex gap-2" key={page.n}>
                <span className="w-7 shrink-0 text-fd-muted-foreground tabular-nums">
                  {`[${page.n}]`}
                </span>
                <Link className={PAGE_LINK_CLASS} href={page.url}>
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/** Fumadocs' search buttons: the full field and the icon one. */
const SEARCH_TRIGGER = "[data-search-full], [data-search]";

/**
 * Where focus goes when the panel closes: back to whatever asked, or, when
 * that has left the page (an input in the search dialog, say), to the search
 * button on screen. No opener means a link was followed, and focus stays
 * where the new page puts it.
 */
export function returnFocusTarget(
  opener: HTMLElement | null,
  root: ParentNode
): HTMLElement | null {
  if (!opener) {
    return null;
  }
  if (opener.isConnected) {
    return opener;
  }
  for (const trigger of root.querySelectorAll<HTMLElement>(SEARCH_TRIGGER)) {
    if (trigger.getClientRects().length > 0) {
      return trigger;
    }
  }
  return null;
}

/** A plain left click on a link, which navigates in this tab. */
function followsLink(event: MouseEvent<HTMLElement>): boolean {
  const { target } = event;
  return (
    target instanceof Element &&
    target.closest("a[href]") !== null &&
    event.button === 0 &&
    !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
  );
}

interface AnswerPanelProps {
  answer: AnswerState | null;
  /** A link in the panel was followed; the panel should close. */
  onFollowLink: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** What asked the question; null once a link in the panel is followed. */
  returnFocusTo: RefObject<HTMLElement | null>;
}

/**
 * The answer, in a dialog: a sheet on the right from 768px, full screen
 * below. Escape, the close button and a click outside all close it.
 */
export function AnswerPanel({
  answer,
  onFollowLink,
  onOpenChange,
  open,
  returnFocusTo,
}: AnswerPanelProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className={PANEL_CLASS}
        onClick={(event) => {
          if (followsLink(event)) {
            onFollowLink();
          }
        }}
        onCloseAutoFocus={(event) => {
          // Nothing opened this through a Radix trigger, so Radix would leave
          // focus on <body>. Send it back to whatever asked the question.
          event.preventDefault();
          returnFocusTarget(returnFocusTo.current, document)?.focus();
        }}
        overlayClassName={OVERLAY_CLASS}
        showCloseButton={false}
        side="right"
      >
        <div
          className="flex shrink-0 items-start gap-3 border-edge border-b bg-deep px-5 pt-5 pb-6 text-ink md:px-6"
          data-surface="deep"
        >
          <div className="min-w-0 flex-1">
            <p className="mb-2 font-bold text-[11.5px] text-ink-accent uppercase tracking-[0.08em]">
              You asked
            </p>
            {/* A question can run to 500 characters: past 40% of the screen
                the header scrolls rather than hiding the rest. */}
            <SheetTitle className="max-h-[40dvh] overflow-y-auto break-words font-bold font-display text-ink text-xl leading-tight">
              {answer?.question}
            </SheetTitle>
          </div>
          <SheetClose className={CLOSE_CLASS}>
            <XIcon aria-hidden="true" className="size-5" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 md:px-6">
          {answer ? <AnswerPanelView answer={answer} /> : null}
        </div>
        <SheetDescription className="shrink-0 border-t px-5 py-3 text-[12.5px] text-fd-muted-foreground leading-snug md:px-6">
          {NOTE}
        </SheetDescription>
      </SheetContent>
    </Sheet>
  );
}
