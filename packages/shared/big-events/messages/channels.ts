import "server-only";

/**
 * The channel steps of the send engine (send.ts): pushes as `announcements`
 * rows (plan M1) and emails and SMS as delivery-queue rows (plan M2). Each
 * step skips people an earlier run already covered (plan M8).
 */

import { ID, type Messaging, Query, type TablesDB } from "@repo/api";
import type { Announcements } from "@repo/api/types/appwrite";
import { mapWithConcurrency } from "../../utils/concurrency";
import { dispatchAnnouncement } from "../../utils/push-dispatch";
import { BIG_EVENT_TABLES, type DeliveryChannel } from "../tables";
import type {
  BigEventDeliveryRow,
  BigEventMessageRecipientRow,
  BigEventMessageRow,
  BigEventRow,
} from "../types";
import { bigEventDeepLink } from "./deep-link";
import { listAll } from "./load";
import type { LocalizedVars, PlannedRecipient } from "./plan";
import { renderText, textToHtml } from "./text";

/** A person to send to, their recipient row and the details their copies use. */
export interface SendTarget {
  planned: PlannedRecipient;
  row: BigEventMessageRecipientRow;
  vars: LocalizedVars;
}

export interface ChannelContext {
  db: TablesDB;
  event: BigEventRow;
  message: BigEventMessageRow;
  messaging: Messaging;
  now: () => Date;
}

interface PushTexts {
  body_en: string;
  body_no: string;
  title_en: string;
  title_no: string;
}

interface NewDelivery {
  address: string;
  channel: DeliveryChannel;
  ids: string[];
}

type Locale = "no" | "en";

const DB = "app";
const RECIPIENTS = BIG_EVENT_TABLES.messageRecipients;
const DELIVERIES = BIG_EVENT_TABLES.deliveries;
const ANNOUNCEMENTS = "announcements";
const PUSH_CHUNK = 100;
/** Pushes in flight at once (ruling R38). */
const PUSH_CONCURRENCY = 4;
const WRITE_CONCURRENCY = 8;
/** Size of `announcements.title_*`. */
const TITLE_MAX = 200;
const BOTH_LOCALES: Locale[] = ["no", "en"];

function clipTitle(text: string): string {
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text;
}

// ── Pushes ────────────────────────────────────────────────────────────────────

/** The push in both languages, without the first name (spec D6). */
function pushTexts(
  message: BigEventMessageRow,
  vars: LocalizedVars
): PushTexts {
  const render = (text: string | null, locale: Locale) =>
    renderText(text ?? "", vars[locale], { forPush: true });
  const titleNo = clipTitle(render(message.title_no, "no"));
  const titleEn = clipTitle(render(message.title_en, "en"));
  return {
    body_en: render(message.body_en, "en"),
    body_no: render(message.body_no, "no"),
    title_en: titleEn || titleNo,
    title_no: titleNo,
  };
}

async function pushChunk(
  ctx: ChannelContext,
  texts: PushTexts,
  chunk: SendTarget[]
): Promise<void> {
  const { db, message } = ctx;
  const userIds = [
    ...new Set(
      chunk.flatMap((target) =>
        target.planned.userId ? [target.planned.userId] : []
      )
    ),
  ];
  const at = ctx.now().toISOString();
  const announcement = await db.createRow(DB, ANNOUNCEMENTS, ID.unique(), {
    ...texts,
    // The app shows the body as HTML: keep the organizer's line breaks.
    body_en: textToHtml(texts.body_en),
    body_no: textToHtml(texts.body_no),
    audience_type: "users",
    audience_value: JSON.stringify(userIds),
    category: message.important ? "urgent" : "trip",
    deep_link: bigEventDeepLink(ctx.event.slug),
    push: true,
    sent_at: at,
    source: message.kind === "manual" ? "manual" : "auto",
    status: "sent",
  });
  try {
    await dispatchAnnouncement(announcement as unknown as Announcements, {
      db,
      messaging: ctx.messaging,
    });
  } catch (error) {
    // Not left as `sent` in anyone's records; the retry makes a new one.
    try {
      await db.updateRow(DB, ANNOUNCEMENTS, announcement.$id, {
        status: "failed",
      });
    } catch {
      // The send fails either way; the push error is the one to report.
    }
    throw error;
  }
  await mapWithConcurrency(chunk, WRITE_CONCURRENCY, (target) =>
    db.updateRow(DB, RECIPIENTS, target.row.$id, { pushed_at: at })
  );
  for (const target of chunk) {
    target.row.pushed_at = at;
  }
}

/**
 * Pushes everyone due one and not pushed yet: one announcement per group of
 * people whose push is identical in both languages (Stage 3 ruling R6), at
 * most 100 people each, four pushes at a time (ruling R38). `onPushed` runs
 * after each push with its head count.
 */
export async function sendPushes(
  ctx: ChannelContext,
  targets: SendTarget[],
  onPushed: (people: number) => Promise<void>
): Promise<void> {
  const groups = new Map<string, { targets: SendTarget[]; texts: PushTexts }>();
  for (const target of targets) {
    if (!target.planned.push || target.row.pushed_at) {
      continue;
    }
    const texts = pushTexts(ctx.message, target.vars);
    const key = JSON.stringify([
      texts.title_no,
      texts.body_no,
      texts.title_en,
      texts.body_en,
    ]);
    const group = groups.get(key);
    if (group) {
      group.targets.push(target);
    } else {
      groups.set(key, { targets: [target], texts });
    }
  }
  const chunks: { targets: SendTarget[]; texts: PushTexts }[] = [];
  for (const group of groups.values()) {
    for (let start = 0; start < group.targets.length; start += PUSH_CHUNK) {
      chunks.push({
        targets: group.targets.slice(start, start + PUSH_CHUNK),
        texts: group.texts,
      });
    }
  }
  await mapWithConcurrency(chunks, PUSH_CONCURRENCY, async (chunk) => {
    await pushChunk(ctx, chunk.texts, chunk.targets);
    await onPushed(chunk.targets.length);
  });
}

// ── Emails and SMS ────────────────────────────────────────────────────────────

/**
 * Same address, same languages, same text with every detail filled in:
 * those copies share one email (Stage 3 ruling R10).
 */
function emailKey(message: BigEventMessageRow, target: SendTarget): string {
  const { emailTo, locale } = target.planned;
  const parts = [emailTo?.trim().toLowerCase() ?? "", locale ?? "both"];
  for (const lang of locale ? [locale] : BOTH_LOCALES) {
    parts.push(
      renderText(message[`title_${lang}`] ?? "", target.vars[lang]),
      renderText(message[`body_${lang}`] ?? "", target.vars[lang])
    );
  }
  return JSON.stringify(parts);
}

/** The deliveries to queue: emails grouped per ruling R10, one SMS per person. */
function newDeliveries(
  message: BigEventMessageRow,
  targets: SendTarget[],
  covered: Record<"email" | "sms", Set<string>>,
  sms: boolean
): NewDelivery[] {
  const emails = new Map<string, NewDelivery>();
  const deliveries: NewDelivery[] = [];
  for (const target of targets) {
    const { emailTo, participantId, smsTo } = target.planned;
    // Someone already pushed is emailed too only when it's Important.
    const email =
      target.planned.email && (message.important || !target.row.pushed_at);
    if (email && emailTo && !covered.email.has(participantId)) {
      const key = emailKey(message, target);
      const shared = emails.get(key);
      if (shared) {
        shared.ids.push(participantId);
      } else {
        const delivery: NewDelivery = {
          address: emailTo,
          channel: "email",
          ids: [participantId],
        };
        emails.set(key, delivery);
        deliveries.push(delivery);
      }
    }
    if (sms && smsTo && !covered.sms.has(participantId)) {
      deliveries.push({ address: smsTo, channel: "sms", ids: [participantId] });
    }
  }
  return deliveries;
}

/**
 * Queues the emails and SMS (when `sms`) nobody queued yet, as `pending`
 * `message` rows for the delivery queue. Returns how many of `targets` have
 * an email and an SMS queued, from this run or an earlier one.
 */
export async function queueDeliveries(
  ctx: Pick<ChannelContext, "db" | "message">,
  targets: SendTarget[],
  sms: boolean
): Promise<{ email: number; sms: number }> {
  const { db, message } = ctx;
  const existing = await listAll<BigEventDeliveryRow>(db, DELIVERIES, [
    Query.equal("message_id", message.$id),
  ]);
  const covered = { email: new Set<string>(), sms: new Set<string>() };
  for (const delivery of existing) {
    if (delivery.channel === "email" || delivery.channel === "sms") {
      for (const id of delivery.participant_ids ?? []) {
        covered[delivery.channel].add(id);
      }
    }
  }

  const deliveries = newDeliveries(message, targets, covered, sms);
  await mapWithConcurrency(deliveries, WRITE_CONCURRENCY, async (delivery) => {
    await db.createRow(DB, DELIVERIES, ID.unique(), {
      attempts: 0,
      big_event_id: message.big_event_id,
      channel: delivery.channel,
      kind: "message",
      message_id: message.$id,
      participant_ids: delivery.ids,
      scheduled_for: null,
      status: "pending",
      to_address: delivery.address,
    });
    for (const id of delivery.ids) {
      covered[delivery.channel === "sms" ? "sms" : "email"].add(id);
    }
  });

  const has = (channel: "email" | "sms") =>
    targets.filter((target) =>
      covered[channel].has(target.planned.participantId)
    ).length;
  return { email: has("email"), sms: has("sms") };
}
