import type { Audience } from "@repo/shared/big-events/messages/audience";
import {
  findPlaceholders,
  MESSAGE_BODY_MAX,
  MESSAGE_TITLE_MAX,
  type Placeholder,
} from "@repo/shared/big-events/messages/text";
import { GROUP_LEGS, type GroupLeg } from "@repo/shared/big-events/tables";
import { z } from "zod";

/**
 * A big event message as the organizer writes it, and the checks before it
 * is previewed or sent (plan M4–M8). Pure module, safe in the browser.
 */

/** Expected refusals of the message actions (plan M11). */
export type MessageError =
  | "already_sent"
  | "in_the_past"
  | "missing_translation"
  | "no_access"
  | "no_people"
  | "not_found"
  | "unknown_placeholder";

export interface MessageRefusal<E extends string = MessageError> {
  error: E;
  ok: false;
}

export type MessageResult<T extends object = Record<never, never>> =
  | ({ ok: true } & T)
  | MessageRefusal;

export function refuse<E extends string>(error: E): MessageRefusal<E> {
  return { error, ok: false };
}

/** The two languages every message is written in (plan M6). */
export type MessageLocale = "no" | "en";

/**
 * Most groups or chosen people one message names: 100 ids of up to 36
 * characters fit the 4000-character `audience` column.
 */
export const AUDIENCE_IDS_MAX = 100;
/**
 * A minute around now: a scheduled time this far behind still counts as now
 * (ruling R23), and a message due within it can't be cancelled any more
 * (ruling R28).
 */
export const SCHEDULE_GRACE_MS = 60_000;

/** An Appwrite row id. */
export const idSchema = z.string().min(1).max(36);
const idsSchema = z.array(idSchema).min(1).max(AUDIENCE_IDS_MAX);

const localizedSchema = (max: number) =>
  z.object({
    en: z.string().max(max).optional(),
    no: z.string().max(max).optional(),
  });

export const audienceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("everyone") }),
  z.object({ campusIds: idsSchema, type: z.literal("campus") }),
  z.object({
    groupIds: idsSchema,
    leg: z.enum(GROUP_LEGS).optional(),
    type: z.literal("groups"),
  }),
  z.object({ participantIds: idsSchema, type: z.literal("people") }),
]);

export const messageDraftSchema = z.object({
  alsoSms: z.boolean(),
  audience: audienceSchema,
  body: localizedSchema(MESSAGE_BODY_MAX),
  important: z.boolean(),
  /** For audiences that aren't buses: whose bus details the text names. */
  leg: z.enum(GROUP_LEGS).optional(),
  title: localizedSchema(MESSAGE_TITLE_MAX),
});

export type MessageDraft = z.infer<typeof messageDraftSchema>;

export const sendWhenSchema = z.union([
  z.object({ at: z.literal("now") }),
  z.object({ at: z.iso.datetime({ offset: true }) }),
]);

export type SendWhen = { at: "now" } | { at: string };

/** A message's title and text in both languages, trimmed. */
export interface MessageTexts {
  body: Record<MessageLocale, string>;
  title: Record<MessageLocale, string>;
}

const LOCALES: readonly MessageLocale[] = ["no", "en"];

/**
 * The draft's texts, trimmed. Refuses an unknown `{…}` (plan M4); with
 * `complete`, also a title or text missing in either language (plan M6:
 * both languages are needed to send).
 */
export function checkDraftTexts(
  draft: Pick<MessageDraft, "body" | "title">,
  options: { complete: boolean }
):
  | { ok: true; texts: MessageTexts }
  | MessageRefusal<"missing_translation" | "unknown_placeholder"> {
  const texts: MessageTexts = {
    body: { en: draft.body.en?.trim() ?? "", no: draft.body.no?.trim() ?? "" },
    title: {
      en: draft.title.en?.trim() ?? "",
      no: draft.title.no?.trim() ?? "",
    },
  };
  const all = LOCALES.flatMap((locale) => [
    texts.title[locale],
    texts.body[locale],
  ]);
  if (all.some((text) => findPlaceholders(text).unknown.length > 0)) {
    return refuse("unknown_placeholder");
  }
  if (options.complete && all.some((text) => text === "")) {
    return refuse("missing_translation");
  }
  return { ok: true, texts };
}

/** Every placeholder the texts use, in either language. */
export function usedPlaceholders(texts: MessageTexts): Set<Placeholder> {
  const used = new Set<Placeholder>();
  for (const locale of LOCALES) {
    for (const text of [texts.title[locale], texts.body[locale]]) {
      for (const key of findPlaceholders(text).known) {
        used.add(key);
      }
    }
  }
  return used;
}

/**
 * The leg a message is for, stored on the message and its audience alike
 * (ruling R13): a groups audience keeps its own leg, else the draft's; one
 * that names a bus without either is for the way out (ruling R8). Other
 * audiences keep the draft's leg, which only picks the bus details.
 */
export function messageLeg(
  audience: Audience,
  draftLeg: GroupLeg | undefined,
  busIds: ReadonlySet<string>
): { audience: Audience; leg: GroupLeg | null } {
  if (audience.type !== "groups") {
    return { audience, leg: draftLeg ?? null };
  }
  const namesBus = audience.groupIds.some((id) => busIds.has(id));
  const leg = audience.leg ?? draftLeg ?? (namesBus ? "out" : undefined);
  if (leg === undefined) {
    return { audience, leg: null };
  }
  return { audience: { ...audience, leg }, leg };
}

/**
 * When the message goes out: now, or a time that is not in the past (a
 * minute of grace, ruling R23).
 */
export function sendTime(
  when: SendWhen,
  now: Date
):
  | { at: string; immediate: boolean; ok: true }
  | MessageRefusal<"in_the_past"> {
  if (when.at === "now") {
    return { at: now.toISOString(), immediate: true, ok: true };
  }
  const at = Date.parse(when.at);
  if (Number.isNaN(at) || at < now.getTime() - SCHEDULE_GRACE_MS) {
    return refuse("in_the_past");
  }
  return { at: new Date(at).toISOString(), immediate: false, ok: true };
}
