import { createHash } from "node:crypto";
import { resolveModel } from "@repo/ai/models";
import { createTextStreamResponse, type LanguageModel, streamText } from "ai";
import { checkLimits } from "lib/assistant/limits";
import { buildUserMessage, SYSTEM_PROMPT } from "lib/assistant/prompt";
import { retrieveSources } from "lib/assistant/retrieve";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_QUESTION_CHARS = 500;
const MAX_OUTPUT_TOKENS = 1200;
const NO_ANSWER_NOTE = "I couldn't answer that. Try the docs search instead.";
const HASH_OR_QUERY = /[#?].*$/;
const TRAILING_SLASH = /(.)\/$/;

interface AskDeps {
  enabled: boolean;
  model: LanguageModel;
  retrieve: typeof retrieveSources;
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

function visitorKey(req: Request): string {
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return createHash("sha256")
    .update(first || "unknown")
    .digest("hex");
}

function isEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function pageExists(path: string): Promise<boolean> {
  const { source } = await import("lib/source");
  const wanted = path.replace(HASH_OR_QUERY, "").replace(TRAILING_SLASH, "$1");
  return source
    .getPages()
    .some((p) => p.url.replace(TRAILING_SLASH, "$1") === wanted);
}

async function parse(
  req: Request
): Promise<{ question: string; pageUrl?: string } | null> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const { question, pageUrl } = body as Record<string, unknown>;
  if (typeof question !== "string") {
    return null;
  }
  const trimmed = question.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_QUESTION_CHARS) {
    return null;
  }
  if (pageUrl === undefined) {
    return { question: trimmed };
  }
  if (
    typeof pageUrl !== "string" ||
    !pageUrl.startsWith("/") ||
    !(await pageExists(pageUrl))
  ) {
    return null;
  }
  return { question: trimmed, pageUrl };
}

interface Part {
  finishReason?: string;
  text?: string;
  type: string;
}

const STOP_TYPES = new Set(["error", "abort"]);

function endsClean(part: Part, wrote: boolean): boolean {
  return (
    part.type === "finish" && wrote && part.finishReason !== "content-filter"
  );
}

// Turns the model's part stream into plain text. A refusal or content filter
// arrives as a finish reason, not an exception, so it ends with a short note.
async function* answerText(
  iterator: AsyncIterator<Part>,
  first: Part | undefined
): AsyncGenerator<string> {
  let wrote = false;
  try {
    let part = first;
    while (part) {
      if (part.type === "text-delta" && part.text) {
        wrote = true;
        yield part.text;
      } else if (STOP_TYPES.has(part.type)) {
        break;
      } else if (part.type === "finish") {
        if (endsClean(part, wrote)) {
          return;
        }
        break;
      }
      part = (await iterator.next()).value;
    }
  } catch {
    // Fall through to the note. The error itself is never shown or logged.
  }
  yield `${wrote ? "\n\n" : ""}${NO_ANSWER_NOTE}`;
}

function toStream(source: AsyncGenerator<string>): ReadableStream<string> {
  return new ReadableStream<string>({
    async pull(controller) {
      const next = await source.next();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(next.value);
    },
    async cancel() {
      await source.return(undefined);
    },
  });
}

export async function handleAsk(
  req: Request,
  deps: AskDeps
): Promise<Response> {
  if (!deps.enabled) {
    return json({ error: "disabled" }, 503);
  }
  const input = await parse(req);
  if (!input) {
    return json({ error: "invalid" }, 400);
  }
  if (checkLimits(visitorKey(req)) !== "ok") {
    return json({ error: "rate_limited" }, 429);
  }

  try {
    const sources = await deps.retrieve(input.question, input.pageUrl);
    const result = streamText({
      model: deps.model,
      instructions: SYSTEM_PROMPT,
      prompt: buildUserMessage(input.question, sources),
      reasoning: "low",
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      // The default handler logs the error, which can carry the request.
      onError: () => undefined,
    });

    const iterator = result.stream[
      Symbol.asyncIterator
    ]() as AsyncIterator<Part>;
    // Read up to the first text or the end, so a failed call is a clean 502.
    let first: Part | undefined;
    while (true) {
      const next = await iterator.next();
      first = next.value;
      if (!first || first.type === "text-delta" || first.type === "finish") {
        break;
      }
      if (first.type === "error") {
        return json({ error: "failed" }, 502);
      }
    }

    const header = encodeURIComponent(
      JSON.stringify(sources.map(({ n, title, url }) => ({ n, title, url })))
    );
    return createTextStreamResponse({
      stream: toStream(answerText(iterator, first)),
      headers: { ...NO_STORE, "X-Docs-Sources": header },
    });
  } catch {
    return json({ error: "failed" }, 502);
  }
}

export function GET(): Response {
  return json({ enabled: isEnabled() }, 200);
}

export function POST(req: Request): Promise<Response> {
  return handleAsk(req, {
    enabled: isEnabled(),
    model: resolveModel(process.env.DOCS_ASSISTANT_MODEL ?? "balanced"),
    retrieve: retrieveSources,
  });
}
