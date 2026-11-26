"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  type ReachSummary,
  reachSummary,
} from "@repo/shared/big-events/messages/plan";
import {
  type SendCounts,
  sendMessage,
} from "@repo/shared/big-events/messages/send";
import {
  BIG_EVENT_TABLES,
  type MessageStatus,
} from "@repo/shared/big-events/tables";
import type {
  BigEventGroupRow,
  BigEventMessageRow,
} from "@repo/shared/big-events/types";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import {
  canManageGroup,
  canManageMessage,
  canSeeMessage,
  messageCampusIds,
} from "@/lib/big-events/access";
import {
  type AdminDb,
  revalidateBigEvent,
} from "@/lib/big-events/action-helpers";
import { kickDeliveries } from "@/lib/big-events/kick-deliveries";
import { listAllRows } from "@/lib/big-events/list-rows";
import {
  loadAudienceData,
  planRecipients,
  reachedPeople,
} from "@/lib/big-events/messages/audience.server";
import {
  checkDraftTexts,
  MESSAGE_BODY_MAX,
  MESSAGE_TITLE_MAX,
  type MessageDraft,
  type MessageRefusal,
  type MessageResult,
  messageDraftSchema,
  messageLeg,
  refuse,
  type SendWhen,
  sendTime,
  sendWhenSchema,
  usedPlaceholders,
} from "@/lib/big-events/messages/draft";
import {
  type MessageHistoryItem,
  messageHistory,
  messageStatus,
} from "@/lib/big-events/messages/history";
import {
  type MessageSample,
  messageSamples,
  messageWarnings,
  warningTexts,
} from "@/lib/big-events/messages/preview";
import {
  isSmsEnabled,
  messageSendDeps,
} from "@/lib/big-events/messages/send-deps.server";
import { translateContentFields } from "@/lib/content-translation.server";
import { logAuditEvent } from "./audit-log";
import { getBigEvent } from "./big-events";

/**
 * The Messages tab (plans M6–M11): preview, translate, send or schedule,
 * cancel, try again, unpin and the history. Anyone with access to the big
 * event may send, campus admins only to their campus (spec D2). Expected
 * refusals come back as `{ ok: false, error }`; anything else throws.
 */

const DATABASE_ID = "app";
const MESSAGES = BIG_EVENT_TABLES.messages;
const GROUPS = BIG_EVENT_TABLES.groups;

const idSchema = z.string().min(1).max(36);
const translateSchema = z.object({
  body: z.string().max(MESSAGE_BODY_MAX),
  from: z.enum(["no", "en"]),
  title: z.string().max(MESSAGE_TITLE_MAX),
});

type Ctx = Awaited<ReturnType<typeof requireAuth>>;

/** The message by id, when the caller may cancel, retry or unpin it. */
async function manageableMessage(
  messageId: string
): Promise<
  { db: AdminDb; message: BigEventMessageRow; ok: true } | MessageRefusal
> {
  const id = idSchema.parse(messageId);
  const { db } = await createAdminClient();
  const { rows } = await db.listRows<BigEventMessageRow>(
    DATABASE_ID,
    MESSAGES,
    [Query.equal("$id", [id]), Query.limit(1)]
  );
  const message = rows[0];
  if (!message) {
    return refuse("not_found");
  }
  const found = await getBigEvent(message.big_event_id);
  if (!(found && canManageMessage(found.access, message))) {
    return refuse("no_access");
  }
  return { db, message, ok: true };
}

/**
 * Sends a message right away (ruling R14: a send that outlives the action
 * is finished by the messages cron), then asks the api to start on the
 * emails it queued.
 */
async function sendInline(
  messageId: string
): Promise<
  | { counts: SendCounts | null; ok: true; status: MessageStatus }
  | MessageRefusal<"not_found">
> {
  try {
    const result = await sendMessage(await messageSendDeps(), messageId);
    if (result.ok) {
      return { counts: result.counts, ok: true, status: "sent" };
    }
    if (result.error === "not_found") {
      return refuse("not_found");
    }
    // `busy`: another run (the cron) is sending it right now.
    return {
      counts: null,
      ok: true,
      status: result.error === "already_sent" ? "sent" : "sending",
    };
  } finally {
    kickDeliveries();
  }
}

/** Ids and counts only (no text, no names) in the audit log. */
function audit(
  ctx: Ctx,
  action: string,
  bigEventId: string,
  payload: Record<string, unknown>
): Promise<void> {
  return logAuditEvent(ctx, action, {
    payload,
    resourceId: bigEventId,
    resourceType: "big_event",
  });
}

/**
 * Who the message reaches and how (the reach box), one rendered sample per
 * distinct text (at most five) and the details the text needs but some
 * buses or people lack. Works with one language written.
 */
export async function previewMessage(
  bigEventId: string,
  draft: MessageDraft
): Promise<
  MessageResult<{
    reach: ReachSummary;
    samples: MessageSample[];
    warnings: string[];
  }>
> {
  const input = messageDraftSchema.parse(draft);
  const found = await getBigEvent(bigEventId);
  if (!found) {
    return refuse("no_access");
  }
  const checked = checkDraftTexts(input, { complete: false });
  if (!checked.ok) {
    return checked;
  }
  const { db } = await createAdminClient();
  const data = await loadAudienceData(db, bigEventId, found.access);
  const { audience, leg } = messageLeg(
    input.audience,
    input.leg,
    new Set(data.buses.keys())
  );
  const people = reachedPeople(data, audience, found.access);
  const detailsLeg = leg ?? "out";
  const sms = input.alsoSms && (await isSmsEnabled());
  const [planned, t, locale] = await Promise.all([
    planRecipients(db, data, people, {
      important: input.important,
      leg: detailsLeg,
      sms,
    }),
    getTranslations("adminPortal.bigEvents.messages"),
    getLocale(),
  ]);
  const warnings = messageWarnings({
    buses: data.buses,
    leg: detailsLeg,
    members: data.members,
    people,
    roomIds: new Set(data.rooms.keys()),
    uses: usedPlaceholders(checked.texts),
  });
  return {
    ok: true,
    reach: reachSummary(planned),
    samples: messageSamples({
      labels: {
        everyone: t("everyone"),
        noBus: t("noBus"),
        noRoom: t("noRoom"),
      },
      locale: locale === "no" ? "no" : "en",
      people: planned,
      texts: checked.texts,
    }),
    warnings: warningTexts(warnings, detailsLeg, t),
  };
}

/**
 * The organizer's title and text in the other language (plan M6). Only the
 * message as written goes to the AI, placeholders and all, never anyone's
 * details. A translation longer than a message holds is cut.
 */
export async function translateMessage(
  bigEventId: string,
  input: { body: string; from: "no" | "en"; title: string }
): Promise<MessageResult<{ body: string; title: string }>> {
  const data = translateSchema.parse(input);
  const found = await getBigEvent(bigEventId);
  if (!found) {
    return refuse("no_access");
  }
  const translated = await translateContentFields({
    contentType: "big_event_message",
    fields: [
      { format: "plain", key: "title", value: data.title },
      { format: "plain", key: "body", value: data.body },
    ],
    sourceLocale: data.from,
    targetLocale: data.from === "no" ? "en" : "no",
  });
  return {
    body: (translated.body ?? "").slice(0, MESSAGE_BODY_MAX),
    ok: true,
    title: (translated.title ?? "").slice(0, MESSAGE_TITLE_MAX),
  };
}

/**
 * Writes the message in the caller's scope (`campus_ids`, ruling R22) with
 * its leg (ruling R13), then sends it now or leaves it for the cron at the
 * chosen time. Important messages are pinned (plan M10).
 */
export async function sendBigEventMessage(
  bigEventId: string,
  draft: MessageDraft,
  when: SendWhen
): Promise<
  MessageResult<{ messageId: string; people: number; status: MessageStatus }>
> {
  const ctx = await requireAuth();
  const input = messageDraftSchema.parse(draft);
  const timing = sendWhenSchema.parse(when);
  const found = await getBigEvent(bigEventId);
  if (!found) {
    return refuse("no_access");
  }
  const checked = checkDraftTexts(input, { complete: true });
  if (!checked.ok) {
    return checked;
  }
  const time = sendTime(timing, new Date());
  if (!time.ok) {
    return time;
  }
  const { db } = await createAdminClient();
  const data = await loadAudienceData(db, bigEventId, found.access);
  const { audience, leg } = messageLeg(
    input.audience,
    input.leg,
    new Set(data.buses.keys())
  );
  const people = reachedPeople(data, audience, found.access).length;
  if (people === 0) {
    return refuse("no_people");
  }
  const { texts } = checked;
  const campusIds = messageCampusIds(found.access);
  const row = await db.createRow<BigEventMessageRow>(
    DATABASE_ID,
    MESSAGES,
    ID.unique(),
    {
      also_sms: input.alsoSms,
      audience: JSON.stringify(audience),
      big_event_id: bigEventId,
      body_en: texts.body.en,
      body_no: texts.body.no,
      campus_ids: campusIds,
      created_by: ctx.userId,
      email_count: 0,
      failed_count: 0,
      important: input.important,
      kind: "manual",
      leg,
      pinned: input.important,
      push_count: 0,
      recipients: 0,
      scheduled_at: time.at,
      sent_at: null,
      sms_count: 0,
      status: "scheduled",
      title_en: texts.title.en,
      title_no: texts.title.no,
    }
  );
  const details = {
    also_sms: input.alsoSms,
    audience: audience.type,
    campus_ids: campusIds,
    important: input.important,
    leg,
    message_id: row.$id,
    people,
    scheduled_at: time.at,
  };
  if (!time.immediate) {
    await audit(ctx, "big_event.message.schedule", bigEventId, details);
    revalidateBigEvent(bigEventId);
    return { messageId: row.$id, ok: true, people, status: "scheduled" };
  }
  let sent: Awaited<ReturnType<typeof sendInline>> | null = null;
  try {
    sent = await sendInline(row.$id);
  } finally {
    await audit(ctx, "big_event.message.send", bigEventId, {
      ...details,
      counts: sent?.ok ? sent.counts : null,
      status: sent?.ok ? sent.status : "failed",
    });
    revalidateBigEvent(bigEventId);
  }
  if (!sent.ok) {
    return sent;
  }
  return {
    messageId: row.$id,
    ok: true,
    people: sent.counts?.recipients ?? people,
    status: sent.status,
  };
}

/** Deletes a manual message that hasn't started (plan M8). */
export async function cancelMessage(messageId: string): Promise<MessageResult> {
  const ctx = await requireAuth();
  const found = await manageableMessage(messageId);
  if (!found.ok) {
    return found;
  }
  const { db, message } = found;
  // Automatic messages go to people already marked as told (ruling R17).
  if (message.kind !== "manual") {
    return refuse("no_access");
  }
  if (messageStatus(message) !== "scheduled") {
    return refuse("already_sent");
  }
  await db.deleteRow(DATABASE_ID, MESSAGES, message.$id);
  await audit(ctx, "big_event.message.cancel", message.big_event_id, {
    message_id: message.$id,
  });
  revalidateBigEvent(message.big_event_id);
  return { ok: true };
}

/**
 * "Try again" on a failed message: back to scheduled for now, then sent
 * right away (ruling R12). People already reached aren't sent it twice;
 * the rest get the details stored on the first attempt (plan M8).
 */
export async function retryMessage(
  messageId: string
): Promise<MessageResult<{ status: MessageStatus }>> {
  const ctx = await requireAuth();
  const found = await manageableMessage(messageId);
  if (!found.ok) {
    return found;
  }
  const { db, message } = found;
  if (messageStatus(message) !== "failed") {
    return refuse("already_sent");
  }
  await db.updateRow<BigEventMessageRow>(DATABASE_ID, MESSAGES, message.$id, {
    scheduled_at: new Date().toISOString(),
    status: "scheduled",
  });
  let sent: Awaited<ReturnType<typeof sendInline>> | null = null;
  try {
    sent = await sendInline(message.$id);
  } finally {
    await audit(ctx, "big_event.message.retry", message.big_event_id, {
      counts: sent?.ok ? sent.counts : null,
      message_id: message.$id,
      status: sent?.ok ? sent.status : "failed",
    });
    revalidateBigEvent(message.big_event_id);
  }
  return sent.ok ? { ok: true, status: sent.status } : sent;
}

/** Takes an Important message off the top (plan M10). */
export async function unpinMessage(messageId: string): Promise<MessageResult> {
  const ctx = await requireAuth();
  const found = await manageableMessage(messageId);
  if (!found.ok) {
    return found;
  }
  const { db, message } = found;
  if (message.pinned) {
    await db.updateRow<BigEventMessageRow>(DATABASE_ID, MESSAGES, message.$id, {
      pinned: false,
    });
    await audit(ctx, "big_event.message.unpin", message.big_event_id, {
      message_id: message.$id,
    });
    revalidateBigEvent(message.big_event_id);
  }
  return { ok: true };
}

/**
 * Every message the caller may see, newest first, automatic ones merged
 * per cron run (ruling R21): full access sees all, campus admins their
 * campuses' and organisation-wide ones (ruling R22).
 */
export async function listMessages(
  bigEventId: string
): Promise<MessageResult<{ items: MessageHistoryItem[] }>> {
  const found = await getBigEvent(bigEventId);
  if (!found) {
    return refuse("no_access");
  }
  const { access } = found;
  const { db } = await createAdminClient();
  const inEvent = Query.equal("big_event_id", [bigEventId]);
  const [rows, groups] = await Promise.all([
    listAllRows<BigEventMessageRow>(db, MESSAGES, [inEvent]),
    listAllRows<BigEventGroupRow>(db, GROUPS, [
      inEvent,
      Query.select(["$id", "campus_id", "name"]),
    ]),
  ]);
  return {
    items: messageHistory({
      canManage: (message) => canManageMessage(access, message),
      groups: new Map(
        groups.map((group) => [
          group.$id,
          { name: group.name, visible: canManageGroup(access, group) },
        ])
      ),
      messages: rows.filter((message) => canSeeMessage(access, message)),
    }),
    ok: true,
  };
}
