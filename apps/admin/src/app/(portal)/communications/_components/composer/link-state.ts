import type { PrefillSnapshot } from "./composer-state";

/** What the linked card shows for the content the announcement points at. */
export interface LinkedDisplay {
  id: string;
  image: string | null;
  /** "{title} ({date})", shown as where a tap on the push lands. */
  label?: string;
  /** "{dateLabel} · {campus}", empty when only the title is known. */
  meta: string;
  title: string;
}

export interface LinkState {
  display: LinkedDisplay | null;
  /** What the last prefill wrote, so re-linking only replaces untouched text. */
  snapshot: PrefillSnapshot | null;
  /** The one-line note shown after linking. */
  tip: string | null;
  /** The tip is a quiet note (prefill failed), not a success message. */
  tipQuiet?: boolean;
}

export function buildLinkState(): LinkState {
  return { display: null, snapshot: null, tip: null };
}

/** The title and image the row was saved with for its linked content. */
export interface StoredLink {
  image: string | null;
  title: string;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The linked content as the stored row's `items` snapshot describes it, so a
 * reopened draft can still show its card when the content can't be loaded.
 */
export function storedLinkFrom(
  items: string | null | undefined,
  contentId: string | null | undefined
): StoredLink | null {
  if (!(items && contentId)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(items);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }
  const item = parsed.find(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && entry.id === contentId
  );
  const title = asText(item?.title_en) || asText(item?.title_no);
  if (!(item && title)) {
    return null;
  }
  return { image: asText(item.image) || null, title };
}
