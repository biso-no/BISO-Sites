import {
  findPlaceholders,
  type Placeholder,
} from "@repo/shared/big-events/messages/text";
import type { GroupKind, GroupLeg } from "@repo/shared/big-events/tables";
import {
  AUDIENCE_IDS_MAX,
  type MessageDraft,
  type MessageLocale,
} from "@/lib/big-events/messages/draft";

/**
 * What the Messages tab's composer holds while the organizer writes, and
 * the draft the message actions take. Pure module.
 */

export type AudienceType = "everyone" | "campus" | "groups" | "people";
export type ComposerStep = "message" | "who" | "check";

export const COMPOSER_STEPS: readonly ComposerStep[] = [
  "message",
  "who",
  "check",
];

export interface ComposerTexts {
  body: Record<MessageLocale, string>;
  title: Record<MessageLocale, string>;
}

export type TextField = keyof ComposerTexts;

/** Each card keeps its own choice, so switching cards loses nothing. */
export interface ComposerState {
  alsoSms: boolean;
  audienceType: AudienceType | null;
  campusIds: string[];
  groupIds: string[];
  important: boolean;
  /** Whose bus details and which bus riders (ruling R8): the way out by default. */
  leg: GroupLeg;
  participantIds: string[];
  texts: ComposerTexts;
}

/** A bus, room or group the organizer may send to. */
export interface MessageGroupOption {
  campusId: string | null;
  id: string;
  kind: GroupKind;
  name: string;
}

/** A participant the organizer may see, by name only. */
export interface MessagePersonOption {
  campusId: string | null;
  id: string;
  name: string;
}

export function emptyComposer(): ComposerState {
  return {
    alsoSms: false,
    audienceType: null,
    campusIds: [],
    groupIds: [],
    important: false,
    leg: "out",
    participantIds: [],
    texts: { body: { en: "", no: "" }, title: { en: "", no: "" } },
  };
}

export function otherLocale(locale: MessageLocale): MessageLocale {
  return locale === "no" ? "en" : "no";
}

/** A title and a text, both written, in this language. */
export function hasText(texts: ComposerTexts, locale: MessageLocale): boolean {
  return texts.title[locale].trim() !== "" && texts.body[locale].trim() !== "";
}

/** Both languages written: a message needs both to be sent (plan M6). */
export function textsComplete(texts: ComposerTexts): boolean {
  return hasText(texts, "no") && hasText(texts, "en");
}

const BUS_DETAILS: ReadonlySet<Placeholder> = new Set([
  "bus",
  "bus_contact",
  "departure",
  "meeting_point",
]);

/** The text names a bus detail in either language. */
export function usesBusDetails(texts: ComposerTexts): boolean {
  return [texts.title.no, texts.title.en, texts.body.no, texts.body.en].some(
    (text) => findPlaceholders(text).known.some((key) => BUS_DETAILS.has(key))
  );
}

/** A groups audience that names at least one bus. */
export function choosesBus(
  state: ComposerState,
  busIds: ReadonlySet<string>
): boolean {
  return (
    state.audienceType === "groups" &&
    state.groupIds.some((id) => busIds.has(id))
  );
}

/**
 * The way out / way home choice: shown while Travel is on, for a message to
 * a bus (it picks the riders, ruling R8) or one whose text names bus details
 * (it picks whose details).
 */
export function showsLeg(
  state: ComposerState,
  busIds: ReadonlySet<string>,
  travel: boolean
): boolean {
  return travel && (choosesBus(state, busIds) || usesBusDetails(state.texts));
}

function audienceOf(
  state: ComposerState,
  busIds: ReadonlySet<string>
): MessageDraft["audience"] | null {
  switch (state.audienceType) {
    case "everyone":
      return { type: "everyone" };
    case "campus":
      return state.campusIds.length > 0
        ? { campusIds: state.campusIds, type: "campus" }
        : null;
    case "groups":
      if (state.groupIds.length === 0) {
        return null;
      }
      return choosesBus(state, busIds)
        ? { groupIds: state.groupIds, leg: state.leg, type: "groups" }
        : { groupIds: state.groupIds, type: "groups" };
    case "people":
      return state.participantIds.length > 0
        ? { participantIds: state.participantIds, type: "people" }
        : null;
    default:
      return null;
  }
}

/** The draft the message actions take, or null until someone is chosen. */
export function draftOf(
  state: ComposerState,
  options: { busIds: ReadonlySet<string>; travel: boolean }
): MessageDraft | null {
  const audience = audienceOf(state, options.busIds);
  if (!audience) {
    return null;
  }
  return {
    alsoSms: state.alsoSms,
    audience,
    body: state.texts.body,
    important: state.important,
    ...(showsLeg(state, options.busIds, options.travel)
      ? { leg: state.leg }
      : {}),
    title: state.texts.title,
  };
}

/** Adds one id, at most once, never past what one message can name. */
export function addCapped(ids: string[], id: string): string[] {
  if (ids.includes(id) || ids.length >= AUDIENCE_IDS_MAX) {
    return ids;
  }
  return [...ids, id];
}

/** Takes an id out, or adds it within the cap. */
export function toggleCapped(ids: string[], id: string): string[] {
  return ids.includes(id)
    ? ids.filter((each) => each !== id)
    : addCapped(ids, id);
}
