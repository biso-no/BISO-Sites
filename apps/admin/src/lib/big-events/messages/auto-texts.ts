import type {
  AutoMessageKind,
  AutoText,
  AutoTexts,
} from "@repo/shared/big-events/messages/auto";
import { findPlaceholders } from "@repo/shared/big-events/messages/text";
import { z } from "zod";

/**
 * The organizers' own texts for automatic messages (`big_events.auto_texts`,
 * ruling R18), checked before they are saved. Pure module, safe in the
 * browser.
 */

type Locale = "no" | "en";

/** Column sizes: a message's title and text, and `big_events.auto_texts`. */
const TITLE_MAX = 200;
const BODY_MAX = 2000;
const AUTO_TEXTS_MAX = 4000;

const AUTO_KINDS: readonly AutoMessageKind[] = [
  "bus_assigned",
  "bus_moved",
  "bus_none",
  "departure_reminder",
];
const LOCALES: readonly Locale[] = ["no", "en"];

const autoTextSchema = z.object({
  body: z.string().optional(),
  title: z.string().optional(),
});
const languagesSchema = z.object({
  en: autoTextSchema.optional(),
  no: autoTextSchema.optional(),
});

/** `{ [kind]: { no?: { title, body }, en?: { title, body } } }`; anything else is dropped. */
export const autoTextsSchema = z.object({
  bus_assigned: languagesSchema.optional(),
  bus_moved: languagesSchema.optional(),
  bus_none: languagesSchema.optional(),
  departure_reminder: languagesSchema.optional(),
} satisfies Record<AutoMessageKind, unknown>);

export type AutoTextsInput = z.infer<typeof autoTextsSchema>;
export type AutoTextsError = "too_long" | "unknown_placeholder";

/** The texts written, trimmed; empty ones are left out (they mean the default). */
function compact(input: AutoTextsInput): AutoTexts {
  const texts: AutoTexts = {};
  for (const kind of AUTO_KINDS) {
    const languages: Partial<Record<Locale, Partial<AutoText>>> = {};
    for (const locale of LOCALES) {
      const title = input[kind]?.[locale]?.title?.trim();
      const body = input[kind]?.[locale]?.body?.trim();
      if (title || body) {
        languages[locale] = {
          ...(title ? { title } : {}),
          ...(body ? { body } : {}),
        };
      }
    }
    if (Object.keys(languages).length > 0) {
      texts[kind] = languages;
    }
  }
  return texts;
}

function textsOf(texts: AutoTexts): Partial<AutoText>[] {
  return AUTO_KINDS.flatMap((kind) =>
    LOCALES.flatMap((locale) => texts[kind]?.[locale] ?? [])
  );
}

/**
 * The `auto_texts` value to save: null when nothing is written. Refuses a
 * title or text longer than a message holds, all texts together longer
 * than the column, and an unknown placeholder (Task 7 carry).
 */
export function autoTextsColumn(
  input: AutoTextsInput | null
): { ok: true; value: string | null } | { error: AutoTextsError; ok: false } {
  const texts = compact(input ?? {});
  const written = textsOf(texts);
  if (written.length === 0) {
    return { ok: true, value: null };
  }
  const tooLong = written.some(
    (text) =>
      (text.title?.length ?? 0) > TITLE_MAX ||
      (text.body?.length ?? 0) > BODY_MAX
  );
  if (tooLong) {
    return { error: "too_long", ok: false };
  }
  const unknown = written.some((text) =>
    [text.title ?? "", text.body ?? ""].some(
      (value) => findPlaceholders(value).unknown.length > 0
    )
  );
  if (unknown) {
    return { error: "unknown_placeholder", ok: false };
  }
  const value = JSON.stringify(texts);
  if (value.length > AUTO_TEXTS_MAX) {
    return { error: "too_long", ok: false };
  }
  return { ok: true, value };
}
