import {
  MEMBERSHIP_TEXT_BODY_MAX,
  MEMBERSHIP_TEXT_MAX_ITEMS,
  MEMBERSHIP_TEXT_TITLE_MAX,
} from "@repo/shared/utils/membership-texts";
import type {
  MembershipSpotData,
  MembershipSpotInputItem,
} from "../../../_actions/membership-texts";

/** One line being edited. `key` keeps its identity while it is dragged. */
export interface DraftItem {
  body_en: string;
  body_nb: string;
  key: string;
  title_en: string;
  title_nb: string;
}

export type ItemError = "bodyTooLong" | "titleMissing" | "titleTooLong";
export type CardError = "noItems" | "tooMany";

export interface DraftErrors {
  card: CardError | null;
  items: Record<string, ItemError>;
}

let counter = 0;

export function newKey(): string {
  counter += 1;
  return `line-${counter}`;
}

export function emptyItem(): DraftItem {
  return {
    body_en: "",
    body_nb: "",
    key: newKey(),
    title_en: "",
    title_nb: "",
  };
}

export function draftFromSpot(data: MembershipSpotData): DraftItem[] {
  return data.items.map((item) => ({ ...item, key: newKey() }));
}

/** What the server is sent: the lines in display order, nothing else. */
export function toInput(
  items: DraftItem[],
  hasBody: boolean
): MembershipSpotInputItem[] {
  return items.map((item) => ({
    ...(hasBody ? { body_en: item.body_en, body_nb: item.body_nb } : {}),
    title_en: item.title_en,
    title_nb: item.title_nb,
  }));
}

/** A comparable snapshot of the editable text, ignoring line keys. */
export function snapshot(items: DraftItem[], hasBody: boolean): string {
  return JSON.stringify(toInput(items, hasBody));
}

/** Mirrors the server's rules so the editor rarely sees a server error. */
export function validateDraft(
  items: DraftItem[],
  hasBody: boolean
): DraftErrors {
  const errors: DraftErrors = { card: null, items: {} };
  if (items.length === 0) {
    errors.card = "noItems";
  } else if (items.length > MEMBERSHIP_TEXT_MAX_ITEMS) {
    errors.card = "tooMany";
  }
  for (const item of items) {
    const title = item.title_nb.trim();
    if (!title) {
      errors.items[item.key] = "titleMissing";
    } else if (
      title.length > MEMBERSHIP_TEXT_TITLE_MAX ||
      item.title_en.trim().length > MEMBERSHIP_TEXT_TITLE_MAX
    ) {
      errors.items[item.key] = "titleTooLong";
    } else if (
      hasBody &&
      (item.body_nb.trim().length > MEMBERSHIP_TEXT_BODY_MAX ||
        item.body_en.trim().length > MEMBERSHIP_TEXT_BODY_MAX)
    ) {
      errors.items[item.key] = "bodyTooLong";
    }
  }
  return errors;
}

export function hasErrors(errors: DraftErrors): boolean {
  return errors.card !== null || Object.keys(errors.items).length > 0;
}
