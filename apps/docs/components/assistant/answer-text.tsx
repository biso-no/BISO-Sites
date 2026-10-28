import { Callout } from "components/callout";
import Link from "next/link";
import type { ReactNode } from "react";
import { sitePath } from "./site-path";
import type { AnswerSource } from "./use-ask";

type Block =
  | { kind: "paragraph"; key: number; lines: string[] }
  | { kind: "warning"; key: number; lines: string[] }
  | {
      kind: "list";
      key: number;
      start: number;
      items: { key: number; lines: string[] }[];
    };

const LINE_BREAK = /\r\n?/g;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const WATCH_OUT = /^\s*(?:\*\*)?watch out:(?:\*\*)?\s*/i;
const INDENTED = /^\s/;
/** `**bold**`, or a citation: `[2]` or a group like `[1, 3]`. */
const INLINE = /\*\*(.+?)\*\*|\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g;
const CITATION = /\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g;
const LIST_SEPARATOR = /\s*,\s*/;

const CITE_TEXT = "whitespace-nowrap font-bold text-[0.85em] text-fd-primary";
const CITE_LINK =
  "rounded-sm no-underline hover:underline focus-visible:outline-2 focus-visible:outline-fd-ring focus-visible:outline-offset-2";

/**
 * Splits the answer into paragraphs, numbered lists and warnings. A numbered
 * list carries on across blank lines; an indented line continues the item
 * above it.
 */
function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let afterBlank = true;

  for (const [index, line] of text
    .replace(LINE_BREAK, "\n")
    .split("\n")
    .entries()) {
    if (!line.trim()) {
      afterBlank = true;
      continue;
    }
    const last = blocks.at(-1);
    const numbered = NUMBERED.exec(line);
    const warning = WATCH_OUT.exec(line);

    if (numbered) {
      const item = { key: index, lines: [numbered[2] ?? ""] };
      if (last?.kind === "list") {
        last.items.push(item);
      } else {
        blocks.push({
          kind: "list",
          key: index,
          start: Number(numbered[1]),
          items: [item],
        });
      }
    } else if (warning) {
      const rest = line.slice(warning[0].length);
      if (last?.kind === "warning") {
        last.lines.push(rest);
      } else {
        blocks.push({ kind: "warning", key: index, lines: [rest] });
      }
    } else if (last?.kind === "list" && !afterBlank && INDENTED.test(line)) {
      last.items.at(-1)?.lines.push(line.trim());
    } else if (last?.kind === "paragraph" && !afterBlank) {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "paragraph", key: index, lines: [line] });
    }
    afterBlank = false;
  }
  return blocks;
}

/** The numbers in `1, 3` or `2`, each once, in order. */
function citationNumbers(group: string): number[] {
  return [...new Set(group.split(LIST_SEPARATOR).map(Number))];
}

function citationLink(
  source: AnswerSource,
  label: string,
  className: string,
  key: string
): ReactNode {
  return (
    <Link
      className={className}
      href={source.url}
      key={key}
      title={source.title}
    >
      {label}
      <span className="sr-only">{` ${source.title}`}</span>
    </Link>
  );
}

/** Joins neighbouring strings, so the markup has no empty text separators. */
function joinText(parts: ReactNode[]): ReactNode[] {
  const joined: ReactNode[] = [];
  for (const part of parts) {
    const last = joined.at(-1);
    if (typeof part === "string" && typeof last === "string") {
      joined[joined.length - 1] = last + part;
    } else {
      joined.push(part);
    }
  }
  return joined;
}

/**
 * `[2]` becomes one link. A group like `[1, 3]` stays one bracket with its
 * commas, and each number links to its source. A number with no source stays
 * text.
 */
function citations(
  group: string,
  byNumber: Map<number, AnswerSource>,
  key: string
): ReactNode {
  const numbers = citationNumbers(group);
  const linked = numbers.filter((n) => byNumber.has(n));
  if (linked.length === 0) {
    return `[${group}]`;
  }
  const only = numbers.length === 1 ? byNumber.get(linked[0] ?? 0) : undefined;
  if (only) {
    return citationLink(only, `[${only.n}]`, `${CITE_TEXT} ${CITE_LINK}`, key);
  }
  const parts: ReactNode[] = ["["];
  for (const [i, n] of numbers.entries()) {
    if (i > 0) {
      parts.push(", ");
    }
    const source = byNumber.get(n);
    parts.push(
      source
        ? citationLink(source, String(n), CITE_LINK, `${key}-${n}`)
        : String(n)
    );
  }
  parts.push("]");
  return (
    <span className={CITE_TEXT} key={key}>
      {joinText(parts)}
    </span>
  );
}

/** Only sources whose url is a docs page path. */
function safeSources(sources: AnswerSource[]): AnswerSource[] {
  return sources.flatMap((source) => {
    const url = sitePath(source.url);
    return url === null ? [] : [{ ...source, url }];
  });
}

/** Bold and citations become elements; every other character stays text. */
function inline(
  text: string,
  byNumber: Map<number, AnswerSource>,
  key: string
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let at = 0;
  for (const match of text.matchAll(INLINE)) {
    const start = match.index;
    if (start > at) {
      nodes.push(text.slice(at, start));
    }
    const [, bold, group] = match;
    if (bold !== undefined) {
      nodes.push(
        <strong className="font-bold" key={`${key}-b${start}`}>
          {inline(bold, byNumber, `${key}-b${start}`)}
        </strong>
      );
    } else if (group !== undefined) {
      // A no-break space keeps the citation on the line of the word before it.
      const before = nodes.at(-1);
      if (typeof before === "string" && before.endsWith(" ")) {
        nodes[nodes.length - 1] = `${before.slice(0, -1)} `;
      }
      nodes.push(citations(group, byNumber, `${key}-c${start}`));
    }
    at = start + match[0].length;
  }
  if (at < text.length) {
    nodes.push(text.slice(at));
  }
  return nodes;
}

function lines(
  list: string[],
  byNumber: Map<number, AnswerSource>,
  key: string
): ReactNode[] {
  return list.flatMap((line, i) => [
    i > 0 ? <br key={`${key}-br${i}`} /> : null,
    ...inline(line, byNumber, `${key}-${i}`),
  ]);
}

/**
 * The sources an answer cites as `[n]`, or every source when it cites none.
 * A source whose url isn't a docs page path is dropped.
 */
export function citedSources(
  text: string,
  sources: AnswerSource[]
): AnswerSource[] {
  const cited = new Set<number>();
  for (const match of text.matchAll(CITATION)) {
    for (const n of citationNumbers(match[1] ?? "")) {
      cited.add(n);
    }
  }
  const safe = safeSources(sources);
  const used = safe.filter((source) => cited.has(source.n));
  return used.length > 0 ? used : safe;
}

/**
 * The assistant's answer as React elements. It is never inserted as HTML:
 * paragraphs, numbered lists, `**bold**`, `[n]` citations and `Watch out:`
 * lines are rendered, and anything else, markup included, stays text.
 */
export function AnswerText({
  text,
  sources,
}: {
  text: string;
  sources: AnswerSource[];
}) {
  // Checked here as well as in `parseSources`, so this component is safe
  // whatever its caller passes.
  const byNumber = new Map(
    safeSources(sources).map((source) => [source.n, source])
  );

  return (
    <div className="text-[15px] leading-relaxed [&>:first-child]:mt-0 [&>:last-child]:mb-0">
      {parseBlocks(text).map((block) => {
        const key = String(block.key);
        if (block.kind === "list") {
          return (
            <ol
              className="my-3 list-decimal space-y-1.5 pl-5 marker:font-bold"
              key={key}
              start={block.start === 1 ? undefined : block.start}
            >
              {block.items.map((item) => (
                <li className="pl-1" key={item.key}>
                  {lines(item.lines, byNumber, `${key}-${item.key}`)}
                </li>
              ))}
            </ol>
          );
        }
        if (block.kind === "warning") {
          return (
            <Callout key={key} type="warn">
              {block.lines.map((line, i) => (
                <p key={`${key}-${i}`}>
                  <strong className="font-bold">Watch out:</strong>{" "}
                  {inline(line, byNumber, `${key}-${i}`)}
                </p>
              ))}
            </Callout>
          );
        }
        return (
          <p className="my-3" key={key}>
            {lines(block.lines, byNumber, key)}
          </p>
        );
      })}
    </div>
  );
}
