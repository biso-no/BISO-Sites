/**
 * The email for one big event message row: the message title as heading, the
 * body with each person's details filled in, one language for a linked
 * person and Norwegian then English for an unlinked one (plan M6).
 * `buildMessageEmail` is pure; `prepareMessageEmail` reads rows.
 */

import { type Models, Query } from "@repo/api";
import type { DeliveryDb } from "../delivery-queue";
import { type EmailSection, renderEmail } from "../email-layout";
import { BIG_EVENT_TABLES } from "../tables";
import type {
  BigEventDeliveryRow,
  BigEventMessageRecipientRow,
  BigEventMessageRow,
  BigEventParticipantRow,
  BigEventRow,
} from "../types";
import { type LocalizedVars, parseStoredVars } from "./plan";
import { renderText } from "./text";

type Lang = "no" | "en";

export interface MessageEmailInput {
  bodyEn: string | null;
  bodyNo: string | null;
  /** The big event's name, used in the footer. */
  eventNameEn: string | null;
  eventNameNo: string;
  /** One language for a linked person; null gives Norwegian, then English. */
  locale: Lang | null;
  /**
   * The people this email is for, named at the top; null or empty for one
   * person alone at their address (ruling R10).
   */
  names: string[] | null;
  titleEn: string | null;
  titleNo: string | null;
  /** Placeholder values; empty when the stored copy can't be read. */
  vars: LocalizedVars;
}

export interface MessageEmail {
  html: string;
  subject: string;
  text: string;
}

const BLANK_LINE = /\n[ \t]*\n/;
const SUBJECT_JOINER = " · ";

const TO_LABEL: Record<Lang, string> = { en: "For: ", no: "Til: " };

function footer(lang: Lang, eventName: string): string {
  return lang === "no"
    ? `Du får denne fordi du er med på ${eventName} i BISO.`
    : `You get this because you're on ${eventName} in BISO.`;
}

function paragraphs(body: string): string[] {
  return body
    .split(BLANK_LINE)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildMessageEmail(input: MessageEmailInput): MessageEmail {
  const title = (lang: Lang) =>
    renderText(
      (lang === "no" ? input.titleNo : input.titleEn) ?? "",
      input.vars[lang]
    ).trim();
  const body = (lang: Lang) =>
    renderText(
      (lang === "no" ? input.bodyNo : input.bodyEn) ?? "",
      input.vars[lang]
    );
  const langs: Lang[] = input.locale ? [input.locale] : ["no", "en"];
  const nameNo = input.eventNameNo.trim();
  const nameEn = input.eventNameEn?.trim() || nameNo;
  const names = (input.names ?? []).filter(Boolean);

  let preheader = "";
  const sections: EmailSection[] = langs.map((lang) => {
    const text = paragraphs(body(lang));
    preheader ||= text[0] ?? "";
    return {
      heading: title(lang),
      lang,
      paragraphs: names.length
        ? [`${TO_LABEL[lang]}${names.join(", ")}`, ...text]
        : text,
    };
  });

  const { html, text } = renderEmail({
    footer: langs
      .map((lang) => footer(lang, lang === "no" ? nameNo : nameEn))
      .join("\n"),
    preheader: preheader || title(langs[0] ?? "no"),
    sections,
  });

  const subject = [...new Set(langs.map(title))].join(SUBJECT_JOINER);
  return { html, subject, text };
}

// ── Loading ───────────────────────────────────────────────────────────────────

const DB = "app";
const USER_TABLE = "user";
/** Appwrite refuses an `equal` query with more values than this. */
const MAX_QUERY_VALUES = 100;

export interface PrepareMessageEmailInput {
  db: DeliveryDb;
  /** The row's big event; null when it no longer exists. */
  event: BigEventRow | null;
  loadPeople: (ids: string[]) => Promise<BigEventParticipantRow[]>;
  row: BigEventDeliveryRow;
}

function fullName(person: BigEventParticipantRow): string {
  return [person.first_name, person.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

async function loadRecipients(
  db: DeliveryDb,
  messageId: string,
  ids: string[]
): Promise<BigEventMessageRecipientRow[]> {
  const found: BigEventMessageRecipientRow[] = [];
  for (let start = 0; start < ids.length; start += MAX_QUERY_VALUES) {
    const chunk = ids.slice(start, start + MAX_QUERY_VALUES);
    const { rows } = await db.listRows<BigEventMessageRecipientRow>(
      DB,
      BIG_EVENT_TABLES.messageRecipients,
      [
        Query.equal("message_id", messageId),
        Query.equal("participant_id", chunk),
        Query.limit(chunk.length),
      ]
    );
    found.push(...rows);
  }
  return found;
}

/**
 * The email for a claimed message row, or `{ skip }` with the reason when the
 * message, the big event or every recipient is gone. The language comes from
 * the row's first person (the row's people share a language set).
 */
export async function prepareMessageEmail(
  input: PrepareMessageEmailInput
): Promise<MessageEmail | { skip: string }> {
  const { db, event, loadPeople, row } = input;
  const ids = row.participant_ids ?? [];
  const { rows: messages } = await db.listRows<BigEventMessageRow>(
    DB,
    BIG_EVENT_TABLES.messages,
    [Query.equal("$id", row.message_id ?? ""), Query.limit(1)]
  );
  const message = messages[0];
  if (!message) {
    return { skip: "The message no longer exists." };
  }
  if (!event) {
    return { skip: "The big event no longer exists." };
  }

  const stored = await loadRecipients(db, message.$id, ids);
  const first = ids
    .map((id) => stored.find((recipient) => recipient.participant_id === id))
    .find((recipient) => recipient !== undefined);
  if (!first) {
    return { skip: "The recipient no longer exists." };
  }

  // A linked person reads their account's language; others get both (M6).
  let locale: Lang | null = null;
  if (first.user_id) {
    const { rows } = await db.listRows<Models.Row & { locale?: string }>(
      DB,
      USER_TABLE,
      [Query.equal("$id", first.user_id), Query.limit(1)]
    );
    locale = rows[0]?.locale === "no" ? "no" : "en";
  }

  // Name the people when an email covers several, or when this message sends
  // more than one email to the same address (ruling R10).
  const { total } = await db.listRows<BigEventDeliveryRow>(
    DB,
    BIG_EVENT_TABLES.deliveries,
    [
      Query.equal("message_id", message.$id),
      Query.equal("channel", "email"),
      Query.equal("to_address", row.to_address ?? ""),
      Query.limit(2),
    ]
  );
  const names =
    ids.length > 1 || total > 1 ? (await loadPeople(ids)).map(fullName) : [];

  return buildMessageEmail({
    bodyEn: message.body_en,
    bodyNo: message.body_no,
    eventNameEn: event.name_en,
    eventNameNo: event.name_no,
    locale,
    names,
    titleEn: message.title_en,
    titleNo: message.title_no,
    vars: parseStoredVars(first.vars) ?? { en: {}, no: {} },
  });
}
