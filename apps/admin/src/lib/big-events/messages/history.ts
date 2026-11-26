import type {
  GroupLeg,
  MessageKind,
  MessageStatus,
} from "@repo/shared/big-events/tables";
import type { BigEventMessageRow } from "@repo/shared/big-events/types";

/**
 * The Messages tab's history (plan M10): every message the caller may see,
 * automatic ones merged per cron run and kind (ruling R21), with totals and
 * what the caller may do with each. Text and totals only, never who the
 * people are (ruling R22). Pure module.
 */

type Locale = "no" | "en";

/** Who a message was for, without naming anyone. */
export type AudienceSummary =
  | { type: "everyone" }
  | { campusIds: string[]; type: "campus" }
  | {
      groupNames: string[];
      /** Groups the caller may not see, or that no longer exist. */
      hiddenGroups: number;
      leg: GroupLeg | null;
      type: "groups";
    }
  | { count: number; type: "people" };

export interface MessageCounts {
  email: number;
  /** People whose email or SMS could not be delivered (ruling R15). */
  failed: number;
  people: number;
  push: number;
  sms: number;
}

export interface MessageHistoryItem {
  audience: AudienceSummary | null;
  automatic: boolean;
  body: Record<Locale, string>;
  /** A manual message that hasn't started; cancelling deletes it. */
  canCancel: boolean;
  canUnpin: boolean;
  counts: MessageCounts;
  /** The first message's id: a stable key. */
  id: string;
  important: boolean;
  kind: MessageKind;
  leg: GroupLeg | null;
  /** Every message in the item (several for one automatic run). */
  messageIds: string[];
  pinned: boolean;
  /**
   * Failed messages here the caller may try again. A retry reaches only
   * people not reached yet, with the details stored on the first attempt.
   */
  retryIds: string[];
  scheduledAt: string | null;
  /** When it went out; set only once sent (ruling R11). */
  sentAt: string | null;
  status: MessageStatus;
  title: Record<Locale, string>;
}

export interface HistoryInput {
  canManage: (message: BigEventMessageRow) => boolean;
  /** Group names by id, and whether the caller may see each. */
  groups: ReadonlyMap<string, { name: string; visible: boolean }>;
  /** The messages the caller may see. */
  messages: BigEventMessageRow[];
}

/** A missing status is the column default (Stage 3 carry). */
export function messageStatus(
  message: Pick<BigEventMessageRow, "status">
): MessageStatus {
  return message.status ?? "scheduled";
}

const timeOf = (message: BigEventMessageRow): number =>
  Date.parse(message.scheduled_at ?? message.$createdAt);

const STATUS_ORDER: readonly MessageStatus[] = [
  "failed",
  "sending",
  "scheduled",
  "sent",
];

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((id) => typeof id === "string")
    ? value
    : null;
}

function summarize(
  raw: string | null,
  groups: HistoryInput["groups"]
): AudienceSummary | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw ?? "null");
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const campusIds = stringList(parsed.campusIds);
  const groupIds = stringList(parsed.groupIds);
  const participantIds = stringList(parsed.participantIds);
  switch (parsed.type) {
    case "everyone":
      return { type: "everyone" };
    case "campus":
      return campusIds ? { campusIds, type: "campus" } : null;
    case "groups": {
      if (!groupIds) {
        return null;
      }
      const names = groupIds.flatMap((id) => {
        const group = groups.get(id);
        return group?.visible ? [group.name] : [];
      });
      const leg =
        parsed.leg === "out" || parsed.leg === "home" ? parsed.leg : null;
      return {
        groupNames: names,
        hiddenGroups: groupIds.length - names.length,
        leg,
        type: "groups",
      };
    }
    case "people":
      return participantIds
        ? { count: participantIds.length, type: "people" }
        : null;
    default:
      return null;
  }
}

/** Two summaries of one automatic run; different kinds keep the first. */
function mergeAudience(
  a: AudienceSummary | null,
  b: AudienceSummary | null
): AudienceSummary | null {
  if (a?.type === "people" && b?.type === "people") {
    return { count: a.count + b.count, type: "people" };
  }
  if (a?.type === "campus" && b?.type === "campus") {
    return {
      campusIds: [...new Set([...a.campusIds, ...b.campusIds])],
      type: "campus",
    };
  }
  if (a?.type === "groups" && b?.type === "groups") {
    return {
      groupNames: [...new Set([...a.groupNames, ...b.groupNames])],
      hiddenGroups: a.hiddenGroups + b.hiddenGroups,
      leg: a.leg === b.leg ? a.leg : null,
      type: "groups",
    };
  }
  return a;
}

function toItem(
  parts: BigEventMessageRow[],
  input: HistoryInput
): MessageHistoryItem {
  const [first] = parts as [BigEventMessageRow, ...BigEventMessageRow[]];
  const statuses = new Set(parts.map(messageStatus));
  const status = STATUS_ORDER.find((each) => statuses.has(each)) ?? "sent";
  const sum = (pick: (message: BigEventMessageRow) => number | null): number =>
    parts.reduce((total, message) => total + (pick(message) ?? 0), 0);
  const sentTimes = parts.flatMap((message) =>
    message.sent_at ? [message.sent_at] : []
  );
  const legs = new Set(parts.map((message) => message.leg));
  const manageable = parts.filter(input.canManage);
  return {
    audience: parts
      .slice(1)
      .reduce(
        (summary, message) =>
          mergeAudience(summary, summarize(message.audience, input.groups)),
        summarize(first.audience, input.groups)
      ),
    automatic: first.kind !== "manual",
    body: { en: first.body_en ?? "", no: first.body_no ?? "" },
    canCancel:
      first.kind === "manual" &&
      status === "scheduled" &&
      manageable.length === parts.length,
    canUnpin: manageable.some((message) => message.pinned === true),
    counts: {
      email: sum((message) => message.email_count),
      failed: sum((message) => message.failed_count),
      people: sum((message) => message.recipients),
      push: sum((message) => message.push_count),
      sms: sum((message) => message.sms_count),
    },
    id: first.$id,
    important: parts.some((message) => message.important === true),
    kind: first.kind,
    leg: legs.size === 1 ? first.leg : null,
    messageIds: parts.map((message) => message.$id),
    pinned: parts.some((message) => message.pinned === true),
    retryIds: manageable
      .filter((message) => messageStatus(message) === "failed")
      .map((message) => message.$id),
    scheduledAt: first.scheduled_at,
    sentAt:
      status === "sent" && sentTimes.length > 0
        ? sentTimes.reduce((latest, at) =>
            Date.parse(at) > Date.parse(latest) ? at : latest
          )
        : null,
    status,
    title: { en: first.title_en ?? "", no: first.title_no ?? "" },
  };
}

/** Newest first; automatic messages of one cron run and kind become one item. */
export function messageHistory(input: HistoryInput): MessageHistoryItem[] {
  const ordered = [...input.messages].sort((a, b) => timeOf(b) - timeOf(a));
  const items = new Map<string, BigEventMessageRow[]>();
  for (const message of ordered) {
    const key =
      message.kind === "manual"
        ? `manual:${message.$id}`
        : `${message.kind}:${timeOf(message)}`;
    const parts = items.get(key);
    if (parts) {
      parts.push(message);
    } else {
      items.set(key, [message]);
    }
  }
  return [...items.values()].map((parts) => toItem(parts, input));
}
