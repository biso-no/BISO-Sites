import { keptOlStart } from "@/lib/rich-allowlist";

export const LIST_TAGS: ReadonlySet<string> = new Set(["OL", "UL"]);

const LI_BLOCK_TAGS: ReadonlySet<string> = new Set([
  "BLOCKQUOTE",
  "H2",
  "H3",
  "HR",
  "P",
]);

/**
 * Each `<li>`'s nested lists moved to just after it, in their order, and its
 * block children unwrapped, so every item deserializes as one flat block and
 * keeps its depth as its count of list ancestors. `deserializeHtml` alone
 * does not do this, and the nested item's text would end up inside its
 * parent item. `BaseListPlugin`'s paste transform does, but it inserts each
 * sublist right after the item, so an item's second sublist lands before
 * its first. Stored HTML and pasted HTML both go through this first.
 */
export function flattenListItems(root: HTMLElement): void {
  for (const li of Array.from(root.querySelectorAll("li"))) {
    let anchor: Element = li;
    for (const child of Array.from(li.children)) {
      if (LIST_TAGS.has(child.tagName)) {
        anchor.after(child);
        anchor = child;
      } else if (LI_BLOCK_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
      }
    }
  }
}

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

/**
 * The nesting depth of each item in one run of list items, from their raw
 * levels (Plate's `indent`, or Word's `mso-list` level). A level deeper than
 * the item before goes one depth down, however many levels it skips; a level
 * equal to the one before stays at its depth; a shallower level returns to
 * the depth of the latest item at that level, or one below the latest item
 * shallower than it. So items that skip the same levels stay siblings.
 */
export function effectiveDepths(levels: readonly number[]): number[] {
  const depths: number[] = [];
  for (const [i, level] of levels.entries()) {
    const previous = levels[i - 1];
    if (previous === undefined) {
      depths.push(1);
    } else if (level > previous) {
      depths.push((depths[i - 1] ?? 0) + 1);
    } else if (level === previous) {
      depths.push(depths[i - 1] ?? 1);
    } else {
      depths.push(depthOfShallower(levels, depths, i));
    }
  }
  return depths;
}

/** The depth of item `i`, whose level is below the item before it. */
function depthOfShallower(
  levels: readonly number[],
  depths: readonly number[],
  i: number
): number {
  const level = levels[i] ?? 1;
  for (let j = i - 1; j >= 0; j -= 1) {
    const earlier = levels[j] ?? 1;
    if (earlier === level) {
      return depths[j] ?? 1;
    }
    if (earlier < level) {
      return (depths[j] ?? 0) + 1;
    }
  }
  return 1;
}

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
