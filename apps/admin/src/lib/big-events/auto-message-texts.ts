import type { AutoMessageKind } from "@repo/shared/big-events/messages/auto";
import type { AutoTextsInput } from "./messages/auto-texts";
import type { MessageLocale } from "./messages/draft";

/**
 * The settings form's automatic-message texts (plan M9, ruling R18): every
 * kind in both languages as the organizer sees it, the defaults filled in.
 * Only what differs from a default is saved, so "Reset to default" just puts
 * the default back. Pure module, safe in the browser.
 */

export const AUTO_MESSAGE_KINDS: readonly AutoMessageKind[] = [
  "bus_assigned",
  "bus_moved",
  "bus_none",
  "departure_reminder",
];

const LOCALES: readonly MessageLocale[] = ["no", "en"];
const FIELDS = ["title", "body"] as const;

export interface AutoTextPair {
  body: string;
  title: string;
}

export type AutoTextsForm = Record<
  AutoMessageKind,
  Record<MessageLocale, AutoTextPair>
>;

/** One form value, each kind's texts from `pick` (the defaults, or the texts in use). */
export function autoTextsForm(
  pick: (kind: AutoMessageKind) => Record<MessageLocale, AutoTextPair>
): AutoTextsForm {
  return {
    bus_assigned: pick("bus_assigned"),
    bus_moved: pick("bus_moved"),
    bus_none: pick("bus_none"),
    departure_reminder: pick("departure_reminder"),
  };
}

/**
 * What the save sends as `auto_texts`: the fields that differ from their
 * default, trimmed; an empty field means the default. Null when nothing
 * differs (the column goes back to the defaults).
 */
export function autoTextsPayload(
  texts: AutoTextsForm,
  defaults: AutoTextsForm
): AutoTextsInput | null {
  const payload: AutoTextsInput = {};
  for (const kind of AUTO_MESSAGE_KINDS) {
    for (const locale of LOCALES) {
      for (const field of FIELDS) {
        const value = texts[kind][locale][field].trim();
        if (value === "" || value === defaults[kind][locale][field].trim()) {
          continue;
        }
        const languages = payload[kind] ?? {};
        languages[locale] = { ...languages[locale], [field]: value };
        payload[kind] = languages;
      }
    }
  }
  return Object.keys(payload).length > 0 ? payload : null;
}

/** Whether a kind's texts are the defaults (an empty field counts as one). */
export function isDefaultKind(
  texts: AutoTextsForm,
  defaults: AutoTextsForm,
  kind: AutoMessageKind
): boolean {
  return LOCALES.every((locale) =>
    FIELDS.every((field) => {
      const value = texts[kind][locale][field].trim();
      return value === "" || value === defaults[kind][locale][field].trim();
    })
  );
}

/** One kind back to its default texts; the others stay as they are. */
export function resetKind(
  texts: AutoTextsForm,
  defaults: AutoTextsForm,
  kind: AutoMessageKind
): AutoTextsForm {
  return {
    ...texts,
    [kind]: {
      en: { ...defaults[kind].en },
      no: { ...defaults[kind].no },
    },
  };
}
