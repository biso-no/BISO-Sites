"use client";

import { useEffect, useState } from "react";
import { sitePath } from "./site-path";

export interface AnswerSource {
  n: number;
  title: string;
  url: string;
}

/** `invalid` is a 400, `rate_limited` a 429; anything else is `failed`. */
export type AnswerError = "invalid" | "rate_limited" | "failed";

export interface AnswerState {
  error?: AnswerError;
  question: string;
  sources: AnswerSource[];
  /** `thinking` until the first text arrives. */
  status: "thinking" | "streaming" | "done" | "error";
  text: string;
}

export interface AskInput {
  pageUrl?: string;
  question: string;
}

interface RequestOptions {
  fetcher?: typeof fetch;
  onUpdate: (answer: AnswerState) => void;
  signal: AbortSignal;
}

/** The route's own limit, checked here too so a long question costs no request. */
export const MAX_QUESTION_CHARS = 500;

/** One header entry, or null unless its url is a docs page path. */
function toSource(value: unknown): AnswerSource | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { n, title, url } = value as Record<string, unknown>;
  if (!(Number.isInteger(n) && typeof title === "string")) {
    return null;
  }
  const path = typeof url === "string" ? sitePath(url) : null;
  return path === null ? null : { n: n as number, title, url: path };
}

/**
 * Reads `X-Docs-Sources`. Only docs page paths are kept (see `sitePath`), so
 * a source can never become a link to another origin or a `javascript:` URL.
 */
export function parseSources(header: string | null): AnswerSource[] {
  if (!header) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(header));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map(toSource)
    .filter((source): source is AnswerSource => source !== null);
}

function errorFor(status: number): AnswerError {
  if (status === 429) {
    return "rate_limited";
  }
  return status === 400 ? "invalid" : "failed";
}

/**
 * Asks `POST /api/ask` and reports each step through `onUpdate`. It never
 * throws, and once `signal` aborts it reports nothing more.
 */
export async function requestAnswer(
  input: AskInput,
  { fetcher = fetch, onUpdate, signal }: RequestOptions
): Promise<void> {
  const question = input.question.trim();
  let answer: AnswerState = {
    question,
    sources: [],
    status: "thinking",
    text: "",
  };
  const update = (next: Partial<AnswerState>) => {
    answer = { ...answer, ...next };
    if (!signal.aborted) {
      onUpdate(answer);
    }
  };

  update({});
  if (question.length === 0 || question.length > MAX_QUESTION_CHARS) {
    update({ status: "error", error: "invalid" });
    return;
  }

  try {
    const response = await fetcher("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, pageUrl: input.pageUrl }),
      cache: "no-store",
      signal,
    });
    if (!response.ok) {
      update({ status: "error", error: errorFor(response.status) });
      return;
    }
    const sources = parseSources(response.headers.get("X-Docs-Sources"));
    if (!response.body) {
      update({ status: "error", error: "failed" });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      text += decoder.decode(value, { stream: !done });
      if (done) {
        break;
      }
      if (text) {
        update({ sources, status: "streaming", text });
      }
    }
    update(
      text.trim()
        ? { sources, status: "done", text }
        : { status: "error", error: "failed" }
    );
  } catch {
    // An abort lands here too; `update` stays quiet once the signal is aborted.
    update({ status: "error", error: "failed" });
  }
}

interface Asker {
  ask: (question: string, pageUrl?: string) => void;
  cancel: () => void;
}

/**
 * Runs one answer at a time. A new question aborts the one before it, and
 * `cancel` aborts the current one, as the panel does when it closes.
 */
export function createAsker(
  onUpdate: (answer: AnswerState) => void,
  fetcher?: typeof fetch
): Asker {
  let current: AbortController | null = null;
  return {
    ask(question, pageUrl) {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      requestAnswer(
        { question, pageUrl },
        { fetcher, onUpdate, signal: controller.signal }
      );
    },
    cancel() {
      current?.abort();
      current = null;
    },
  };
}

/** `createAsker` as a hook: its answer is state, and unmounting cancels. */
export function useAsk(): Asker & { answer: AnswerState | null } {
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const [asker] = useState(() => createAsker(setAnswer));

  useEffect(() => () => asker.cancel(), [asker]);

  return { answer, ask: asker.ask, cancel: asker.cancel };
}
