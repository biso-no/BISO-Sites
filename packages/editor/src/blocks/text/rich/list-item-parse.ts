import { keptOlStart } from "@/lib/rich-allowlist";

export const LIST_TAGS: ReadonlySet<string> = new Set(["OL", "UL"]);

/**
 * The list styles that number their items, in a `data-list-style-type` and
 * in the value. The serializer writes these as `<ol>`; every other style is
 * a bullet.
 */
export const ORDERED_LIST_STYLES: ReadonlySet<string> = new Set([
  "decimal",
  "lower-alpha",
  "upper-alpha",
  "lower-roman",
  "upper-roman",
]);

type ListStyle = "disc" | "decimal";

/**
 * The Plate indent-list block an `<li>` becomes. Replaces the stock `LI`
 * parse of `BaseListPlugin`, which reads only `data-indent`/`aria-level` and
 * so flattens plain nested `<ul>`/`<ol>` markup to one level and forgets
 * `<ol start>`.
 */
export function parseListItem(li: HTMLElement): {
  indent: number;
  /** The `start` of the `<ol>` this item opens; Plate turns it into `listStart`. */
  listRestartPolite?: number;
  listStyleType: ListStyle;
  type: "p";
} {
  const start = restartOf(li);
  return {
    indent: levelOf(li),
    listStyleType: styleOf(li),
    type: "p",
    ...(start === undefined ? {} : { listRestartPolite: start }),
  };
}

function statedLevel(value: string | null): number | undefined {
  const level = Number.parseInt(value ?? "", 10);
  return Number.isNaN(level) ? undefined : level;
}

function levelOf(li: HTMLElement): number {
  const level =
    statedLevel(li.getAttribute("aria-level")) ??
    statedLevel(li.getAttribute("data-indent")) ??
    listAncestorCount(li);
  return Math.max(1, level);
}

function listAncestorCount(li: HTMLElement): number {
  let count = 0;
  for (let el = li.parentElement; el; el = el.parentElement) {
    if (LIST_TAGS.has(el.tagName)) {
      count += 1;
    }
  }
  return count;
}

function styleOf(li: HTMLElement): ListStyle {
  const stated = li.getAttribute("data-list-style-type");
  if (stated !== null) {
    return ORDERED_LIST_STYLES.has(stated) ? "decimal" : "disc";
  }
  return li.closest("ul, ol")?.tagName === "OL" ? "decimal" : "disc";
}

/** The `<ol start>` worth keeping, on the list's first item only. */
function restartOf(li: HTMLElement): number | undefined {
  const list = li.parentElement;
  if (list?.tagName !== "OL") {
    return;
  }
  const firstItem = Array.from(list.children).find(
    (child) => child.tagName === "LI"
  );
  if (firstItem !== li) {
    return;
  }
  const start = keptOlStart(list.getAttribute("start") ?? "");
  return start === null ? undefined : Number(start);
}
