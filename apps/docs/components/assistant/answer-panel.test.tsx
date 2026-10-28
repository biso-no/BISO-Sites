import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ANSWER_ERRORS,
  AnswerPanelView,
  returnFocusTarget,
} from "./answer-panel";
import type { AnswerState } from "./use-ask";

const SOURCES = [
  { n: 1, title: "How recruitment works", url: "/guide/recruitment" },
  { n: 2, title: "Book interviews", url: "/guide/recruitment/book" },
  { n: 3, title: "Publish a vacancy", url: "/guide/recruitment/publish" },
];

function view(answer: Partial<AnswerState>): string {
  return renderToStaticMarkup(
    <AnswerPanelView
      answer={{
        question: "How do I book an interview?",
        sources: SOURCES,
        status: "done",
        text: "",
        ...answer,
      }}
    />
  );
}

function pagesUsed(out: string): string {
  return out.slice(out.indexOf("Pages used"));
}

test("Pages used lists only the cited sources when there are citations", () => {
  const pages = pagesUsed(view({ text: "Open the candidate [2]. Then [3]." }));
  expect(pages).toContain("Book interviews");
  expect(pages).toContain("Publish a vacancy");
  expect(pages).not.toContain("How recruitment works");
});

test("Pages used links each cited source", () => {
  const pages = pagesUsed(view({ text: "Open it [1, 3]." }));
  for (const source of [SOURCES[0], SOURCES[2]]) {
    expect(pages).toContain(source?.title ?? "");
    expect(pages).toContain(`href="${source?.url}"`);
  }
});

test("Pages used is left out when the answer cites nothing", () => {
  for (const text of [
    "The docs don't cover that. Try the docs search.",
    "I couldn't answer that. Try the docs search instead.",
    "Only [7].",
  ]) {
    expect(view({ text })).not.toContain("Pages used");
  }
});

test("Pages used is left out with no sources", () => {
  expect(view({ text: "I couldn't answer that.", sources: [] })).not.toContain(
    "Pages used"
  );
});

test("before the first token it says Thinking…", () => {
  const out = view({ status: "thinking", sources: [] });
  expect(out).toContain("Thinking…");
  expect(out).not.toContain("Pages used");
});

test("the answer is a polite live region", () => {
  expect(view({ text: "Yes [1]." })).toContain('aria-live="polite"');
});

test("Pages used waits until the answer is finished", () => {
  expect(view({ status: "streaming", text: "Open [2]" })).not.toContain(
    "Pages used"
  );
});

test("each error has its own copy", () => {
  expect(view({ status: "error", error: "rate_limited" })).toContain(
    "You&#x27;ve asked a lot of questions. Try again in a few minutes."
  );
  expect(view({ status: "error", error: "failed" })).toContain(
    "The assistant couldn&#x27;t answer right now. Try the search instead."
  );
  expect(view({ status: "error", error: "invalid" })).toContain(
    "Ask a question of up to 500 characters."
  );
  expect(ANSWER_ERRORS.failed).toBe(
    "The assistant couldn't answer right now. Try the search instead."
  );
});

function element(props: { isConnected?: boolean; visible?: boolean }) {
  return {
    isConnected: props.isConnected ?? true,
    getClientRects: () => (props.visible === false ? [] : [{}]),
  } as unknown as HTMLElement;
}

function page(...triggers: HTMLElement[]): ParentNode {
  return { querySelectorAll: () => triggers } as unknown as ParentNode;
}

test("focus goes back to the opener while it is on the page", () => {
  const opener = element({});
  expect(returnFocusTarget(opener, page(element({})))).toBe(opener);
});

test("focus falls back to the visible search button when the opener is gone", () => {
  const hidden = element({ visible: false });
  const shown = element({});
  expect(
    returnFocusTarget(element({ isConnected: false }), page(hidden, shown))
  ).toBe(shown);
});

test("no opener means focus stays where the new page puts it", () => {
  expect(returnFocusTarget(null, page(element({})))).toBeNull();
});
